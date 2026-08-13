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


def test_completed_quest_is_saved_and_comes_back_with_the_course(
    client: TestClient,
    insert: Callable[..., int],
    rows: Callable[..., list[dict]],
) -> None:
    add_places(insert)
    headers = {"X-User-No": "1"}
    stops = client.get("/api/v1/journey/course", headers=headers).json()["stops"]
    quest_id = stops[0]["questId"]

    completed = client.post(f"/api/v1/journey/quests/{quest_id}/complete", headers=headers)

    assert completed.status_code == 200
    assert completed.json()["completed"] is True
    # 다시 불러와도 완료 표시가 남아 있어야 한다.
    reloaded = client.get("/api/v1/journey/course", headers=headers).json()["stops"]
    assert [stop["completed"] for stop in reloaded] == [True] + [False] * (len(reloaded) - 1)
    assert len(rows("SELECT IDX FROM USER_QUEST WHERE STATUS = 2")) == 1


def test_completing_the_same_quest_twice_keeps_one_record(
    client: TestClient,
    insert: Callable[..., int],
    rows: Callable[..., list[dict]],
) -> None:
    add_places(insert)
    headers = {"X-User-No": "1"}
    quest_id = client.get("/api/v1/journey/course", headers=headers).json()["stops"][0]["questId"]

    first = client.post(f"/api/v1/journey/quests/{quest_id}/complete", headers=headers)
    second = client.post(f"/api/v1/journey/quests/{quest_id}/complete", headers=headers)

    assert second.status_code == 200
    # 완료일시는 처음 누른 시각을 지킨다.
    assert first.json()["completedAt"] == second.json()["completedAt"]
    assert len(rows("SELECT IDX FROM USER_QUEST")) == 1


def test_completing_a_quest_outside_my_course_is_rejected(
    client: TestClient,
    insert: Callable[..., int],
) -> None:
    add_places(insert)
    headers = {"X-User-No": "1"}
    quest_id = client.get("/api/v1/journey/course", headers=headers).json()["stops"][0]["questId"]

    response = client.post(f"/api/v1/journey/quests/{quest_id}/complete", headers={"X-User-No": "2"})

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "QUEST_NOT_FOUND"


def test_course_marks_places_that_can_be_read_aloud(
    client: TestClient,
    insert: Callable[..., int],
    database: pymysql.Connection,
) -> None:
    add_places(insert)
    with database.cursor() as cursor:
        cursor.execute(
            "UPDATE PLACE SET TEXT = %s WHERE NAME = %s",
            ("동궁과 월지는 신라 왕궁의 별궁 터다.", "경주 동궁과 월지"),
        )

    stops = client.get("/api/v1/journey/course", headers={"X-User-No": "1"}).json()["stops"]

    # 설명이 있는 장소만 도슨트 버튼이 켜진다.
    assert [stop["name"] for stop in stops if stop["docent"]] == ["경주 동궁과 월지"]


def test_unknown_persona_is_rejected(client: TestClient) -> None:
    response = client.get("/api/v1/journey/course?persona=ghost", headers={"X-User-No": "1"})

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "PERSONA_NOT_FOUND"
