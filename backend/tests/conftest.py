"""Shared pytest fixtures for the Intelligent Knowledge Base test suite."""

from __future__ import annotations

import os
from pathlib import Path
from unittest.mock import MagicMock

from fastapi.testclient import TestClient
from langchain_core.documents import Document
import pytest

# ---------------------------------------------------------------------------
# Ensure test-safe environment variables before any app module imports
# ---------------------------------------------------------------------------
os.environ.setdefault("GOOGLE_API_KEY", "test-key-not-real")
os.environ.setdefault("METADATA_DB_PATH", "./data/test_registry.json")
os.environ.setdefault("SQLITE_DB_PATH", "./data/test_knowledge_base.db")
os.environ.setdefault("STORAGE_BACKEND", "local")
os.environ.setdefault("VECTOR_STORE", "chroma")
os.environ.setdefault("AUTH_ENABLED", "false")


# ---------------------------------------------------------------------------
# Session-level cleanup: wipe the stale shared test registry before run
# ---------------------------------------------------------------------------
@pytest.fixture(autouse=True, scope="session")
def clean_test_registry():
    """Delete the shared test_registry.json BEFORE the session starts.

    This prevents false 'duplicate' results caused by documents uploaded
    during prior test sessions polluting the content hash database.
    The data/ directory is created fresh so subsequent tests can write to it.
    """
    data_dir = Path("./data")
    data_dir.mkdir(parents=True, exist_ok=True)

    stale_path = data_dir / "test_registry.json"
    if stale_path.exists():
        stale_path.unlink()

    yield  # Let all tests run — do NOT delete the file after (tests need it)


# ---------------------------------------------------------------------------
# Clear RuntimeSettings overrides between tests to avoid state pollution
# ---------------------------------------------------------------------------
@pytest.fixture(autouse=True)
def clear_runtime_settings():
    """Clear RuntimeSettings overrides to keep tests isolated."""
    from app.config import RuntimeSettings

    RuntimeSettings._overrides.clear()
    yield
    RuntimeSettings._overrides.clear()


# ---------------------------------------------------------------------------
# Document factory
# ---------------------------------------------------------------------------
def make_document(
    text: str = "sample text",
    document_id: str = "doc-001",
    file_name: str = "test.pdf",
    page: int | None = 0,
) -> Document:
    """Create a LangChain Document with standard metadata."""
    return Document(
        page_content=text,
        metadata={
            "document_id": document_id,
            "file_name": file_name,
            "page": page,
            "source_type": "pdf",
            "chunk_index": 0,
            "owner_id": "anonymous",
            "created_at": "2026-01-01T00:00:00+00:00",
        },
    )


# ---------------------------------------------------------------------------
# Temporary document registry
# ---------------------------------------------------------------------------
@pytest.fixture()
def tmp_registry(tmp_path: Path):
    """Create a LocalDocumentRegistry backed by a temporary JSON file."""
    from app.config import get_settings

    # Clear the lru_cache so we can inject a temp path
    get_settings.cache_clear()

    db_path = tmp_path / "registry.json"
    os.environ["METADATA_DB_PATH"] = str(db_path)
    os.environ["UPLOAD_DIR"] = str(tmp_path / "uploads")
    os.environ["CHROMA_PERSIST_DIR"] = str(tmp_path / "chroma")
    os.environ["SQLITE_DB_PATH"] = str(tmp_path / "knowledge_base.db")
    os.environ["STORAGE_BACKEND"] = "local"
    os.environ["AUTH_ENABLED"] = "false"

    from app import ingest, storage
    from app.storage import LocalDocumentRegistry

    reg = LocalDocumentRegistry()
    original_storage_registry = storage.registry
    storage.registry = reg
    ingest.storage.registry = reg
    yield reg

    storage.registry = original_storage_registry
    ingest.storage.registry = original_storage_registry
    get_settings.cache_clear()


# ---------------------------------------------------------------------------
# Mock vector store
# ---------------------------------------------------------------------------
@pytest.fixture()
def mock_vector_store() -> MagicMock:
    """Return a mock that quacks like a LangChain vector store."""
    store = MagicMock()
    store.similarity_search_with_relevance_scores.return_value = []
    store.similarity_search_with_score.return_value = []
    store.add_documents.return_value = None
    store.delete.return_value = None
    return store


# ---------------------------------------------------------------------------
# FastAPI test client (with mocked dependencies)
# ---------------------------------------------------------------------------
@pytest.fixture()
def test_client(tmp_registry, mock_vector_store) -> TestClient:
    """TestClient wired with mocked vector store and temporary registry."""
    from app.core.sse_limiter import sse_limiter
    from app.dependencies import get_registry, set_embeddings, set_vector_store
    from app.main import app

    set_vector_store(mock_vector_store)
    set_embeddings(MagicMock())
    sse_limiter.reset()  # Clear SSE connection slots between tests

    def override_registry():
        return tmp_registry

    app.dependency_overrides[get_registry] = override_registry

    client = TestClient(app)
    yield client

    app.dependency_overrides.clear()
    set_vector_store(None)
    set_embeddings(None)
    sse_limiter.reset()


# ---------------------------------------------------------------------------
# Async HTTPX client for streaming tests
# ---------------------------------------------------------------------------
@pytest.fixture()
async def async_test_client(tmp_registry, mock_vector_store):
    """Async HTTPX client for testing async streaming endpoints."""
    from unittest.mock import MagicMock

    from httpx import ASGITransport, AsyncClient

    from app.core.sse_limiter import sse_limiter
    from app.dependencies import get_registry, set_embeddings, set_vector_store
    from app.main import app

    set_vector_store(mock_vector_store)
    set_embeddings(MagicMock())
    sse_limiter.reset()  # Clear SSE connection slots between tests

    def override_registry():
        return tmp_registry

    app.dependency_overrides[get_registry] = override_registry

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()
    set_vector_store(None)
    set_embeddings(None)
    sse_limiter.reset()


# ---------------------------------------------------------------------------
# Sample documents fixture
# ---------------------------------------------------------------------------
@pytest.fixture()
def sample_doc_record() -> dict:
    return {
        "document_id": "abc123def456",
        "file_name": "test_report.pdf",
        "source_type": "pdf",
        "pages": 5,
        "chunks": 12,
        "content_hash": "abc123def456ghij789klmno",
        "owner_id": "anonymous",
        "created_at": "2026-01-01T00:00:00+00:00",
    }
