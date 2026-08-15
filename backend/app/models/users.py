from typing import Literal

from pydantic import Field

from .common import CamelModel


LanguageCode = Literal["ko", "en", "ja", "zh"]


class UserPreferencesResponse(CamelModel):
    language: LanguageCode


class UserPreferencesUpdate(CamelModel):
    language: LanguageCode = Field(description="UI language code")
