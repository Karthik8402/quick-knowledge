"""Per-IP concurrent SSE connection limiter.

Defends against Slowloris-style denial-of-service attacks where an attacker
opens many long-lived SSE connections to exhaust uvicorn's worker/thread pool.

Usage in a FastAPI endpoint::

    from app.core.sse_limiter import sse_limiter

    @router.post("/chat/stream")
    async def chat_stream(request: Request, ...):
        client_ip = request.client.host if request.client else "unknown"
        if not sse_limiter.try_acquire(client_ip):
            raise HTTPException(status_code=429, detail="Too many concurrent streams")
        try:
            return EventSourceResponse(my_generator())
        finally:
            sse_limiter.release(client_ip)
"""

from __future__ import annotations

from collections import defaultdict
import logging
import threading

from ..config import get_settings

logger = logging.getLogger(__name__)


class SSEConnectionLimiter:
    """Thread-safe per-IP concurrent SSE connection counter."""

    def __init__(self) -> None:
        self._counts: dict[str, int] = defaultdict(int)
        self._lock = threading.Lock()

    @property
    def max_per_ip(self) -> int:
        return get_settings().max_sse_connections_per_ip

    def try_acquire(self, ip: str) -> bool:
        """Attempt to acquire a connection slot for *ip*.

        Returns True if the slot was acquired, False if the limit is reached.
        """
        with self._lock:
            if self._counts[ip] >= self.max_per_ip:
                logger.warning(
                    "SSE connection limit reached for IP %s (%d/%d)",
                    ip,
                    self._counts[ip],
                    self.max_per_ip,
                )
                return False
            self._counts[ip] += 1
            logger.debug("SSE slot acquired for %s (%d/%d)", ip, self._counts[ip], self.max_per_ip)
            return True

    def release(self, ip: str) -> None:
        """Release a connection slot for *ip*."""
        with self._lock:
            if self._counts[ip] > 0:
                self._counts[ip] -= 1
            if self._counts[ip] == 0:
                del self._counts[ip]
            logger.debug("SSE slot released for %s", ip)

    def active_count(self, ip: str) -> int:
        """Return the number of active connections for *ip*."""
        with self._lock:
            return self._counts.get(ip, 0)

    def reset(self) -> None:
        """Clear all tracked connections. Used for test isolation."""
        with self._lock:
            self._counts.clear()


# Module-level singleton
sse_limiter = SSEConnectionLimiter()
