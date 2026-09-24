from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR / ".env")
VERCEL_PRODUCTION_HOST = os.getenv("VERCEL_PROJECT_PRODUCTION_URL", "").strip()
VERCEL_PRODUCTION_ORIGIN = (
    f"https://{VERCEL_PRODUCTION_HOST}" if VERCEL_PRODUCTION_HOST else ""
)
IS_VERCEL = os.getenv("VERCEL", "").strip().lower() in {"1", "true", "yes", "on"} or bool(
    os.getenv("VERCEL_URL")
)


def _bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    database_path: Path = Path(os.getenv("DATABASE_PATH", BASE_DIR / "data" / "summarize.db"))
    database_url: str | None = (
        os.getenv("DATABASE_URL")
        or os.getenv("POSTGRES_URL")
        or os.getenv("NEON_DATABASE_URL")
        or None
    )
    bot_token: str = os.getenv("TELEGRAM_BOT_TOKEN", "")
    web_app_url: str = (
        os.getenv("TELEGRAM_WEB_APP_URL")
        or VERCEL_PRODUCTION_ORIGIN
        or "http://localhost:8080"
    )
    telegram_webhook_url: str = os.getenv("TELEGRAM_WEBHOOK_URL") or (
        f"{VERCEL_PRODUCTION_ORIGIN}/api/telegram/webhook"
        if VERCEL_PRODUCTION_ORIGIN
        else ""
    )
    telegram_webhook_secret: str = os.getenv("TELEGRAM_WEBHOOK_SECRET", "")
    webhook_setup_secret: str = os.getenv("WEBHOOK_SETUP_SECRET", "")
    ai_api_key: str = os.getenv("AI_API_KEY", "")
    ai_model: str = os.getenv("AI_MODEL", "gpt-4.1-mini")
    ai_base_url: str | None = os.getenv("AI_BASE_URL") or None
    max_file_mb: int = int(os.getenv("MAX_FILE_MB", "20"))
    max_chunk_chars: int = int(os.getenv("AI_CHUNK_CHARS", "14000"))
    dev_mode: bool = _bool("DEV_MODE", False) and not IS_VERCEL
    dev_user_id: int = int(os.getenv("DEV_USER_ID", "10001"))
    dev_user_name: str = os.getenv("DEV_USER_NAME", "Ava")
    frontend_origins: tuple[str, ...] = tuple(
        item.strip()
        for item in os.getenv(
            "FRONTEND_ORIGINS", "http://localhost:3000,http://localhost:5173"
        ).split(",")
        if item.strip()
    )
    is_vercel: bool = IS_VERCEL


settings = Settings()
