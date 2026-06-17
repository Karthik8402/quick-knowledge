"""Unit tests for PlatformSettingsService."""

from __future__ import annotations

import logging

from app.config import RuntimeSettings, get_settings
from app.services.platform_settings_service import PlatformSettingsService


class TestPlatformSettingsService:
    def test_cast_value(self):
        # Test integer setting casting
        assert PlatformSettingsService._cast_value("rag_top_k", "8") == 8
        # Test float setting casting
        assert PlatformSettingsService._cast_value("llm_temperature", "0.7") == 0.7
        # Test boolean setting casting
        assert PlatformSettingsService._cast_value("auth_enabled", "true") is True
        assert PlatformSettingsService._cast_value("auth_enabled", "false") is False
        # Test string casting
        assert PlatformSettingsService._cast_value("llm_provider", "openai") == "openai"
        # Test non-existent keys return value unchanged
        assert PlatformSettingsService._cast_value("fake_setting_key", "custom") == "custom"

    def test_sqlite_table_initialization(self, tmp_path):
        db_path = tmp_path / "test_kb.db"
        settings = get_settings()
        original_db_path = settings.sqlite_db_path
        settings.sqlite_db_path = str(db_path)

        try:
            conn = PlatformSettingsService._get_sqlite_conn()
            cursor = conn.cursor()
            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='platform_settings'"
            )
            row = cursor.fetchone()
            assert row is not None
            assert row[0] == "platform_settings"
            conn.close()
        finally:
            settings.sqlite_db_path = original_db_path

    def test_save_and_load_settings_sqlite(self, tmp_path):
        db_path = tmp_path / "test_kb.db"
        settings = get_settings()
        original_db_path = settings.sqlite_db_path
        settings.sqlite_db_path = str(db_path)

        try:
            # Initially clear overrides
            RuntimeSettings._overrides.clear()

            # Save setting
            PlatformSettingsService.save_setting("rag_top_k", 9, "admin_user")

            # Check immediately in memory
            assert RuntimeSettings.get_all()["rag_top_k"] == 9

            # Reset in-memory override to test database loading
            RuntimeSettings._overrides.clear()
            assert "rag_top_k" not in RuntimeSettings.get_all()

            # Load from DB and verify override is re-applied
            PlatformSettingsService.load_and_apply_settings()
            assert RuntimeSettings.get_all()["rag_top_k"] == 9
        finally:
            settings.sqlite_db_path = original_db_path

    def test_silently_catches_exceptions(self, tmp_path, caplog):
        settings = get_settings()
        original_db_path = settings.sqlite_db_path
        settings.sqlite_db_path = "/invalid/path/to/database.db"

        try:
            with caplog.at_level(logging.WARNING):
                # Should silently catch and not raise
                PlatformSettingsService.load_and_apply_settings()
                assert any(
                    "Failed to load platform settings" in record.message
                    for record in caplog.records
                )

            caplog.clear()

            with caplog.at_level(logging.WARNING):
                # Should silently catch and not raise
                PlatformSettingsService.save_setting("rag_top_k", 12, "admin")
                assert any(
                    "Failed to save platform setting" in record.message for record in caplog.records
                )
        finally:
            settings.sqlite_db_path = original_db_path
