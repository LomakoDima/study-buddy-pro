from __future__ import annotations

import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from urllib.parse import parse_qsl

from fastapi import Header, HTTPException, status

from .config import settings


@dataclass(frozen=True)
class AuthUser:
    id: int
    first_name: str
    username: str | None = None


def validate_init_data(init_data: str) -> AuthUser:
    if not settings.bot_token:
        raise HTTPException(status_code=503, detail="Telegram bot token is not configured")

    values = dict(parse_qsl(init_data, keep_blank_values=True))
    received_hash = values.pop("hash", None)
    if not received_hash:
        raise HTTPException(status_code=401, detail="Telegram authentication is missing a hash")

    data_check_string = "\n".join(f"{key}={values[key]}" for key in sorted(values))
    secret_key = hmac.new(b"WebAppData", settings.bot_token.encode(), hashlib.sha256).digest()
    expected_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected_hash, received_hash):
        raise HTTPException(status_code=401, detail="Invalid Telegram authentication")

    try:
        auth_date = int(values.get("auth_date", "0"))
        if abs(time.time() - auth_date) > 24 * 60 * 60:
            raise HTTPException(status_code=401, detail="Telegram authentication has expired")
        raw_user = json.loads(values["user"])
        return AuthUser(
            id=int(raw_user["id"]),
            first_name=str(raw_user.get("first_name") or "Student"),
            username=raw_user.get("username"),
        )
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=401, detail="Invalid Telegram user data") from exc


def current_user(authorization: str | None = Header(default=None)) -> AuthUser:
    if authorization and authorization.startswith("tma "):
        return validate_init_data(authorization[4:])
    if settings.dev_mode:
        return AuthUser(settings.dev_user_id, settings.dev_user_name, "local_dev")
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Open this app from Telegram to sign in",
    )
