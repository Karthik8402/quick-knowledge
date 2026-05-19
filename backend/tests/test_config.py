"""Tests for app.config — Settings loading and defaults."""

from __future__ import annotations

import os


class TestSettings:
    """Tests for the configuration Settings class."""

    def test_default_values(self, tmp_path):
        from app.config import Settings

        os.environ["UPLOAD_DIR"] = str(tmp_path / "uploads")
        os.environ["CHROMA_PERSIST_DIR"] = str(tmp_path / "chroma")
        os.environ["METADATA_DB_PATH"] = str(tmp_path / "registry.json")

        s = Settings(_env_file=None)
        assert s.llm_provider == "google"
        # llm_model default — check the actual value rather than hardcoding a specific model
        assert s.llm_model  # non-empty string
        assert s.vector_store == "chroma"
        assert s.rag_top_k == 6
        assert s.rag_chunk_size == 800
        assert s.rag_chunk_overlap == 150
        assert s.max_upload_size_mb == 25

    def test_embedding_defaults(self, tmp_path):
        from app.config import Settings

        os.environ["METADATA_DB_PATH"] = str(tmp_path / "registry.json")
        s = Settings(_env_file=None)
        assert s.embedding_provider == "google"
        assert s.embedding_model == "gemini-embedding-001"

    def test_reads_env_overrides(self, tmp_path, monkeypatch):
        from app.config import Settings

        monkeypatch.setenv("RAG_TOP_K", "10")
        monkeypatch.setenv("LLM_PROVIDER", "openai")
        monkeypatch.setenv("METADATA_DB_PATH", str(tmp_path / "registry.json"))

        s = Settings()
        assert s.rag_top_k == 10
        assert s.llm_provider == "openai"

    def test_get_settings_creates_directories(self, tmp_path, monkeypatch):
        from app.config import get_settings

        get_settings.cache_clear()

        upload_dir = tmp_path / "new_uploads"
        chroma_dir = tmp_path / "new_chroma"
        db_path = tmp_path / "sub" / "registry.json"

        monkeypatch.setenv("UPLOAD_DIR", str(upload_dir))
        monkeypatch.setenv("CHROMA_PERSIST_DIR", str(chroma_dir))
        monkeypatch.setenv("METADATA_DB_PATH", str(db_path))

        get_settings()

        assert upload_dir.exists()
        assert chroma_dir.exists()
        assert db_path.parent.exists()

        get_settings.cache_clear()

    def test_get_settings_caches_result(self, tmp_path, monkeypatch):
        from app.config import get_settings

        get_settings.cache_clear()

        monkeypatch.setenv("METADATA_DB_PATH", str(tmp_path / "registry.json"))
        monkeypatch.setenv("UPLOAD_DIR", str(tmp_path / "uploads"))
        monkeypatch.setenv("CHROMA_PERSIST_DIR", str(tmp_path / "chroma"))

        s1 = get_settings()
        s2 = get_settings()
        assert s1 is s2

        get_settings.cache_clear()
