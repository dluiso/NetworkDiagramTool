from datetime import datetime, timedelta, timezone
from collections import defaultdict, deque
from typing import Optional
import secrets
import time
import json
import jwt
import bcrypt

from ..config import get_settings

settings = get_settings()

# ---------------------------------------------------------------------------
# Password hashing (bcrypt direct — compatible with bcrypt 5.x)
# ---------------------------------------------------------------------------

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8")
        )
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


# ---------------------------------------------------------------------------
# JWT tokens
# ---------------------------------------------------------------------------

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    })
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def decode_access_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except jwt.PyJWTError:
        return None


# ---------------------------------------------------------------------------
# Secure random tokens (for activation links, etc.)
# ---------------------------------------------------------------------------

def generate_secure_token(length: int = 32) -> str:
    """Generate a cryptographically secure URL-safe token."""
    return secrets.token_urlsafe(length)


# ---------------------------------------------------------------------------
# In-memory rate limiter (sliding window)
# ---------------------------------------------------------------------------

_rate_buckets: dict = defaultdict(deque)


def check_rate_limit(key: str, max_requests: int, window_seconds: int) -> bool:
    """
    Sliding window rate limiter.
    Returns True if request is allowed, False if limit exceeded.
    Thread-safety: acceptable for single-process dev; use Redis for multi-process prod.
    """
    now = time.monotonic()
    bucket = _rate_buckets[key]

    # Evict timestamps outside the window
    while bucket and bucket[0] < now - window_seconds:
        bucket.popleft()

    if len(bucket) >= max_requests:
        return False

    bucket.append(now)
    return True


def clear_rate_limit(key: str) -> None:
    """Reset rate limit bucket for a given key (e.g. after successful auth)."""
    _rate_buckets.pop(key, None)


# ---------------------------------------------------------------------------
# Permission helpers
# ---------------------------------------------------------------------------

# All available permission slugs
ALL_PERMISSIONS = [
    "dashboard",
    "scanner",
    "projects",
    "tools",
    "profile",
    "admin",      # full admin panel access
    "users",      # manage users
    "groups",     # manage groups
    "config",     # manage app configuration
]


def user_has_permission(user, permission: str) -> bool:
    """
    Check if a user has a given permission.
    is_admin=True (legacy flag) always grants all permissions.
    Otherwise, derived from the user's group permissions list.
    'admin' permission in a group also grants all other permissions.
    """
    if not user.is_active or not user.is_approved:
        return False
    if user.is_admin:
        return True
    if not user.group:
        return False
    try:
        perms: list = json.loads(user.group.permissions or "[]")
    except (ValueError, TypeError):
        return False
    return "admin" in perms or permission in perms


def get_user_permissions(user) -> list:
    """Return the effective permission list for a user."""
    if user.is_admin:
        return ALL_PERMISSIONS[:]
    if not user.group:
        return []
    try:
        perms: list = json.loads(user.group.permissions or "[]")
    except (ValueError, TypeError):
        perms = []
    if "admin" in perms:
        return ALL_PERMISSIONS[:]
    return [p for p in perms if p in ALL_PERMISSIONS]
