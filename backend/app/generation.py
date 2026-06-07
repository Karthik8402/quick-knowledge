from __future__ import annotations

from collections.abc import Callable, Generator
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Any, cast

from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from pydantic import SecretStr

from .config import get_settings

try:
    from langchain_groq import ChatGroq as _ChatGroq
except ImportError:
    ChatGroq = None
else:
    ChatGroq = _ChatGroq

FALLBACK_ANSWER = "Sorry, I could not find this information in your uploaded documents."


# ---------------------------------------------------------------------------
# StreamResult — replaces the fragile LazyResult(dict) pattern
# ---------------------------------------------------------------------------
@dataclass
class StreamResult:
    """Holds a streaming token generator and a deferred citation resolver.

    IMPORTANT: call get_citations() ONLY after the tokens generator has been
    fully consumed (i.e. all tokens have been yielded).  Accessing it early
    returns an empty list because the collected buffer will be empty.
    """

    tokens: Generator
    get_citations: Callable[[], list[int]]
    _extra: dict = field(default_factory=dict)

    # Allow dict-style .get() for backward compat with any stray callers.
    def get(self, key: str, default: Any = None) -> Any:
        if key == "citation_indices":
            return self.get_citations()
        return self._extra.get(key, default)



def get_embeddings() -> Embeddings:
    settings = get_settings()

    if settings.embedding_provider.lower() == "google":
        if not settings.google_api_key:
            raise ValueError("GOOGLE_API_KEY is required for google embeddings")
        model_name = settings.embedding_model
        embeddings_cls = cast(Any, GoogleGenerativeAIEmbeddings)
        return embeddings_cls(model=model_name, google_api_key=settings.google_api_key)

    if settings.embedding_provider.lower() == "openai":
        if not settings.openai_api_key:
            raise ValueError("OPENAI_API_KEY is required for openai embeddings")
        return OpenAIEmbeddings(
            model=settings.embedding_model,
            api_key=SecretStr(settings.openai_api_key),
        )

    raise ValueError(f"Unsupported embedding provider: {settings.embedding_provider}")


@lru_cache(maxsize=1)
def get_chat_model():
    """Return the configured LangChain chat model.

    Cached per process with @lru_cache.  If LLM_PROVIDER or API keys are
    changed at runtime, a server restart is required to pick up the new values.
    This is intentional — model clients are not safely hot-swappable.
    """
    settings = get_settings()

    if settings.llm_provider.lower() == "google":
        if not settings.google_api_key:
            raise ValueError("GOOGLE_API_KEY is required for google llm")
        return ChatGoogleGenerativeAI(
            model=settings.llm_model,
            google_api_key=settings.google_api_key,
            temperature=settings.llm_temperature,
        )

    if settings.llm_provider.lower() == "openai":
        if not settings.openai_api_key:
            raise ValueError("OPENAI_API_KEY is required for openai llm")
        kwargs: dict[str, Any] = {
            "model": settings.llm_model,
            "api_key": settings.openai_api_key,
            "temperature": settings.llm_temperature,
            "top_p": settings.llm_top_p,
            "timeout": settings.llm_timeout_seconds,
            "max_retries": 1,
        }
        if settings.llm_max_tokens:
            kwargs["max_completion_tokens"] = settings.llm_max_tokens
        return ChatOpenAI(**kwargs)

    if settings.llm_provider.lower() == "groq":
        if ChatGroq is None:
            raise ValueError("langchain-groq is not installed")
        if not settings.groq_api_key:
            raise ValueError("GROQ_API_KEY is required for groq llm")
        return ChatGroq(
            model=settings.llm_model,
            api_key=settings.groq_api_key,
            temperature=settings.llm_temperature,
        ).bind(top_p=settings.llm_top_p)

    raise ValueError(f"Unsupported llm provider: {settings.llm_provider}")


def build_context(retrieved_docs: list[tuple[Document, float]]) -> str:
    """Build a structured context block with document name, page, and content."""
    chunks = []
    for index, (doc, _score) in enumerate(retrieved_docs, start=1):
        meta = doc.metadata or {}
        file_name = meta.get("file_name", "Unknown Document")
        page = meta.get("page")
        section = meta.get("section", "")

        header_parts = [f"--- Reference {index} ---"]
        header_parts.append(f"Document: {file_name}")
        if page is not None:
            header_parts.append(f"Page: {int(page) + 1}")
        if section:
            header_parts.append(f"Section: {section}")
        header_parts.append("Content:")
        header_parts.append(doc.page_content)

        chunks.append("\n".join(header_parts))

    return "\n\n".join(chunks)


def _get_system_prompt() -> str:
    return (
        "You are an accurate AI assistant that answers questions using ONLY the provided reference documents. "
        "Follow these rules strictly:\n"
        "1. Use the provided context to answer. Never use outside knowledge.\n"
        "2. Cite your sources by appending [Source N] to the end of the relevant sentence or bullet point, where N is the reference number. "
        "For example: 'Remote work requires manager approval [Source 1].'\n"
        "3. NEVER output the document name or page number inline in your text. Rely entirely on the [Source N] format for citations.\n"
        "4. If the answer cannot be found in the provided context, respond EXACTLY with: "
        "'Sorry, I could not find this information in your uploaded documents.'\n"
        "5. Do not invent file names, page numbers, or statistics.\n"
        "6. Be concise, professional, and direct."
    )


def _build_messages(
    question: str,
    context: str,
    history: list[dict] | None = None,
) -> list:
    """Build the LangChain message list for the LLM.

    Message order:
        SystemMessage  (instructions)
        [HumanMessage / AIMessage pairs from history — oldest first]
        HumanMessage   (current question + context)
    """
    settings = get_settings()
    system_text = _get_system_prompt()
    human_text = f"Question: {question}\n\nContext:\n{context}"

    llm_provider = settings.llm_provider.lower()
    llm_model = settings.llm_model.lower()
    use_single_user_prompt = llm_provider == "google" and "gemma" in llm_model

    if use_single_user_prompt:
        # Some Gemma endpoints reject developer/system instructions.
        gemma_prompt = f"Instructions:\n{system_text}\n\nQuestion and Context:\n{human_text}"
        return [HumanMessage(content=gemma_prompt)]

    messages: list = [SystemMessage(content=system_text)]

    # Prepend conversation history (up to 20 turns, validated by ChatRequest schema).
    if history:
        for turn in history:
            role = turn.get("role", "")
            content = turn.get("content", "")
            if role == "user":
                messages.append(HumanMessage(content=content))
            elif role == "assistant":
                messages.append(AIMessage(content=content))

    messages.append(HumanMessage(content=human_text))
    return messages


def _parse_llm_response(content: str) -> dict[str, Any]:
    """Parse LLM response, extracting any reference indices mentioned."""
    import re

    content = content.strip()

    citation_indices = []
    # Match both legacy [Source N] and new 'Reference N' patterns
    for match in re.finditer(r"(?:\[Source\s+(\d+)\]|Reference\s+(\d+))", content, re.IGNORECASE):
        try:
            idx = int(match.group(1) or match.group(2))
            if idx not in citation_indices:
                citation_indices.append(idx)
        except (ValueError, TypeError):
            continue

    # Also detect document name citations to map back to reference indices
    # This covers the natural citation format we instructed the LLM to use

    if not content:
        content = FALLBACK_ANSWER

    return {"answer": content, "citation_indices": citation_indices}


def _extract_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            block.get("text", "") if isinstance(block, dict) else str(block) for block in content
        )
    return ""


def answer_with_citations(
    question: str,
    retrieved_docs: list[tuple[Document, float]],
    history: list[dict] | None = None,
) -> dict[str, Any]:
    """Standard (non-streaming) answer generation."""
    if not retrieved_docs:
        return {"answer": FALLBACK_ANSWER, "citation_indices": []}

    llm = get_chat_model()
    context = build_context(retrieved_docs)
    messages = _build_messages(question, context, history=history)

    try:
        response = llm.invoke(messages)
    except Exception as e:
        import logging
        logging.getLogger(__name__).exception("LLM generation failed")
        raise RuntimeError(f"LLM generation failed: {e}") from e

    content = _extract_text(response.content)
    return _parse_llm_response(content)


def stream_answer_with_citations(
    question: str,
    retrieved_docs: list[tuple[Document, float]],
    history: list[dict] | None = None,
) -> StreamResult:
    """
    Streaming answer generation.

    Returns a StreamResult with:
      - tokens: generator yielding string tokens (consume this first!)
      - get_citations(): callable that parses citations from the collected
        buffer — call it ONLY after `tokens` is fully consumed.
    """
    if not retrieved_docs:

        def _empty_gen():
            yield FALLBACK_ANSWER

        return StreamResult(tokens=_empty_gen(), get_citations=lambda: [])

    llm = get_chat_model()
    context = build_context(retrieved_docs)
    messages = _build_messages(question, context, history=history)

    collected: list[str] = []

    def token_generator():
        try:
            for chunk in llm.stream(messages):
                token = _extract_text(chunk.content)
                if token:
                    collected.append(token)
                    yield token
        except Exception:
            if not collected:
                yield FALLBACK_ANSWER
            else:
                raise

    def get_citations() -> list[int]:
        """Parse citation indices from the fully-collected stream buffer.

        Must be called AFTER the tokens generator is exhausted.
        """
        if not collected:
            return []
        full_text = "".join(collected)
        parsed = _parse_llm_response(full_text)
        return parsed.get("citation_indices", [])

    return StreamResult(tokens=token_generator(), get_citations=get_citations)
