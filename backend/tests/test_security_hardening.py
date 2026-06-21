"""Unit and integration tests for security hardening features.

Covers:
1. CSP Header Pinning
2. PII Redaction / Masking Regexes
3. SSE Connection Limiter (Unit and Integration)
4. Supabase User-Scoped Client initialization
"""

from __future__ import annotations

import asyncio
from unittest.mock import MagicMock, patch

import pytest
from sse_starlette.sse import AppStatus

from app.core.sse_limiter import SSEConnectionLimiter, sse_limiter
from app.core.supabase import get_supabase_user_client
from app.ingest import _redact_pii


# ═══════════════════════════════════════════════════════════════════════════
# 1. CSP Headers Test
# ═══════════════════════════════════════════════════════════════════════════
def test_security_and_csp_headers(test_client):
    """Verify that all configured security and CSP headers are present and correctly pinned."""
    resp = test_client.get("/health")
    assert resp.status_code == 200

    # General Security Headers
    assert resp.headers.get("X-Content-Type-Options") == "nosniff"
    assert resp.headers.get("X-Frame-Options") == "DENY"
    assert resp.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
    assert "camera=()" in resp.headers.get("Permissions-Policy", "")
    assert "Strict-Transport-Security" in resp.headers

    # CSP Header
    csp = resp.headers.get("Content-Security-Policy", "")
    assert csp is not None

    # Check font-src, style-src pinning, object-src, and upgrade-insecure-requests
    assert "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;" in csp
    assert "font-src 'self' data: https://fonts.gstatic.com;" in csp
    assert "object-src 'none';" in csp
    assert "upgrade-insecure-requests" in csp


# ═══════════════════════════════════════════════════════════════════════════
# 2. PII Redaction Regexes Test
# ═══════════════════════════════════════════════════════════════════════════
@pytest.mark.parametrize(
    ("input_text", "expected_contains_redacted", "expected_count"),
    [
        # Email addresses
        ("My email is karthik@example.com", "My email is [REDACTED]", 1),
        # Phone numbers
        ("Call me at +1 (555) 123-4567", "Call me at [REDACTED]", 1),
        ("My phone is 555-123-4567 or 123.456.7890", "My phone is [REDACTED] or [REDACTED]", 2),
        # Credit cards
        ("Card number 1234-5678-9012-3456 is active", "Card number [REDACTED] is active", 1),
        # SSN
        ("SSN number is 000-12-3456", "SSN number is [REDACTED]", 1),
        # IPv4
        ("Local address is 192.168.1.1", "Local address is [REDACTED]", 1),
        # DOB
        ("My DOB: 12/25/1995", "My [REDACTED]", 1),
        ("Date of Birth: 05-12-1980", "[REDACTED]", 1),
        ("Born 1/2/90", "[REDACTED]", 1),
        # API Keys
        ("AWS Key AKIAIOSFODNN7EXAMPLE", "AWS Key [REDACTED]", 1),
        ("OpenAI sk-proj-1234567890123456", "OpenAI [REDACTED]", 1),
        ("Stripe sk_live_mockkey123", "Stripe [REDACTED]", 1),
        # Passport
        ("Passport No: A1234567B", "[REDACTED]", 1),
        # IBAN
        ("Send money to DE89370400440532013000", "Send money to [REDACTED]", 1),
    ],
)
def test_pii_redaction_patterns(input_text, expected_contains_redacted, expected_count):
    """Verify that all new and existing PII regex patterns mask data properly."""
    redacted = _redact_pii(input_text)
    assert "[REDACTED]" in redacted
    assert redacted.count("[REDACTED]") == expected_count


def test_pii_redaction_does_not_match_non_pii():
    """Verify that version numbers, standard integers, and standard text are not masked."""
    safe_texts = [
        "FastAPI version 0.100.1",
        "Python version 3.12.3",
        "The project is under D:/Coding/My Projects/Quick Knowledge",
        "Total count is 12345",
        "Created at 2026-06-21T18:00:00",
        "ID is doc-001",
    ]
    for text in safe_texts:
        assert _redact_pii(text) == text


# ═══════════════════════════════════════════════════════════════════════════
# 3. SSE Connection Limiter Test
# ═══════════════════════════════════════════════════════════════════════════
def test_sse_connection_limiter_unit():
    """Unit test for the SSEConnectionLimiter logic and thread-safe limits."""
    # Fresh limiter instance with custom limit via settings mock or direct checking
    limiter = SSEConnectionLimiter()

    # Stub the max_per_ip property to be 3 for deterministic testing
    with patch.object(SSEConnectionLimiter, "max_per_ip", new=3):
        assert limiter.max_per_ip == 3

        # Acquire 3 slots successfully
        assert limiter.try_acquire("127.0.0.1") is True
        assert limiter.try_acquire("127.0.0.1") is True
        assert limiter.try_acquire("127.0.0.1") is True
        assert limiter.active_count("127.0.0.1") == 3

        # 4th acquisition should fail
        assert limiter.try_acquire("127.0.0.1") is False

        # Other IP should be isolated and succeed
        assert limiter.try_acquire("192.168.1.1") is True
        assert limiter.active_count("192.168.1.1") == 1

        # Release one slot
        limiter.release("127.0.0.1")
        assert limiter.active_count("127.0.0.1") == 2

        # Now acquisition should succeed
        assert limiter.try_acquire("127.0.0.1") is True
        assert limiter.active_count("127.0.0.1") == 3
        assert limiter.try_acquire("127.0.0.1") is False

        # Reset should wipe all counts
        limiter.reset()
        assert limiter.active_count("127.0.0.1") == 0
        assert limiter.active_count("192.168.1.1") == 0


@pytest.mark.asyncio
async def test_sse_limiter_integration_limits_exceeded(async_test_client):
    """Verify that when 3 slots are occupied, subsequent requests receive 429."""
    # Setup AppStatus exit event
    AppStatus.should_exit_event = asyncio.Event()

    # Pre-occupy 3 connection slots for the test client IP.
    # ASGITransport requests might resolve client host to "127.0.0.1", "testclient", or "unknown".
    sse_limiter.reset()
    for _ in range(3):
        sse_limiter.try_acquire("127.0.0.1")
        sse_limiter.try_acquire("testclient")
        sse_limiter.try_acquire("unknown")

    # Now make a request, which should fail with 429
    resp = await async_test_client.post(
        "/chat/stream",
        json={"question": "Should be blocked"},
    )
    assert resp.status_code == 429
    assert "Too many concurrent streams" in resp.json()["detail"]

    # Release slots and try again, it should pass
    sse_limiter.reset()
    resp = await async_test_client.post(
        "/chat/stream",
        json={"question": "Should pass now"},
    )
    assert resp.status_code == 200


# ═══════════════════════════════════════════════════════════════════════════
# 4. Supabase User-Scoped Client Test
# ═══════════════════════════════════════════════════════════════════════════
@patch("supabase.create_client")
def test_get_supabase_user_client_initialization(mock_create_client):
    """Verify that get_supabase_user_client properly attaches JWT in auth header."""
    mock_client = MagicMock()
    mock_create_client.return_value = mock_client

    # Inject mock settings values
    from app.config import get_settings

    settings = get_settings()

    with (
        patch.object(settings, "supabase_url", "https://xyz.supabase.co"),
        patch.object(settings, "supabase_anon_key", "anon-key-123"),
    ):
        jwt_token = "mock-user-jwt-token"
        client = get_supabase_user_client(jwt_token)

        assert client == mock_client
        mock_create_client.assert_called_once()

        # Verify call arguments
        args, kwargs = mock_create_client.call_args
        assert args[0] == "https://xyz.supabase.co"
        assert args[1] == "anon-key-123"

        options = kwargs.get("options")
        assert options is not None
        assert options.headers.get("Authorization") == "Bearer mock-user-jwt-token"
