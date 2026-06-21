"""System routes: health (public), status/settings (secured)."""

from __future__ import annotations

from datetime import UTC, datetime
import logging
import os
from pathlib import Path
import platform
import shutil
import time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.config import get_settings
from app.core.auth import UserContext, get_current_user, get_optional_user
from app.dependencies import (
    get_embeddings_instance,
    get_init_error,
    get_registry,
    get_vector_store_optional,
)
from app.schemas import HealthResponse, SettingsResponse, SettingsUpdate, StatusResponse
from app.services.usage_service import UsageService

logger = logging.getLogger(__name__)
router = APIRouter(tags=["system"])

# ── Sensitive config keys that MUST never be returned to any client ─────
SENSITIVE_CONFIG_KEYS: frozenset[str] = frozenset({
    "supabase_service_key",
    "supabase_anon_key",
    "supabase_jwt_secret",
    "supabase_url",
    "database_url",
    "google_api_key",
    "openai_api_key",
    "groq_api_key",
    "redis_url",
    "chroma_persist_dir",
    "upload_dir",
    "metadata_db_path",
    "sqlite_db_path",
    "admin_emails",
})


def _filter_sensitive_config(config: dict[str, Any]) -> dict[str, Any]:
    """Remove any keys that match sensitive configuration keys."""
    return {k: v for k, v in config.items() if k not in SENSITIVE_CONFIG_KEYS}

_start_time = time.time()


@router.get("/health", response_model=HealthResponse)
@router.head("/health")
def health(
    vector_store: Any = Depends(get_vector_store_optional),
    embeddings: Any = Depends(get_embeddings_instance),
) -> dict:
    """Public health check returning only {"status": "ok"/"degraded"}."""
    settings = get_settings()

    checks: dict[str, Any] = {
        "vector_store": vector_store is not None,
        "embeddings": embeddings is not None,
    }

    # Check Supabase connectivity when using supabase backend
    if settings.storage_backend == "supabase":
        try:
            from app.core.supabase import get_supabase_client

            client = get_supabase_client()
            client.table("documents").select("id").limit(1).execute()
            checks["supabase_connection"] = True
        except Exception:
            checks["supabase_connection"] = False

    # Check disk space in local mode
    if settings.storage_backend == "local":
        try:
            data_dir = Path(settings.upload_dir).parent
            if data_dir.exists():
                disk = shutil.disk_usage(str(data_dir))
                disk_free_mb = disk.free / (1024 * 1024)
                checks["disk_space_ok"] = disk_free_mb > 100
            else:
                checks["disk_space_ok"] = False
        except Exception:
            checks["disk_space_ok"] = False

    overall = all(v for k, v in checks.items() if isinstance(v, bool))
    return {"status": "ok" if overall else "degraded"}


@router.get("/health/details")
def health_details(
    vector_store: Any = Depends(get_vector_store_optional),
    embeddings: Any = Depends(get_embeddings_instance),
    user: UserContext = Depends(get_current_user),
) -> dict:
    """Detailed health check for admin users only."""
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required to view health details",
        )

    settings = get_settings()

    checks: dict[str, Any] = {
        "vector_store": vector_store is not None,
        "embeddings": embeddings is not None,
    }

    # Check Supabase connectivity when using supabase backend
    if settings.storage_backend == "supabase":
        try:
            from app.core.supabase import get_supabase_client

            client = get_supabase_client()
            client.table("documents").select("id").limit(1).execute()
            checks["supabase_connection"] = True
        except Exception as e:
            logger.warning("Supabase health check failed: %s", e)
            checks["supabase_connection"] = False
            checks["supabase_error"] = str(e)

    # Only check disk space in local mode
    if settings.storage_backend == "local":
        data_dir = Path(settings.upload_dir).parent
        disk = shutil.disk_usage(str(data_dir))
        disk_free_mb = disk.free / (1024 * 1024)
        checks["disk_space_ok"] = disk_free_mb > 100
    else:
        disk_free_mb = -1  # Not applicable for cloud storage

    overall = all(v for k, v in checks.items() if isinstance(v, bool))

    return {
        "status": "healthy" if overall else "degraded",
        "timestamp": datetime.now(UTC).isoformat(),
        "uptime_seconds": round(time.time() - _start_time),
        "version": "3.0.0",
        "git_commit": os.environ.get("RENDER_GIT_COMMIT")
        or os.environ.get("GIT_COMMIT")
        or "local",
        "python_version": platform.python_version(),
        "disk_free_mb": round(disk_free_mb, 2) if disk_free_mb >= 0 else None,
        "storage_backend": settings.storage_backend,
        "vector_store": settings.vector_store,
        "auth_enabled": settings.auth_enabled,
        "checks": checks,
    }


@router.get("/status", response_model=StatusResponse)
def get_status(
    vector_store: Any = Depends(get_vector_store_optional),
    embeddings: Any = Depends(get_embeddings_instance),
    reg=Depends(get_registry),
    user: UserContext = Depends(get_current_user),
):
    """System status — optionally requires authentication."""
    docs = reg.list_documents(owner_id=user.user_id)
    doc_count = len(docs)
    chunk_count = sum(doc.get("chunks", 0) for doc in docs)
    settings = get_settings()

    return StatusResponse(
        vector_store=settings.vector_store,
        llm_provider=settings.llm_provider,
        store_initialized=vector_store is not None,
        embeddings_loaded=embeddings is not None,
        documents=doc_count,
        chunks=chunk_count,
        storage_backend=settings.storage_backend,
        auth_enabled=settings.auth_enabled,
    )


@router.get("/system/config")
def get_system_config(user: UserContext | None = Depends(get_optional_user)):
    """Get active platform configuration and initialization status."""
    settings = get_settings()
    init_err = get_init_error()

    # Unauthenticated users only get a boolean 'configured' flag
    if not user:
        return {
            "configured": init_err is None,
        }

    return _filter_sensitive_config({
        "configured": init_err is None,
        "init_error": str(init_err) if init_err else None,
        "llm_provider": settings.llm_provider,
        "llm_model": settings.llm_model,
        "embedding_provider": settings.embedding_provider,
        "embedding_model": settings.embedding_model,
        "vector_store": settings.vector_store,
    })


@router.get("/usage")
def get_user_usage(user: UserContext = Depends(get_current_user)):
    """Get AI usage quota for the current user."""
    return UsageService.get_usage(user.user_id)


@router.get("/settings", response_model=SettingsResponse)
def get_current_settings(
    user: UserContext = Depends(get_current_user),
):
    """Get current settings — optionally requires authentication."""
    settings = get_settings()
    return SettingsResponse(
        rag_top_k=settings.rag_top_k,
        rag_chunk_size=settings.rag_chunk_size,
        rag_chunk_overlap=settings.rag_chunk_overlap,
        llm_provider=settings.llm_provider,
        llm_model=settings.llm_model,
        llm_temperature=settings.llm_temperature,
        llm_top_p=settings.llm_top_p,
        embedding_model=settings.embedding_model,
        vector_store=settings.vector_store,
        max_upload_size_mb=settings.max_upload_size_mb,
    )


@router.put("/settings")
def update_settings(
    updates: SettingsUpdate,
    user: UserContext = Depends(get_current_user),
):
    """Update settings in memory — optionally requires authentication."""
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required to change settings",
        )

    settings = get_settings()

    # Apply and persist updates to database
    from app.services.platform_settings_service import PlatformSettingsService

    updated_by = user.email or user.user_id or "admin"
    updates_dict = updates.model_dump(exclude_unset=True)
    for key, value in updates_dict.items():
        if value is not None:
            PlatformSettingsService.save_setting(key, value, updated_by)

    logger.info(
        "Settings updated by user=%s: top_k=%d, llm=%s, vs=%s",
        user.user_id,
        settings.rag_top_k,
        settings.llm_provider,
        settings.vector_store,
    )

    get_settings.cache_clear()
    from app.generation import get_chat_model

    get_chat_model.cache_clear()

    return {
        "status": "updated_in_memory",
        "warning": "Changes reset on server restart. Use environment variables for persistence.",
        "settings": SettingsResponse(
            rag_top_k=settings.rag_top_k,
            rag_chunk_size=settings.rag_chunk_size,
            rag_chunk_overlap=settings.rag_chunk_overlap,
            llm_provider=settings.llm_provider,
            llm_model=settings.llm_model,
            llm_temperature=settings.llm_temperature,
            llm_top_p=settings.llm_top_p,
            embedding_model=settings.embedding_model,
            vector_store=settings.vector_store,
            max_upload_size_mb=settings.max_upload_size_mb,
        ),
    }
