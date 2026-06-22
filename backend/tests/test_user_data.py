from __future__ import annotations

import os
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.dependencies import get_vector_store_optional
from app.main import app


def _make_doc(
    doc_id: str = "doc-001",
    file_name: str = "test.pdf",
    source_type: str = "pdf",
    pages: int = 5,
    chunks: int = 20,
    owner_id: str = "anonymous",
    created_at: str = "2026-06-11T12:00:00+00:00",
) -> dict:
    """Build a minimal document registry record."""
    return {
        "document_id": doc_id,
        "file_name": file_name,
        "source_type": source_type,
        "pages": pages,
        "chunks": chunks,
        "content_hash": f"hash-{doc_id}",
        "owner_id": owner_id,
        "created_at": created_at,
    }


# ---------------------------------------------------------------------------
# Sessions Tests
# ---------------------------------------------------------------------------
class TestUserSessions:
    def test_sessions_empty_registry(self, test_client: TestClient):
        """Test sessions when registry is empty (no docs)."""
        resp = test_client.get("/user/sessions")
        assert resp.status_code == 200
        data = resp.json()
        assert "sessions" in data
        assert len(data["sessions"]) == 1

        sess = data["sessions"][0]
        assert sess["session_id"] == "current"
        assert sess["is_current"] is True
        assert sess["status"] == "active"
        assert sess["user_id"] == "anonymous"
        assert sess["is_anonymous"] is True
        assert sess["last_activity"] is None
        assert sess["first_seen"] is None
        assert sess["document_count"] == 0

    def test_sessions_with_docs(self, test_client: TestClient, tmp_registry):
        """Test sessions when registry has documents (inferred activity/first_seen)."""
        tmp_registry.upsert(_make_doc("doc1", created_at="2026-06-10T10:00:00+00:00"))
        tmp_registry.upsert(_make_doc("doc2", created_at="2026-06-11T11:00:00+00:00"))

        resp = test_client.get("/user/sessions")
        assert resp.status_code == 200
        data = resp.json()
        sess = data["sessions"][0]
        assert sess["first_seen"] == "2026-06-10T10:00:00+00:00"
        assert sess["last_activity"] == "2026-06-11T11:00:00+00:00"
        assert sess["document_count"] == 2

    def test_sessions_auth_guard(self, tmp_registry, mock_vector_store):
        """When AUTH_ENABLED=true, unauthenticated /user/sessions must return 401."""
        os.environ["AUTH_ENABLED"] = "true"
        try:
            from app.config import get_settings

            get_settings.cache_clear()

            from app.dependencies import get_registry, set_embeddings, set_vector_store

            set_vector_store(mock_vector_store)
            set_embeddings(MagicMock())
            app.dependency_overrides[get_registry] = lambda: tmp_registry

            client = TestClient(app, raise_server_exceptions=False)
            resp = client.get("/user/sessions")
            assert resp.status_code == 401
        finally:
            os.environ["AUTH_ENABLED"] = "false"
            from app.config import get_settings

            get_settings.cache_clear()
            app.dependency_overrides.clear()
            set_vector_store(None)
            set_embeddings(None)

    def test_sessions_database_failure_fallback(self, tmp_registry, mock_vector_store):
        """When AUTH_ENABLED=true and DB connection fails, /user/sessions returns fallback current session."""
        os.environ["AUTH_ENABLED"] = "true"
        try:
            from app.config import get_settings

            get_settings.cache_clear()

            with patch(
                "app.api.v1.endpoints.user_data.get_supabase_db_conn",
                side_effect=Exception("DB Connection failed"),
            ):
                from app.dependencies import get_registry, set_embeddings, set_vector_store

                set_vector_store(mock_vector_store)
                set_embeddings(MagicMock())
                app.dependency_overrides[get_registry] = lambda: tmp_registry

                from app.core.auth import UserContext, get_current_user

                dummy_user = UserContext(
                    user_id="user-123",
                    email="user@example.com",
                    role="user",
                    session_id="my-session-id",
                )
                app.dependency_overrides[get_current_user] = lambda: dummy_user

                client = TestClient(app, raise_server_exceptions=False)
                resp = client.get(
                    "/user/sessions",
                    headers={
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0"
                    },
                )
                assert resp.status_code == 200
                data = resp.json()
                assert "sessions" in data
                assert len(data["sessions"]) == 1
                sess = data["sessions"][0]
                assert sess["session_id"] == "my-session-id"
                assert sess["is_current"] is True
                assert "note" in data
                assert "temporarily unavailable" in data["note"]
        finally:
            os.environ["AUTH_ENABLED"] = "false"
            from app.config import get_settings

            get_settings.cache_clear()
            app.dependency_overrides.clear()
            set_vector_store(None)
            set_embeddings(None)


# ---------------------------------------------------------------------------
# Notifications Tests
# ---------------------------------------------------------------------------
class TestUserNotifications:
    def test_notifications_default_state(self, test_client: TestClient, tmp_registry):
        """Test default notifications when store is initialized but no documents."""
        resp = test_client.get("/user/notifications")
        assert resp.status_code == 200
        data = resp.json()
        assert "notifications" in data

        notifs = data["notifications"]
        assert any(n["id"] == "onboarding-upload" for n in notifs)

    def test_notifications_vector_store_not_initialized(self, test_client: TestClient):
        """Test critical notification when vector store is not initialized."""
        app.dependency_overrides[get_vector_store_optional] = lambda: None
        try:
            resp = test_client.get("/user/notifications")
            assert resp.status_code == 200
            data = resp.json()
            notifs = data["notifications"]

            notif = next((n for n in notifs if n["id"] == "sys-store-not-init"), None)
            assert notif is not None
            assert notif["type"] == "critical"
            assert notif["dismissible"] is False
        finally:
            if get_vector_store_optional in app.dependency_overrides:
                del app.dependency_overrides[get_vector_store_optional]

    def test_notifications_usage_warning_and_critical(self, test_client: TestClient):
        """Test usage notifications at warning (>=80%) and critical (>=100%) thresholds."""
        # Case A: 84% usage
        mock_usage_warning = {"used": 42, "limit": 50, "percentage": 84.0, "plan": "free"}
        with patch(
            "app.services.usage_service.UsageService.get_usage", return_value=mock_usage_warning
        ):
            resp = test_client.get("/user/notifications")
            assert resp.status_code == 200
            notifs = resp.json()["notifications"]
            notif = next((n for n in notifs if n["id"] == "usage-warning"), None)
            assert notif is not None
            assert notif["type"] == "warning"
            assert notif["dismissible"] is True

        # Case B: 100% usage
        mock_usage_critical = {"used": 50, "limit": 50, "percentage": 100.0, "plan": "free"}
        with patch(
            "app.services.usage_service.UsageService.get_usage", return_value=mock_usage_critical
        ):
            resp = test_client.get("/user/notifications")
            assert resp.status_code == 200
            notifs = resp.json()["notifications"]
            notif = next((n for n in notifs if n["id"] == "usage-critical"), None)
            assert notif is not None
            assert notif["type"] == "critical"
            assert notif["dismissible"] is False

    def test_notifications_usage_error_graceful(self, test_client: TestClient):
        """If fetching usage raises an exception, the notifications endpoint still succeeds."""
        with patch(
            "app.services.usage_service.UsageService.get_usage",
            side_effect=ValueError("Database error"),
        ):
            resp = test_client.get("/user/notifications")
            assert resp.status_code == 200
            data = resp.json()
            assert "notifications" in data

    def test_notifications_with_documents(self, test_client: TestClient, tmp_registry):
        """Test notifications when documents are present in the registry."""
        tmp_registry.upsert(
            {
                "document_id": "doc-789",
                "file_name": "research_paper.pdf",
                "owner_id": "anonymous",
                "created_at": "2026-06-22T10:00:00Z",
                "chunks": 42,
                "content_hash": "hash123",
                "pages": 5,
                "source_type": "upload",
            }
        )

        resp = test_client.get("/user/notifications")
        assert resp.status_code == 200
        data = resp.json()
        assert "notifications" in data
        notifs = data["notifications"]

        # 1. Onboarding upload and welcome notifications should NOT be present
        assert not any(n["id"] == "onboarding-upload" for n in notifs)
        assert not any(n["id"] == "welcome" for n in notifs)

        # 2. Document indexed notification should be present
        doc_notif = next((n for n in notifs if n["id"] == "doc-indexed-doc-789"), None)
        assert doc_notif is not None
        assert "research_paper.pdf" in doc_notif["body"]
        assert doc_notif["type"] == "info"
        assert doc_notif["action"]["label"] == "Search Document"

        # 3. Platform update notification should be present
        update_notif = next((n for n in notifs if n["id"] == "platform-update-v3"), None)
        assert update_notif is not None

        # 4. Pro Tip: Tuning Search Relevance should be present
        tip_notif = next((n for n in notifs if n["id"] == "tip-rag-tuning"), None)
        assert tip_notif is not None
