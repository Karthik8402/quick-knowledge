"""Document management routes: upload, list, delete, chunks — secured."""

import logging
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.auth import UserContext, get_current_user
from app.dependencies import get_registry, get_vector_store
from app.schemas import DocumentIngestResult, DocumentsListResponse
from app.services.document_service import DocumentService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/documents", tags=["documents"])
limiter = Limiter(key_func=get_remote_address)


@router.post("/upload", response_model=list[DocumentIngestResult])
@limiter.limit("5/minute")
def upload_documents(
    request: Request,
    files: list[UploadFile] = File(...),
    vector_store: Any = Depends(get_vector_store),
    user: UserContext = Depends(get_current_user),
):
    if len(files) > 10:
        raise HTTPException(status_code=400, detail="Max 10 files per upload request.")
    return DocumentService.upload_documents(files, vector_store, user.user_id)


@router.get("", response_model=DocumentsListResponse)
def list_documents(
    reg=Depends(get_registry),
    user: UserContext = Depends(get_current_user),
):
    return {"documents": DocumentService.list_documents(reg, user.user_id)}


@router.delete("/{document_id}")
def delete_document(
    document_id: str,
    vector_store: Any = Depends(get_vector_store),
    reg=Depends(get_registry),
    user: UserContext = Depends(get_current_user),
):
    return DocumentService.delete_document(document_id, vector_store, reg, user.user_id)


@router.get("/{document_id}/chunks")
def get_chunks(
    document_id: str,
    vector_store: Any = Depends(get_vector_store),
    reg=Depends(get_registry),
    user: UserContext = Depends(get_current_user),
):
    try:
        chunks = DocumentService.get_chunks(document_id, vector_store, user.user_id)
    except Exception as e:
        logger.error("Failed to get chunks for doc %s: %s", document_id, e)
        raise HTTPException(
            status_code=503, detail={"error": "Chunk retrieval failed", "reason": str(e)}
        ) from e

    if not chunks:
        doc = reg.get(document_id)
        if doc:
            logger.warning(
                "Document %s found in registry but no chunks retrieved for user %s. Missing metadata?",
                document_id,
                user.user_id,
            )
            raise HTTPException(
                status_code=503,
                detail={"error": "Chunk retrieval failed", "reason": "Missing owner metadata"},
            )
        return {"document_id": document_id, "chunks": []}

    return {"document_id": document_id, "chunks": chunks}
