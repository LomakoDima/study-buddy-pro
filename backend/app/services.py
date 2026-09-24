from __future__ import annotations

import json
import logging
import uuid
from pathlib import Path
from typing import Any

from fastapi import HTTPException

from .ai import Summarizer
from .auth import AuthUser
from .db import Database, utc_now
from .parsers import ParsedDocument


logger = logging.getLogger(__name__)


class SummaryService:
    def __init__(self, database: Database, summarizer: Summarizer):
        self.database = database
        self.summarizer = summarizer

    def ensure_user(self, user: AuthUser) -> None:
        self.database.upsert_user(user.id, user.first_name, user.username)

    def create_document(
        self,
        user: AuthUser,
        filename: str,
        size_bytes: int,
        parsed: ParsedDocument,
    ) -> dict[str, Any]:
        self.ensure_user(user)
        document_id = str(uuid.uuid4())
        title = Path(filename).stem.replace("_", " ").replace("-", " ").strip() or "Untitled"
        created_at = utc_now()
        self.database.execute(
            """
            INSERT INTO documents
            (id, user_id, filename, title, file_type, size_bytes, unit_count, extracted_text, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                document_id,
                user.id,
                filename,
                title,
                parsed.file_type,
                size_bytes,
                parsed.unit_count,
                parsed.text,
                created_at,
            ),
        )
        return {
            "id": document_id,
            "filename": filename,
            "title": title,
            "fileType": parsed.file_type,
            "sizeBytes": size_bytes,
            "unitCount": parsed.unit_count,
            "createdAt": created_at,
        }

    def create_summary(self, user: AuthUser, document_id: str, mode: str) -> dict[str, Any]:
        document = self.database.fetch_one(
            "SELECT * FROM documents WHERE id = ? AND user_id = ?", (document_id, user.id)
        )
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        summary_id = str(uuid.uuid4())
        now = utc_now()
        self.database.execute(
            """
            INSERT INTO summaries
            (id, document_id, user_id, mode, status, progress, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'processing', 5, ?, ?)
            """,
            (summary_id, document_id, user.id, mode, now, now),
        )
        return self.get_summary(user.id, summary_id)

    async def generate_summary(self, summary_id: str) -> None:
        row = self.database.fetch_one(
            """
            SELECT s.*, d.filename, d.extracted_text
            FROM summaries s JOIN documents d ON d.id = s.document_id
            WHERE s.id = ?
            """,
            (summary_id,),
        )
        if not row:
            return

        def progress(value: int) -> None:
            self.database.execute(
                "UPDATE summaries SET progress = ?, updated_at = ? WHERE id = ?",
                (value, utc_now(), summary_id),
            )

        try:
            payload = await self.summarizer.summarize(
                row["filename"], row["extracted_text"], row["mode"], progress
            )
            self.database.execute(
                """
                UPDATE summaries
                SET status = 'ready', progress = 100, payload = ?, error = NULL, updated_at = ?
                WHERE id = ?
                """,
                (json.dumps(payload, ensure_ascii=False), utc_now(), summary_id),
            )
        except Exception as exc:
            logger.exception("Summary generation failed for %s", summary_id)
            message = str(exc).strip() or "Summary generation failed"
            self.database.execute(
                """
                UPDATE summaries
                SET status = 'error', error = ?, updated_at = ?
                WHERE id = ?
                """,
                (message[:500], utc_now(), summary_id),
            )

    def get_summary(self, user_id: int, summary_id: str) -> dict[str, Any]:
        row = self.database.fetch_one(
            """
            SELECT s.*, d.filename, d.title AS document_title, d.file_type,
                   d.size_bytes, d.unit_count
            FROM summaries s JOIN documents d ON d.id = s.document_id
            WHERE s.id = ? AND s.user_id = ?
            """,
            (summary_id, user_id),
        )
        if not row:
            raise HTTPException(status_code=404, detail="Summary not found")
        return self._serialize(row)

    def list_summaries(self, user_id: int) -> list[dict[str, Any]]:
        rows = self.database.fetch_all(
            """
            SELECT s.*, d.filename, d.title AS document_title, d.file_type,
                   d.size_bytes, d.unit_count
            FROM summaries s JOIN documents d ON d.id = s.document_id
            WHERE s.user_id = ?
            ORDER BY s.created_at DESC
            """,
            (user_id,),
        )
        return [self._serialize(row) for row in rows]

    def delete_summary(self, user_id: int, summary_id: str) -> None:
        row = self.database.fetch_one(
            "SELECT document_id FROM summaries WHERE id = ? AND user_id = ?",
            (summary_id, user_id),
        )
        if not row:
            raise HTTPException(status_code=404, detail="Summary not found")
        self.database.execute(
            "DELETE FROM summaries WHERE id = ? AND user_id = ?", (summary_id, user_id)
        )
        remaining = self.database.fetch_one(
            "SELECT id FROM summaries WHERE document_id = ? LIMIT 1", (row["document_id"],)
        )
        if not remaining:
            self.database.execute(
                "DELETE FROM documents WHERE id = ? AND user_id = ?",
                (row["document_id"], user_id),
            )

    @staticmethod
    def _serialize(row: dict[str, Any]) -> dict[str, Any]:
        payload = json.loads(row["payload"]) if row.get("payload") else None
        return {
            "id": row["id"],
            "documentId": row["document_id"],
            "title": (payload or {}).get("title") or row["document_title"],
            "filename": row["filename"],
            "fileType": row["file_type"],
            "sizeBytes": row["size_bytes"],
            "unitCount": row["unit_count"],
            "mode": row["mode"],
            "status": row["status"],
            "progress": row["progress"],
            "error": row["error"],
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
            "payload": payload,
        }
