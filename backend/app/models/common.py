from enum import StrEnum

from pydantic import BaseModel, ConfigDict


class CamelModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


class PlaceType(StrEnum):
    TOUR = "TOUR"
    FOOD = "FOOD"


class PlaceProvider(StrEnum):
    KAKAO = "KAKAO"
    NAVER = "NAVER"


class ReactionType(StrEnum):
    LIKE = "like"
    BOOKMARK = "bookmark"

    @property
    def database_value(self) -> int:
        return 1 if self is ReactionType.LIKE else 2
