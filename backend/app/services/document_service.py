import logging
from pathlib import Path
from typing import Any

from app.config import get_settings
from app.exceptions import DocumentNotFoundError, NoFilesUploadedError
from app.ingest import ingest_files

logger = logging.getLogger(__name__)


class DocumentService:
    @staticmethod
    def upload_documents(files: list, vector_store: Any, owner_id: str):
        if not files:
            raise NoFilesUploadedError()

        logger.info("Upload request from user=%s: %d file(s)", owner_id, len(files))
        results = ingest_files(files, vector_store, owner_id=owner_id)
        logger.info("Upload complete: %s", [r["status"] for r in results])
        return results

    @staticmethod
    def list_documents(reg: Any, owner_id: str):
        return reg.list_documents(owner_id=owner_id)

    @staticmethod
    def delete_document(document_id: str, vector_store: Any, reg: Any, owner_id: str):
        settings = get_settings()
        doc = reg.get(document_id)
        if not doc:
            raise DocumentNotFoundError(document_id)

        # Authorization: only the owner can delete
        if settings.auth_enabled and doc.get("owner_id") and doc["owner_id"] != owner_id:
            raise DocumentNotFoundError(document_id)

        logger.info(
            "Deleting document %s (%s) by user=%s", document_id, doc.get("file_name"), owner_id
        )

        # Delete from vector store — try metadata filter first, then ID-based
        try:
            if settings.vector_store.lower() in {"chroma", "pgvector"}:
                if hasattr(vector_store, "delete"):
                    vector_store.delete(where={"document_id": document_id})
                    if hasattr(vector_store, "persist"):
                        vector_store.persist()
                    logger.info(
                        "Deleted vectors for document %s from %s",
                        document_id,
                        settings.vector_store,
                    )
            elif hasattr(vector_store, "docstore"):
                # FAISS: remove by filtering docstore
                ids_to_remove = [
                    k
                    for k, v in vector_store.docstore._dict.items()
                    if v.metadata.get("document_id") == document_id
                ]
                if ids_to_remove and hasattr(vector_store, "delete"):
                    vector_store.delete(ids_to_remove)
                    logger.info(
                        "Deleted %d FAISS vectors for document %s", len(ids_to_remove), document_id
                    )
        except Exception as e:
            logger.warning("Failed to delete chunks from vector store: %s", e)

        removed = reg.delete(document_id)

        # Delete file from storage
        if settings.storage_backend == "supabase":
            from app.core.supabase import delete_file_from_storage

            delete_file_from_storage(doc.get("file_name", ""))
        else:
            upload_path = Path(settings.upload_dir) / doc.get("file_name", "")
            if upload_path.exists():
                upload_path.unlink(missing_ok=True)

        return {"status": "deleted", "document": removed}

    @staticmethod
    def get_chunks(document_id: str, vector_store: Any, owner_id: str | None = None):
        """Retrieve chunks for a document, with optional owner_id verification."""
        chunks: list[dict] = []

        if hasattr(vector_store, "docstore"):
            for doc in vector_store.docstore._dict.values():
                meta = doc.metadata or {}
                if meta.get("document_id") == document_id:
                    if owner_id and owner_id != "anonymous" and meta.get("owner_id") != owner_id:
                        continue
                    text = doc.page_content if hasattr(doc, "page_content") else str(doc)
                    chunks.append({"text": text, "page": meta.get("page")})
        elif hasattr(vector_store, "get"):
            try:
                where_filter: dict = {"document_id": document_id}
                if owner_id and owner_id != "anonymous":
                    where_filter = {"$and": [{"document_id": document_id}, {"owner_id": owner_id}]}
                res = vector_store.get(where=where_filter)
                for doc_text, meta in zip(
                    res.get("documents", []), res.get("metadatas", []), strict=False
                ):
                    chunks.append({"text": doc_text, "page": meta.get("page")})
            except Exception:
                logger.warning("Failed to query chunks for document %s", document_id)

        return chunks
