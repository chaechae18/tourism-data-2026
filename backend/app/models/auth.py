from datetime import date
from pydantic import Field, field_validator
from .common import CamelModel


class SignupRequest(CamelModel):
    id: str
    nickname: str
    country: str
    birth_date: date | None = Field(default=None, alias="birthDate")
    email: str
    password: str

    @field_validator("id", "nickname", "country", "email", mode="before")
    @classmethod
    def strip_text(cls, value):
        return str(value).strip()


class SignupResponse(CamelModel):
    user_no: int = Field(alias="userNo")
    message: str