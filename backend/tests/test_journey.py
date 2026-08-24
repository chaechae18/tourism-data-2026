from collections.abc import Callable

from fastapi.testclient import TestClient
import pymysql

from app.journey import get_or_create_course
from app.personas import PERSONAS

KING = PERSONAS["king"]


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


def test_high_scoring_places_are_preferred_for_the_role(
    database: pymysql.Connection,
    insert: Callable[..., int],
) -> None:
    add_places(insert)
    with database.cursor() as cursor:
        cursor.execute("SELECT IDX, NAME FROM PLACE WHERE TYPE = 'TOUR'")
        tours = cursor.fetchall()
        # 한 곳만 스님에게 어울리고 나머지는 어울리지 않는다고 채점해 둔다.
        cursor.executemany(
            """INSERT INTO PLACE_PERSONA_SCORE (PLACE_IDX, PERSONA_KEY, SCORE)
               VALUES (%s, 'monk', %s)""",
            [
                (place["IDX"], 5 if place["NAME"] == "운곡서원" else 0)
                for place in tours
            ],
        )

    course = get_or_create_course(database, user_no=1, persona=PERSONAS["monk"])

    # 점수가 있는 곳만 관광 칸에 들어간다. (0점짜리는 자격 미달로 빠진다)
    tour_names = [stop.name for stop in course.stops if stop.time_slot != "점심" and stop.time_slot != "저녁"]
    assert tour_names == ["운곡서원"]


def test_course_still_works_before_any_scoring(
    database: pymysql.Connection,
    insert: Callable[..., int],
) -> None:
    add_places(insert)

    # 채점을 한 번도 안 돌린 DB 에서도 코스는 나와야 한다. (팀원이 막 받아 온 상태)
    course = get_or_create_course(database, user_no=1, persona=PERSONAS["hwarang"])

    assert len(course.stops) == 6


def test_selected_role_is_remembered(client: TestClient, insert: Callable[..., int]) -> None:
    add_places(insert)
    headers = {"X-User-No": "1"}
    client.get("/api/v1/journey/course?persona=scholar", headers=headers)

    response = client.get("/api/v1/journey/characters/selected", headers=headers)

    # 앱을 다시 열어도 마지막에 고른 역할이 그대로 나와야 한다.
    assert response.status_code == 200
    assert response.json() == {"key": "scholar", "name": "학자"}


def test_no_selected_role_before_choosing_one(client: TestClient) -> None:
    response = client.get("/api/v1/journey/characters/selected", headers={"X-User-No": "1"})

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "SELECTED_PERSONA_NOT_FOUND"


def test_course_carries_opening_hours_and_parking(
    client: TestClient,
    insert: Callable[..., int],
    database: pymysql.Connection,
) -> None:
    add_places(insert)
    with database.cursor() as cursor:
        cursor.execute("UPDATE PLACE SET OPERATING_HOURS = %s, PARKING = %s", ("09:00~18:00", "가능"))

    stops = client.get("/api/v1/journey/course", headers={"X-User-No": "1"}).json()["stops"]

    assert all(stop["operatingHours"] == "09:00~18:00" for stop in stops)
    assert all(stop["parking"] == "가능" for stop in stops)
