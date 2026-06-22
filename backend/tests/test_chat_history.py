"""Unit tests for ChatHistoryService."""

from __future__ import annotations

import logging

from app.config import get_settings
from app.services.chat_history_service import ChatHistoryService


class TestChatHistoryService:
    def test_sqlite_table_initialization(self, tmp_path):
        db_path = tmp_path / "test_kb.db"

        # Override settings for this test
        settings = get_settings()
        original_db_path = settings.sqlite_db_path
        settings.sqlite_db_path = str(db_path)

        conn = None
        try:
            # Invoking _get_sqlite_conn should create the file and the table
            conn = ChatHistoryService._get_sqlite_conn()
            cursor = conn.cursor()
            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='chat_sessions'"
            )
            row = cursor.fetchone()
            assert row is not None
            assert row[0] == "chat_sessions"
        finally:
            if conn:
                conn.close()
            settings.sqlite_db_path = original_db_path

    def test_save_and_load_turns_sqlite(self, tmp_path):
        db_path = tmp_path / "test_kb.db"
        settings = get_settings()
        original_db_path = settings.sqlite_db_path
        settings.sqlite_db_path = str(db_path)

        try:
            user_id = "user_123"
            session_id = "session_xyz"
            turns = [
                {"role": "user", "content": "hello", "metadata": {"ip": "127.0.0.1"}},
                {"role": "assistant", "content": "hi there", "metadata": {}},
            ]

            # Save turns
            ChatHistoryService.save_turns(user_id, session_id, turns)

            # Load turns
            loaded = ChatHistoryService.load_history(user_id, session_id)
            assert len(loaded) == 2
            assert loaded[0]["role"] == "user"
            assert loaded[0]["content"] == "hello"
            assert loaded[1]["role"] == "assistant"
            assert loaded[1]["content"] == "hi there"

            # Test loading for non-existent session
            assert len(ChatHistoryService.load_history(user_id, "nonexistent")) == 0
        finally:
            settings.sqlite_db_path = original_db_path

    def test_silently_catches_exceptions(self, tmp_path, caplog):
        settings = get_settings()
        original_db_path = settings.sqlite_db_path
        settings.sqlite_db_path = "/invalid/path/to/database.db"

        try:
            with caplog.at_level(logging.WARNING):
                # Should return safe default [] instead of raising
                loaded = ChatHistoryService.load_history("user", "session")
                assert loaded == []

                # Check log warning was raised
                assert any(
                    "Failed to load chat history" in record.message for record in caplog.records
                )

            caplog.clear()

            with caplog.at_level(logging.WARNING):
                # Should silently log warning and do nothing instead of raising
                ChatHistoryService.save_turns(
                    "user", "session", [{"role": "user", "content": "hello"}]
                )
                assert any(
                    "Failed to save chat history" in record.message for record in caplog.records
                )
        finally:
            settings.sqlite_db_path = original_db_path
