from datetime import UTC, datetime, timedelta
import json
from pathlib import Path
from typing import Any

from app.config import get_settings


class UsageService:
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
    def _write_usage(data: dict[str, Any]):
        UsageService._get_usage_file().write_text(json.dumps(data, indent=2))

    @staticmethod
    def get_usage(user_id: str) -> dict[str, Any]:
        data = UsageService._read_usage()
        now = datetime.now(UTC)
        today_str = now.strftime("%Y-%m-%d")

        user_data = data.get(user_id, {})
        last_reset = user_data.get("last_reset", "")

        if last_reset != today_str:
            # Reset daily usage
            user_data["used"] = 0
            user_data["last_reset"] = today_str
            data[user_id] = user_data
            UsageService._write_usage(data)

        used = user_data.get("used", 0)
        limit = 50  # Hardcoded default limit for Free plan, could be configurable later
        remaining = max(0, limit - used)
        percentage = min(100, int((used / limit) * 100)) if limit > 0 else 100

        # Calculate next midnight UTC
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
        """Increment usage by 1. Returns True if successful, False if limit reached."""
        data = UsageService._read_usage()
        now = datetime.now(UTC)
        today_str = now.strftime("%Y-%m-%d")

        user_data = data.get(user_id, {"used": 0, "last_reset": today_str})

        if user_data.get("last_reset") != today_str:
            user_data["used"] = 0
            user_data["last_reset"] = today_str

        limit = 50
        if user_data["used"] >= limit:
            return False

        user_data["used"] += 1
        data[user_id] = user_data
        UsageService._write_usage(data)
        return True
