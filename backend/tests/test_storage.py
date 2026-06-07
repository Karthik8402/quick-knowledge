"""Tests for app.storage — DocumentRegistry and utility functions."""

from __future__ import annotations


class TestDocumentRegistry:
    """Tests for the JSON-backed document registry."""

    def test_initializes_empty_when_file_missing(self, tmp_registry):
        docs = tmp_registry.list_documents()
        assert docs == []

    def test_list_documents_returns_empty_list(self, tmp_registry):
        assert tmp_registry.list_documents() == []

    def test_upsert_adds_new_document(self, tmp_registry, sample_doc_record):
        tmp_registry.upsert(sample_doc_record)
        docs = tmp_registry.list_documents()
        assert len(docs) == 1
        assert docs[0]["document_id"] == sample_doc_record["document_id"]

    def test_upsert_updates_existing_document(self, tmp_registry, sample_doc_record):
        tmp_registry.upsert(sample_doc_record)
        updated = {**sample_doc_record, "chunks": 99}
        tmp_registry.upsert(updated)
        docs = tmp_registry.list_documents()
        assert len(docs) == 1
        assert docs[0]["chunks"] == 99

    def test_get_returns_correct_document(self, tmp_registry, sample_doc_record):
        tmp_registry.upsert(sample_doc_record)
        result = tmp_registry.get(sample_doc_record["document_id"])
        assert result is not None
        assert result["file_name"] == "test_report.pdf"

    def test_get_returns_none_for_missing(self, tmp_registry):
        assert tmp_registry.get("nonexistent-id") is None

    def test_find_by_hash_matches(self, tmp_registry, sample_doc_record):
        tmp_registry.upsert(sample_doc_record)
        result = tmp_registry.find_by_hash(sample_doc_record["content_hash"])
        assert result is not None
        assert result["document_id"] == sample_doc_record["document_id"]

    def test_find_by_hash_returns_none_on_mismatch(self, tmp_registry, sample_doc_record):
        tmp_registry.upsert(sample_doc_record)
        assert tmp_registry.find_by_hash("no-such-hash") is None

    def test_delete_removes_and_returns_document(self, tmp_registry, sample_doc_record):
        tmp_registry.upsert(sample_doc_record)
        removed = tmp_registry.delete(sample_doc_record["document_id"])
        assert removed is not None
        assert removed["document_id"] == sample_doc_record["document_id"]
        assert tmp_registry.list_documents() == []

    def test_delete_returns_none_for_missing(self, tmp_registry):
        assert tmp_registry.delete("nonexistent") is None

    def test_count_method(self, tmp_registry, sample_doc_record):
        assert tmp_registry.count() == 0
        tmp_registry.upsert(sample_doc_record)
        assert tmp_registry.count() == 1

    def test_multiple_documents(self, tmp_registry):
        for i in range(5):
            tmp_registry.upsert(
                {
                    "document_id": f"doc-{i}",
                    "file_name": f"file_{i}.pdf",
                    "source_type": "pdf",
                    "pages": i,
                    "chunks": i * 2,
                    "content_hash": f"hash-{i}",
                    "created_at": "2026-01-01T00:00:00+00:00",
                }
            )
        assert tmp_registry.count() == 5
        tmp_registry.delete("doc-2")
        assert tmp_registry.count() == 4


class TestUtilityFunctions:
    """Tests for content_hash_from_path and create_document_id."""

    def test_content_hash_returns_consistent_sha256(self, tmp_path):
        from app.storage import content_hash_from_path

        test_file = tmp_path / "test.txt"
        test_file.write_text("hello world", encoding="utf-8")

        hash1 = content_hash_from_path(test_file)
        hash2 = content_hash_from_path(test_file)

        assert hash1 == hash2
        assert len(hash1) == 64  # SHA256 hex digest length

    def test_content_hash_differs_for_different_content(self, tmp_path):
        from app.storage import content_hash_from_path

        file_a = tmp_path / "a.txt"
        file_b = tmp_path / "b.txt"
        file_a.write_text("content A", encoding="utf-8")
        file_b.write_text("content B", encoding="utf-8")

        assert content_hash_from_path(file_a) != content_hash_from_path(file_b)

    def test_create_document_id_returns_first_32_chars(self):
        """document_id uses 32 hex chars (128-bit) for negligible collision risk."""
        from app.storage import create_document_id

        full_hash = "abcdef1234567890" * 4  # 64-char SHA256-like string
        doc_id = create_document_id(full_hash)
        assert doc_id == "abcdef1234567890abcdef1234567890"
        assert len(doc_id) == 32

    def test_utc_now_iso_returns_string(self):
        from app.storage import utc_now_iso

        result = utc_now_iso()
        assert isinstance(result, str)
        assert "T" in result  # ISO format contains T separator
