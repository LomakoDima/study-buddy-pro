from __future__ import annotations

import json
import sqlite3
import threading
from datetime import UTC, datetime
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from psycopg import Connection


def utc_now() -> str:
    return datetime.now(UTC).isoformat()


class Database:
    def __init__(self, path: Path, url: str | None = None):
        self.path = path
        self.url = url
        if not self.url:
            self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._initialize()

    @property
    def backend(self) -> str:
        return "postgresql" if self.url else "sqlite"

    def _connect(self) -> sqlite3.Connection | "Connection[Any]":
        if self.url:
            from psycopg import Connection
            from psycopg.rows import dict_row

            return Connection.connect(self.url, row_factory=dict_row)
        connection = sqlite3.connect(self.path, timeout=30, check_same_thread=False)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA journal_mode = WAL")
        return connection

    def _query(self, query: str) -> str:
        return query.replace("?", "%s") if self.url else query

    def _initialize(self) -> None:
        schema = """
                CREATE TABLE IF NOT EXISTS users (
                    id BIGINT PRIMARY KEY,
                    first_name TEXT NOT NULL,
                    username TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS documents (
                    id TEXT PRIMARY KEY,
                    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    filename TEXT NOT NULL,
                    title TEXT NOT NULL,
                    file_type TEXT NOT NULL,
                    size_bytes INTEGER NOT NULL,
                    unit_count INTEGER NOT NULL,
                    extracted_text TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS summaries (
                    id TEXT PRIMARY KEY,
                    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
                    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    mode TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'processing',
                    progress INTEGER NOT NULL DEFAULT 0,
                    payload TEXT,
                    error TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_summaries_user_created
                ON summaries(user_id, created_at DESC);
                """
        with self._connect() as connection:
            if self.url:
                for statement in schema.split(";"):
                    if statement.strip():
                        connection.execute(statement)
            else:
                connection.executescript(schema)

    def execute(self, query: str, params: tuple[Any, ...] = ()) -> None:
        with self._lock, self._connect() as connection:
            connection.execute(self._query(query), params)
            connection.commit()

    def fetch_one(self, query: str, params: tuple[Any, ...] = ()) -> dict[str, Any] | None:
        with self._lock, self._connect() as connection:
            row = connection.execute(self._query(query), params).fetchone()
            return dict(row) if row else None

    def fetch_all(self, query: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
        with self._lock, self._connect() as connection:
            return [dict(row) for row in connection.execute(self._query(query), params).fetchall()]

    def upsert_user(self, user_id: int, first_name: str, username: str | None) -> None:
        now = utc_now()
        self.execute(
            """
            INSERT INTO users (id, first_name, username, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                first_name = excluded.first_name,
                username = excluded.username,
                updated_at = excluded.updated_at
            """,
            (user_id, first_name, username, now, now),
        )

    @staticmethod
    def decode_payload(row: dict[str, Any]) -> dict[str, Any]:
        result = dict(row)
        if result.get("payload"):
            result["payload"] = json.loads(result["payload"])
        return result
