"""Pydantic models with strict validation for API contracts."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator


class Citation(BaseModel):
    document_id: str = Field(max_length=64)
    file_name: str = Field(max_length=255)
    page: int | None = None
    snippet: str = Field(max_length=500)
    confidence: str = Field(default="Medium", max_length=10)

    @field_validator("confidence")
    @classmethod
    def validate_confidence(cls, v: str) -> str:
        if v not in ("Low", "Medium", "High"):
            raise ValueError("confidence must be Low, Medium, or High")
        return v


class RetrievedChunk(BaseModel):
    document_id: str = Field(max_length=64)
    file_name: str = Field(max_length=255)
    page: int | None = None
    score: float | None = None
    text: str = Field(max_length=2000)


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    document_ids: list[str] | None = None
    history: list[dict] | None = None
    session_id: str | None = None

    @field_validator("question")
    @classmethod
    def sanitize_question(cls, v: str) -> str:
        """Strip leading/trailing whitespace and null bytes."""
        return v.strip().replace("\x00", "")

    @field_validator("history")
    @classmethod
    def validate_history(cls, v: list[dict] | None) -> list[dict] | None:
        """Validate conversation history structure.

        Rules:
          - Maximum 20 turns (prevents prompt stuffing).
          - Each turn must have role 'user' or 'assistant'.
          - Each turn must have a non-empty string content.
        """
        if v is None:
            return v
        if len(v) > 20:
            raise ValueError("History cannot exceed 20 turns")
        for i, turn in enumerate(v):
            role = turn.get("role")
            content = turn.get("content")
            if role not in ("user", "assistant"):
                raise ValueError(
                    f"History turn {i}: 'role' must be 'user' or 'assistant', got {role!r}"
                )
            if not isinstance(content, str) or not content.strip():
                raise ValueError(f"History turn {i}: 'content' must be a non-empty string")
        return v


class ChatResponse(BaseModel):
    answer: str
    citations: list[Citation]
    retrieved_chunks: list[RetrievedChunk]


class DocumentIngestResult(BaseModel):
    document_id: str
    file_name: str = Field(max_length=255)
    pages: int
    chunks: int
    status: str = Field(max_length=20)
    error: str | None = None


class DocumentMetadata(BaseModel):
    document_id: str = Field(max_length=64)
    file_name: str = Field(max_length=255)
    source_type: str = Field(max_length=10)
    pages: int
    chunks: int
    content_hash: str = Field(max_length=128)
    created_at: datetime


class DocumentsListResponse(BaseModel):
    documents: list[DocumentMetadata]


class ErrorResponse(BaseModel):
    error: str
    details: dict[str, Any] | None = None


# --- System models ---


class SettingsUpdate(BaseModel):
    """Request body for PUT /settings."""

    rag_top_k: int | None = Field(None, ge=1, le=20)
    rag_chunk_size: int | None = Field(None, ge=100, le=4000)
    rag_chunk_overlap: int | None = Field(None, ge=0, le=1000)
    llm_provider: str | None = Field(None, max_length=20)
    llm_model: str | None = Field(None, max_length=80)
    llm_temperature: float | None = Field(None, ge=0.0, le=1.0)
    llm_top_p: float | None = Field(None, ge=0.0, le=1.0)
    embedding_model: str | None = Field(None, max_length=80)
    vector_store: str | None = Field(None, max_length=20)
    max_upload_size_mb: int | None = Field(None, ge=1, le=200)


class SettingsResponse(BaseModel):
    """Response body for GET /settings and PUT /settings."""

    rag_top_k: int
    rag_chunk_size: int
    rag_chunk_overlap: int
    llm_provider: str
    llm_model: str
    llm_temperature: float
    llm_top_p: float
    embedding_model: str
    vector_store: str
    max_upload_size_mb: int


class StatusResponse(BaseModel):
    """Response body for GET /status."""

    vector_store: str
    llm_provider: str
    store_initialized: bool
    embeddings_loaded: bool
    documents: int
    chunks: int
    storage_backend: str
    auth_enabled: bool


class HealthResponse(BaseModel):
    """Response body for GET /health."""

    status: str
    git_commit: str | None = None
