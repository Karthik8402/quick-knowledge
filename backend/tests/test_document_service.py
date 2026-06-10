"""
Unit tests for DocumentService — tests upload, list, delete, and chunk retrieval
without any real file I/O or vector store calls.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.exceptions import DocumentNotFoundError, NoFilesUploadedError
from app.services.document_service import DocumentService


# ═══════════════════════════════════════════════════════════════════════════
# upload_documents
# ═══════════════════════════════════════════════════════════════════════════
class TestUploadDocuments:
    def test_raises_when_no_files_given(self):
        with pytest.raises(NoFilesUploadedError):
            DocumentService.upload_documents([], MagicMock(), owner_id="user1")

    def test_delegates_to_ingest_files(self):
        mock_results = [{"status": "indexed", "file_name": "doc.txt", "chunks": 5}]
        with patch(
            "app.services.document_service.ingest_files", return_value=mock_results
        ) as mock_ingest:
            result = DocumentService.upload_documents(
                files=[MagicMock()],
                vector_store=MagicMock(),
                owner_id="user1",
            )
        mock_ingest.assert_called_once()
        assert result == mock_results

    def test_passes_owner_id_to_ingest(self):
        with patch("app.services.document_service.ingest_files", return_value=[]) as mock_ingest:
            DocumentService.upload_documents(
                files=[MagicMock()],
                vector_store=MagicMock(),
                owner_id="owner-xyz",
            )
        _, kwargs = mock_ingest.call_args
        assert kwargs.get("owner_id") == "owner-xyz"

    def test_multiple_files_passed_through(self):
        files = [MagicMock(), MagicMock(), MagicMock()]
        mock_results = [{"status": "indexed"}] * 3
        with patch("app.services.document_service.ingest_files", return_value=mock_results):
            result = DocumentService.upload_documents(files, MagicMock(), owner_id="anon")
        assert len(result) == 3


# ═══════════════════════════════════════════════════════════════════════════
# list_documents
# ═══════════════════════════════════════════════════════════════════════════
class TestListDocuments:
    def test_returns_empty_when_no_docs(self):
        reg = MagicMock()
        reg.list_documents.return_value = []
        result = DocumentService.list_documents(reg, owner_id="anon")
        assert result == []

    def test_returns_list_of_docs(self):
        reg = MagicMock()
        reg.list_documents.return_value = [
            {"document_id": "abc", "file_name": "test.pdf"},
        ]
        result = DocumentService.list_documents(reg, owner_id="anon")
        assert len(result) == 1
        assert result[0]["document_id"] == "abc"

    def test_passes_owner_id_to_registry(self):
        reg = MagicMock()
        reg.list_documents.return_value = []
        DocumentService.list_documents(reg, owner_id="user-42")
        reg.list_documents.assert_called_once_with(owner_id="user-42")


# ═══════════════════════════════════════════════════════════════════════════
# delete_document
# ═══════════════════════════════════════════════════════════════════════════
class TestDeleteDocument:
    def _make_reg(self, doc: dict | None) -> MagicMock:
        reg = MagicMock()
        reg.get.return_value = doc
        reg.delete.return_value = doc
        return reg

    def test_raises_when_document_not_found(self):
        reg = self._make_reg(doc=None)
        with pytest.raises(DocumentNotFoundError):
            DocumentService.delete_document("ghost-id", MagicMock(), reg, owner_id="anon")

    def test_returns_deleted_status(self):
        doc = {"document_id": "doc1", "file_name": "test.pdf", "owner_id": "anon"}
        reg = self._make_reg(doc)

        with patch("app.services.document_service.get_settings") as mock_settings:
            mock_settings.return_value.auth_enabled = False
            mock_settings.return_value.vector_store = "chroma"
            mock_settings.return_value.storage_backend = "local"
            mock_settings.return_value.upload_dir = "/tmp/uploads"

            result = DocumentService.delete_document("doc1", MagicMock(), reg, owner_id="anon")

        assert result["status"] == "deleted"

    def test_calls_vector_store_delete(self):
        doc = {"document_id": "doc1", "file_name": "test.pdf", "owner_id": "anon"}
        reg = self._make_reg(doc)
        vector_store = MagicMock()
        vector_store.delete = MagicMock()

        with patch("app.services.document_service.get_settings") as mock_settings:
            mock_settings.return_value.auth_enabled = False
            mock_settings.return_value.vector_store = "chroma"
            mock_settings.return_value.storage_backend = "local"
            mock_settings.return_value.upload_dir = "/tmp/uploads"

            DocumentService.delete_document("doc1", vector_store, reg, owner_id="anon")

        vector_store.delete.assert_called_once_with(where={"document_id": "doc1"})

    def test_calls_vector_store_delete_pgvector(self):
        doc = {"document_id": "doc1", "file_name": "test.pdf", "owner_id": "anon", "chunks": 3}
        reg = self._make_reg(doc)
        vector_store = MagicMock()
        vector_store.delete = MagicMock()

        with patch("app.services.document_service.get_settings") as mock_settings:
            mock_settings.return_value.auth_enabled = False
            mock_settings.return_value.vector_store = "pgvector"
            mock_settings.return_value.storage_backend = "local"
            mock_settings.return_value.upload_dir = "/tmp/uploads"

            DocumentService.delete_document("doc1", vector_store, reg, owner_id="anon")

        vector_store.delete.assert_called_once_with(ids=["doc1:0", "doc1:1", "doc1:2"])

    def test_auth_guard_blocks_wrong_owner(self):
        doc = {"document_id": "doc1", "file_name": "test.pdf", "owner_id": "alice"}
        reg = self._make_reg(doc)

        with patch("app.services.document_service.get_settings") as mock_settings:
            mock_settings.return_value.auth_enabled = True
            mock_settings.return_value.vector_store = "chroma"
            mock_settings.return_value.storage_backend = "local"
            mock_settings.return_value.upload_dir = "/tmp/uploads"

            with pytest.raises(DocumentNotFoundError):
                DocumentService.delete_document("doc1", MagicMock(), reg, owner_id="bob")


# ═══════════════════════════════════════════════════════════════════════════
# get_chunks
# ═══════════════════════════════════════════════════════════════════════════
class TestGetChunks:
    def test_returns_empty_list_for_plain_mock(self):
        """A plain MagicMock has neither docstore nor get — should return []."""
        vector_store = MagicMock(spec=[])  # spec=[] means no attributes
        result = DocumentService.get_chunks("doc-001", vector_store)
        assert result == []

    def test_queries_chroma_style_vector_store(self):
        """Simulates a Chroma-style .get() interface."""
        vector_store = MagicMock()
        del vector_store.docstore  # ensure it uses the .get() path
        del vector_store.get_by_ids # ensure pgvector path is not taken

        vector_store.get.return_value = {
            "documents": ["chunk text here"],
            "metadatas": [{"document_id": "doc-001", "page": 0}],
        }

        result = DocumentService.get_chunks("doc-001", vector_store)

        assert len(result) == 1
        assert result[0]["text"] == "chunk text here"
        assert result[0]["page"] == 0

    def test_returns_empty_when_get_raises(self):
        """If .get() raises an exception, should silently return []."""
        vector_store = MagicMock()
        del vector_store.docstore
        del vector_store.get_by_ids # ensure pgvector path is not taken

        vector_store.get.side_effect = Exception("DB error")

        result = DocumentService.get_chunks("doc-001", vector_store)
        assert result == []

    def test_filters_by_document_id_in_docstore(self):
        """Only returns chunks matching the given document_id."""
        from langchain_core.documents import Document

        doc_match = Document(
            page_content="correct chunk",
            metadata={"document_id": "target-doc", "page": 1},
        )
        doc_other = Document(
            page_content="wrong chunk",
            metadata={"document_id": "other-doc", "page": 2},
        )

        vector_store = MagicMock()
        vector_store.docstore._dict = {"k1": doc_match, "k2": doc_other}

        result = DocumentService.get_chunks("target-doc", vector_store)

        assert len(result) == 1
        assert result[0]["text"] == "correct chunk"
        assert result[0]["page"] == 1

    def test_queries_pgvector_style_vector_store(self):
        """Simulates a pgvector-style .get_by_ids() interface."""
        from langchain_core.documents import Document

        doc_chunk_1 = Document(
            page_content="chunk 1 text",
            metadata={"document_id": "doc-pg", "chunk_index": 0, "page": 0}
        )
        doc_chunk_2 = Document(
            page_content="chunk 2 text",
            metadata={"document_id": "doc-pg", "chunk_index": 1, "page": 1}
        )

        vector_store = MagicMock()
        del vector_store.docstore  # Ensure docstore path is not taken
        del vector_store.get       # Ensure chroma path is not taken

        vector_store.get_by_ids.return_value = [doc_chunk_2, doc_chunk_1]

        mock_registry_doc = {"document_id": "doc-pg", "chunks": 2}

        with patch("app.storage.registry.get", return_value=mock_registry_doc):
            result = DocumentService.get_chunks("doc-pg", vector_store)

        vector_store.get_by_ids.assert_called_once_with(["doc-pg:0", "doc-pg:1"])
        assert len(result) == 2
        assert result[0]["text"] == "chunk 1 text"
        assert result[0]["page"] == 0
        assert result[1]["text"] == "chunk 2 text"
        assert result[1]["page"] == 1

