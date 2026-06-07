"""Intelligent Knowledge Base API — production-grade FastAPI application."""

from __future__ import annotations

from contextlib import asynccontextmanager
import logging
import os
import uuid
import warnings

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"
warnings.filterwarnings("ignore", category=UserWarning)

from fastapi import FastAPI, Request, Response  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.responses import JSONResponse  # noqa: E402
from slowapi import Limiter  # noqa: E402
from slowapi.errors import RateLimitExceeded  # noqa: E402
from slowapi.middleware import SlowAPIMiddleware  # noqa: E402
from slowapi.util import get_remote_address  # noqa: E402

from .api.v1.api import api_router  # noqa: E402
from .config import get_settings  # noqa: E402
from .dependencies import set_embeddings, set_init_error, set_vector_store  # noqa: E402
from .exceptions import KnowledgeBaseError  # noqa: E402
from .generation import get_embeddings  # noqa: E402
from .retrieval import build_vector_store  # noqa: E402

# ---------------------------------------------------------------------------
# Logging — structured JSON-style for production observability
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | [%(request_id)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)


import contextvars  # noqa: E402

request_id_context_var = contextvars.ContextVar("request_id", default="-")


class RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_context_var.get()
        return True


# Apply filter to all root logger handlers so third-party logs don't crash
for handler in logging.root.handlers:
    handler.addFilter(RequestIdFilter())

logger = logging.getLogger("knowledge_base")

# ---------------------------------------------------------------------------
# Rate Limiter
# ---------------------------------------------------------------------------
limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])


# ---------------------------------------------------------------------------
# Lifespan: initialize embeddings + vector store once at startup
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Intelligent Knowledge Base API …")
    settings = get_settings()

    logger.info(
        "Config: storage=%s, vector=%s, llm=%s, auth=%s",
        settings.storage_backend,
        settings.vector_store,
        settings.llm_provider,
        settings.auth_enabled,
    )

    # Validate required environment variables for production
    _validate_production_env(settings)

    try:
        emb = get_embeddings()
        vs = build_vector_store(emb)
        set_embeddings(emb)
        set_vector_store(vs)
        set_init_error(None)
        logger.info("Vector store (%s) initialized successfully", settings.vector_store)
    except Exception as e:
        logger.warning("Vector store disabled: %s", e)
        set_embeddings(None)
        set_vector_store(None)
        set_init_error(e)

    yield  # app is running

    logger.info("Shutting down …")


def _validate_production_env(settings) -> None:
    """Validate required environment variables based on configuration."""
    missing = []

    if settings.llm_provider == "google" and not settings.google_api_key:
        missing.append("GOOGLE_API_KEY (required for google LLM provider)")

    if settings.storage_backend == "supabase":
        if not settings.supabase_url:
            missing.append("SUPABASE_URL (required for supabase storage backend)")
        if not settings.supabase_service_key:
            missing.append("SUPABASE_SERVICE_KEY (required for supabase storage backend)")
        if not settings.supabase_anon_key:
            missing.append("SUPABASE_ANON_KEY (required for supabase storage backend)")

    if settings.auth_enabled and not settings.supabase_jwt_secret:
        missing.append("SUPABASE_JWT_SECRET (required when AUTH_ENABLED=true)")

    if missing:
        error_msg = f"Missing required environment variables: {'; '.join(missing)}"
        logger.error(error_msg)
        raise ValueError(error_msg)

    # ── Security guard: warn loudly if Supabase is used without auth ──
    if settings.storage_backend == "supabase" and not settings.auth_enabled:
        logger.error(
            "⚠️  SECURITY WARNING: AUTH_ENABLED=false with storage_backend=supabase — "
            "all user data is accessible without authentication (owner_id defaults to "
            "'anonymous' for every request). Set AUTH_ENABLED=true in production!"
        )

    logger.info("Environment validation passed")



# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Intelligent Knowledge Base API",
    description="Production-grade RAG-powered document Q&A system with multi-LLM support.",
    version="3.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter

# ── CORS ──
settings = get_settings()
origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
allow_all_origins = "*" in origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=not allow_all_origins,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
    max_age=3600,
)
app.add_middleware(SlowAPIMiddleware)


# ---------------------------------------------------------------------------
# Middleware: Request ID + structured logging
# ---------------------------------------------------------------------------
@app.middleware("http")
async def request_id_middleware(request: Request, call_next) -> Response:
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4())[:8])
    request.state.request_id = request_id

    # Set context var for this async task
    token = request_id_context_var.set(request_id)

    try:
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response
    finally:
        request_id_context_var.reset(token)


# ---------------------------------------------------------------------------
# Security headers middleware
# ---------------------------------------------------------------------------
@app.middleware("http")
async def security_headers_middleware(request: Request, call_next) -> Response:
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "img-src 'self' data: https:; "
        "style-src 'self' 'unsafe-inline' https:; "
        "script-src 'self'; "
        "connect-src 'self' https: http:; "
        "font-src 'self' data: https:; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self'"
    )
    return response


# ---------------------------------------------------------------------------
# Exception handlers
# ---------------------------------------------------------------------------
@app.exception_handler(KnowledgeBaseError)
async def knowledge_base_exception_handler(request: Request, exc: KnowledgeBaseError):
    logger.error("KnowledgeBaseError: %s (status=%d)", exc.message, exc.status_code)
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.message},
    )


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    logger.warning("Rate limit exceeded: %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=429,
        content={"error": "Too many requests. Please slow down.", "retry_after": str(exc.detail)},
    )


# ---------------------------------------------------------------------------
# Register routers
# ---------------------------------------------------------------------------
@app.get("/")
async def root() -> dict[str, str]:
    return {
        "status": "ok",
        "message": "Intelligent Knowledge Base API is running",
    }


app.include_router(api_router)
