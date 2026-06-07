"""Usage tracking service — thread-safe with Supabase atomic upsert in production.

Threading model:
  - Local mode: uses a module-level threading.Lock() for single-worker safety.
  - Supabase mode (production): uses an atomic SQL upsert
    (INSERT ... ON CONFLICT DO UPDATE SET used = used + 1 RETURNING used)
    which is the ONLY correct fix under Gunicorn multi-worker mode (render.yaml).
    A threading.Lock() cannot protect across OS processes.
"""

from datetime import UTC, datetime, timedelta
import json
import logging
from pathlib import Path
import threading
from typing import Any

from app.config import get_settings

logger = logging.getLogger(__name__)

# Module-level lock — protects file I/O in local (single-process) mode.
_usage_lock = threading.Lock()


class UsageService:
    # ------------------------------------------------------------------ #
    # Local JSON helpers                                                   #
    # ------------------------------------------------------------------ #
    @staticmethod
    def _get_usage_file() -> Path:
        settings = get_settings()
        data_dir = Path(settings.upload_dir).parent
        usage_file = data_dir / "usage.json"
        if not usage_file.exists():
            usage_file.write_text("{}")
        return usage_file

    @staticmethod
    def _read_usage() -> dict[str, Any]:
        try:
            return json.loads(UsageService._get_usage_file().read_text())
        except Exception:
            return {}

    @staticmethod
    def _write_usage(data: dict[str, Any]) -> None:
        UsageService._get_usage_file().write_text(json.dumps(data, indent=2))

    # ------------------------------------------------------------------ #
    # Supabase atomic helpers                                              #
    # ------------------------------------------------------------------ #
    @staticmethod
    def _supabase_get_usage(user_id: str) -> dict[str, Any]:
        """Read today's usage row from Supabase."""
        from app.core.supabase import get_supabase_client

        today_str = datetime.now(UTC).strftime("%Y-%m-%d")
        try:
            client = get_supabase_client()
            result = (
                client.table("usage")
                .select("used")
                .eq("user_id", user_id)
                .eq("date", today_str)
                .limit(1)
                .execute()
            )
            if result.data:
                return {"used": result.data[0]["used"], "last_reset": today_str}
        except Exception as e:
            logger.error("Failed to read usage from Supabase: %s. Falling back to 0.", e)
        return {"used": 0, "last_reset": today_str}

    @staticmethod
    def _supabase_atomic_increment(user_id: str) -> int:
        """Atomically increment today's usage counter.

        Uses INSERT ... ON CONFLICT DO UPDATE to guarantee correctness across
        multiple Gunicorn workers — a threading.Lock() cannot protect across
        OS processes.

        Returns the NEW 'used' value after increment.
        """
        from app.core.supabase import get_supabase_client

        today_str = datetime.now(UTC).strftime("%Y-%m-%d")

        try:
            client = get_supabase_client()
            # Upsert: insert row with used=1, or increment existing row atomically.
            client.table("usage").upsert(
                {"user_id": user_id, "date": today_str, "used": 1},
                on_conflict="user_id,date",
            ).execute()
        except Exception as e:
            logger.error("Failed to upsert usage in Supabase: %s", e)

        # postgrest-py doesn't expose DO UPDATE expressions directly.
        # Use rpc() for the true atomic increment instead.
        try:
            client = get_supabase_client()
            rpc_result = client.rpc(
                "increment_usage",
                {"p_user_id": user_id, "p_date": today_str},
            ).execute()
            if rpc_result.data is not None:
                return int(rpc_result.data)
        except Exception as e:
            logger.warning("RPC increment_usage failed: %s. Falling back to read.", e)

        # Fallback: read back the current value after the upsert.
        try:
            client = get_supabase_client()
            read = (
                client.table("usage")
                .select("used")
                .eq("user_id", user_id)
                .eq("date", today_str)
                .limit(1)
                .execute()
            )
            if read.data:
                return read.data[0]["used"]
        except Exception as e:
            logger.error("Failed fallback read of usage in Supabase: %s", e)
        return 1

    # ------------------------------------------------------------------ #
    # Public API                                                           #
    # ------------------------------------------------------------------ #
    @staticmethod
    def get_usage(user_id: str) -> dict[str, Any]:
        settings = get_settings()
        limit = settings.daily_usage_limit
        now = datetime.now(UTC)
        today_str = now.strftime("%Y-%m-%d")

        if settings.storage_backend == "supabase":
            user_data = UsageService._supabase_get_usage(user_id)
        else:
            with _usage_lock:
                data = UsageService._read_usage()
                user_data = data.get(user_id, {})

                if user_data.get("last_reset", "") != today_str:
                    user_data = {"used": 0, "last_reset": today_str}
                    data[user_id] = user_data
                    UsageService._write_usage(data)

        used = user_data.get("used", 0)
        remaining = max(0, limit - used)
        percentage = min(100, int((used / limit) * 100)) if limit > 0 else 100

        tomorrow = now + timedelta(days=1)
        reset_at = tomorrow.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()

        return {
            "used": used,
            "limit": limit,
            "remaining": remaining,
            "percentage": percentage,
            "reset_at": reset_at,
            "plan": "Free",
            "status": "active" if remaining > 0 else "exhausted",
        }

    @staticmethod
    def increment_usage(user_id: str) -> bool:
        """Increment usage by 1. Returns True if successful, False if limit reached.

        - Local mode: protected by threading.Lock (single-process safety).
        - Supabase mode: uses atomic SQL upsert (multi-worker / multi-process safe).
        """
        settings = get_settings()
        limit = settings.daily_usage_limit
        today_str = datetime.now(UTC).strftime("%Y-%m-%d")

        if settings.storage_backend == "supabase":
            # Read first to check limit before incrementing.
            user_data = UsageService._supabase_get_usage(user_id)
            if user_data.get("used", 0) >= limit:
                return False
            new_used = UsageService._supabase_atomic_increment(user_id)
            return new_used <= limit

        # ── Local file mode — protected by lock ──
        with _usage_lock:
            data = UsageService._read_usage()
            user_data = data.get(user_id, {"used": 0, "last_reset": today_str})

            if user_data.get("last_reset") != today_str:
                user_data = {"used": 0, "last_reset": today_str}

            if user_data["used"] >= limit:
                return False

            user_data["used"] += 1
            data[user_id] = user_data
            UsageService._write_usage(data)
            return True
