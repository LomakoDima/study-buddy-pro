from __future__ import annotations

import asyncio
import contextlib
import secrets
from contextlib import asynccontextmanager
from urllib.parse import parse_qsl, urlencode

from aiogram import Bot, Dispatcher
from aiogram.types import Update
from fastapi import (
    BackgroundTasks,
    Depends,
    FastAPI,
    File,
    Header,
    HTTPException,
    Request,
    Response,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware

from .ai import Summarizer
from .auth import AuthUser, current_user
from .bot import create_router
from .config import settings
from .db import Database
from .parsers import parse_document
from .schemas import SummaryRequest, UserResponse
from .services import SummaryService


if settings.is_vercel and not settings.database_url:
    raise RuntimeError(
        "DATABASE_URL is required on Vercel. Connect a PostgreSQL database before deploying."
    )

database = Database(settings.database_path, settings.database_url)
summarizer = Summarizer(settings)
service = SummaryService(database, summarizer)
bot = Bot(settings.bot_token) if settings.bot_token else None
dispatcher = Dispatcher()
dispatcher.include_router(create_router(service, settings))


@asynccontextmanager
async def lifespan(app: FastAPI):
    polling_task: asyncio.Task | None = None
    if bot and not settings.telegram_webhook_url and not settings.is_vercel:
        polling_task = asyncio.create_task(
            dispatcher.start_polling(bot, handle_signals=False, close_bot_session=False)
        )
    yield
    if polling_task:
        polling_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await polling_task
    if bot:
        await bot.session.close()


app = FastAPI(title="Summarize API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.frontend_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def restore_vercel_api_path(request: Request, call_next):
    """Restore the original path after Vercel rewrites /api/* to one function."""
    if request.scope.get("path") in {"/api/index", "/api/index.py"}:
        query = parse_qsl(
            request.scope.get("query_string", b"").decode("utf-8"),
            keep_blank_values=True,
        )
        forwarded_path: str | None = None
        remaining_query: list[tuple[str, str]] = []
        for key, value in query:
            if key == "__vercel_api_path" and forwarded_path is None:
                forwarded_path = value
            else:
                remaining_query.append((key, value))

        if forwarded_path is not None:
            path = f"/api/{forwarded_path.lstrip('/')}"
            request.scope["path"] = path
            request.scope["raw_path"] = path.encode("utf-8")
            request.scope["query_string"] = urlencode(remaining_query).encode("utf-8")

    return await call_next(request)


@app.get("/api/health")
def health() -> dict[str, str | bool]:
    return {
        "status": "ok",
        "aiConfigured": summarizer.configured,
        "botConfigured": bot is not None,
        "database": database.backend,
    }


@app.post("/api/telegram/webhook", include_in_schema=False)
async def telegram_webhook(
    request: Request,
    telegram_secret: str | None = Header(
        default=None, alias="X-Telegram-Bot-Api-Secret-Token"
    ),
) -> dict[str, bool]:
    if not bot or not settings.telegram_webhook_secret:
        raise HTTPException(status_code=503, detail="Telegram webhook is not configured")
    if not telegram_secret or not secrets.compare_digest(
        telegram_secret, settings.telegram_webhook_secret
    ):
        raise HTTPException(status_code=403, detail="Invalid Telegram webhook secret")

    update = Update.model_validate(await request.json(), context={"bot": bot})
    await dispatcher.feed_update(bot, update)
    return {"ok": True}


@app.post("/api/telegram/setup", include_in_schema=False)
async def setup_telegram_webhook(
    setup_secret: str | None = Header(default=None, alias="X-Webhook-Setup-Secret"),
) -> dict[str, str | bool]:
    if not bot:
        raise HTTPException(status_code=503, detail="TELEGRAM_BOT_TOKEN is not configured")
    if not settings.webhook_setup_secret or not setup_secret or not secrets.compare_digest(
        setup_secret, settings.webhook_setup_secret
    ):
        raise HTTPException(status_code=403, detail="Invalid webhook setup secret")
    if not settings.telegram_webhook_url.startswith("https://"):
        raise HTTPException(
            status_code=503,
            detail="TELEGRAM_WEBHOOK_URL must be a public HTTPS URL",
        )
    if not settings.telegram_webhook_secret:
        raise HTTPException(
            status_code=503, detail="TELEGRAM_WEBHOOK_SECRET is not configured"
        )

    await bot.set_webhook(
        url=settings.telegram_webhook_url,
        secret_token=settings.telegram_webhook_secret,
        allowed_updates=dispatcher.resolve_used_update_types(),
    )
    info = await bot.get_webhook_info()
    return {"ok": True, "url": info.url, "pendingUpdates": str(info.pending_update_count)}


@app.get("/api/me", response_model=UserResponse)
def me(user: AuthUser = Depends(current_user)) -> AuthUser:
    service.ensure_user(user)
    return user


@app.post("/api/documents", status_code=201)
async def upload_document(
    file: UploadFile = File(...), user: AuthUser = Depends(current_user)
) -> dict:
    filename = file.filename or "document"
    max_bytes = settings.max_file_mb * 1024 * 1024
    content = await file.read(max_bytes + 1)
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=413, detail=f"The file is too large. The limit is {settings.max_file_mb} MB."
        )
    parsed = parse_document(filename, content)
    return service.create_document(user, filename, len(content), parsed)


@app.get("/api/summaries")
def list_summaries(user: AuthUser = Depends(current_user)) -> list[dict]:
    service.ensure_user(user)
    return service.list_summaries(user.id)


@app.post("/api/documents/{document_id}/summaries", status_code=202)
def create_summary(
    document_id: str,
    request: SummaryRequest,
    background_tasks: BackgroundTasks,
    user: AuthUser = Depends(current_user),
) -> dict:
    if not summarizer.configured:
        raise HTTPException(
            status_code=503,
            detail="AI summarization is not configured. Set AI_API_KEY on the backend.",
        )
    summary = service.create_summary(user, document_id, request.mode)
    background_tasks.add_task(service.generate_summary, summary["id"])
    return summary


@app.get("/api/summaries/{summary_id}")
def get_summary(summary_id: str, user: AuthUser = Depends(current_user)) -> dict:
    return service.get_summary(user.id, summary_id)


@app.delete("/api/summaries/{summary_id}", status_code=204)
def delete_summary(summary_id: str, user: AuthUser = Depends(current_user)) -> Response:
    service.delete_summary(user.id, summary_id)
    return Response(status_code=204)
