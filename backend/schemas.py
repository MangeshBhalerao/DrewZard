# schemas.py

from pydantic import BaseModel
from typing import Literal, Optional


class DrawPayload(BaseModel):
    x: float
    y: float


class ChatPayload(BaseModel):
    message: str


class Event(BaseModel):
    type: Literal["draw", "chat"]
    payload: dict