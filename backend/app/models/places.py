from pydantic import Field, field_validator

from .common import CamelModel


class KakaoPlace(CamelModel):
    id: str = Field(min_length=1, max_length=255)
    name: str = Field(min_length=1, max_length=200)
    address: str = Field(default="", max_length=500)
    road_address: str = Field(default="", alias="roadAddress", max_length=500)
    latitude: float
    longitude: float
    category_name: str = Field(default="", alias="categoryName")
    category_group_code: str = Field(default="", alias="categoryGroupCode")
    category_group_name: str = Field(default="", alias="categoryGroupName")
    phone: str = ""
    place_url: str = Field(default="", alias="placeUrl")
    distance: int | None = None

    @field_validator("id", "name", mode="before")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        return value.strip()


class PlaceSearchMeta(CamelModel):
    total_count: int = Field(alias="totalCount")
    pageable_count: int = Field(alias="pageableCount")
    is_end: bool = Field(alias="isEnd")


class PlaceSearchResponse(CamelModel):
    meta: PlaceSearchMeta
    places: list[KakaoPlace]
