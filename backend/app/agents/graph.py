"""LangGraph RAG agent — Retriever → Grader → Generator pipeline.

This is a simplified but production-ready 3-node graph:
1. **Retrieve**: Fetch relevant chunks from the vector store.
2. **Grade**: Check if retrieved chunks are actually relevant (self-RAG).
3. **Generate**: Produce a grounded answer with citations.

If no relevant chunks survive grading, the graph returns the fallback answer
without calling the LLM — saving API costs.
"""

from __future__ import annotations

from dataclasses import dataclass, field
import logging
from typing import Any

from langchain_core.documents import Document

from ..citations import validate_citation_indices
from ..config import get_settings
from ..generation import (
    FALLBACK_ANSWER,
    answer_with_citations,
)
from ..retrieval import retrieve_chunks

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Agent State
# ---------------------------------------------------------------------------
@dataclass
class RAGState:
    """Mutable state passed through the LangGraph pipeline."""

    question: str = ""
    retrieved_docs: list[tuple[Document, float]] = field(default_factory=list)
    relevant_docs: list[tuple[Document, float]] = field(default_factory=list)
    answer: str = ""
    citation_indices: list[int] = field(default_factory=list)
    fallback: bool = False
    owner_id: str | None = None
    document_ids: list[str] | None = None


# ---------------------------------------------------------------------------
# Node: Retrieve
# ---------------------------------------------------------------------------
def retrieve_node(state: RAGState, vector_store: Any) -> RAGState:
    """Retrieve top-k chunks from the vector store."""
    settings = get_settings()

    docs = retrieve_chunks(
        vector_store=vector_store,
        question=state.question,
        top_k=settings.rag_top_k,
        owner_id=state.owner_id,
        document_ids=state.document_ids,
    )

    state.retrieved_docs = docs
    logger.info("Retrieve node: found %d chunks", len(docs))
    return state


# ---------------------------------------------------------------------------
# Node: Grade (Self-RAG relevance filter)
# ---------------------------------------------------------------------------
def grade_node(state: RAGState) -> RAGState:
    """Filter retrieved chunks by relevance score.

    Chunks with very low relevance scores are discarded to prevent
    the LLM from being confused by irrelevant context. This is a
    lightweight alternative to a full cross-encoder reranker.
    """
    if not state.retrieved_docs:
        state.fallback = True
        return state

    # Keep chunks with relevance score above threshold
    RELEVANCE_THRESHOLD = 0.3
    relevant = []

    for doc, score in state.retrieved_docs:
        # Normalize: some stores return distance (lower=better), others similarity (higher=better)
        # ChromaDB and pgvector return similarity scores where higher is better
        if score >= RELEVANCE_THRESHOLD:
            relevant.append((doc, score))

    if not relevant:
        logger.info("Grade node: no chunks above relevance threshold %.2f", RELEVANCE_THRESHOLD)
        state.fallback = True
    else:
        logger.info(
            "Grade node: %d/%d chunks passed relevance filter",
            len(relevant),
            len(state.retrieved_docs),
        )
        state.relevant_docs = relevant

    return state


# ---------------------------------------------------------------------------
# Node: Generate
# ---------------------------------------------------------------------------
def generate_node(state: RAGState) -> RAGState:
    """Generate a grounded answer with citations from relevant chunks."""
    if state.fallback or not state.relevant_docs:
        state.answer = FALLBACK_ANSWER
        state.citation_indices = []
        return state

    generation = answer_with_citations(state.question, state.relevant_docs)
    state.answer = generation.get("answer", FALLBACK_ANSWER)
    state.citation_indices = generation.get("citation_indices", [])

    # Validate citations
    state.citation_indices = validate_citation_indices(
        state.citation_indices, len(state.relevant_docs)
    )

    # If we got an answer but no valid citations, fall back
    if state.answer != FALLBACK_ANSWER and not state.citation_indices:
        state.answer = FALLBACK_ANSWER

    logger.info(
        "Generate node: answer length=%d, citations=%d",
        len(state.answer),
        len(state.citation_indices),
    )
    return state


# ---------------------------------------------------------------------------
# Graph executor (synchronous pipeline)
# ---------------------------------------------------------------------------
def run_rag_agent(
    question: str,
    vector_store: Any,
    owner_id: str | None = None,
    document_ids: list[str] | None = None,
) -> RAGState:
    """Execute the full RAG agent pipeline.

    This is a synchronous, sequential execution of the 3 nodes.
    For production LangGraph with async/branching, this can be
    upgraded to use langgraph.graph.StateGraph.
    """
    state = RAGState(question=question, owner_id=owner_id, document_ids=document_ids)

    # Step 1: Retrieve
    state = retrieve_node(state, vector_store)

    # Step 2: Grade
    state = grade_node(state)

    # Step 3: Generate
    state = generate_node(state)

    return state
