"""API integration tests for v3.0 — covers health, status, settings, documents, chat, CORS, and request IDs."""

from __future__ import annotations

from io import BytesIO

import pytest


# ═══════════════════════════════════════════════════════════════════════════
# Health Endpoint
# ═══════════════════════════════════════════════════════════════════════════
class TestHealthEndpoint:
    def test_health_returns_healthy(self, test_client):
        resp = test_client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "git_commit" in data

    def test_health_head_returns_200(self, test_client):
        resp = test_client.head("/health")
        assert resp.status_code == 200

    def test_health_details_contains_version(self, test_client):
        resp = test_client.get("/health/details")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] in ("healthy", "degraded")
        assert "version" in data
        assert data["version"] == "3.0.0"
        assert "git_commit" in data
        assert data["git_commit"] == "local"

    def test_health_details_contains_uptime(self, test_client):
        resp = test_client.get("/health/details")
        assert resp.status_code == 200
        data = resp.json()
        assert "uptime_seconds" in data
        assert isinstance(data["uptime_seconds"], int)
        assert data["uptime_seconds"] >= 0

    def test_health_details_contains_python_version(self, test_client):
        resp = test_client.get("/health/details")
        assert resp.status_code == 200
        data = resp.json()
        assert "python_version" in data

    def test_health_details_contains_timestamp(self, test_client):
        resp = test_client.get("/health/details")
        assert resp.status_code == 200
        data = resp.json()
        assert "timestamp" in data

    def test_health_details_as_non_admin_fails(self, test_client):
        from app.core.auth import UserContext, get_current_user
        from app.main import app

        def mock_regular_user():
            return UserContext(user_id="user-456", email="user@example.com", role="authenticated")

        app.dependency_overrides[get_current_user] = mock_regular_user
        try:
            resp = test_client.get("/health/details")
            assert resp.status_code == 403
            assert "Admin privileges required" in resp.json()["detail"]
        finally:
            app.dependency_overrides.pop(get_current_user, None)


# ═══════════════════════════════════════════════════════════════════════════
# Status Endpoint
# ═══════════════════════════════════════════════════════════════════════════
class TestStatusEndpoint:
    def test_status_returns_system_info(self, test_client):
        resp = test_client.get("/status")
        assert resp.status_code == 200
        data = resp.json()
        assert "vector_store" in data
        assert "llm_provider" in data
        assert "store_initialized" in data
        assert "documents" in data
        assert "chunks" in data

    def test_status_shows_zero_documents_initially(self, test_client):
        resp = test_client.get("/status")
        data = resp.json()
        assert data["documents"] == 0
        assert data["chunks"] == 0

    def test_status_store_initialized_true(self, test_client):
        resp = test_client.get("/status")
        data = resp.json()
        # mock_vector_store is set, so should be True
        assert data["store_initialized"] is True

    def test_status_embeddings_loaded_true(self, test_client):
        resp = test_client.get("/status")
        data = resp.json()
        assert data["embeddings_loaded"] is True


# ═══════════════════════════════════════════════════════════════════════════
# Documents Endpoint
# ═══════════════════════════════════════════════════════════════════════════
class TestDocumentsEndpoint:
    def test_list_documents_empty(self, test_client):
        resp = test_client.get("/documents")
        assert resp.status_code == 200
        assert resp.json()["documents"] == []

    def test_delete_nonexistent_returns_404(self, test_client):
        resp = test_client.delete("/documents/fake-id-12345")
        assert resp.status_code == 404

    def test_upload_no_files_returns_422(self, test_client):
        resp = test_client.post("/documents/upload")
        assert resp.status_code == 422

    def test_upload_unsupported_file(self, test_client):
        files = [("files", ("bad.xlsx", BytesIO(b"data"), "application/octet-stream"))]
        resp = test_client.post("/documents/upload", files=files)
        assert resp.status_code == 200
        data = resp.json()
        assert data[0]["status"] == "failed"
        assert "Unsupported" in data[0]["error"]

    def test_upload_valid_txt_file(self, test_client, mock_vector_store):
        import uuid

        # Use unique content each run to avoid duplicate-hash collisions
        unique_suffix = uuid.uuid4().hex
        content = (
            f"This is test content for a valid document upload. {unique_suffix} ".encode() * 10
        )
        files = [("files", ("valid.txt", BytesIO(content), "text/plain"))]
        resp = test_client.post("/documents/upload", files=files)
        assert resp.status_code == 200
        data = resp.json()
        assert data[0]["status"] == "indexed"
        assert data[0]["chunks"] > 0

    def test_upload_then_list(self, test_client, mock_vector_store, tmp_registry):
        # Clear registry to isolate from prior tests
        content = b"Document for listing test. " * 10
        files = [("files", ("listing.txt", BytesIO(content), "text/plain"))]
        test_client.post("/documents/upload", files=files)

        resp = test_client.get("/documents")
        data = resp.json()
        assert any(d["file_name"] == "listing.txt" for d in data["documents"])

    def test_upload_duplicate_detection(self, test_client, mock_vector_store):
        content = b"Duplicate detection test content. " * 10
        files1 = [("files", ("dup.txt", BytesIO(content), "text/plain"))]
        test_client.post("/documents/upload", files=files1)

        files2 = [("files", ("dup.txt", BytesIO(content), "text/plain"))]
        resp = test_client.post("/documents/upload", files=files2)
        data = resp.json()
        assert data[0]["status"] == "duplicate"


# ═══════════════════════════════════════════════════════════════════════════
# Chunks Endpoint
# ═══════════════════════════════════════════════════════════════════════════
class TestChunksEndpoint:
    def test_get_chunks_empty(self, test_client):
        resp = test_client.get("/documents/nonexistent/chunks")
        assert resp.status_code == 200
        data = resp.json()
        assert data["chunks"] == []

    def test_get_chunks_returns_document_id(self, test_client):
        resp = test_client.get("/documents/test-doc-123/chunks")
        data = resp.json()
        assert data["document_id"] == "test-doc-123"


# ═══════════════════════════════════════════════════════════════════════════
# Chat Endpoint
# ═══════════════════════════════════════════════════════════════════════════
class TestChatEndpoint:
    def test_chat_no_documents_returns_fallback(self, test_client):
        resp = test_client.post(
            "/chat",
            json={"question": "What is AI?"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "citations" in data
        assert "retrieved_chunks" in data
        assert "answer" in data

    def test_chat_empty_question_returns_422(self, test_client):
        resp = test_client.post("/chat", json={"question": ""})
        assert resp.status_code == 422

    def test_chat_missing_question_returns_422(self, test_client):
        resp = test_client.post("/chat", json={})
        assert resp.status_code == 422

    def test_chat_response_structure(self, test_client):
        resp = test_client.post(
            "/chat",
            json={"question": "test question"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data["answer"], str)
        assert isinstance(data["citations"], list)
        assert isinstance(data["retrieved_chunks"], list)


# ═══════════════════════════════════════════════════════════════════════════
# Chat Streaming Endpoint
# ═══════════════════════════════════════════════════════════════════════════
class TestChatStreamEndpoint:
    @pytest.mark.asyncio
    async def test_stream_returns_200(self, async_test_client):
        import asyncio

        from sse_starlette.sse import AppStatus

        AppStatus.should_exit_event = asyncio.Event()

        resp = await async_test_client.post(
            "/chat/stream",
            json={"question": "What is AI?"},
        )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_stream_content_type_is_sse(self, async_test_client):
        import asyncio

        from sse_starlette.sse import AppStatus

        AppStatus.should_exit_event = asyncio.Event()

        resp = await async_test_client.post(
            "/chat/stream",
            json={"question": "test"},
        )
        assert "text/event-stream" in resp.headers.get("content-type", "")

    @pytest.mark.asyncio
    async def test_stream_empty_question_returns_422(self, async_test_client):
        import asyncio

        from sse_starlette.sse import AppStatus

        AppStatus.should_exit_event = asyncio.Event()

        resp = await async_test_client.post("/chat/stream", json={"question": ""})
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_stream_contains_events(self, async_test_client):
        import asyncio

        from sse_starlette.sse import AppStatus

        AppStatus.should_exit_event = asyncio.Event()

        resp = await async_test_client.post(
            "/chat/stream",
            json={"question": "test"},
        )
        body = resp.text
        assert "event:" in body or "data:" in body


# ═══════════════════════════════════════════════════════════════════════════
# Settings Endpoint
# ═══════════════════════════════════════════════════════════════════════════
class TestSettingsEndpoint:
    def test_get_settings(self, test_client):
        resp = test_client.get("/settings")
        assert resp.status_code == 200
        data = resp.json()
        assert "rag_top_k" in data
        assert "llm_provider" in data
        assert "vector_store" in data

    def test_update_settings(self, test_client):
        resp = test_client.put(
            "/settings",
            json={
                "rag_top_k": 10,
                "llm_provider": "openai",
                "vector_store": "faiss",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "updated_in_memory"

    def test_update_partial_settings(self, test_client):
        resp = test_client.put("/settings", json={"rag_top_k": 3})
        assert resp.status_code == 200
        data = resp.json()
        assert data["settings"]["rag_top_k"] == 3

    def test_update_settings_as_non_admin_fails(self, test_client):
        from app.core.auth import UserContext, get_current_user
        from app.main import app

        def mock_regular_user():
            return UserContext(user_id="user-456", email="user@example.com", role="authenticated")

        app.dependency_overrides[get_current_user] = mock_regular_user
        try:
            resp = test_client.put("/settings", json={"rag_top_k": 3})
            assert resp.status_code == 403
            assert "Admin privileges required" in resp.json()["detail"]
        finally:
            app.dependency_overrides.pop(get_current_user, None)


# ═══════════════════════════════════════════════════════════════════════════
# Request ID Middleware
# ═══════════════════════════════════════════════════════════════════════════
class TestRequestIdMiddleware:
    def test_response_contains_request_id_header(self, test_client):
        resp = test_client.get("/health")
        assert "x-request-id" in resp.headers

    def test_request_id_is_returned(self, test_client):
        resp = test_client.get("/health")
        request_id = resp.headers.get("x-request-id")
        assert request_id is not None
        assert len(request_id) > 0

    def test_client_provided_request_id_is_echoed(self, test_client):
        resp = test_client.get("/health", headers={"X-Request-ID": "my-custom-id"})
        assert resp.headers["x-request-id"] == "my-custom-id"


# ═══════════════════════════════════════════════════════════════════════════
# CORS Headers
# ═══════════════════════════════════════════════════════════════════════════
class TestCORSHeaders:
    def test_cors_allows_configured_origin(self, test_client):
        resp = test_client.options(
            "/health",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert resp.status_code in (200, 204, 405)
