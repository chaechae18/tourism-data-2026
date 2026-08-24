# 페르소나 규칙 기반 코스 

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date
import math
import random
from typing import Any

import pymysql

from .mysql import fetch_all
from .personas import Persona, Slot
from .tourapi import ALWAYS_OPEN, WEEKDAYS


EARTH_RADIUS_KM = 6371.0

# 지도 마커 모양. 코스 규칙이 아니라 화면 표현이라 분류코드로 그린다.
DEFAULT_MARKER_ICON = "temple"
MARKER_ICONS = {
    "HS010100": "palace",  # 고궁
    "HS010800": "grotto",  # 고분·능 (봉분 언덕 모양)
    "HS010700": "tower",  # 사적지
}
# 음식점(FD로 시작하는 분류)은 전부 밥그릇 모양
FOOD_CATEGORY_PREFIX = "FD"
FOOD_MARKER_ICON = "food"


def marker_icon(category_code: str | None) -> str:
    if category_code and category_code.startswith(FOOD_CATEGORY_PREFIX):
        return FOOD_MARKER_ICON
    return MARKER_ICONS.get(category_code, DEFAULT_MARKER_ICON)


def candidate_sql() -> str:
    # 역할 적합도 점수(PLACE_PERSONA_SCORE)를 같이 가져온다. 점수가 없으면 0으로 본다.
    return """
        SELECT p.IDX,
               COALESCE(NULLIF(t.NAME, ''), NULLIF(k.NAME, ''), p.NAME) AS NAME,
               COALESCE(NULLIF(t.ADDRESS, ''), NULLIF(k.ADDRESS, ''), p.ADDRESS) AS ADDRESS,
               p.IMG, p.MENU, p.REST_DATE, p.TYPE,
               p.OPERATING_HOURS, p.PARKING,
               p.CATEGORY_CODE, p.CATEGORY_SUB, p.LATITUDE, p.LONGITUDE,
               COALESCE(s.SCORE, 0) AS PERSONA_SCORE
        FROM PLACE p
        LEFT JOIN PLACE_I18N t ON t.PLACE_IDX = p.IDX AND t.LANGUAGE_CODE = %s
        LEFT JOIN PLACE_I18N k ON k.PLACE_IDX = p.IDX AND k.LANGUAGE_CODE = 'ko'
        LEFT JOIN PLACE_PERSONA_SCORE s ON s.PLACE_IDX = p.IDX AND s.PERSONA_KEY = %s
        WHERE p.IS_DISPLAY = 1
          AND p.CATEGORY_CODE IS NOT NULL
          AND p.LATITUDE IS NOT NULL AND p.LATITUDE <> ''
          AND p.LONGITUDE IS NOT NULL AND p.LONGITUDE <> ''
    """


@dataclass(frozen=True)
class Stop:
    order: int
    time_slot: str
    place_idx: int
    name: str
    category: str | None
    address: str | None
    latitude: float
    longitude: float
    menu: str | None
    rest_date: str | None
    distance_km: float
    # 상세 카드에 보여 주는 실용 정보
    operating_hours: str | None = None
    parking: str | None = None
    img: str | None = None
    icon: str = DEFAULT_MARKER_ICON
    # 저장된 코스에서 온 경우에만 채워진다 (QUEST.IDX).
    quest_id: int | None = None
    # 사용자가 방문 완료로 저장했는지 (USER_QUEST.STATUS = 2)
    completed: bool = False
    # 읽어 줄 설명(PLACE.TEXT)이 있는지 = 도슨트를 들을 수 있는지
    has_docent: bool = False

    @property
    def hours_unknown(self) -> bool:
        # 휴무 null인 경우
        return self.rest_date is None


@dataclass(frozen=True)
class Course:
    persona_key: str
    persona_name: str
    visit_date: date
    stops: tuple[Stop, ...]
    skipped_slots: tuple[str, ...]
    course_id: int | None = None

    @property
    def total_km(self) -> float:
        return sum(stop.distance_km for stop in self.stops)


def distance_km(
    origin: tuple[float, float] | None,
    destination: tuple[float, float],
) -> float:
    if origin is None:
        return 0.0
    lat1, lon1 = map(math.radians, origin)
    lat2, lon2 = map(math.radians, destination)
    inner = (
        math.sin((lat2 - lat1) / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    )
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(inner))


def is_open_on(rest_date: str | None, weekday: str) -> bool:
    # 휴무일이 없거나, 매일 영업이면 True
    if not rest_date or rest_date == ALWAYS_OPEN:
        return True
    return weekday not in rest_date.split(",")


def matches(row: dict[str, Any], slot: Slot) -> bool:
    # 시간대에 맞는 종류인지만 본다. 어떤 장소가 이 역할에 어울리는지는 점수가 판단한다.
    return row["TYPE"] == slot.place_type


def _coordinates(row: dict[str, Any]) -> tuple[float, float]:
    return float(row["LATITUDE"]), float(row["LONGITUDE"])


def _nearby(
    pool: Sequence[dict[str, Any]],
    origin: tuple[float, float] | None,
    radius_km: float,
) -> list[dict[str, Any]]:
   # 후보를 가까운 순으로 정렬하고, radius_km 안에 있는 것만 반환
    if origin is None:
        return list(pool)

    ranked = sorted(pool, key=lambda row: distance_km(origin, _coordinates(row)))
    for limit in (radius_km, radius_km * 2):
        within = [row for row in ranked if distance_km(origin, _coordinates(row)) <= limit]
        if within:
            return within
    return ranked


def _weighted_choice(
    candidates: Sequence[dict[str, Any]],
    rng: random.Random,
) -> dict[str, Any]:
    # 점수가 높을수록 자주 뽑히되, 낮은 곳도 가끔 뽑히게 한다.
    # 제곱을 쓰는 이유: 5점(25)이 3점(9)보다 뚜렷하게 자주 나오면서도 3점이 배제되지 않는다.
    weights = [max(1, row["PERSONA_SCORE"]) ** 2 for row in candidates]
    return rng.choices(list(candidates), weights=weights, k=1)[0]


def _slot_pool(
    rows: Sequence[dict[str, Any]],
    slot: Slot,
    persona: Persona,
    weekday: str,
    used: set[int],
    scored: bool,
) -> list[dict[str, Any]]:
    # 시간대·휴무일이 맞는 곳 중에서 자격 점수를 조금씩 낮춰 가며 찾는다.
    open_places = [
        row
        for row in rows
        if row["IDX"] not in used
        and matches(row, slot)
        and is_open_on(row["REST_DATE"], weekday)
    ]
    # 채점된 DB 라면 0점(=이 역할에게 안 어울림)까지 내려가지 않는다.
    # 칸을 채우자고 엉뚱한 곳을 넣느니 그 칸을 비우는 편이 낫다.
    # 아직 한 번도 채점하지 않은 DB 에서는 점수를 보지 않고 뽑는다.
    thresholds = (persona.min_score, 1) if scored else (0,)
    for minimum in thresholds:
        pool = [row for row in open_places if row["PERSONA_SCORE"] >= minimum]
        if pool:
            return pool
    return []


def _build_once(
    rows: Sequence[dict[str, Any]],
    persona: Persona,
    weekday: str,
    rng: random.Random,
) -> tuple[list[Stop], list[str]]:
    stops: list[Stop] = []
    skipped: list[str] = []
    used: set[int] = set()
    position: tuple[float, float] | None = None
    # 이 역할로 채점된 장소가 하나라도 있는지. 없으면 점수를 보지 않고 뽑는다.
    scored = any(row["PERSONA_SCORE"] > 0 for row in rows)

    for slot in persona.slots:
        pool = _slot_pool(rows, slot, persona, weekday, used, scored)
        candidates = _nearby(pool, position, persona.radius_km)
        if not candidates:
            skipped.append(slot.time_slot)
            continue

        # 가까운 후보 몇 곳을 추린 뒤, 그 안에서 점수에 따라 뽑는다.
        chosen = _weighted_choice(candidates[: persona.choice_pool], rng)
        point = _coordinates(chosen)
        stops.append(
            Stop(
                order=len(stops) + 1,
                time_slot=slot.time_slot,
                place_idx=chosen["IDX"],
                name=chosen["NAME"],
                category=chosen["CATEGORY_SUB"],
                address=chosen["ADDRESS"],
                latitude=point[0],
                longitude=point[1],
                menu=chosen["MENU"],
                rest_date=chosen["REST_DATE"],
                operating_hours=chosen["OPERATING_HOURS"],
                parking=chosen["PARKING"],
                distance_km=round(distance_km(position, point), 2),
                img=chosen["IMG"],
                icon=marker_icon(chosen["CATEGORY_CODE"]),
            )
        )
        used.add(chosen["IDX"])
        position = point

    return stops, skipped


def build_course(
    connection: pymysql.Connection,
    persona: Persona,
    *,
    visit_date: date | None = None,
    rng: random.Random | None = None,
    attempts: int = 5,
    language: str = "ko",
) -> Course:
    # 경로 생성 시도 
    visit_date = visit_date or date.today()
    rng = rng or random.Random()
    weekday = WEEKDAYS[visit_date.weekday()]
    rows = fetch_all(connection, candidate_sql(), (language, persona.key))

    best: tuple[list[Stop], list[str]] | None = None
    for _ in range(max(1, attempts)):
        stops, skipped = _build_once(rows, persona, weekday, rng)
        total = sum(stop.distance_km for stop in stops)
        if total <= persona.max_total_km:
            best = (stops, skipped)
            break
        if best is None or total < sum(stop.distance_km for stop in best[0]):
            best = (stops, skipped)

    stops, skipped = best or ([], [slot.time_slot for slot in persona.slots])
    return Course(
        persona_key=persona.key,
        persona_name=persona.name,
        visit_date=visit_date,
        stops=tuple(stops),
        skipped_slots=tuple(skipped),
    )
