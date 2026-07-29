from datetime import datetime
from typing import Literal

from pydantic import Field, field_validator

from .common import (
    CamelModel,
    PlaceProvider,
    PlaceType,
    ReactionType,
)
from .places import PlaceSearchItem


class SpotCreateRequest(CamelModel):
    place: PlaceSearchItem
    place_type: PlaceType = Field(alias="placeType")
    caption: str = Field(min_length=1, max_length=350)
    photo_url: str | None = Field(default=None, alias="photoUrl", max_length=500)

    @field_validator("caption", mode="before")
    @classmethod
    def strip_caption(cls, value: str) -> str:
        return value.strip()


class SpotPlace(CamelModel):
    place_id: int = Field(alias="placeId")
    provider: PlaceProvider
    map_place_id: str = Field(alias="mapPlaceId")
    type: PlaceType
    name: str
    address: str | None
    latitude: float
    longitude: float


class SpotResponse(CamelModel):
    id: int
    user_no: int = Field(alias="userNo")
    author_nickname: str = Field(alias="authorNickname")
    place: SpotPlace
    photo_url: str | None = Field(alias="photoUrl")
    caption: str
    like_count: int = Field(alias="likeCount")
    comment_count: int = Field(default=0, alias="commentCount")
    is_liked: bool = Field(default=False, alias="isLiked")
    is_bookmarked: bool = Field(default=False, alias="isBookmarked")
    is_owner: bool = Field(default=False, alias="isOwner")
    moderation_status: int = Field(alias="moderationStatus")
    created_at: datetime = Field(alias="createdAt")


class ReactionResponse(CamelModel):
    spot_id: int = Field(alias="spotId")
    type: ReactionType
    active: bool
    like_count: int = Field(alias="likeCount")


class CommentCreateRequest(CamelModel):
    content: str = Field(min_length=1, max_length=1000)

    @field_validator("content", mode="before")
    @classmethod
    def strip_content(cls, value: str) -> str:
        return value.strip()


class CommentResponse(CamelModel):
    id: int
    spot_id: int = Field(alias="spotId")
    user_no: int = Field(alias="userNo")
    author_nickname: str = Field(alias="authorNickname")
    content: str
    moderation_status: int = Field(alias="moderationStatus")
    is_owner: bool = Field(alias="isOwner")
    created_at: datetime = Field(alias="createdAt")


class ModerationRequest(CamelModel):
    status: Literal[1, 2]


class ModerationResponse(CamelModel):
    target_type: Literal["spot", "comment"] = Field(alias="targetType")
    target_id: int = Field(alias="targetId")
    status: Literal[1, 2]
