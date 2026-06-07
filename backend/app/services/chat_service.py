import json
import logging
import re
import time
from typing import Any

from langchain_core.documents import Document

from app.citations import validate_citation_indices
from app.config import get_settings
from app.generation import FALLBACK_ANSWER, answer_with_citations, stream_answer_with_citations
from app.schemas import ChatResponse, Citation, RetrievedChunk

logger = logging.getLogger(__name__)


class ChatService:
    # Prompt injection patterns — basic guardrails against adversarial inputs.
    # NOTE: these catch common patterns but are not a complete defence.
    # Unicode homoglyph and indirect injection via document content require
    # an LLM-based guardrail (e.g. Llama Guard) for full protection.
    _INJECTION_PATTERNS = [
        # Original 5
        re.compile(r"ignore\s+(all\s+)?previous\s+instructions", re.IGNORECASE),
        re.compile(r"you\s+are\s+now\s+(a|an)\s+", re.IGNORECASE),
        re.compile(r"system\s*:\s*", re.IGNORECASE),
        re.compile(r"<\|?(system|im_start|endoftext)\|?>", re.IGNORECASE),
        re.compile(r"ADMIN\s*MODE", re.IGNORECASE),
        # Additional patterns
        re.compile(r"disregard\s+(all\s+)?(previous|prior)", re.IGNORECASE),
        re.compile(r"forget\s+(all\s+)?(?:previous|prior|earlier)", re.IGNORECASE),
        re.compile(r"act\s+as\s+(?:a|an)\s+", re.IGNORECASE),
        re.compile(r"new\s+instructions?\s*:", re.IGNORECASE),
        # Unicode fullwidth Latin homoglyph attack (e.g. ｉｇｎｏｒｅ)
        re.compile(r"[\uff41-\uff5a\uff21-\uff3a]"),
    ]

    @classmethod
    def check_prompt_injection(cls, question: str) -> bool:
        """Return True if the question looks like a prompt injection attempt."""
        for pattern in cls._INJECTION_PATTERNS:
            if pattern.search(question):
                return True
        return False

    @staticmethod
    def _extractive_fallback(retrieved: list[tuple[Document, float]]) -> str:
        """Create a short extractive answer when the LLM returns the fallback."""
        if not retrieved:
            return FALLBACK_ANSWER
        # Prefer the longest chunk to avoid returning only a title line.
        best_doc = max(retrieved, key=lambda item: len(item[0].page_content or ""))[0]
        joined = " ".join(
            [
                (best_doc.page_content or "").strip(),
                *[doc.page_content.strip() for doc, _score in retrieved[1:] if doc.page_content],
            ]
        )
        sentences = [s for s in re.split(r"(?<=[.!?])\s+", joined) if s]
        summary = " ".join(sentences[:4]).strip()
        if not summary:
            summary = joined[:500].strip()
        return summary or FALLBACK_ANSWER

    @staticmethod
    def _infer_document_filter(question: str, reg, owner_id: str) -> list[str] | None:
        """Infer document filter from question text and available document filenames.

        Matches if any keyword appears in:
          1. The user's question (lowercased), OR
          2. Any document filename owned by the user (lowercased).

        This ensures 'explain the refund policy' still routes correctly when
        the document is named 'refund_policy_2025.pdf' even if 'policy' is
        not mentioned by the user.
        """
        _KEYWORDS = (
            "resume", "cv", "policy", "report", "invoice",
            "contract", "manual", "spec", "whitepaper",
        )
        q = question.lower()
        question_keywords = {kw for kw in _KEYWORDS if kw in q}

        docs = reg.list_documents(owner_id=owner_id) or []

        matched: list[str] = []
        for doc in docs:
            fname = (doc.get("file_name") or "").lower()
            doc_id = doc.get("document_id")
            if not doc_id:
                continue
            # Match if keyword appears in question OR in the document's filename.
            if any(kw in fname for kw in _KEYWORDS) and (
                any(kw in q for kw in _KEYWORDS)
                or any(kw in fname for kw in question_keywords)
            ):
                matched.append(doc_id)

        return matched or None

    @staticmethod
    def build_chat_response(
        question: str,
        vector_store: Any,
        reg,
        owner_id: str,
        document_ids: list[str] | None = None,
        history: list[dict] | None = None,
    ) -> ChatResponse:
        """Core chat logic shared by standard endpoint."""
        from fastapi import HTTPException
        if history:
            for turn in history:
                if turn.get("role") == "user" and ChatService.check_prompt_injection(turn.get("content", "")):
                    raise HTTPException(status_code=400, detail="Invalid input detected in history")

        if reg.count(owner_id=owner_id) == 0 or vector_store is None:
            logger.info("Chat fallback: no documents or vector store unavailable")
            return ChatResponse(
                answer=FALLBACK_ANSWER
                if vector_store is not None
                else "Backend not configured correctly (missing API keys).",
                citations=[],
                retrieved_chunks=[],
            )

        inferred_doc_ids = document_ids or ChatService._infer_document_filter(
            question, reg, owner_id
        )

        from app.agents.graph import run_rag_agent

        state = run_rag_agent(
            question=question,
            vector_store=vector_store,
            owner_id=owner_id,
            document_ids=inferred_doc_ids,
            history=history,
        )

        answer_text = state.answer
        if answer_text == FALLBACK_ANSWER and state.retrieved_docs:
            answer_text = ChatService._extractive_fallback(state.retrieved_docs)

        citations: list[Citation] = []
        retrieved_chunks: list[RetrievedChunk] = []

        # Build retrieved_chunks from all retrieved docs
        for doc, score in state.retrieved_docs:
            meta = doc.metadata or {}
            page_value = meta.get("page")
            page_number = int(page_value) + 1 if isinstance(page_value, int) else None

            chunk_payload = RetrievedChunk(
                document_id=meta.get("document_id", "unknown"),
                file_name=meta.get("file_name", "unknown"),
                page=page_number,
                score=round(float(score), 4) if score is not None else None,
                text=doc.page_content[:800],
            )
            retrieved_chunks.append(chunk_payload)

        # Build citations from relevant docs that were actually used
        safe_indices = state.citation_indices
        for idx, (doc, _score) in enumerate(state.relevant_docs, start=1):
            if idx in safe_indices:
                meta = doc.metadata or {}
                page_value = meta.get("page")
                page_number = int(page_value) + 1 if isinstance(page_value, int) else None
                citations.append(
                    Citation(
                        document_id=meta.get("document_id", "unknown"),
                        file_name=meta.get("file_name", "unknown"),
                        page=page_number,
                        snippet=doc.page_content[:220],
                    )
                )

        if not citations and state.relevant_docs:
            # Fallback citation if model omitted it but context was used
            doc, score = state.relevant_docs[0]
            meta = doc.metadata or {}
            page_value = meta.get("page")
            page_number = int(page_value) + 1 if isinstance(page_value, int) else None
            citations.append(
                Citation(
                    document_id=meta.get("document_id", "unknown"),
                    file_name=meta.get("file_name", "unknown"),
                    page=page_number,
                    snippet=doc.page_content[:220],
                )
            )

        return ChatResponse(
            answer=answer_text, citations=citations, retrieved_chunks=retrieved_chunks
        )

    @staticmethod
    async def chat_stream_generator(
        question: str,
        vector_store: Any,
        reg,
        owner_id: str,
        document_ids: list[str] | None = None,
        history: list[dict] | None = None,
    ):
        if history:
            for turn in history:
                if turn.get("role") == "user" and ChatService.check_prompt_injection(turn.get("content", "")):
                    yield {"event": "error", "data": "Invalid input detected in history"}
                    return

        if reg.count(owner_id=owner_id) == 0 or vector_store is None:
            fallback = (
                FALLBACK_ANSWER
                if vector_store is not None
                else "Backend not configured correctly (missing API keys)."
            )
            yield {"event": "token", "data": fallback}
            yield {"event": "citations", "data": json.dumps([])}
            yield {"event": "done", "data": ""}
            return

        settings = get_settings()
        inferred_doc_ids = document_ids or ChatService._infer_document_filter(
            question, reg, owner_id
        )

        from app.agents.graph import RAGState, grade_node, retrieve_node

        state = RAGState(question=question, owner_id=owner_id, document_ids=inferred_doc_ids)
        state = retrieve_node(state, vector_store)
        state = grade_node(state)

        if state.fallback or not state.relevant_docs:
            yield {"event": "token", "data": FALLBACK_ANSWER}
            yield {"event": "citations", "data": json.dumps([])}
            yield {"event": "done", "data": ""}
            return

        citations_data = []
        for _idx, (doc, _score) in enumerate(state.relevant_docs, start=1):
            meta = doc.metadata or {}
            page_value = meta.get("page")
            page_number = int(page_value) + 1 if isinstance(page_value, int) else None
            citations_data.append(
                {
                    "document_id": meta.get("document_id", "unknown"),
                    "file_name": meta.get("file_name", "unknown"),
                    "page": page_number,
                    "snippet": doc.page_content[:220],
                }
            )

        logger.info(
            "LLM stream request: provider=%s model=%s temp=%s top_p=%s max_tokens=%s",
            settings.llm_provider,
            settings.llm_model,
            settings.llm_temperature,
            settings.llm_top_p,
            settings.llm_max_tokens or "default",
        )

        try:
            started = time.perf_counter()
            streamed_chars = 0
            result = stream_answer_with_citations(question, state.relevant_docs, history=history)

            # ── Consume tokens FIRST, THEN resolve citations ──
            # StreamResult.get_citations() is a deferred resolver that parses
            # the full collected buffer.  It returns [] if called before the
            # generator is exhausted — so this order is critical.
            for token in result.tokens:
                streamed_chars += len(token)
                yield {"event": "token", "data": token}

            if streamed_chars == 0:
                logger.warning("LLM stream returned 0 chars; falling back to non-stream response")
                fallback_generation = answer_with_citations(question, state.relevant_docs, history=history)
                fallback_answer = fallback_generation.get("answer", FALLBACK_ANSWER)
                if fallback_answer == FALLBACK_ANSWER and state.relevant_docs:
                    fallback_answer = ChatService._extractive_fallback(state.relevant_docs)
                yield {"event": "token", "data": fallback_answer}
                streamed_chars = len(fallback_answer)
                safe_indices = validate_citation_indices(
                    fallback_generation.get("citation_indices", []), len(state.relevant_docs)
                )
            else:
                # Generator fully consumed — now safe to call get_citations()
                safe_indices = validate_citation_indices(
                    result.get_citations(), len(state.relevant_docs)
                )

            if not safe_indices and state.relevant_docs:
                safe_indices = [1]
                logger.info("LLM stream response: no citations found, defaulting to Source 1")
            final_citations = [
                citations_data[i - 1] for i in safe_indices if 0 < i <= len(citations_data)
            ]
            yield {"event": "citations", "data": json.dumps(final_citations)}
            yield {"event": "done", "data": ""}
            elapsed_ms = int((time.perf_counter() - started) * 1000)
            logger.info(
                "LLM stream response: status=ok duration_ms=%d chars=%d",
                elapsed_ms,
                streamed_chars,
            )
        except Exception as e:
            logger.error("Stream error: %s", e)
            logger.info("LLM stream response: status=error")
            yield {"event": "error", "data": str(e)}
