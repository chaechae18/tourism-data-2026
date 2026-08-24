from datetime import date, datetime

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
    # 화면 상세 카드에 보여 주는 실용 정보
    operating_hours: str | None = Field(default=None, alias="operatingHours")
    parking: str | None = None
    hours_unknown: bool = Field(alias="hoursUnknown")
    distance_km: float = Field(alias="distanceKm")
    # 사용자가 방문 완료로 저장한 퀘스트인지
    completed: bool = False
    # 도슨트로 읽어 줄 설명이 있는지
    docent: bool = False


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


class DocentResponse(CamelModel):
    place_id: int = Field(alias="placeId")
    name: str | None = None
    # PLACE.TEXT 원문 전체. 화면에 같이 보여 주고, 음성도 이 글을 읽는다.
    text: str
    source: str = "한국관광공사"


class QuestCompletionResponse(CamelModel):
    quest_id: int = Field(alias="questId")
    name: str | None = None
    completed: bool
    completed_at: datetime | None = Field(default=None, alias="completedAt")
