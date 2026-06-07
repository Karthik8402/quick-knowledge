from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # ── LLM / Embedding ──
    llm_provider: str = "google"
    llm_model: str = "gemini-3.1-flash-lite"
    llm_temperature: float = 0.2
    llm_top_p: float = 1.0
    llm_max_tokens: int | None = None
    llm_timeout_seconds: float = 45.0
    google_api_key: str = ""
    openai_api_key: str = ""
    groq_api_key: str = ""

    embedding_provider: str = "google"
    embedding_model: str = "gemini-embedding-001"

    # ── Vector Store ──
    vector_store: str = "chroma"  # "chroma" | "pgvector"
    chroma_persist_dir: str = "./data/chroma"

    # ── Storage Backend ──
    storage_backend: str = "local"  # "local" | "supabase"
    upload_dir: str = "./data/uploads"
    metadata_db_path: str = "./data/document_registry.json"
    sqlite_db_path: str = "./data/knowledge_base.db"

    # ── Supabase ──
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_key: str = ""
    supabase_jwt_secret: str = ""
    database_url: str = ""  # postgres://... connection string
    supabase_storage_bucket: str = "documents"

    # ── Auth ──
    auth_enabled: bool = False  # Set True in production

    # ── RAG ──
    rag_top_k: int = 6
    rag_chunk_size: int = 800
    rag_chunk_overlap: int = 150

    # ── Limits ──
    max_upload_size_mb: int = 25
    rate_limit: str = "10/minute"
    daily_usage_limit: int = 50

    # ── CORS ──
    cors_origins: str = (
        "http://localhost:5173,"
        "http://127.0.0.1:5173,"
        "https://intelligent-knowledge.vercel.app,"
        "https://knowledge.karthikdev.app"
    )

    # ── Redis (optional caching) ──
    redis_url: str = ""


@lru_cache
def get_settings() -> Settings:
    settings = Settings()

    # Only create local dirs when using local storage
    if settings.storage_backend == "local":
        Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
        Path(settings.metadata_db_path).parent.mkdir(parents=True, exist_ok=True)
        Path(settings.sqlite_db_path).parent.mkdir(parents=True, exist_ok=True)
    if settings.vector_store == "chroma":
        Path(settings.chroma_persist_dir).mkdir(parents=True, exist_ok=True)

    return settings
