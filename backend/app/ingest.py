"""Document ingestion pipeline — dual-mode: local filesystem or Supabase Storage."""

from __future__ import annotations

from datetime import UTC, datetime
import logging
from pathlib import Path
import re
from typing import Any

from fastapi import UploadFile
from langchain_community.document_loaders import Docx2txtLoader, PyPDFLoader, TextLoader
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

from . import storage
from .config import get_settings
from .exceptions import EmptyDocumentError, FileTooLargeError, UnsupportedFileTypeError
from .storage import content_hash_from_bytes, create_document_id

logger = logging.getLogger(__name__)

# ── PII redaction patterns ─────────────────────────────────────────────
_PII_PATTERNS: list[re.Pattern] = [
    # Email addresses
    re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b"),
    # Phone numbers: +1 (555) 123-4567, 555-123-4567, 555.123.4567, etc.
    re.compile(r"\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b"),
    # Credit card numbers: 13-19 digit sequences, optionally with spaces/dashes
    # grouped in common patterns (4-6-4-4, 4-4-4-4, 4-4-4, etc.)
    re.compile(r"\b(?:\d{4}[-\s]?){3,4}\d{4}\b"),
    # US Social Security Numbers: XXX-XX-XXXX
    re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
    # IPv4 addresses (avoid matching version numbers like 1.2.3)
    re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b"),
    # Date of birth patterns: DOB: 01/15/1990, Date of Birth: 15-01-1990
    re.compile(
        r"\b(?:DOB|Date\s+of\s+Birth|Born)\s*:?\s*\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}\b",
        re.IGNORECASE,
    ),
    # API keys / secret keys (AWS AKIA, OpenAI sk-, Stripe sk_live/pk_live)
    re.compile(r"\b(?:AKIA|sk-|sk_live_|pk_live_|sk_test_|pk_test_)[A-Za-z0-9]{10,}\b"),
    # Passport numbers: common 6-9 alphanumeric format with "passport" keyword nearby
    re.compile(r"(?i)\bpassport\s*(?:no|number|#)?\s*:?\s*[A-Z0-9]{6,9}\b"),
    # IBAN: 2 letter country code + 2 check digits + up to 30 alphanumeric
    re.compile(r"\b[A-Z]{2}\d{2}[A-Z0-9]{4,30}\b"),
]


def _redact_pii(text: str) -> str:
    """Replace detected PII with ``[REDACTED]`` in the given text."""
    result = text
    for pattern in _PII_PATTERNS:
        result = pattern.sub("[REDACTED]", result)
    return result


# Allowed file extensions and their MIME types
ALLOWED_EXTENSIONS = {".pdf", ".txt", ".md", ".docx"}
MAGIC_BYTES = {
    ".pdf": b"%PDF",
    ".docx": b"PK",  # ZIP archive (OOXML)
}


def _validate_file_type(file_name: str, file_bytes: bytes) -> str:
    """Validate file extension and magic bytes. Returns the extension."""
    extension = Path(file_name).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise UnsupportedFileTypeError(extension)

    # Magic byte validation for binary formats
    expected_magic = MAGIC_BYTES.get(extension)
    if expected_magic and not file_bytes[: len(expected_magic)].startswith(expected_magic):
        raise ValueError(
            f"File content does not match expected format for {extension}. "
            "Possible file type spoofing detected."
        )

    return extension


def _save_upload_local(file: UploadFile, destination: Path) -> bytes:
    """Save an upload to local filesystem and return its bytes."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    file_bytes = file.file.read()
    destination.write_bytes(file_bytes)
    return file_bytes


def _load_documents(path: Path) -> list[Document]:
    """Parse a document file into LangChain Documents."""
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return PyPDFLoader(str(path)).load()
    if suffix in {".txt", ".md"}:
        return TextLoader(str(path), encoding="utf-8").load()
    if suffix == ".docx":
        return Docx2txtLoader(str(path)).load()

    raise UnsupportedFileTypeError(suffix)


def _enrich_metadata(
    documents: list[Document],
    document_id: str,
    file_name: str,
    owner_id: str = "anonymous",
) -> list[Document]:
    """Attach structured metadata to each document chunk."""
    enriched = []
    for index, doc in enumerate(documents):
        page = doc.metadata.get("page") if isinstance(doc.metadata, dict) else None
        metadata = {
            "document_id": document_id,
            "file_name": file_name,
            "page": page,
            "source_type": Path(file_name).suffix.replace(".", ""),
            "chunk_index": index,
            "owner_id": owner_id,
            "created_at": datetime.now(UTC).isoformat(),
        }
        enriched.append(Document(page_content=doc.page_content, metadata=metadata))

    return enriched


def ingest_files(
    files: list[UploadFile],
    vector_store: Any,
    owner_id: str = "anonymous",
) -> list[dict]:
    """Ingest uploaded files into the vector store and document registry.

    Supports both local and Supabase storage backends transparently.
    """
    settings = get_settings()
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.rag_chunk_size,
        chunk_overlap=settings.rag_chunk_overlap,
    )

    results = []

    for upload in files:
        temp_dir = None
        try:
            if not upload.filename:
                raise ValueError("Uploaded file is missing a filename")

            # Read file bytes for validation and hashing
            file_bytes = upload.file.read()
            upload.file.seek(0)  # Reset for potential re-read

            # Validate file size
            max_bytes = settings.max_upload_size_mb * 1024 * 1024
            if len(file_bytes) > max_bytes:
                raise FileTooLargeError(upload.filename, settings.max_upload_size_mb)

            # Validate file type (extension + magic bytes)
            extension = _validate_file_type(upload.filename, file_bytes)

            # Compute content hash for duplicate detection
            file_hash = content_hash_from_bytes(file_bytes)
            existing = storage.registry.find_by_hash(file_hash, owner_id=owner_id)
            if existing:
                results.append(
                    {
                        "document_id": existing["document_id"],
                        "file_name": existing["file_name"],
                        "pages": existing.get("pages", 0),
                        "chunks": existing.get("chunks", 0),
                        "status": "duplicate",
                        "error": None,
                    }
                )
                continue

            document_id = create_document_id(file_hash)

            # ── Save file based on storage backend ──
            if settings.storage_backend == "supabase":
                from .core.supabase import upload_file_to_storage

                content_type = upload.content_type or "application/octet-stream"
                upload_file_to_storage(file_bytes, upload.filename, content_type)
                # For parsing, write temporarily to a temp location
                import tempfile

                temp_dir = Path(tempfile.mkdtemp())
                tmp = temp_dir / Path(upload.filename).name
                tmp.write_bytes(file_bytes)
                destination = tmp
            else:
                destination = Path(settings.upload_dir) / Path(upload.filename).name
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_bytes(file_bytes)

            # Parse and chunk
            base_docs = _load_documents(destination)
            if not base_docs:
                raise EmptyDocumentError(upload.filename)

            # Redact PII from document text before chunking
            redacted_count = 0
            for doc in base_docs:
                original = doc.page_content or ""
                redacted = _redact_pii(original)
                if redacted != original:
                    redacted_count += 1
                doc.page_content = redacted

            if redacted_count:
                logger.info(
                    "PII redacted in %d/%d pages for %s",
                    redacted_count,
                    len(base_docs),
                    upload.filename,
                )

            chunks = splitter.split_documents(base_docs)
            chunks = _enrich_metadata(chunks, document_id, upload.filename, owner_id)

            # Index in vector store
            if hasattr(vector_store, "add_documents"):
                ids = [f"{document_id}:{i}" for i in range(len(chunks))]
                vector_store.add_documents(chunks, ids=ids)
            else:
                vector_store.add_texts(
                    texts=[c.page_content for c in chunks],
                    metadatas=[c.metadata for c in chunks],
                )

            if hasattr(vector_store, "persist"):
                vector_store.persist()

            # Save metadata to registry
            record = {
                "document_id": document_id,
                "file_name": upload.filename,
                "source_type": extension.replace(".", ""),
                "pages": len(base_docs),
                "chunks": len(chunks),
                "content_hash": file_hash,
                "owner_id": owner_id,
                "created_at": datetime.now(UTC).isoformat(),
            }
            storage.registry.upsert(record)

            results.append(
                {
                    "document_id": document_id,
                    "file_name": upload.filename,
                    "pages": len(base_docs),
                    "chunks": len(chunks),
                    "status": "indexed",
                    "error": None,
                }
            )
        except Exception as exc:
            logger.exception("Failed to ingest file: %s", upload.filename)
            results.append(
                {
                    "document_id": "",
                    "file_name": upload.filename or "unknown",
                    "pages": 0,
                    "chunks": 0,
                    "status": "failed",
                    "error": str(exc),
                }
            )
        finally:
            if temp_dir and temp_dir.exists():
                import shutil

                shutil.rmtree(temp_dir, ignore_errors=True)

    return results
