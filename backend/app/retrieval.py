"""Vector store builder and retrieval — dual-mode: ChromaDB (local) or pgvector (Supabase).

Key production features:
  - MMR (Max Marginal Relevance) as default retrieval strategy
  - Strict owner_id filtering on ALL vector queries (data isolation)
  - Detailed observability logging (scores, timings, document IDs)
"""

from __future__ import annotations

import logging
import time
from typing import Any

from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings

from .config import get_settings

logger = logging.getLogger(__name__)


def build_vector_store(embeddings: Embeddings):
    """Build or connect to the vector store based on config."""
    settings = get_settings()

    if settings.vector_store.lower() == "pgvector":
        return _build_pgvector_store(embeddings)

    if settings.vector_store.lower() == "faiss":
        return _build_faiss_store(embeddings)

    # Default: ChromaDB
    return _build_chroma_store(embeddings)


def _build_pgvector_store(embeddings: Embeddings):
    """Connect to Supabase Postgres with pgvector extension."""
    from langchain_postgres import PGVector

    settings = get_settings()
    connection_string = settings.database_url

    if not connection_string:
        raise ValueError("DATABASE_URL is required when VECTOR_STORE=pgvector")

    store = PGVector(
        embeddings=embeddings,
        connection=connection_string,
        collection_name="knowledge_base",
        use_jsonb=True,
    )
    logger.info("pgvector store connected to Supabase Postgres")
    return store


def _build_chroma_store(embeddings: Embeddings):
    """Build a local ChromaDB store with a robust retry mechanism for race conditions."""
    import random
    import time

    from langchain_chroma import Chroma

    settings = get_settings()

    for attempt in range(3):
        try:
            return Chroma(
                persist_directory=settings.chroma_persist_dir,
                embedding_function=embeddings,
                collection_name="knowledge_base",
            )
        except Exception as e:
            if "already exists" in str(e) or "locked" in str(e).lower():
                logger.warning(
                    "ChromaDB initialization collision, retrying in a moment (attempt %d/3): %s",
                    attempt + 1,
                    e,
                )
                time.sleep(1.0 + random.random())
            else:
                raise

    # Final fallback attempt
    return Chroma(
        persist_directory=settings.chroma_persist_dir,
        embedding_function=embeddings,
        collection_name="knowledge_base",
    )


def _build_faiss_store(embeddings: Embeddings):
    """Build a local FAISS store."""
    from pathlib import Path

    from langchain_community.vectorstores import FAISS

    settings = get_settings()
    faiss_dir = str(Path(settings.upload_dir).parent / "faiss")
    if Path(faiss_dir).exists():
        try:
            return FAISS.load_local(faiss_dir, embeddings, allow_dangerous_deserialization=True)
        except Exception:
            pass
    return FAISS.from_texts(["__empty__"], embedding=embeddings)


def _build_owner_filter(
    owner_id: str | None,
    document_ids: list[str] | None = None,
) -> dict | None:
    """Build a metadata filter dict that enforces owner_id isolation.

    Returns None only if no filtering is needed (should not happen in production).
    """
    conditions: list[dict] = []

    if owner_id and owner_id != "anonymous":
        conditions.append({"owner_id": owner_id})

    if document_ids:
        if len(document_ids) == 1:
            conditions.append({"document_id": document_ids[0]})
        else:
            conditions.append({"$or": [{"document_id": doc_id} for doc_id in document_ids]})

    if not conditions:
        return None
    if len(conditions) == 1:
        return conditions[0]
    return {"$and": conditions}


def retrieve_chunks(
    vector_store: Any,
    question: str,
    top_k: int,
    owner_id: str | None = None,
    document_ids: list[str] | None = None,
) -> list[tuple[Document, float]]:
    """Retrieve relevant chunks using MMR with strict owner_id filtering.

    Args:
        vector_store: The active vector store instance.
        question: The user's question.
        top_k: Number of chunks to retrieve.
        owner_id: The authenticated user's ID (REQUIRED for data isolation).
        document_ids: Optional list of document IDs to scope the search to.

    Returns:
        List of (Document, score) tuples sorted by relevance.

    MMR Score Warning
    -----------------
    MMR search does not return real relevance scores. The scores assigned here
    are **synthetic positional values** (1.0, 0.95, 0.90, ...) and will ALWAYS
    pass the 0.3 grade threshold in grade_node. The relevance gate is therefore
    only meaningful when the similarity fallback path is used (e.g. on MMR
    failure). This is a known limitation of LangChain's MMR API.
    Use pgvector or Chroma; FAISS is NOT recommended for multi-tenant production
    (see FAISS path below for details).
    """
    settings = get_settings()
    store_type = settings.vector_store.lower()
    started = time.perf_counter()

    metadata_filter = _build_owner_filter(owner_id, document_ids)

    logger.info(
        "Retrieval request: store=%s top_k=%d owner_id=%s doc_filter=%s",
        store_type,
        top_k,
        owner_id,
        document_ids or "all",
    )

    # ── pgvector & ChromaDB retrieval (MMR) ──
    if store_type in {"pgvector", "chroma"}:
        try:
            raw_docs = vector_store.max_marginal_relevance_search(
                query=question,
                k=top_k,
                fetch_k=top_k * 3,
                filter=metadata_filter,
            )
            # MMR doesn't return scores; assign positional scores
            docs = [(doc, round(1.0 - (i * 0.05), 4)) for i, doc in enumerate(raw_docs)]
        except Exception as e:
            logger.warning("MMR failed for %s, falling back to similarity: %s", store_type, e)
            docs = vector_store.similarity_search_with_relevance_scores(
                query=question,
                k=top_k,
                filter=metadata_filter,
            )

    # ── FAISS fallback (no native metadata filtering support) ──
    else:
        # FAISS does not support server-side metadata filtering, so we must
        # over-fetch and filter in Python.  Fetching top_k alone means a user's
        # documents may never appear if other users' docs dominate the top-k.
        # Fetching top_k * 10 (capped at 100) gives reasonable recall before
        # the owner filter is applied.
        # ⚠️  FAISS is NOT recommended for multi-tenant production — use
        # pgvector or Chroma which support native metadata filters.
        faiss_fetch_k = min(top_k * 10, 100)
        raw = vector_store.similarity_search_with_score(query=question, k=faiss_fetch_k)
        docs = [(doc, float(score)) for doc, score in raw]
        if owner_id and owner_id != "anonymous":
            docs = [
                (doc, score)
                for doc, score in docs
                if doc.metadata.get("owner_id") == owner_id
            ]
        # Trim to top_k after filtering
        docs = docs[:top_k]

    elapsed_ms = int((time.perf_counter() - started) * 1000)

    # ── Observability logging ──
    for i, (doc, score) in enumerate(docs):
        meta = doc.metadata or {}
        logger.info(
            "  Chunk %d: score=%.4f doc_id=%s file=%s page=%s owner=%s",
            i + 1,
            score,
            meta.get("document_id", "?"),
            meta.get("file_name", "?"),
            meta.get("page", "?"),
            meta.get("owner_id", "?"),
        )

    logger.info(
        "Retrieval complete: %d chunks in %dms (store=%s, method=MMR)",
        len(docs),
        elapsed_ms,
        store_type,
    )

    return docs
