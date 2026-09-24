from __future__ import annotations

import io

from aiogram import Bot, F, Router
from aiogram.filters import CommandStart
from aiogram.types import KeyboardButton, Message, ReplyKeyboardMarkup, WebAppInfo
from fastapi import HTTPException

from .auth import AuthUser
from .config import Settings
from .parsers import SUPPORTED_EXTENSIONS, parse_document
from .services import SummaryService


def _user(message: Message) -> AuthUser:
    sender = message.from_user
    if not sender:
        raise RuntimeError("Telegram user is unavailable")
    return AuthUser(sender.id, sender.first_name or "Student", sender.username)


def _render_summary(summary: dict) -> str:
    payload = summary.get("payload") or {}
    parts = [summary["title"]]
    points = payload.get("key_points") or []
    if points:
        parts.append("\nKEY POINTS\n" + "\n".join(f"• {point}" for point in points))
    for section in payload.get("sections") or []:
        parts.append(f"\n{section['heading'].upper()}\n{section['text']}")
    if payload.get("qa"):
        rendered = []
        for item in payload["qa"]:
            rendered.append(f"Q: {item['q']}\nA: {item['a']}")
        parts.append("\nLIKELY QUESTIONS\n" + "\n\n".join(rendered))
    return "\n".join(parts)


async def _send_long(message: Message, text: str) -> None:
    while text:
        if len(text) <= 4000:
            chunk, text = text, ""
        else:
            split = text.rfind("\n", 0, 4000)
            split = split if split > 500 else 4000
            chunk, text = text[:split], text[split:].lstrip()
        await message.answer(chunk)


def create_router(service: SummaryService, config: Settings) -> Router:
    router = Router()

    @router.message(CommandStart())
    async def start(message: Message) -> None:
        text = (
            "Send me a PDF, DOCX or PPTX lecture and I’ll create Study Notes. "
            "Use the Mini App to choose other modes and browse the same library."
        )
        if config.web_app_url.lower().startswith("https://"):
            keyboard = ReplyKeyboardMarkup(
                keyboard=[
                    [
                        KeyboardButton(
                            text="Open Summarize",
                            web_app=WebAppInfo(url=config.web_app_url),
                        )
                    ]
                ],
                resize_keyboard=True,
            )
            await message.answer(text, reply_markup=keyboard)
        else:
            await message.answer(
                text
                + "\n\nThe Mini App button is disabled because TELEGRAM_WEB_APP_URL "
                "must be a public HTTPS address. Direct document uploads already work."
            )

    @router.message(F.document)
    async def document(message: Message, bot: Bot) -> None:
        attachment = message.document
        if not attachment:
            return
        filename = attachment.file_name or "document"
        extension = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        if extension not in SUPPORTED_EXTENSIONS:
            await message.answer("Unsupported file. Please send a PDF, DOCX or PPTX document.")
            return
        if attachment.file_size and attachment.file_size > config.max_file_mb * 1024 * 1024:
            await message.answer(f"That file is too large. The limit is {config.max_file_mb} MB.")
            return
        progress = await message.answer("Downloading and reading your document…")
        try:
            buffer = io.BytesIO()
            await bot.download(attachment, destination=buffer)
            content = buffer.getvalue()
            parsed = parse_document(filename, content)
            user = _user(message)
            saved_document = service.create_document(user, filename, len(content), parsed)
            summary = service.create_summary(user, saved_document["id"], "notes")
            await progress.edit_text("Creating Study Notes…")
            await service.generate_summary(summary["id"])
            summary = service.get_summary(user.id, summary["id"])
            if summary["status"] == "error":
                raise RuntimeError(summary["error"] or "Summary generation failed")
            await progress.delete()
            await _send_long(message, _render_summary(summary))
        except HTTPException as exc:
            await progress.edit_text(str(exc.detail))
        except Exception as exc:
            await progress.edit_text(f"I couldn’t summarize that file: {str(exc)[:300]}")

    @router.message()
    async def fallback(message: Message) -> None:
        await message.answer("Send a PDF, DOCX or PPTX file, or tap Open Summarize.")

    return router
