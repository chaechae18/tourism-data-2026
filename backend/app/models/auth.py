from datetime import date

from pydantic import Field, field_validator

from .common import CamelModel


class SignupRequest(CamelModel):
    id: str
    nickname: str
    country: str
    birth_date: date | None = Field(
        default=None,
        alias="birthDate",
    )
    email: str
    password: str

    language_code: str = Field(
        default="ko",
        alias="languageCode",
    )

    @field_validator(
        "id",
        "nickname",
        "country",
        "email",
        "language_code",
        mode="before",
    )
    @classmethod
    def strip_text(cls, value):
        return str(value).strip()


class SignupResponse(CamelModel):
    user_no: int = Field(alias="userNo")
    message: str
    user: dict


class LoginRequest(CamelModel):
    id: str
    password: str


class LoginResponse(CamelModel):
    message: str
    user: dict
    
class UpdateUserRequest(CamelModel):
    nickname: str
    country: str
    birth_date: date | None = Field(
        default=None,
        alias="birthDate",
    )
    email: str

    @field_validator(
        "nickname",
        "country",
        "email",
        mode="before",
    )
    @classmethod
    def strip_text(cls, value):
        return str(value).strip()