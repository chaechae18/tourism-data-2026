from collections.abc import Callable
from base64 import b64encode
import json

from fastapi.testclient import TestClient
from itsdangerous import TimestampSigner
import pymysql
import pytest

from app.journey import get_or_create_course
from app.personas import PERSONAS

KING = PERSONAS["king"]


def set_session(client: TestClient, user_no: int | None) -> None:
    if user_no is None:
        client.cookies.delete("session")
        return
    payload = b64encode(json.dumps({"user": {"user_no": user_no}}).encode())
    client.cookies.set(
        "session",
        TimestampSigner("dev-session-secret-key-change-this").sign(payload).decode(),
    )


@pytest.fixture(autouse=True)
def signed_in_journey_client(request: pytest.FixtureRequest) -> None:
    if "client" in request.fixturenames:
        set_session(request.getfixturevalue("client"), 1)


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
    # 하루는 오전으로 시작해 저녁으로 끝나고, 점심이 그 사이에 한 번 들어간다.
    slots = [stop["timeSlot"] for stop in first.json()["stops"]]
    assert slots[0] == "오전"
    assert slots[-1] == "저녁"
    assert slots.count("점심") == 1
    assert all(slot == "오전" for slot in slots[: slots.index("점심")])


def test_course_requires_session_even_with_user_header(client: TestClient) -> None:
    set_session(client, None)
    response = client.get("/api/v1/journey/course", headers={"X-User-No": "1"})
    assert response.status_code == 401


def test_course_follows_session_when_header_names_another_user(
    client: TestClient, insert: Callable[..., int]
) -> None:
    add_places(insert)
    insert("USERS", NO=2, ID="second-user", NICKNAME="second", COUNTRY="KR", EMAIL="second@example.com")

    first = client.get("/api/v1/journey/course").json()
    set_session(client, 2)
    second = client.get("/api/v1/journey/course", headers={"X-User-No": "1"}).json()
    assert second["courseId"] != first["courseId"]

    set_session(client, 1)
    assert client.get("/api/v1/journey/course").json()["courseId"] == first["courseId"]


def test_completed_quest_is_saved_and_comes_back_with_the_course(
    client: TestClient,
    insert: Callable[..., int],
    rows: Callable[..., list[dict]],
) -> None:
    add_places(insert)
    headers = {"X-User-No": "1"}
    stops = client.get("/api/v1/journey/course", headers=headers).json()["stops"]
    stop = stops[0]
    quest_id = stop["questId"]

    completed = client.post(f"/api/v1/journey/quests/{quest_id}/complete", headers=headers,
                           json={"latitude": stop["latitude"], "longitude": stop["longitude"], "accuracy": 10})

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
    stop = client.get("/api/v1/journey/course", headers=headers).json()["stops"][0]
    quest_id = stop["questId"]

    first = client.post(f"/api/v1/journey/quests/{quest_id}/complete", headers=headers,
                           json={"latitude": stop["latitude"], "longitude": stop["longitude"], "accuracy": 10})
    second = client.post(f"/api/v1/journey/quests/{quest_id}/complete", headers=headers,
                           json={"latitude": stop["latitude"], "longitude": stop["longitude"], "accuracy": 10})

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
    stop = client.get("/api/v1/journey/course", headers=headers).json()["stops"][0]
    quest_id = stop["questId"]

    insert("USERS", NO=2, ID="second-user", NICKNAME="second", COUNTRY="KR", EMAIL="second@example.com")
    set_session(client, 2)
    response = client.post(f"/api/v1/journey/quests/{quest_id}/complete",
                           json={"latitude": stop["latitude"], "longitude": stop["longitude"], "accuracy": 10})

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
        cursor.execute("SELECT IDX, TEXT FROM PLACE")
        descriptions = {row["IDX"]: row["TEXT"] for row in cursor.fetchall()}

    response = client.get("/api/v1/journey/course", headers={"X-User-No": "1"})
    assert response.status_code == 200
    stops = response.json()["stops"]

    # 무작위로 뽑힌 장소마다 설명 유무에 맞게 도슨트 버튼이 켜진다.
    assert stops
    for stop in stops:
        assert stop["docent"] is bool(descriptions[stop["placeId"]])


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
    assert all(not stop["routeName"].startswith("EN ") for stop in response.json()["stops"])


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

    # 점수가 높은 곳이 가장 먼저 들어간다. 나머지 칸은 하한(관광지 3곳)을 채우느라
    # 0점짜리로 메워지지만, 어울리는 곳을 제쳐 두지는 않는다.
    tour_names = [
        stop.name for stop in course.stops if stop.time_slot not in ("점심", "간식", "저녁")
    ]
    assert "운곡서원" in tour_names


def test_course_still_works_before_any_scoring(
    database: pymysql.Connection,
    insert: Callable[..., int],
) -> None:
    add_places(insert)

    # 채점을 한 번도 안 돌린 DB 에서도 코스는 나와야 한다. (팀원이 막 받아 온 상태)
    course = get_or_create_course(database, user_no=1, persona=PERSONAS["hwarang"])

    assert 5 <= len(course.stops) <= 7


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


def test_course_shows_details_in_the_requested_language(
    client: TestClient,
    database: pymysql.Connection,
    insert: Callable[..., int],
) -> None:
    add_places(insert)
    with database.cursor() as cursor:
        cursor.execute("SELECT IDX, CATEGORY_CODE FROM PLACE")
        places = cursor.fetchall()
        cursor.executemany(
            """INSERT INTO PLACE_I18N
               (PLACE_IDX, LANGUAGE_CODE, NAME, MENU, PARKING, OPERATING_HOURS, REST_DATE)
               VALUES (%s, 'en', 'EN name', 'Grilled beef', 'Available',
                       '09:00-18:00', 'Closed on Tuesdays')""",
            [(place["IDX"],) for place in places],
        )
        cursor.executemany(
            """INSERT INTO CATEGORY_NAME_I18N
               (CATEGORY_CODE, LANGUAGE_CODE, CATEGORY_MAIN, CATEGORY_SUB)
               VALUES (%s, 'en', 'Historic site', 'Royal tomb')
               ON DUPLICATE KEY UPDATE CATEGORY_SUB = VALUES(CATEGORY_SUB)""",
            [(place["CATEGORY_CODE"],) for place in places],
        )

    stops = client.post(
        "/api/v1/journey/course/refresh?lang=en",
        headers={"X-User-No": "1"},
    ).json()["stops"]

    assert all(stop["menu"] == "Grilled beef" for stop in stops if stop["menu"])
    assert all(stop["parking"] == "Available" for stop in stops)
    assert all(stop["operatingHours"] == "09:00-18:00" for stop in stops)
    assert all(stop["restDate"] == "Closed on Tuesdays" for stop in stops)
    assert all(stop["category"] == "Royal tomb" for stop in stops)


def test_course_falls_back_to_korean_when_a_translation_is_missing(
    client: TestClient,
    database: pymysql.Connection,
    insert: Callable[..., int],
) -> None:
    add_places(insert)
    with database.cursor() as cursor:
        cursor.execute("SELECT IDX FROM PLACE LIMIT 1")
        translated = cursor.fetchone()["IDX"]
        # 한 곳만 영어가 있고 나머지는 없다.
        cursor.execute(
            """INSERT INTO PLACE_I18N (PLACE_IDX, LANGUAGE_CODE, NAME)
               VALUES (%s, 'en', 'Donggung Palace')""",
            (translated,),
        )

    stops = client.post(
        "/api/v1/journey/course/refresh?lang=en",
        headers={"X-User-No": "1"},
    ).json()["stops"]

    names = [stop["name"] for stop in stops]
    # 영어가 없는 곳은 빈칸이 아니라 한국어 이름으로 나온다.
    assert all(name for name in names)
    assert any(name == "Donggung Palace" for name in names) or all(
        name in {place[1] for place in PLACES} for name in names
    )


def test_course_recommendation_still_reads_the_normalized_rest_date(
    database: pymysql.Connection,
    insert: Callable[..., int],
) -> None:
    add_places(insert)
    with database.cursor() as cursor:
        cursor.execute("SELECT IDX FROM PLACE")
        places = cursor.fetchall()
        # 화면용 원문이 영어로 들어와도 코스 추천은 PLACE.REST_DATE 를 봐야 한다.
        cursor.executemany(
            """INSERT INTO PLACE_I18N (PLACE_IDX, LANGUAGE_CODE, NAME, REST_DATE)
               VALUES (%s, 'en', 'EN name', 'Closed on Mondays')""",
            [(place["IDX"],) for place in places],
        )

    course = get_or_create_course(database, user_no=1, persona=KING, language="en")

    # 모든 장소가 연중무휴라 어느 요일에 돌려도 칸이 채워진다.
    assert course.stops
    assert all(stop.rest_date == "Closed on Mondays" for stop in course.stops)


def test_course_keeps_the_place_counts_within_range(
    database: pymysql.Connection,
    insert: Callable[..., int],
) -> None:
    import random
    from app.course_builder import build_course

    add_places(insert)
    seen = set()
    for seed in range(30):
        course = build_course(database, KING, rng=random.Random(seed))
        tour = sum(1 for stop in course.stops if stop.time_slot in ("오전", "오후"))
        food = len(course.stops) - tour
        # 관광지 3~4곳, 음식점 2~3곳을 벗어나지 않는다.
        assert 3 <= tour <= 4, f"관광지 {tour}곳 (seed={seed})"
        assert 2 <= food <= 3, f"음식점 {food}곳 (seed={seed})"
        seen.add((tour, food))

    # 매번 같은 구성만 나오면 "최대 3개" 가 의미가 없다.
    assert len(seen) > 1


def test_the_third_meal_is_an_afternoon_snack(
    database: pymysql.Connection,
    insert: Callable[..., int],
) -> None:
    import random
    from app.course_builder import build_course

    add_places(insert)
    # 간식까지 채우려면 음식점이 셋은 있어야 한다.
    insert(
        "PLACE",
        SOURCE="TOUR_API",
        CONTENT_ID="1006",
        TYPE="FOOD",
        NAME="황리단길 찻집",
        CATEGORY_CODE="FD010300",
        CATEGORY_SUB="카페",
        LATITUDE="35.8330",
        LONGITUDE="129.2210",
        REST_DATE="연중무휴",
    )
    for seed in range(30):
        course = build_course(database, KING, rng=random.Random(seed))
        slots = [stop.time_slot for stop in course.stops]
        if "간식" not in slots:
            continue
        # 간식은 오후 안에 들어가고, 저녁 바로 앞에 붙지 않는다.
        assert slots.index("점심") < slots.index("간식") < slots.index("저녁")
        assert slots[slots.index("간식") - 1] == "오후"
        return
    raise AssertionError("30번 뽑는 동안 간식이 한 번도 나오지 않았다")


@pytest.mark.parametrize("offset,accuracy,expected", [(0.0008, 10, 200), (0.001, 10, 400), (1, 10, 400), (0, 101, 422)])
def test_completion_requires_nearby_location(client, insert, rows, offset, accuracy, expected):
    add_places(insert)
    stop = client.get("/api/v1/journey/course").json()["stops"][0]
    response = client.post(f"/api/v1/journey/quests/{stop['questId']}/complete", json={
        "latitude": stop["latitude"] + offset, "longitude": stop["longitude"], "accuracy": accuracy,
    })
    assert response.status_code == expected
    assert len(rows("SELECT IDX FROM USER_QUEST WHERE STATUS = 2")) == (1 if expected == 200 else 0)


def test_completion_requires_coordinates(client, insert, rows):
    add_places(insert)
    stop = client.get("/api/v1/journey/course").json()["stops"][0]
    response = client.post(f"/api/v1/journey/quests/{stop['questId']}/complete")
    assert response.status_code == 422
    assert not rows("SELECT IDX FROM USER_QUEST WHERE STATUS = 2")


def test_demo_completion_without_gps_is_saved(client, insert, rows):
    add_places(insert)
    stop = client.get("/api/v1/journey/course").json()["stops"][0]
    response = client.post(f"/api/v1/journey/quests/{stop['questId']}/complete",
                           json={"demoCompletion": True})
    assert response.status_code == 200
    assert response.json()["completed"] is True
    reloaded = client.get("/api/v1/journey/course").json()["stops"]
    assert next(s for s in reloaded if s["questId"] == stop["questId"])["completed"] is True
    assert len(rows("SELECT IDX FROM USER_QUEST WHERE STATUS = 2")) == 1


@pytest.mark.parametrize("payload", [{}, {"demoCompletion": False}, {"demoCompletion": "true"}])
def test_location_bypass_requires_explicit_demo_boolean(client, insert, rows, payload):
    add_places(insert)
    stop = client.get("/api/v1/journey/course").json()["stops"][0]
    response = client.post(f"/api/v1/journey/quests/{stop['questId']}/complete", json=payload)
    assert response.status_code == 422
    assert not rows("SELECT IDX FROM USER_QUEST WHERE STATUS = 2")


def test_demo_completion_cannot_complete_another_users_quest(client, insert, rows):
    add_places(insert)
    stop = client.get("/api/v1/journey/course").json()["stops"][0]
    insert("USERS", NO=2, ID="demo-other-user", NICKNAME="other", COUNTRY="KR", EMAIL="other@example.com", LANGUAGE_CODE="ko")
    set_session(client, 2)
    response = client.post(f"/api/v1/journey/quests/{stop['questId']}/complete",
                           json={"demoCompletion": True})
    assert response.status_code == 404
    assert not rows("SELECT IDX FROM USER_QUEST WHERE STATUS = 2")
