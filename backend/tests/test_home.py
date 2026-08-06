from collections.abc import Callable
from datetime import datetime, timedelta

from fastapi.testclient import TestClient

from app.home import RECOMMENDED_PLACES, get_tour_api_client, month_end
from app.main import app
from app.tourapi import TourApiError


class FakeTourApi:
    def __init__(self, items: list[dict] | None = None, error: str | None = None) -> None:
        self.items = items or []
        self.error = error

    def search_festival(self, event_start_date: str, **kwargs: object):
        if self.error:
            raise TourApiError(self.error)
        return iter(self.items)

    def detail_common(self, content_id: str) -> dict:
        return {
            "overview": f"{content_id} 소개",
            "homepage": f'<a href="https://example.com/{content_id}">공식</a>',
        }

    def detail_intro(self, content_id: str, content_type_id: int) -> dict:
        return {"eventplace": "경주 봉황대"}


def use_tour_api(fake: FakeTourApi) -> None:
    app.dependency_overrides[get_tour_api_client] = lambda: fake


def festival_item(content_id: str, title: str, start: str, end: str) -> dict:
    return {
        "contentid": content_id,
        "contenttypeid": 15,
        "title": title,
        "addr1": "경북 경주시",
        "eventstartdate": start,
        "eventenddate": end,
        "firstimage": f"https://img/{content_id}.jpg",
    }


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


def test_festival_list_comes_from_tourapi_and_keeps_translations(
    client: TestClient,
    insert: Callable[..., int],
) -> None:
    now = datetime.now()
    first = now.strftime("%Y%m01")
    today = now.strftime("%Y%m%d")
    last = month_end(now).strftime("%Y%m%d")
    next_first = (month_end(now) + timedelta(days=1)).strftime("%Y%m%d")
    festival_idx = insert(
        "FESTIVAL",
        SOURCE="TOUR_API", CONTENT_ID="1718137", NAME="신라문화제", IS_TRASH=0,
        URL="https://silla.example.com", IMG="https://img/silla-poster.jpg",
    )
    insert(
        "FESTIVAL_I18N",
        FESTIVAL_IDX=festival_idx, LANGUAGE_CODE="en",
        NAME="Silla Cultural Festival", CONTENT="", LOCATION="Gyeongju",
    )
    insert(
        "FESTIVAL",
        SOURCE="TOUR_API", CONTENT_ID="4062064", NAME="숨김 처리된 행사", IS_TRASH=1,
    )
    use_tour_api(
        FakeTourApi(
            [
                festival_item("4087207", "이달 말", last, last),
                festival_item("1718137", "신라문화제", first, today),
                festival_item("3509748", "끝남", "20250101", "20250102"),
                festival_item("4062064", "숨김 처리된 행사", first, last),
                festival_item("4087208", "다음 달", next_first, next_first),
            ]
        )
    )

    body = client.get("/api/v1/main/festivals").json()
    translated = client.get("/api/v1/main/festivals", params={"lang": "en"}).json()

    # 운영자가 IS_TRASH 로 숨긴 행사는 TourAPI 가 내려줘도 언어와 무관하게 빠진다.
    # 이달을 넘겨 시작하는 행사와 이미 끝난 행사는 홈에 걸리지 않는다.
    assert [row["name"] for row in body] == ["신라문화제", "이달 말"]
    assert [row["name"] for row in translated] == ["Silla Cultural Festival", "이달 말"]
    assert sorted(body[0]) == [
        "content", "endDate", "img", "location", "name", "startDate", "url",
    ]
    # TourAPI 링크·사진이 엉뚱하면 운영자가 FESTIVAL 행에 넣은 값이 이긴다.
    assert body[0]["url"] == "https://silla.example.com"
    assert body[0]["img"] == "https://img/silla-poster.jpg"
    assert body[1]["url"] == "https://example.com/4087207"
    assert body[0]["location"] == "경주 봉황대"
    # 번역 행이 있으면 덮어쓰고, 빈 칸은 TourAPI 원문을 그대로 둔다.
    assert translated[0]["name"] == "Silla Cultural Festival"
    assert translated[0]["location"] == "Gyeongju"
    assert translated[0]["content"] == "1718137 소개"
    assert translated[1]["name"] == "이달 말"


def test_festival_list_falls_back_to_stored_rows_when_tourapi_fails(
    client: TestClient,
    insert: Callable[..., int],
) -> None:
    now = datetime.now()
    insert(
        "FESTIVAL",
        NAME="저장된 행사", CONTENT="설명", LOCATION="경주", IS_TRASH=0,
        START_DATE=now, END_DATE=None,
    )
    insert(
        "FESTIVAL",
        NAME="끝남", IS_TRASH=0,
        START_DATE=now - timedelta(days=30), END_DATE=now - timedelta(days=2),
    )
    insert(
        "FESTIVAL",
        NAME="다음 달", IS_TRASH=0,
        START_DATE=month_end(now) + timedelta(days=1), END_DATE=None,
    )
    insert("FESTIVAL", NAME="삭제됨", IS_TRASH=1)
    use_tour_api(FakeTourApi(error="504 게이트웨이 시간 초과"))

    body = client.get("/api/v1/main/festivals").json()

    assert [row["name"] for row in body] == ["저장된 행사"]


def test_recommended_places_order(
    client: TestClient,
    insert: Callable[..., int],
) -> None:
    assert client.get("/api/v1/main/places/recommended").json() == []

    add_place(insert, NAME="많이 본 곳", LATITUDE=" 35.834755 ", VIEW_COUNT=500)
    add_place(insert, NAME="좌표 깨짐", LATITUDE="좌표없음", LONGITUDE="", VIEW_COUNT=10)
    add_place(insert, NAME="경주 첨성대", VIEW_COUNT=1)
    add_place(insert, NAME="비추천", IS_RECOMMENDED=0, VIEW_COUNT=99999)
    add_place(insert, NAME="검수 대기", IS_DISPLAY=0, VIEW_COUNT=99999)

    body = client.get("/api/v1/main/places/recommended").json()

    # RECOMMENDED_ORDER 에 있는 곳이 조회수보다 앞선다.
    assert [row["name"] for row in body] == ["경주 첨성대", "많이 본 곳", "좌표 깨짐"]
    assert body[1]["latitude"] == 35.834755
    assert body[2]["latitude"] is None
    assert body[2]["longitude"] is None


def test_recommended_place_text_is_shortened(
    client: TestClient,
    insert: Callable[..., int],
) -> None:
    place_idx = add_place(
        insert,
        NAME="경주 첨성대",
        TEXT="선덕여왕 때 세운 천문대다. 국보 제31호로 지정되어 있다.",
    )
    insert(
        "PLACE_I18N",
        PLACE_IDX=place_idx, LANGUAGE_CODE="en", NAME="Cheomseongdae",
        TEXT="The oldest surviving observatory in East Asia. It is National Treasure No. 31.",
    )
    add_place(insert, NAME="목록 밖", TEXT="첫 문장이다. 두 번째 문장이다.")

    body = client.get("/api/v1/main/places/recommended").json()
    translated = client.get(
        "/api/v1/main/places/recommended", params={"lang": "en"}
    ).json()

    # 목록에 있는 곳은 언어별로 적어둔 요약을, 목록 밖은 DB 문장을 두 개까지 쓴다.
    # 어느 쪽이든 문장마다 줄이 바뀐다.
    assert body[0]["text"] == RECOMMENDED_PLACES["경주 첨성대"]["ko"]
    assert translated[0]["text"] == RECOMMENDED_PLACES["경주 첨성대"]["en"]
    assert body[1]["text"] == "첫 문장이다.\n두 번째 문장이다."


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
