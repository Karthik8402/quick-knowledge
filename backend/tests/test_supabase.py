"""Unit tests for the Supabase storage and client helper module."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.config import get_settings
from app.core import supabase


class TestSupabaseHelpers:
    @pytest.fixture(autouse=True)
    def clear_cache(self):
        supabase.get_supabase_client.cache_clear()
        get_settings.cache_clear()

    def test_get_supabase_client_raises_value_error_if_missing_config(self, monkeypatch):
        monkeypatch.setenv("SUPABASE_URL", "")
        monkeypatch.setenv("SUPABASE_SERVICE_KEY", "")

        with pytest.raises(ValueError, match="SUPABASE_URL and SUPABASE_SERVICE_KEY are required"):
            supabase.get_supabase_client()

    @patch("supabase.create_client")
    def test_get_supabase_client_initializes_correctly(self, mock_create_client, monkeypatch):
        monkeypatch.setenv("SUPABASE_URL", "https://xyz.supabase.co")
        monkeypatch.setenv("SUPABASE_SERVICE_KEY", "secret-key")

        client = supabase.get_supabase_client()
        mock_create_client.assert_called_once_with("https://xyz.supabase.co", "secret-key")
        assert client is not None

    @patch("app.core.supabase.get_supabase_client")
    def test_upload_file_to_storage(self, mock_get_client, monkeypatch):
        monkeypatch.setenv("SUPABASE_URL", "https://xyz.supabase.co")
        monkeypatch.setenv("SUPABASE_SERVICE_KEY", "secret-key")
        monkeypatch.setenv("SUPABASE_STORAGE_BUCKET", "test-bucket")

        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        file_bytes = b"my test file bytes"
        file_name = "test.txt"
        content_type = "text/plain"

        path = supabase.upload_file_to_storage(file_bytes, file_name, content_type)

        assert path == "uploads/test.txt"
        mock_client.storage.from_.assert_called_once_with("test-bucket")
        mock_client.storage.from_().upload.assert_called_once_with(
            path="uploads/test.txt",
            file=file_bytes,
            file_options={"content-type": content_type, "upsert": "true"},
        )

    @patch("app.core.supabase.get_supabase_client")
    def test_delete_file_from_storage(self, mock_get_client, monkeypatch):
        monkeypatch.setenv("SUPABASE_URL", "https://xyz.supabase.co")
        monkeypatch.setenv("SUPABASE_SERVICE_KEY", "secret-key")
        monkeypatch.setenv("SUPABASE_STORAGE_BUCKET", "test-bucket")

        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        file_name = "test.txt"
        supabase.delete_file_from_storage(file_name)

        mock_client.storage.from_.assert_called_once_with("test-bucket")
        mock_client.storage.from_().remove.assert_called_once_with(["uploads/test.txt"])

    def test_get_db_connection_string_raises_value_error_if_missing(self, monkeypatch):
        monkeypatch.setenv("DATABASE_URL", "")
        with pytest.raises(ValueError, match="DATABASE_URL is required"):
            supabase.get_db_connection_string()

    def test_get_db_connection_string_returns_value(self, monkeypatch):
        monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@host:5432/db")
        conn = supabase.get_db_connection_string()
        assert conn == "postgresql://user:pass@host:5432/db"
