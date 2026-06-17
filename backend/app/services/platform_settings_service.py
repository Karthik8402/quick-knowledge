from datetime import UTC, datetime
import logging
import sqlite3
from typing import Any, Union, get_args, get_origin

from app.config import RuntimeSettings, Settings, get_settings

logger = logging.getLogger(__name__)


class PlatformSettingsService:
    @staticmethod
    def _get_sqlite_conn() -> sqlite3.Connection:
        settings = get_settings()
        conn = sqlite3.connect(settings.sqlite_db_path)
        # Initialize platform_settings table if not exist
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS platform_settings (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_by TEXT,
                updated_at TEXT
            )
        """)
        conn.commit()
        return conn

    @staticmethod
    def _cast_value(key: str, value_str: str) -> Any:
        """Cast string value back to its correct type defined in Settings."""
        if key == "llm_model" and value_str == "gemini-3.1-flash":
            value_str = "gemini-3.1-flash-lite"

        fields = Settings.model_fields
        if key not in fields:
            return value_str

        field_type = fields[key].annotation
        # Handle Union (like int | None, float | None)
        origin = get_origin(field_type)
        if origin is Union or origin is type(Union):
            args = get_args(field_type)
            non_none_args = [arg for arg in args if arg is not type(None)]
            if non_none_args:
                field_type = non_none_args[0]

        if field_type is int:
            return int(value_str)
        if field_type is float:
            return float(value_str)
        if field_type is bool:
            return value_str.lower() in ("true", "1", "yes")
        return value_str

    @classmethod
    def load_and_apply_settings(cls) -> None:
        """Load settings from DB/SQLite and store them in RuntimeSettings overrides."""
        settings = get_settings()

        overrides = {}
        if settings.storage_backend == "supabase":
            try:
                from app.core.supabase import get_supabase_client

                client = get_supabase_client()
                result = client.table("platform_settings").select("key, value").execute()
                for row in result.data:
                    overrides[row["key"]] = cls._cast_value(row["key"], row["value"])
            except Exception as e:
                logger.warning("Failed to load platform settings from Supabase: %s", e)
        else:
            # Local SQLite database
            try:
                with cls._get_sqlite_conn() as conn:
                    cursor = conn.cursor()
                    cursor.execute("SELECT key, value FROM platform_settings")
                    rows = cursor.fetchall()
                    for key, val in rows:
                        overrides[key] = cls._cast_value(key, val)
            except Exception as e:
                logger.warning("Failed to load platform settings from SQLite: %s", e)

        # Apply overrides to RuntimeSettings
        for k, v in overrides.items():
            RuntimeSettings.set(k, v)

        logger.info("Loaded and applied settings: %s", overrides)

    @classmethod
    def save_setting(cls, key: str, value: Any, updated_by: str) -> None:
        """Save a setting value to Supabase or local SQLite, and update RuntimeSettings overrides."""
        settings = get_settings()
        val_str = str(value)
        updated_at = datetime.now(UTC).isoformat()

        # Update in-memory overrides immediately
        RuntimeSettings.set(key, value)

        if settings.storage_backend == "supabase":
            try:
                from app.core.supabase import get_supabase_client

                client = get_supabase_client()
                client.table("platform_settings").upsert(
                    {
                        "key": key,
                        "value": val_str,
                        "updated_by": updated_by,
                        "updated_at": updated_at,
                    },
                    on_conflict="key",
                ).execute()
            except Exception as e:
                logger.warning("Failed to save platform setting to Supabase: %s", e)
        else:
            # Local SQLite database
            try:
                with cls._get_sqlite_conn() as conn:
                    cursor = conn.cursor()
                    cursor.execute(
                        "INSERT INTO platform_settings (key, value, updated_by, updated_at) "
                        "VALUES (?, ?, ?, ?) "
                        "ON CONFLICT(key) DO UPDATE SET value=excluded.value, "
                        "updated_by=excluded.updated_by, updated_at=excluded.updated_at",
                        (key, val_str, updated_by, updated_at),
                    )
                    conn.commit()
            except Exception as e:
                logger.warning("Failed to save platform setting to SQLite: %s", e)
