from collections.abc import Callable
from datetime import datetime, timedelta

from fastapi.testclient import TestClient


def add_place(insert: Callable[..., int], **overrides: object) -> int:
    values = {
        "NAME": "첨성대",
        "TEXT": "동양 최고의 천문대",
        "ADDRESS": "경북 경주시 인왕동 839-1",
        "LATITUDE": "35.834755",
        "LONGITUDE": "129.219004",
        "ADMISSION_FEE": "무료",
        "IS_DISPLAY": 1,
        "IS_RECOMMENDED": 1,
        "VIEW_COUNT": 0,
    }
    values.update(overrides)
    return insert("PLACE", **values)


def test_banner_list_filters_and_orders(client: TestClient, insert: Callable[..., int]) -> None:
    now = datetime.now()
    insert(
        "MAIN_BANNER",
        TITLE="진행중", SUB_TITLE="부제", IMG="a.png", LINK="/a", SORT=1,
        IS_DISPLAY=1, IS_TRASH=0,
        START_DATE=now - timedelta(days=1), END_DATE=now + timedelta(days=1),
    )
    insert("MAIN_BANNER", TITLE="상시", SORT=0, IS_DISPLAY=1, IS_TRASH=0)
    insert("MAIN_BANNER", TITLE="삭제됨", IS_DISPLAY=1, IS_TRASH=1)
    insert("MAIN_BANNER", TITLE="숨김", IS_DISPLAY=0, IS_TRASH=0)
    insert(
        "MAIN_BANNER",
        TITLE="종료됨", IS_DISPLAY=1, IS_TRASH=0,
        START_DATE=now - timedelta(days=2), END_DATE=now - timedelta(days=1),
    )

    body = client.get("/api/v1/main/banners").json()

    assert [row["title"] for row in body] == ["상시", "진행중"]
    assert sorted(body[0]) == ["img", "link", "subTitle", "title"]


def test_popup_list_returns_open_windows_newest_first(
    client: TestClient,
    insert: Callable[..., int],
) -> None:
    now = datetime.now()
    insert("POPUP", TITLE="오래된", CONTENT="본문", IS_DISPLAY=1)
    insert("POPUP", TITLE="최신", CONTENT="본문", IS_DISPLAY=1)
    insert("POPUP", TITLE="숨김", IS_DISPLAY=0)
    insert(
        "POPUP",
        TITLE="종료됨", IS_DISPLAY=1,
        START_DATE=now - timedelta(days=2), END_DATE=now - timedelta(days=1),
    )

    body = client.get("/api/v1/main/popup").json()

    assert [row["title"] for row in body] == ["최신", "오래된"]


def test_festival_list_excludes_finished_and_orders_by_start(
    client: TestClient,
    insert: Callable[..., int],
) -> None:
    now = datetime.now()
    insert(
        "FESTIVAL",
        NAME="나중", CONTENT="설명", LOCATION="경주", IS_TRASH=0,
        START_DATE=now + timedelta(days=20), END_DATE=now + timedelta(days=21),
    )
    festival_idx = insert(
        "FESTIVAL",
        NAME="먼저", CONTENT="설명", LOCATION="경주", IS_TRASH=0,
        START_DATE=now + timedelta(days=5), END_DATE=None,
    )
    insert(
        "FESTIVAL",
        NAME="끝남", IS_TRASH=0,
        START_DATE=now - timedelta(days=30), END_DATE=now - timedelta(days=2),
    )
    insert("FESTIVAL", NAME="삭제됨", IS_TRASH=1)
    insert(
        "FESTIVAL_I18N",
        FESTIVAL_IDX=festival_idx, LANGUAGE_CODE="en",
        NAME="Silla Cultural Festival", CONTENT="", LOCATION="Gyeongju",
    )

    body = client.get("/api/v1/main/festivals").json()
    translated = client.get("/api/v1/main/festivals", params={"lang": "en"}).json()

    assert [row["name"] for row in body] == ["먼저", "나중"]
    assert sorted(body[0]) == [
        "content", "endDate", "img", "location", "name", "startDate", "url",
    ]
    assert translated[0]["name"] == "Silla Cultural Festival"
    assert translated[0]["location"] == "Gyeongju"
    assert translated[0]["content"] == "설명"


def test_recommended_places_order_by_view_count(
    client: TestClient,
    insert: Callable[..., int],
) -> None:
    add_place(insert, NAME="많이 본 곳", LATITUDE=" 35.834755 ", VIEW_COUNT=500)
    add_place(insert, NAME="좌표 깨짐", LATITUDE="좌표없음", LONGITUDE="", VIEW_COUNT=10)
    add_place(insert, NAME="비추천", IS_RECOMMENDED=0, VIEW_COUNT=99999)
    add_place(insert, NAME="검수 대기", IS_DISPLAY=0, VIEW_COUNT=99999)

    body = client.get("/api/v1/main/places/recommended").json()

    assert [row["name"] for row in body] == ["많이 본 곳", "좌표 깨짐"]
    assert body[0]["latitude"] == 35.834755
    assert body[1]["latitude"] is None
    assert body[1]["longitude"] is None


def test_language_comes_from_the_query_or_the_header(
    client: TestClient,
    insert: Callable[..., int],
) -> None:
    popup_idx = insert("POPUP", TITLE="한국어 원본", CONTENT="한국어 본문", IS_DISPLAY=1)
    insert(
        "POPUP_I18N",
        POPUP_IDX=popup_idx, LANGUAGE_CODE="en", TITLE="en title", CONTENT="en content",
    )
    insert(
        "POPUP_I18N",
        POPUP_IDX=popup_idx, LANGUAGE_CODE="ko", TITLE="ko title", CONTENT="",
    )

    by_param = client.get("/api/v1/main/popup", params={"lang": "en"}).json()
    by_header = client.get(
        "/api/v1/main/popup", headers={"Accept-Language": "en-US,en;q=0.9"}
    ).json()
    unsupported = client.get("/api/v1/main/popup", params={"lang": "fr"}).json()
    missing = client.get("/api/v1/main/popup", params={"lang": "ja"}).json()

    assert by_param[0]["title"] == "en title"
    assert by_header[0]["title"] == "en title"
    assert unsupported[0]["title"] == "ko title"
    # ja 번역이 없으면 한국어 행으로, 한국어 행도 비어 있으면 원본 컬럼으로 내려간다.
    assert missing[0]["title"] == "ko title"
    assert missing[0]["content"] == "한국어 본문"


def test_places_translate_text_but_not_coordinates(
    client: TestClient,
    insert: Callable[..., int],
) -> None:
    place_idx = add_place(insert, NAME="불국사", ADMISSION_FEE="성인 6,000원")
    insert(
        "PLACE_I18N",
        PLACE_IDX=place_idx, LANGUAGE_CODE="en",
        NAME="Bulguksa Temple", ADMISSION_FEE="Adults KRW 6,000",
    )
    add_place(insert, NAME="번역 없는 곳", VIEW_COUNT=0)

    body = client.get("/api/v1/main/places/recommended", params={"lang": "en"}).json()

    assert {row["name"] for row in body} == {"Bulguksa Temple", "번역 없는 곳"}
    assert body[0]["latitude"] == 35.834755
    assert body[0]["admissionFee"] == "Adults KRW 6,000"
