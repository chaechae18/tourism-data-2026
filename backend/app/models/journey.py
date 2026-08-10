from datetime import date

from pydantic import Field

from .common import CamelModel


class CourseStopResponse(CamelModel):
    order: int
    time_slot: str = Field(alias="timeSlot")
    place_id: int = Field(alias="placeId")
    quest_id: int | None = Field(default=None, alias="questId")
    name: str | None = None
    category: str | None = None
    address: str | None = None
    latitude: float
    longitude: float
    img: str | None = None
    icon: str
    menu: str | None = None
    # '연중무휴' / '월,목' / None(모름)
    rest_date: str | None = Field(default=None, alias="restDate")
    hours_unknown: bool = Field(alias="hoursUnknown")
    distance_km: float = Field(alias="distanceKm")


class CourseResponse(CamelModel):
    course_id: int | None = Field(default=None, alias="courseId")
    persona_key: str = Field(alias="personaKey")
    persona_name: str = Field(alias="personaName")
    visit_date: date = Field(alias="visitDate")
    total_km: float = Field(alias="totalKm")
    stops: list[CourseStopResponse]
    # 후보가 없어 채우지 못한 시간대
    skipped_slots: list[str] = Field(default_factory=list, alias="skippedSlots")


class CharacterResponse(CamelModel):
    key: str
    name: str
