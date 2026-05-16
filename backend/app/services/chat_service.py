import json
import logging
import re
import time
from typing import Any

from langchain_core.documents import Document

from app.citations import validate_citation_indices
from app.config import get_settings
from app.generation import FALLBACK_ANSWER, answer_with_citations, stream_answer_with_citations
from app.retrieval import retrieve_chunks
from app.schemas import ChatResponse, Citation, RetrievedChunk

logger = logging.getLogger(__name__)


class ChatService:
    # Prompt injection patterns (basic guardrails)
    _INJECTION_PATTERNS = [
        re.compile(r"ignore\s+(all\s+)?previous\s+instructions", re.IGNORECASE),
        re.compile(r"you\s+are\s+now\s+(a|an)\s+", re.IGNORECASE),
        re.compile(r"system\s*:\s*", re.IGNORECASE),
        re.compile(r"<\|?(system|im_start|endoftext)\|?>", re.IGNORECASE),
        re.compile(r"ADMIN\s*MODE", re.IGNORECASE),
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
        joined = " ".join([
            (best_doc.page_content or "").strip(),
            *[doc.page_content.strip() for doc, _score in retrieved[1:] if doc.page_content],
        ])
        sentences = [s for s in re.split(r"(?<=[.!?])\s+", joined) if s]
        summary = " ".join(sentences[:4]).strip()
        if not summary:
            summary = joined[:500].strip()
        return summary or FALLBACK_ANSWER

    @staticmethod
    def _infer_document_filter(question: str, reg, owner_id: str) -> list[str] | None:
        """Infer document filter from the question (e.g., resume/cv)."""
        q = question.lower()
        if not any(term in q for term in ("resume", "cv")):
            return None

        docs = reg.list_documents(owner_id=owner_id) or []
        matched = [doc.get("document_id") for doc in docs
                   if "resume" in (doc.get("file_name") or "").lower()]
        return [doc_id for doc_id in matched if doc_id] or None

    @staticmethod
    def build_chat_response(
        question: str,
        vector_store: Any,
        reg,
        owner_id: str,
        document_ids: list[str] | None = None,
    ) -> ChatResponse:
        """Core chat logic shared by standard endpoint."""
        if not reg.list_documents(owner_id=owner_id) or vector_store is None:
            logger.info("Chat fallback: no documents or vector store unavailable")
            return ChatResponse(
                answer=FALLBACK_ANSWER
                if vector_store is not None
                else "Backend not configured correctly (missing API keys).",
                citations=[],
                retrieved_chunks=[],
            )

        settings = get_settings()
        inferred_doc_ids = document_ids or ChatService._infer_document_filter(question, reg, owner_id)
        retrieved = retrieve_chunks(
            vector_store=vector_store,
            question=question,
            top_k=settings.rag_top_k,
            owner_id=owner_id,
            document_ids=inferred_doc_ids,
        )

        if not retrieved:
            logger.info("Chat: no relevant chunks found for question")
            return ChatResponse(answer=FALLBACK_ANSWER, citations=[], retrieved_chunks=[])

        logger.info(
            "LLM request: provider=%s model=%s temp=%s top_p=%s max_tokens=%s",
            settings.llm_provider,
            settings.llm_model,
            settings.llm_temperature,
            settings.llm_top_p,
            settings.llm_max_tokens or "default",
        )
        logger.info("Chat: generating answer from %d retrieved chunks", len(retrieved))
        started = time.perf_counter()
        generation = answer_with_citations(question, retrieved)
        elapsed_ms = int((time.perf_counter() - started) * 1000)
        answer_text = generation.get("answer", "") or ""
        if answer_text == FALLBACK_ANSWER and retrieved:
            answer_text = ChatService._extractive_fallback(retrieved)
        logger.info(
            "LLM response: status=ok duration_ms=%d chars=%d",
            elapsed_ms,
            len(answer_text),
        )

        safe_indices = validate_citation_indices(
            generation.get("citation_indices", []), len(retrieved)
        )
        if not safe_indices and retrieved:
            # Some models ignore citation formatting; fall back to the top chunk.
            safe_indices = [1]
            logger.info("LLM response: no citations found, defaulting to Source 1")

        citations: list[Citation] = []
        retrieved_chunks: list[RetrievedChunk] = []

        for idx, (doc, score) in enumerate(retrieved, start=1):
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

            if idx in safe_indices:
                citations.append(
                    Citation(
                        document_id=chunk_payload.document_id,
                        file_name=chunk_payload.file_name,
                        page=chunk_payload.page,
                        snippet=chunk_payload.text[:220],
                    )
                )

        answer = generation.get("answer", FALLBACK_ANSWER)
        if answer == FALLBACK_ANSWER and retrieved:
            answer = answer_text

        return ChatResponse(answer=answer, citations=citations, retrieved_chunks=retrieved_chunks)

    @staticmethod
    async def chat_stream_generator(
        question: str,
        vector_store: Any,
        reg,
        owner_id: str,
        document_ids: list[str] | None = None,
    ):
        if not reg.list_documents(owner_id=owner_id) or vector_store is None:
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
        inferred_doc_ids = document_ids or ChatService._infer_document_filter(question, reg, owner_id)
        retrieved = retrieve_chunks(
            vector_store=vector_store,
            question=question,
            top_k=settings.rag_top_k,
            owner_id=owner_id,
            document_ids=inferred_doc_ids,
        )

        if not retrieved:
            yield {"event": "token", "data": FALLBACK_ANSWER}
            yield {"event": "citations", "data": json.dumps([])}
            yield {"event": "done", "data": ""}
            return

        citations_data = []
        for _idx, (doc, _score) in enumerate(retrieved, start=1):
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
            result = stream_answer_with_citations(question, retrieved)
            for token in result["tokens"]:
                streamed_chars += len(token)
                yield {"event": "token", "data": token}

            if streamed_chars == 0:
                logger.warning("LLM stream returned 0 chars; falling back to non-stream response")
                fallback_generation = answer_with_citations(question, retrieved)
                fallback_answer = fallback_generation.get("answer", FALLBACK_ANSWER)
                if fallback_answer == FALLBACK_ANSWER and retrieved:
                    fallback_answer = ChatService._extractive_fallback(retrieved)
                yield {"event": "token", "data": fallback_answer}
                result = fallback_generation
                streamed_chars = len(fallback_answer)

            safe_indices = validate_citation_indices(
                result.get("citation_indices", []), len(retrieved)
            )
            if not safe_indices and retrieved:
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
