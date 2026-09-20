from enum import StrEnum

from pydantic import Field

from .common import CamelModel
from .users import LanguageCode


class TranslationTarget(StrEnum):
    SPOT = "spot"
    COMMENT = "comment"


class TranslationResponse(CamelModel):
    target_type: TranslationTarget = Field(alias="targetType")
    target_id: int = Field(alias="targetId")
    language: LanguageCode
    text: str
    place_name: str | None = Field(default=None, alias="placeName")
