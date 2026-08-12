from collections.abc import Callable

from fastapi.testclient import TestClient
import pymysql

from app.journey import get_or_create_course
from app.personas import KING


# 왕 코스 6칸을 채울 수 있는 최소한의 장소. course_builder 가 보는 컬럼만 넣는다.
PLACES = [
    ("HS010100", "경주 동궁과 월지", "고궁", 35.8352, 129.2284, None),
    ("HS010800", "경주 선덕여왕릉", "고분, 능", 35.8237, 129.2427, None),
    ("FD010100", "장군암소숯불", "관광식당", 35.8300, 129.2300, "장군 갈비살 / 안창살"),
    ("HS010900", "운곡서원", "사당", 35.8400, 129.2400, None),
    ("HS010700", "경주 동부 사적지대", "사적지", 35.8360, 129.2260, None),
    ("FD010100", "보문한우", "관광식당", 35.8420, 129.2500, "한우육회 / 한우곰탕"),
]


def add_places(insert: Callable[..., int]) -> None:
    for index, (code, name, sub, latitude, longitude, menu) in enumerate(PLACES):
        insert(
            "PLACE",
            SOURCE="TOUR_API",
            CONTENT_ID=str(1000 + index),
            TYPE="FOOD" if code.startswith("FD") else "TOUR",
            NAME=name,
            CATEGORY_CODE=code,
            CATEGORY_SUB=sub,
            LATITUDE=str(latitude),
            LONGITUDE=str(longitude),
            MENU=menu,
            REST_DATE="연중무휴",
        )


def test_course_is_saved_once_and_reused(
    database: pymysql.Connection,
    insert: Callable[..., int],
    rows: Callable[..., list[dict]],
) -> None:
    add_places(insert)

    first = get_or_create_course(database, user_no=1, persona=KING)
    second = get_or_create_course(database, user_no=1, persona=KING)

    # 두 번째 호출은 새로 뽑지 않고 저장해 둔 코스를 그대로 준다.
    assert first.course_id == second.course_id
    assert [stop.name for stop in first.stops] == [stop.name for stop in second.stops]
    assert len(rows("SELECT IDX FROM COURSE")) == 1
    assert all(stop.quest_id for stop in second.stops)


def test_refresh_replaces_the_active_course(
    database: pymysql.Connection,
    insert: Callable[..., int],
    rows: Callable[..., list[dict]],
) -> None:
    add_places(insert)

    first = get_or_create_course(database, user_no=1, persona=KING)
    second = get_or_create_course(database, user_no=1, persona=KING, refresh=True)

    assert first.course_id != second.course_id
    # 이전 코스는 지우지 않고 비활성으로만 내린다.
    active = rows("SELECT IDX FROM COURSE WHERE IS_ACTIVE = 1")
    assert [row["IDX"] for row in active] == [second.course_id]


def test_course_endpoint_keeps_the_same_course(client: TestClient, insert: Callable[..., int]) -> None:
    add_places(insert)

    first = client.get("/api/v1/journey/course", headers={"X-User-No": "1"})
    second = client.get("/api/v1/journey/course", headers={"X-User-No": "1"})
    refreshed = client.post("/api/v1/journey/course/refresh", headers={"X-User-No": "1"})

    assert first.status_code == 200
    assert first.json()["courseId"] == second.json()["courseId"]
    assert refreshed.status_code == 201
    assert refreshed.json()["courseId"] != first.json()["courseId"]
    assert [stop["timeSlot"] for stop in first.json()["stops"]] == [
        "오전", "오전", "점심", "오후", "오후", "저녁",
    ]


def test_unknown_persona_is_rejected(client: TestClient) -> None:
    response = client.get("/api/v1/journey/course?persona=ghost", headers={"X-User-No": "1"})

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "PERSONA_NOT_FOUND"


def test_course_uses_requested_place_translation(
    client: TestClient,
    database: pymysql.Connection,
    insert: Callable[..., int],
) -> None:
    add_places(insert)
    with database.cursor() as cursor:
        cursor.execute("SELECT IDX, NAME FROM PLACE")
        places = cursor.fetchall()
        cursor.executemany(
            """INSERT INTO PLACE_I18N (PLACE_IDX, LANGUAGE_CODE, NAME, ADDRESS)
               VALUES (%s, 'en', %s, 'Palace Road')""",
            [(place["IDX"], f"EN {place['NAME']}") for place in places],
        )

    response = client.post(
        "/api/v1/journey/course/refresh?lang=en",
        headers={"X-User-No": "1"},
    )

    assert response.status_code == 201
    assert all(stop["name"].startswith("EN ") for stop in response.json()["stops"])
