# 페르소나 규칙 기반 코스 

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date
import math
import random
from typing import Any

import pymysql

from .mysql import fetch_all
from .personas import (
    BUDDHA_STATUE,
    HISTORIC_SITE,
    KOREAN_RESTAURANT,
    PALACE,
    SHRINE,
    TOMB,
    Persona,
    Slot,
)
from .tourapi import ALWAYS_OPEN, WEEKDAYS


EARTH_RADIUS_KM = 6371.0

# 지도 마커 모양
DEFAULT_MARKER_ICON = "temple"
MARKER_ICONS = {
    PALACE: "palace",
    TOMB: "grotto",  # 봉분 언덕 모양
    SHRINE: DEFAULT_MARKER_ICON,
    HISTORIC_SITE: "tower",
    BUDDHA_STATUE: DEFAULT_MARKER_ICON,
    KOREAN_RESTAURANT: "food",
}


def candidate_sql() -> str:
    return """
        SELECT p.IDX,
               COALESCE(NULLIF(t.NAME, ''), NULLIF(k.NAME, ''), p.NAME) AS NAME,
               COALESCE(NULLIF(t.ADDRESS, ''), NULLIF(k.ADDRESS, ''), p.ADDRESS) AS ADDRESS,
               p.IMG, p.MENU, p.REST_DATE,
               p.CATEGORY_CODE, p.CATEGORY_SUB, p.LATITUDE, p.LONGITUDE
        FROM PLACE p
        LEFT JOIN PLACE_I18N t ON t.PLACE_IDX = p.IDX AND t.LANGUAGE_CODE = %s
        LEFT JOIN PLACE_I18N k ON k.PLACE_IDX = p.IDX AND k.LANGUAGE_CODE = 'ko'
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
    if row["CATEGORY_CODE"] not in slot.category_codes:
        return False
    if not slot.menu_keywords:
        return True
    menu = row["MENU"] or ""
    return any(keyword in menu for keyword in slot.menu_keywords)


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

    for slot in persona.slots:
        pool = [
            row
            for row in rows
            if row["IDX"] not in used
            and matches(row, slot)
            and is_open_on(row["REST_DATE"], weekday)
        ]
        candidates = _nearby(pool, position, persona.radius_km)
        if not candidates:
            skipped.append(slot.time_slot)
            continue

        chosen = rng.choice(candidates[: persona.choice_pool])
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
                distance_km=round(distance_km(position, point), 2),
                img=chosen["IMG"],
                icon=MARKER_ICONS.get(chosen["CATEGORY_CODE"], DEFAULT_MARKER_ICON),
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
    rows = fetch_all(connection, candidate_sql(), (language,))

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
