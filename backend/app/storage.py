"""Document metadata registry — dual-mode: local JSON or Supabase Postgres."""

from __future__ import annotations

from datetime import UTC, datetime
import hashlib
import json
import logging
from pathlib import Path
import threading
from typing import Protocol

from .config import get_settings
from .exceptions import StorageUnavailableError

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Abstract interface
# ---------------------------------------------------------------------------
class DocumentRegistryProtocol(Protocol):
    """Interface that both local and Supabase registries implement."""

    def list_documents(self, owner_id: str | None = None) -> list[dict]: ...
    def count(self, owner_id: str | None = None) -> int: ...
    def find_by_hash(self, content_hash: str, owner_id: str | None = None) -> dict | None: ...
    def get(self, document_id: str) -> dict | None: ...
    def upsert(self, item: dict) -> None: ...
    def delete(self, document_id: str) -> dict | None: ...


# ---------------------------------------------------------------------------
# Local JSON-backed registry (development mode)
# ---------------------------------------------------------------------------
class LocalDocumentRegistry:
    """Thread-safe JSON-backed document metadata store for local development."""

    def __init__(self) -> None:
        settings = get_settings()
        self.path = Path(settings.metadata_db_path)
        self._lock = threading.Lock()
        if not self.path.exists():
            self.path.write_text(json.dumps({"documents": []}, indent=2), encoding="utf-8")
            logger.info("Initialized empty document registry at %s", self.path)

        try:
            self._cached_data = json.loads(self.path.read_text(encoding="utf-8"))
        except Exception:
            self._cached_data = {"documents": []}

    def _read(self) -> dict:
        return self._cached_data

    def _write(self, payload: dict) -> None:
        self._cached_data = payload
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        tmp.replace(self.path)

    def list_documents(self, owner_id: str | None = None) -> list[dict]:
        with self._lock:
            docs = self._read().get("documents", [])
            if owner_id:
                return [d for d in docs if d.get("owner_id") == owner_id]
            return docs

    def count(self, owner_id: str | None = None) -> int:
        return len(self.list_documents(owner_id))

    def find_by_hash(self, content_hash: str, owner_id: str | None = None) -> dict | None:
        with self._lock:
            docs = self._read().get("documents", [])
            if owner_id:
                docs = [d for d in docs if d.get("owner_id") == owner_id]
            for item in docs:
                if item.get("content_hash") == content_hash:
                    return item
            return None

    def get(self, document_id: str) -> dict | None:
        for item in self.list_documents():
            if item.get("document_id") == document_id:
                return item
        return None

    def upsert(self, item: dict) -> None:
        with self._lock:
            payload = self._read()
            docs = payload.get("documents", [])
            docs = [d for d in docs if d.get("document_id") != item.get("document_id")]
            docs.append(item)
            payload["documents"] = docs
            self._write(payload)
            logger.info("Upserted document %s (%s)", item.get("document_id"), item.get("file_name"))

    def delete(self, document_id: str) -> dict | None:
        with self._lock:
            payload = self._read()
            docs = payload.get("documents", [])
            target = None
            remaining = []
            for doc in docs:
                if doc.get("document_id") == document_id:
                    target = doc
                else:
                    remaining.append(doc)

            payload["documents"] = remaining
            self._write(payload)
            if target:
                logger.info("Deleted document %s", document_id)
            else:
                logger.warning("Attempted to delete non-existent document %s", document_id)
            return target


# ---------------------------------------------------------------------------
# Supabase Postgres-backed registry (production mode)
# ---------------------------------------------------------------------------
class SupabaseDocumentRegistry:
    """Document registry backed by Supabase Postgres for production use.

    By default uses the SERVICE KEY client (for backward compat and system ops).
    Call ``with_user_jwt(jwt)`` to get a copy that uses a user-scoped client
    which respects Row-Level Security.
    """

    def __init__(self, user_jwt: str | None = None) -> None:
        self._user_jwt = user_jwt
        if user_jwt:
            from .core.supabase import get_supabase_user_client

            self._client = get_supabase_user_client(user_jwt)
            logger.info("Supabase document registry initialized (user-scoped)")
        else:
            from .core.supabase import get_supabase_client

            self._client = get_supabase_client()
            logger.info("Supabase document registry initialized (service key)")
        self._table = "documents"

    def with_user_jwt(self, jwt: str) -> SupabaseDocumentRegistry:
        """Return a new registry instance scoped to the user's JWT.

        The returned instance uses ``SUPABASE_ANON_KEY`` + the user's JWT
        so all queries go through Row-Level Security automatically.
        """
        return SupabaseDocumentRegistry(user_jwt=jwt)

    def list_documents(self, owner_id: str | None = None) -> list[dict]:
        try:
            query = self._client.table(self._table).select("*").order("created_at", desc=True)
            if owner_id:
                query = query.eq("owner_id", owner_id)
            result = query.execute()
            return result.data or []
        except Exception as e:
            raise StorageUnavailableError(str(e)) from e

    def count(self, owner_id: str | None = None) -> int:
        try:
            query = self._client.table(self._table).select("document_id", count="exact")
            if owner_id:
                query = query.eq("owner_id", owner_id)
            result = query.limit(0).execute()
            return result.count or 0
        except Exception as e:
            raise StorageUnavailableError(str(e)) from e

    def find_by_hash(self, content_hash: str, owner_id: str | None = None) -> dict | None:
        try:
            query = self._client.table(self._table).select("*").eq("content_hash", content_hash)
            if owner_id:
                query = query.eq("owner_id", owner_id)
            result = query.limit(1).execute()
            return result.data[0] if result.data else None
        except Exception as e:
            raise StorageUnavailableError(str(e)) from e

    def get(self, document_id: str) -> dict | None:
        try:
            result = (
                self._client.table(self._table)
                .select("*")
                .eq("document_id", document_id)
                .limit(1)
                .execute()
            )
            return result.data[0] if result.data else None
        except Exception as e:
            raise StorageUnavailableError(str(e)) from e

    def upsert(self, item: dict) -> None:
        try:
            self._client.table(self._table).upsert(item, on_conflict="document_id").execute()
            logger.info("Upserted document %s (%s)", item.get("document_id"), item.get("file_name"))
        except Exception as e:
            raise StorageUnavailableError(str(e)) from e

    def delete(self, document_id: str) -> dict | None:
        try:
            target = self.get(document_id)
            if target:
                self._client.table(self._table).delete().eq("document_id", document_id).execute()
                logger.info("Deleted document %s", document_id)
            else:
                logger.warning("Attempted to delete non-existent document %s", document_id)
            return target
        except Exception as e:
            raise StorageUnavailableError(str(e)) from e


# ---------------------------------------------------------------------------
# Factory — picks the right registry based on config
# ---------------------------------------------------------------------------
def create_registry() -> LocalDocumentRegistry | SupabaseDocumentRegistry:
    settings = get_settings()
    if settings.storage_backend == "supabase":
        return SupabaseDocumentRegistry()
    return LocalDocumentRegistry()


# Module-level singleton (created on first import)
registry = create_registry()


# ---------------------------------------------------------------------------
# Utility functions (unchanged)
# ---------------------------------------------------------------------------
def content_hash_from_path(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        while chunk := fh.read(8192):
            digest.update(chunk)
    return digest.hexdigest()


def content_hash_from_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def create_document_id(content_hash: str) -> str:
    """Create a document ID from a SHA256 content hash.

    Uses the first 32 hex characters (128-bit) for negligible collision risk.
    Previously [:16] (64-bit) — changed to [:32] for safety as the KB grows.
    Note: only affects newly ingested documents; existing IDs are unchanged.
    """
    return content_hash[:32]


def utc_now_iso() -> str:
    return datetime.now(UTC).isoformat()
