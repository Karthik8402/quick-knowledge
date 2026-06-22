from datetime import UTC, datetime
import json
import logging
import sqlite3
from typing import Any

from app.config import get_settings

logger = logging.getLogger(__name__)


class ChatHistoryService:
    @staticmethod
    def _get_sqlite_conn() -> sqlite3.Connection:
        settings = get_settings()
        conn = sqlite3.connect(settings.sqlite_db_path)
        # Initialize tables if not exist
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS chat_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                session_id TEXT,
                role TEXT,
                content TEXT,
                created_at TEXT,
                metadata TEXT
            )
        """)
        conn.commit()
        return conn

    @staticmethod
    def load_history(user_id: str, session_id: str) -> list[dict[str, Any]]:
        """Load conversation history for user_id + session_id."""
        settings = get_settings()
        if settings.storage_backend == "supabase":
            try:
                from app.core.supabase import get_supabase_client

                client = get_supabase_client()
                result = (
                    client.table("chat_sessions")
                    .select("role, content")
                    .eq("user_id", user_id)
                    .eq("session_id", session_id)
                    .order("created_at", desc=False)
                    .execute()
                )
                return [{"role": r["role"], "content": r["content"]} for r in result.data]
            except Exception as e:
                logger.warning("Failed to load chat history from Supabase: %s", e)
                return []
        else:
            # Local SQLite database
            try:
                conn = ChatHistoryService._get_sqlite_conn()
                try:
                    with conn:
                        cursor = conn.cursor()
                        cursor.execute(
                            "SELECT role, content FROM chat_sessions WHERE user_id = ? AND session_id = ? ORDER BY id ASC",
                            (user_id, session_id),
                        )
                        rows = cursor.fetchall()
                        return [{"role": r[0], "content": r[1]} for r in rows]
                finally:
                    conn.close()
            except Exception as e:
                logger.warning("Failed to load chat history from SQLite: %s", e)
                return []

    @staticmethod
    def save_turns(user_id: str, session_id: str, turns: list[dict[str, Any]]) -> None:
        """Append turns to the database."""
        if not turns:
            return

        settings = get_settings()
        created_at_str = datetime.now(UTC).isoformat()

        if settings.storage_backend == "supabase":
            try:
                from app.core.supabase import get_supabase_client

                client = get_supabase_client()
                payload = [
                    {
                        "user_id": user_id,
                        "session_id": session_id,
                        "role": t["role"],
                        "content": t["content"],
                        "created_at": created_at_str,
                        "metadata": t.get("metadata") or {},
                    }
                    for t in turns
                ]
                client.table("chat_sessions").insert(payload).execute()
            except Exception as e:
                logger.warning("Failed to save chat history to Supabase: %s", e)
        else:
            # Local SQLite database
            try:
                conn = ChatHistoryService._get_sqlite_conn()
                try:
                    with conn:
                        cursor = conn.cursor()
                        for t in turns:
                            metadata_str = json.dumps(t.get("metadata") or {})
                            cursor.execute(
                                "INSERT INTO chat_sessions (user_id, session_id, role, content, created_at, metadata) VALUES (?, ?, ?, ?, ?, ?)",
                                (
                                    user_id,
                                    session_id,
                                    t["role"],
                                    t["content"],
                                    created_at_str,
                                    metadata_str,
                                ),
                            )
                        conn.commit()
                finally:
                    conn.close()
            except Exception as e:
                logger.warning("Failed to save chat history to SQLite: %s", e)
