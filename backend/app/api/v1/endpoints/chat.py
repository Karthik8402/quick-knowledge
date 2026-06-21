"""Chat route: question answering with RAG citations + SSE streaming — secured."""

import asyncio
import json
import logging
import time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sse_starlette.sse import EventSourceResponse

from app.core.auth import UserContext, get_current_user
from app.dependencies import get_registry, get_vector_store_optional
from app.schemas import ChatRequest, ChatResponse
from app.services.chat_service import ChatService
from app.services.usage_service import UsageService

logger = logging.getLogger(__name__)
router = APIRouter(tags=["chat"])
limiter = Limiter(key_func=get_remote_address)

# ── SSE streaming guardrails ───────────────────────────────────────────
STREAM_TIMEOUT_SECONDS = 120
HEARTBEAT_INTERVAL_SECONDS = 15


async def _stream_with_heartbeat(
    sync_gen,
    *,
    timeout: float = STREAM_TIMEOUT_SECONDS,
    heartbeat_interval: float = HEARTBEAT_INTERVAL_SECONDS,
):
    """Wrap a synchronous SSE generator with heartbeat events and a hard timeout.

    Yields heartbeat events every *heartbeat_interval* seconds so the client
    stays connected.  Raises ``asyncio.TimeoutError`` if streaming exceeds
    *timeout* seconds — this triggers an ``error`` event and clean shutdown.
    """
    deadline = time.monotonic() + timeout
    last_heartbeat = time.monotonic()
    stream_done = False

    async def _drain_sync():
        nonlocal stream_done
        for event in sync_gen:
            yield event
        stream_done = True

    async_gen = _drain_sync()
    ait = async_gen.__aiter__()

    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            yield {"event": "error", "data": "Stream timeout exceeded"}
            return

        wait_time = min(remaining, heartbeat_interval)

        try:
            event = await asyncio.wait_for(ait.__anext__(), timeout=wait_time)
            yield event
            last_heartbeat = time.monotonic()
        except StopAsyncIteration:
            return
        except asyncio.TimeoutError:
            if stream_done:
                return
            now = time.monotonic()
            if now - last_heartbeat >= heartbeat_interval:
                yield {"event": "heartbeat", "data": ""}
                last_heartbeat = now


@router.post("/chat", response_model=ChatResponse)
@limiter.limit("20/minute")
def chat(
    request: Request,
    body: ChatRequest,
    vector_store: Any = Depends(get_vector_store_optional),
    reg=Depends(get_registry),
    user: UserContext = Depends(get_current_user),
):
    if ChatService.check_prompt_injection(body.question):
        logger.warning("Prompt injection attempt blocked from user=%s", user.user_id)
        return ChatResponse(
            answer="I can only answer questions about your uploaded documents.",
            citations=[],
            retrieved_chunks=[],
        )

    if not UsageService.increment_usage(user.user_id):
        raise HTTPException(
            status_code=429, detail="AI request limit exceeded. Try again after reset."
        )

    history = body.history
    if body.session_id:
        from app.services.chat_history_service import ChatHistoryService

        history = ChatHistoryService.load_history(user.user_id, body.session_id)

    response = ChatService.build_chat_response(
        body.question,
        vector_store,
        reg,
        user.user_id,
        body.document_ids,
        history=history,
    )

    if body.session_id:
        from app.services.chat_history_service import ChatHistoryService

        ChatHistoryService.save_turns(
            user.user_id,
            body.session_id,
            [
                {"role": "user", "content": body.question},
                {"role": "assistant", "content": response.answer},
            ],
        )

    return response


@router.post("/chat/stream")
@limiter.limit("15/minute")
async def chat_stream(
    request: Request,
    body: ChatRequest,
    vector_store: Any = Depends(get_vector_store_optional),
    reg=Depends(get_registry),
    user: UserContext = Depends(get_current_user),
):
    if ChatService.check_prompt_injection(body.question):
        logger.warning("Prompt injection attempt blocked (stream) from user=%s", user.user_id)

        async def injection_gen():
            yield {
                "event": "token",
                "data": "I can only answer questions about your uploaded documents.",
            }
            yield {"event": "citations", "data": json.dumps([])}
            yield {"event": "done", "data": ""}

        return EventSourceResponse(injection_gen())

    if not UsageService.increment_usage(user.user_id):
        raise HTTPException(
            status_code=429, detail="AI request limit exceeded. Try again after reset."
        )

    history = body.history
    if body.session_id:
        from app.services.chat_history_service import ChatHistoryService

        history = ChatHistoryService.load_history(user.user_id, body.session_id)

    return EventSourceResponse(
        _stream_with_heartbeat(
            ChatService.chat_stream_generator(
                body.question,
                vector_store,
                reg,
                user.user_id,
                body.document_ids,
                history=history,
                session_id=body.session_id,
            )
        )
    )
