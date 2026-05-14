from __future__ import annotations

from typing import Any, cast

from pydantic import SecretStr

from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain_openai import ChatOpenAI, OpenAIEmbeddings

ChatNVIDIA: Any
ChatGroq: Any

try:
    from langchain_nvidia_ai_endpoints import ChatNVIDIA as _ChatNVIDIA
except ImportError:
    ChatNVIDIA = None
else:
    ChatNVIDIA = _ChatNVIDIA

try:
    from langchain_groq import ChatGroq as _ChatGroq
except ImportError:
    ChatGroq = None
else:
    ChatGroq = _ChatGroq

from .config import get_settings

FALLBACK_ANSWER = "The provided documents do not contain this information."
LEGACY_GOOGLE_EMBEDDING_MODELS = {"text-embedding-004"}


def get_embeddings() -> Embeddings:
    settings = get_settings()

    if settings.embedding_provider.lower() == "google":
        if not settings.google_api_key:
            raise ValueError("GOOGLE_API_KEY is required for google embeddings")
        model_name = settings.embedding_model
        if model_name in LEGACY_GOOGLE_EMBEDDING_MODELS:
            model_name = "gemini-embedding-001"
        embeddings_cls = cast(Any, GoogleGenerativeAIEmbeddings)
        return embeddings_cls(model=model_name, google_api_key=settings.google_api_key)

    if settings.embedding_provider.lower() == "openai":
        if not settings.openai_api_key:
            raise ValueError("OPENAI_API_KEY is required for openai embeddings")
        return OpenAIEmbeddings(
            model=settings.embedding_model,
            api_key=SecretStr(settings.openai_api_key),
        )

    from langchain_huggingface import HuggingFaceEmbeddings

    return HuggingFaceEmbeddings(model_name=settings.embedding_model)


def get_chat_model():
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
        return ChatOpenAI(
            model=settings.llm_model,
            api_key=settings.openai_api_key,
            temperature=settings.llm_temperature,
            top_p=settings.llm_top_p,
        )

    if settings.llm_provider.lower() == "nvidia":
        if ChatNVIDIA is None:
            raise ValueError("langchain-nvidia-ai-endpoints is not installed")
        if not settings.nvidia_api_key:
            raise ValueError("NVIDIA_API_KEY is required for nvidia llm")
        kwargs: dict[str, Any] = {
            "model": settings.llm_model,
            "api_key": settings.nvidia_api_key,
            "temperature": settings.llm_temperature,
            "top_p": settings.llm_top_p,
            "streaming": True,
        }
        if settings.llm_max_tokens:
            kwargs["max_tokens"] = settings.llm_max_tokens
        return ChatNVIDIA(**kwargs)

    if settings.llm_provider.lower() == "groq":
        if ChatGroq is None:
            raise ValueError("langchain-groq is not installed")
        if not settings.groq_api_key:
            raise ValueError("GROQ_API_KEY is required for groq llm")
        return ChatGroq(
            model=settings.llm_model,
            api_key=settings.groq_api_key,
            temperature=settings.llm_temperature,
            top_p=settings.llm_top_p,
        )

    raise ValueError(f"Unsupported llm provider: {settings.llm_provider}")


def build_context(retrieved_docs: list[tuple[Document, float]]) -> str:
    chunks = []
    for index, (doc, _score) in enumerate(retrieved_docs, start=1):
        meta = doc.metadata or {}
        file_name = meta.get("file_name", "unknown")
        page = meta.get("page")
        document_id = meta.get("document_id", "unknown")
        page_text = f"{page}" if page is not None else "n/a"
        chunks.append(
            "\n".join(
                [
                    f"[Source {index}]",
                    f"document_id: {document_id}",
                    f"file: {file_name}",
                    f"page: {page_text}",
                    f"text: {doc.page_content}",
                ]
            )
        )

    return "\n\n".join(chunks)


def _get_system_prompt() -> str:
    return (
        "Answer using only the provided context. "
        'If the context does not contain the answer, say exactly: "The provided documents do not contain this information." '
        "Do not use outside knowledge. "
        "Do not invent file names, pages, or numbers. "
        "When stating facts from the context, always include an inline citation like [Source 1] or [Source 2] matching the source index provided."
    )


def _build_messages(question: str, context: str) -> list:
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
    else:
        return [SystemMessage(content=system_text), HumanMessage(content=human_text)]


def _parse_llm_response(content: str) -> dict[str, Any]:
    import re

    content = content.strip()

    citation_indices = []
    # Extract inline citations like [Source 1]
    for match in re.finditer(r"\[Source\s+(\d+)\]", content, re.IGNORECASE):
        try:
            idx = int(match.group(1))
            if idx not in citation_indices:
                citation_indices.append(idx)
        except ValueError:
            continue

    if not content:
        content = FALLBACK_ANSWER

    return {"answer": content, "citation_indices": citation_indices}


def answer_with_citations(
    question: str, retrieved_docs: list[tuple[Document, float]]
) -> dict[str, Any]:
    """Standard (non-streaming) answer generation."""
    if not retrieved_docs:
        return {"answer": FALLBACK_ANSWER, "citation_indices": []}

    llm = get_chat_model()
    context = build_context(retrieved_docs)
    messages = _build_messages(question, context)

    try:
        response = llm.invoke(messages)
    except Exception:
        return {"answer": FALLBACK_ANSWER, "citation_indices": []}

    content = response.content if isinstance(response.content, str) else ""
    return _parse_llm_response(content)


def stream_answer_with_citations(
    question: str, retrieved_docs: list[tuple[Document, float]]
) -> dict[str, Any]:
    """
    Streaming answer generation.
    Returns dict with:
      - "tokens": generator yielding string tokens
      - "citation_indices": list (populated after streaming completes)
    """
    if not retrieved_docs:
        return {"tokens": iter([FALLBACK_ANSWER]), "citation_indices": []}

    llm = get_chat_model()
    context = build_context(retrieved_docs)
    messages = _build_messages(question, context)

    collected = []

    def token_generator():
        try:
            for chunk in llm.stream(messages):
                token = chunk.content if isinstance(chunk.content, str) else ""
                if token:
                    collected.append(token)
                    yield token
        except Exception:
            yield FALLBACK_ANSWER

    tokens = token_generator()

    result: dict[str, Any] = {"tokens": tokens, "citation_indices": []}

    class LazyResult(dict):
        def __getitem__(self, key):
            if key == "citation_indices" and collected:
                full_text = "".join(collected)
                parsed = _parse_llm_response(full_text)
                self["citation_indices"] = parsed.get("citation_indices", [])
            return super().__getitem__(key)

        def get(self, key, default=None):
            if key == "citation_indices" and collected:
                full_text = "".join(collected)
                parsed = _parse_llm_response(full_text)
                self["citation_indices"] = parsed.get("citation_indices", [])
            return super().get(key, default)

    return LazyResult(result)
