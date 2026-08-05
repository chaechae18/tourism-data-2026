from datetime import datetime

from pydantic import Field, field_validator

from .common import CamelModel


class BannerResponse(CamelModel):
    img: str | None = None
    title: str | None = None
    sub_title: str | None = Field(default=None, alias="subTitle")
    link: str | None = None


class PopupResponse(CamelModel):
    title: str | None = None
    content: str | None = None
    img: str | None = None
    link: str | None = None


class FestivalResponse(CamelModel):
    name: str | None = None
    content: str | None = None
    location: str | None = None
    start_date: datetime | None = Field(default=None, alias="startDate")
    end_date: datetime | None = Field(default=None, alias="endDate")
    img: str | None = None
    url: str | None = None


class RecommendedPlaceResponse(CamelModel):
    name: str | None = None
    text: str | None = None
    address: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    admission_fee: str | None = Field(default=None, alias="admissionFee")

    # LATITUDE/LONGITUDE 는 DDL 에서 VARCHAR 라 지도에 넘기기 전에 숫자로 바꾼다.
    @field_validator("latitude", "longitude", mode="before")
    @classmethod
    def parse_coordinate(cls, value: object) -> float | None:
        if value is None:
            return None
        try:
            return float(str(value).strip())
        except ValueError:
            return None
