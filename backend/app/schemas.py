from typing import Literal

from pydantic import BaseModel


Mode = Literal["quick", "notes", "exam"]


class SummaryRequest(BaseModel):
    mode: Mode


class UserResponse(BaseModel):
    id: int
    first_name: str
    username: str | None = None

