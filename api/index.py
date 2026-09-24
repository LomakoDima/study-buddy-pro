"""Vercel Python Function entrypoint and API path adapter."""

import logging
from urllib.parse import parse_qsl, urlencode

from fastapi import FastAPI, Request


logger = logging.getLogger(__name__)

try:
    from backend.app.main import app
except Exception:
    logger.exception("The Summarize backend failed to start")
    app = FastAPI(title="Summarize API (configuration error)")

    @app.get("/api/health", status_code=503)
    def failed_health() -> dict[str, str | bool]:
        return {
            "status": "error",
            "aiConfigured": False,
            "botConfigured": False,
            "database": "unavailable",
            "detail": (
                "The backend failed to start. Check the Vercel Function logs and verify "
                "the PostgreSQL connection and Telegram bot token."
            ),
        }

    @app.api_route(
        "/api/{path:path}",
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        status_code=503,
    )
    def unavailable(path: str) -> dict[str, str]:
        return {"detail": "The backend is unavailable. Check /api/health and Vercel logs."}


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

__all__ = ["app"]
