from datetime import datetime

from pydantic import Field, field_validator

from .common import CamelModel, PlaceType
from .places import KakaoPlace


class SpotCreateRequest(CamelModel):
    place: KakaoPlace
    place_type: PlaceType = Field(alias="placeType")
    caption: str = Field(min_length=1, max_length=350)
    photo_url: str | None = Field(default=None, alias="photoUrl", max_length=500)

    @field_validator("caption", mode="before")
    @classmethod
    def strip_caption(cls, value: str) -> str:
        return value.strip()


class SpotPlace(CamelModel):
    place_id: int = Field(alias="placeId")
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
    moderation_status: int = Field(alias="moderationStatus")
    created_at: datetime = Field(alias="createdAt")
