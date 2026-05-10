"""JWT verification and user context for Supabase Auth."""

from __future__ import annotations

from dataclasses import dataclass
import logging
import time
from typing import Any

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import httpx
import jwt

from ..config import get_settings

logger = logging.getLogger(__name__)

_bearer_scheme = HTTPBearer(auto_error=False)
_TOKEN_CACHE_SKEW_SECONDS = 30
_TOKEN_CACHE_MAX_SECONDS = 300
_token_user_cache: dict[str, tuple[float, UserContext]] = {}
_jwks_clients: dict[str, jwt.PyJWKClient] = {}


@dataclass(frozen=True)
class UserContext:
    """Authenticated user extracted from a Supabase JWT."""

    user_id: str
    email: str
    role: str = "authenticated"


def _supabase_auth_url() -> str:
    settings = get_settings()
    return f"{settings.supabase_url.rstrip('/')}/auth/v1" if settings.supabase_url else ""


def _decode_kwargs(algorithms: list[str]) -> dict[str, Any]:
    kwargs: dict[str, Any] = {
        "algorithms": algorithms,
        "audience": "authenticated",
    }
    issuer = _supabase_auth_url()
    if issuer:
        kwargs["issuer"] = issuer
    return kwargs


def _user_from_payload(payload: dict[str, Any]) -> UserContext:
    user_id = str(payload.get("sub") or payload.get("id") or "")
    email = str(payload.get("email") or "")
    role = str(payload.get("role") or payload.get("aud") or "authenticated")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing user identity (sub)",
        )

    return UserContext(user_id=user_id, email=email, role=role)


def _cache_expiry_for_token(token: str) -> float:
    now = time.time()
    try:
        payload = jwt.decode(
            token,
            options={"verify_signature": False, "verify_exp": False},
            algorithms=["HS256", "RS256", "ES256"],
        )
    except jwt.PyJWTError:
        return now + 60

    exp = payload.get("exp")
    if isinstance(exp, int | float):
        return min(float(exp) - _TOKEN_CACHE_SKEW_SECONDS, now + _TOKEN_CACHE_MAX_SECONDS)
    return now + 60


def _get_cached_user(token: str) -> UserContext | None:
    cached = _token_user_cache.get(token)
    if cached is None:
        return None

    expires_at, user = cached
    if expires_at > time.time():
        return user

    _token_user_cache.pop(token, None)
    return None


def _cache_user(token: str, user: UserContext) -> None:
    expires_at = _cache_expiry_for_token(token)
    if expires_at > time.time():
        _token_user_cache[token] = (expires_at, user)


def verify_jwt(token: str) -> dict[str, Any]:
    """Decode and verify a legacy Supabase HS256 JWT."""
    settings = get_settings()
    if not settings.supabase_jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="SUPABASE_JWT_SECRET is not configured",
        )

    try:
        return jwt.decode(
            token,
            settings.supabase_jwt_secret,
            **_decode_kwargs(["HS256"]),
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        ) from None
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {e}",
        ) from None


def _verify_jwt_with_jwks(token: str) -> dict[str, Any]:
    """Verify an asymmetric Supabase JWT using the project's JWKS endpoint."""
    auth_url = _supabase_auth_url()
    if not auth_url:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="SUPABASE_URL is required to verify asymmetric JWTs",
        )

    try:
        header = jwt.get_unverified_header(token)
    except jwt.PyJWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token header: {e}",
        ) from None

    alg = header.get("alg")
    if alg == "HS256":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="JWKS verification does not apply to HS256 tokens",
        )

    jwks_url = f"{auth_url}/.well-known/jwks.json"
    client = _jwks_clients.get(jwks_url)
    if client is None:
        client = jwt.PyJWKClient(jwks_url)
        _jwks_clients[jwks_url] = client

    try:
        signing_key = client.get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            **_decode_kwargs([str(alg)] if alg else ["ES256", "RS256"]),
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        ) from None
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {e}",
        ) from None


async def _verify_with_supabase_auth(token: str) -> UserContext:
    """Verify a Supabase session through Auth's /user endpoint."""
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Supabase Auth verification is not configured",
        )

    auth_url = f"{settings.supabase_url.rstrip('/')}/auth/v1/user"
    headers = {
        "apikey": settings.supabase_anon_key,
        "Authorization": f"Bearer {token}",
    }

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(auth_url, headers=headers)
    except httpx.HTTPError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not verify token with Supabase Auth",
        ) from None

    if response.status_code == 200:
        data = response.json()
        user_id = str(data.get("id") or data.get("sub") or "")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Supabase Auth response missing user id",
            )

        return UserContext(
            user_id=user_id,
            email=str(data.get("email") or ""),
            role=str(data.get("role") or data.get("aud") or "authenticated"),
        )

    if response.status_code in {401, 403}:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Supabase session",
        )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=f"Supabase Auth verification failed ({response.status_code})",
    )


async def verify_access_token(token: str) -> UserContext:
    """Verify the browser's Supabase access token and return its user context."""
    cached = _get_cached_user(token)
    if cached is not None:
        return cached

    try:
        alg = jwt.get_unverified_header(token).get("alg")
    except jwt.PyJWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token header: {e}",
        ) from None

    local_error: str | None = None
    try:
        payload = verify_jwt(token) if alg == "HS256" else _verify_jwt_with_jwks(token)
        user = _user_from_payload(payload)
        _cache_user(token, user)
        return user
    except HTTPException as e:
        local_error = str(e.detail)

    try:
        user = await _verify_with_supabase_auth(token)
    except HTTPException:
        if local_error:
            logger.info("Local Supabase JWT verification failed: %s", local_error)
        raise

    _cache_user(token, user)
    return user


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> UserContext:
    """Extract and verify the user from the request."""
    settings = get_settings()

    if not settings.auth_enabled:
        return UserContext(user_id="anonymous", email="dev@localhost", role="admin")

    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return await verify_access_token(credentials.credentials)


async def get_optional_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> UserContext | None:
    """Like get_current_user but returns None instead of raising on missing auth."""
    settings = get_settings()

    if not settings.auth_enabled:
        return UserContext(user_id="anonymous", email="dev@localhost", role="admin")

    if credentials is None or not credentials.credentials:
        return None

    try:
        return await verify_access_token(credentials.credentials)
    except HTTPException:
        return None
