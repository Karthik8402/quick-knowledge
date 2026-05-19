"""FastAPI dependency injection for shared resources."""

from __future__ import annotations

import logging
from typing import Any

from .core.auth import UserContext, get_current_user, get_optional_user  # noqa: F401 — re-exported
from .exceptions import VectorStoreNotInitializedError
from .storage import registry

logger = logging.getLogger(__name__)

# Module-level state managed by the lifespan context
_vector_store: Any = None
_embeddings: Any = None
_init_error: Exception | None = None


def set_vector_store(store: Any) -> None:
    global _vector_store
    _vector_store = store


def set_embeddings(emb: Any) -> None:
    global _embeddings
    _embeddings = emb


def get_vector_store() -> Any:
    """Dependency that provides the active vector store, or raises if unavailable."""
    if _vector_store is None:
        error_msg = (
            str(_init_error)
            if _init_error
            else "Vector store not initialized. Check configuration."
        )
        raise VectorStoreNotInitializedError(error_msg)
    return _vector_store


def get_vector_store_optional() -> Any | None:
    """Dependency that provides the vector store or None (non-failing)."""
    return _vector_store


def get_embeddings_instance() -> Any | None:
    """Dependency that provides the embeddings model."""
    return _embeddings


def get_registry():
    """Dependency that provides the document registry (local or Supabase)."""
    return registry


def set_init_error(err: Exception | None) -> None:
    global _init_error
    _init_error = err


def get_init_error() -> Exception | None:
    return _init_error
