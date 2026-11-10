"""Hand-copied models from docs/openapi-prod.json (contract of record).

Only what this client needs. Upstream payloads are passed through loosely
(extra="allow") so undocumented fields survive; these models document the
shapes we rely on.
"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict


class LoginRequest(BaseModel):
    email: str
    password: str


class GateRequest(BaseModel):
    passcode: str


class ErrorBody(BaseModel):
    status: int
    message: str
    code: str | None = None


class ProxyResponse(BaseModel):
    """Normalized shape every /m/* route returns on success."""

    data: Any
    meta: Any = None


class MinimalUserDTO(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: int | None = None
    publicId: str | None = None
    username: str | None = None
    name: str | None = None
    profile_picture: dict[str, Any] | None = None
    is_following: bool | None = None
    has_stories: bool | None = None


class MediaFileDTO(BaseModel):
    model_config = ConfigDict(extra="allow")

    url: str | None = None
    thumbnail_url: str | None = None
    compressed_url: str | None = None
    mime: str | None = None
    status: str | None = None


class PostV1Dto(BaseModel):
    """GET /api/v1/app/post/{publicId} and feed timeline items."""

    model_config = ConfigDict(extra="allow")

    id: int | None = None
    publicId: str | None = None
    title: str | None = None
    description: str | None = None
    post_type: str | None = None
    createdAt: str | None = None
    posted_by: MinimalUserDTO | None = None
    media: list[MediaFileDTO] = []
    likes_count: int = 0
    is_liked: bool = False
    comments_count: int = 0
    repost_count: int = 0
    view_count: int = 0


class TimelineGroup(BaseModel):
    model_config = ConfigDict(extra="allow")

    date_key: str | None = None
    posts: list[PostV1Dto] = []


class PaginationDetailsDTO(BaseModel):
    model_config = ConfigDict(extra="allow")

    page: int | None = None
    pageSize: int | None = None
    total: int | None = None
    pageCount: int | None = None
