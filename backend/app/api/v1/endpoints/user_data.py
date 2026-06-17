"""User-specific data endpoints: sessions, activity feed, notifications.

All endpoints are protected by get_current_user.
Sessions: derived from document registry + auth context.
Activity: document-upload event log from the registry.
Notifications: computed from live system state (not stored).
"""

from __future__ import annotations

from datetime import UTC, datetime
import logging
import os
from typing import Any
import urllib.parse

from fastapi import APIRouter, Depends, HTTPException, Request

from app.config import get_settings
from app.core.auth import UserContext, get_current_user
from app.dependencies import get_registry, get_vector_store_optional
from app.services.usage_service import UsageService

try:
    import psycopg2
except ImportError:
    psycopg2 = None

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/user", tags=["user-data"])


# ---------------------------------------------------------------------------
# Sessions Helpers & Endpoints
# ---------------------------------------------------------------------------


def parse_user_agent(ua: str | None) -> str:
    """Parse a User-Agent string to return a clean category (e.g. Windows — Chrome)."""
    if not ua:
        return "Unknown Device"

    ua_lower = ua.lower()

    # OS detection
    os_name = "Unknown OS"
    if "windows" in ua_lower:
        os_name = "Windows"
    elif "macintosh" in ua_lower or "mac os" in ua_lower:
        os_name = "macOS"
    elif "iphone" in ua_lower:
        os_name = "iPhone"
    elif "ipad" in ua_lower:
        os_name = "iPad"
    elif "android" in ua_lower:
        os_name = "Android"
    elif "linux" in ua_lower:
        os_name = "Linux"

    # Browser detection
    browser = "Unknown Browser"
    if "edge" in ua_lower or "edg" in ua_lower:
        browser = "Edge"
    elif "chrome" in ua_lower or "crios" in ua_lower:
        browser = "Chrome"
    elif "safari" in ua_lower:
        browser = "Safari"
    elif "firefox" in ua_lower or "fxios" in ua_lower:
        browser = "Firefox"
    elif "opera" in ua_lower or "opr/" in ua_lower:
        browser = "Opera"

    return f"{os_name} — {browser}"


def get_supabase_db_conn():
    """Establish direct connection to Supabase Database using psycopg2."""
    if psycopg2 is None:
        raise HTTPException(
            status_code=501,
            detail="psycopg2 library is not installed. Session management is unavailable.",
        )
    settings = get_settings()
    db_url = settings.database_url
    if not db_url:
        raise HTTPException(status_code=500, detail="database_url is not configured in Settings.")

    # 1. Extract project reference ID to form direct connection URL
    project_ref = None
    if settings.supabase_url:
        try:
            parsed_sb = urllib.parse.urlparse(settings.supabase_url)
            hostname = parsed_sb.hostname or ""
            if "." in hostname:
                project_ref = hostname.split(".")[0]
        except Exception:
            pass

    # Fallback to parsing from username in database_url
    if not project_ref:
        try:
            parsed_db = urllib.parse.urlparse(db_url)
            netloc = parsed_db.netloc
            if "@" in netloc:
                user_pass, _ = netloc.rsplit("@", 1)
                if ":" in user_pass:
                    username, _ = user_pass.split(":", 1)
                else:
                    username = user_pass
                if "." in username:
                    project_ref = username.split(".", 1)[1]
        except Exception:
            pass

    # If project_ref is found, rewrite the database url to use direct connection on port 5432
    if project_ref:
        try:
            parsed = urllib.parse.urlparse(db_url)
            direct_host = f"db.{project_ref}.supabase.co"
            # For direct connections, username is always 'postgres'
            password_str = f":{parsed.password}" if parsed.password else ""
            netloc = f"postgres{password_str}@{direct_host}:5432"
            db_url = urllib.parse.urlunparse(
                (parsed.scheme, netloc, parsed.path, parsed.params, parsed.query, parsed.fragment)
            )
            logger.info(
                "Automatically rewrote database connection to direct host: %s on port 5432",
                direct_host,
            )
        except Exception as e:
            logger.warning(
                "Failed to automatically rewrite database URL to direct host: %s", str(e)
            )
    else:
        # Fallback to manual environment variable override if set
        supabase_db_host = os.environ.get("SUPABASE_DB_HOST")
        if supabase_db_host:
            try:
                parsed = urllib.parse.urlparse(db_url)
                netloc = parsed.netloc
                if "@" in netloc:
                    user_pass, _ = netloc.rsplit("@", 1)
                    netloc = f"{user_pass}@{supabase_db_host}:5432"
                else:
                    netloc = f"postgres@{supabase_db_host}:5432"
                db_url = urllib.parse.urlunparse(
                    (
                        parsed.scheme,
                        netloc,
                        parsed.path,
                        parsed.params,
                        parsed.query,
                        parsed.fragment,
                    )
                )
            except Exception as e:
                logger.warning("Failed to rewrite database URL: %s", str(e))

    try:
        conn = psycopg2.connect(db_url)
        return conn
    except Exception as e:
        logger.warning("Database connection failed: %s", str(e))
        raise HTTPException(
            status_code=500, detail=f"Failed to connect to the Supabase database: {e}"
        ) from e


@router.get("/sessions")
def get_sessions(
    user: UserContext = Depends(get_current_user),
    reg=Depends(get_registry),
) -> dict[str, Any]:
    """Return all active user sessions querying the auth.sessions table directly."""
    if not get_settings().auth_enabled:
        settings = get_settings()
        docs = reg.list_documents(owner_id=user.user_id)

        # Infer last activity from most recent document, fallback to None
        sorted_docs = sorted(
            docs,
            key=lambda d: d.get("created_at") or "1970-01-01T00:00:00",
            reverse=True,
        )
        last_activity = sorted_docs[0].get("created_at") if sorted_docs else None

        # Infer account first seen from oldest document
        oldest = sorted(
            docs,
            key=lambda d: d.get("created_at") or "1970-01-01T00:00:00",
        )
        first_seen = oldest[0].get("created_at") if oldest else None

        is_anonymous = user.user_id == "anonymous"
        current_session = {
            "session_id": "current",
            "is_current": True,
            "status": "active",
            "user_id": user.user_id,
            "is_anonymous": is_anonymous,
            "auth_backend": settings.storage_backend,
            "last_activity": last_activity,
            "first_seen": first_seen,
            "document_count": len(docs),
            "created_at": datetime.now(UTC).isoformat(),
            "device": "Windows — Chrome (Dev Mode)",
            "ip": "127.0.0.1",
            "last_seen_at": last_activity or datetime.now(UTC).isoformat(),
        }

        return {
            "sessions": [current_session],
            "total": 1,
            "active_count": 1,
        }

    conn = get_supabase_db_conn()
    try:
        with conn.cursor() as cur:
            # Query active sessions from auth.sessions filtering by user_id to ensure ownership
            cur.execute(
                "SELECT id, created_at, updated_at, user_agent, ip FROM auth.sessions WHERE user_id = %s ORDER BY updated_at DESC",
                (user.user_id,),
            )
            rows = cur.fetchall()

            sessions = []
            for row in rows:
                sess_id = str(row[0])
                is_current = sess_id == user.session_id

                created_at = row[1]
                if isinstance(created_at, datetime):
                    created_at = created_at.isoformat()

                last_seen_at = row[2]
                if isinstance(last_seen_at, datetime):
                    last_seen_at = last_seen_at.isoformat()

                sessions.append(
                    {
                        "session_id": sess_id,
                        "is_current": is_current,
                        "device": parse_user_agent(row[3]),
                        "ip": row[4] or "Unknown",
                        "created_at": created_at,
                        "last_seen_at": last_seen_at,
                    }
                )

            return {
                "sessions": sessions,
                "total": len(sessions),
                "active_count": len(sessions),
            }
    except Exception as e:
        logger.warning("Failed to query sessions for user %s: %s", user.user_id, str(e))
        raise HTTPException(status_code=500, detail=f"Failed to retrieve sessions: {e}") from e
    finally:
        conn.close()


@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: str,
    user: UserContext = Depends(get_current_user),
) -> dict[str, Any]:
    """Revoke a specific user session from auth.sessions."""
    if not get_settings().auth_enabled:
        return {"revoked": True}

    conn = get_supabase_db_conn()
    try:
        with conn.cursor() as cur:
            # Filter by id and user_id to enforce ownership
            cur.execute(
                "DELETE FROM auth.sessions WHERE id = %s AND user_id = %s",
                (session_id, user.user_id),
            )
            conn.commit()
        return {"revoked": True}
    except Exception as e:
        logger.warning("Failed to revoke session %s: %s", session_id, str(e))
        raise HTTPException(status_code=500, detail=f"Failed to revoke session: {e}") from e
    finally:
        conn.close()


@router.delete("/sessions")
def delete_all_other_sessions(
    request: Request,
    user: UserContext = Depends(get_current_user),
) -> dict[str, Any]:
    """Revoke all other user sessions from auth.sessions, then sign out via GoTrue Admin API."""
    if not get_settings().auth_enabled:
        return {"revoked": True}

    if not user.session_id:
        raise HTTPException(
            status_code=400, detail="Current session ID is unknown. Cannot revoke other sessions."
        )

    # 1. SQL delete query first
    conn = get_supabase_db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM auth.sessions WHERE user_id = %s AND id != %s",
                (user.user_id, user.session_id),
            )
            conn.commit()
    except Exception as e:
        logger.warning("Database delete of other sessions failed: %s", str(e))
        raise HTTPException(
            status_code=500, detail=f"Database error during session revocation: {e}"
        ) from e
    finally:
        conn.close()

    # 2. GoTrue admin api sign_out with others scope
    auth_header = request.headers.get("Authorization")
    jwt_token = None
    if auth_header and auth_header.startswith("Bearer "):
        jwt_token = auth_header[7:]

    if jwt_token:
        try:
            from app.core.supabase import get_supabase_client

            client = get_supabase_client()
            client.auth.admin.sign_out(jwt_token, scope="others")
        except Exception as e:
            logger.warning("GoTrue admin sign_out scope=others failed: %s", str(e))

    return {"revoked": True}


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------


def _build_notifications(
    user: UserContext,
    doc_count: int,
    store_initialized: bool,
    usage: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    """Compute the live notification list from system state.

    Notifications are purely derived — they are NOT stored.
    Order: critical → warning → info → onboarding.
    """
    notifications: list[dict[str, Any]] = []
    now = datetime.now(UTC).isoformat()

    # 1. Vector store not initialized (critical — system unusable)
    if not store_initialized:
        notifications.append(
            {
                "id": "sys-store-not-init",
                "type": "critical",
                "icon": "error",
                "title": "Knowledge Base Not Ready",
                "body": (
                    "The vector store has not been initialised. "
                    "Upload at least one document to activate the RAG pipeline."
                ),
                "timestamp": now,
                "dismissible": False,
                "action": {"label": "Upload Document", "href": "/documents"},
            }
        )

    # 2. Usage quota notifications (only if usage data available)
    if usage is not None:
        pct = usage.get("percentage", 0)
        used = usage.get("used", 0)
        limit = usage.get("limit", 50)

        if pct >= 100:
            notifications.append(
                {
                    "id": "usage-critical",
                    "type": "critical",
                    "icon": "block",
                    "title": "AI Query Limit Reached",
                    "body": (
                        f"You have used all {limit} AI queries for this period. "
                        "New queries are blocked until the quota resets."
                    ),
                    "timestamp": now,
                    "dismissible": False,
                    "action": {"label": "View Usage", "href": "/analytics"},
                }
            )
        elif pct >= 80:
            notifications.append(
                {
                    "id": "usage-warning",
                    "type": "warning",
                    "icon": "warning",
                    "title": "AI Usage Approaching Limit",
                    "body": (
                        f"You have used {used} of {limit} AI queries "
                        f"({pct:.0f}%). Consider your usage before the quota resets."
                    ),
                    "timestamp": now,
                    "dismissible": True,
                    "action": {"label": "View Analytics", "href": "/analytics"},
                }
            )

    # 3. Onboarding — no documents yet
    if doc_count == 0:
        notifications.append(
            {
                "id": "onboarding-upload",
                "type": "info",
                "icon": "upload_file",
                "title": "Get Started: Upload Your First Document",
                "body": ("Upload a PDF, text file, or URL to begin querying your knowledge base."),
                "timestamp": now,
                "dismissible": True,
                "action": {"label": "Upload Document", "href": "/documents"},
            }
        )

    # 4. Welcome notification for new users (only if no docs)
    if doc_count == 0 and user.user_id != "anonymous":
        notifications.append(
            {
                "id": "welcome",
                "type": "info",
                "icon": "celebration",
                "title": "Welcome to Intelligent Knowledge",
                "body": (
                    "Your account is set up. Start by uploading documents "
                    "to build your knowledge base."
                ),
                "timestamp": now,
                "dismissible": True,
                "action": None,
            }
        )

    return notifications


@router.get("/notifications")
def get_notifications(
    user: UserContext = Depends(get_current_user),
    reg=Depends(get_registry),
    vector_store: Any = Depends(get_vector_store_optional),
) -> dict[str, Any]:
    """Return computed notifications for the current user.

    Notifications are derived from live system state — not persisted.
    This means they reappear after page refresh until conditions clear.
    Dismissal is handled client-side only.
    """
    docs = reg.list_documents(owner_id=user.user_id)
    doc_count = len(docs)
    store_initialized = vector_store is not None

    # Safely fetch usage — never crash the notifications endpoint
    usage: dict[str, Any] | None = None
    try:
        usage = UsageService.get_usage(user.user_id)
    except Exception:
        logger.warning("Failed to fetch usage for notifications (user=%s)", user.user_id)

    notifications = _build_notifications(user, doc_count, store_initialized, usage)

    return {
        "notifications": notifications,
        "total": len(notifications),
        "unread_count": len(notifications),
    }
