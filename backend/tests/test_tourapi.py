from collections.abc import Callable
import json
from typing import Any

import httpx
import pymysql
import pytest

from app.tourapi import (
    FESTIVAL_CONTENT_MAX,
    PLACE_NAME_MAX,
    SOURCE_TOUR_API,
    TourApiClient,
    TourApiError,
    festival_fields,
    language_client,
    normalize_rest_date,
    place_fields,
    place_i18n_fields,
    sync_category_names,
    sync_festivals,
    sync_place_translations,
    sync_places,
    verified_place_match,
)


# 공사 API 응답 샘플. 필드명은 실제 응답 그대로다.
PLACE_ITEM = {
    "contentid": "126508",
    "contenttypeid": "12",
    "title": "첨성대",
    "addr1": "경상북도 경주시 첨성로 169-5",
    "addr2": "(인왕동)",
    "mapx": "129.2190247127",
    "mapy": "35.8347351901",
    "firstimage": "http://tong.visitkorea.or.kr/cms/a.jpg",
    "firstimage2": "http://tong.visitkorea.or.kr/cms/a_small.jpg",
}

FESTIVAL_ITEM = {
    "contentid": "2758198",
    "contenttypeid": "15",
    "title": "경주 벚꽃축제",
    "addr1": "경상북도 경주시 보문로",
    "eventstartdate": "20260401",
    "eventenddate": "20260410",
}


class FakeResponse:
    def __init__(self, payload: dict | None, status_code: int = 200, text: str = "") -> None:
        self._payload = payload
        self.status_code = status_code
        self.text = text or json.dumps(payload) if payload is not None else text

    def json(self) -> dict:
        if self._payload is None:
            raise ValueError("not json")
        return self._payload


class FakeSession:
    def __init__(self, responses: list) -> None:
        self.responses = list(responses)
        self.calls: list[tuple] = []

    def get(self, url: str, params: dict | None = None, timeout: float | None = None) -> Any:
        self.calls.append((url, params))
        result = self.responses.pop(0)
        if isinstance(result, Exception):
            raise result
        return result


class FakeClient:
    def __init__(self, places=(), festivals=(), common=None, intro=None, categories=None) -> None:
        self.places = list(places)
        self.festivals = list(festivals)
        self.common = common
        self.intro = intro
        self.categories = categories or {}
        # 호출을 아꼈는지 세어 보는 용도. 상세 조회가 동기화 비용의 대부분이다.
        self.detail_calls = 0
        self.category_calls = 0

    def lcls_systm_names(self) -> dict[str, tuple[str, str]]:
        self.category_calls += 1
        return dict(self.categories)

    def area_based_list(self, content_type_id=None, **kwargs) -> list[dict]:
        return list(self.places)

    def search_festival(self, event_start_date, **kwargs) -> list[dict]:
        return list(self.festivals)

    def detail_common(self, content_id) -> dict | None:
        self.detail_calls += 1
        return self.common

    def detail_intro(self, content_id, content_type_id) -> dict | None:
        self.detail_calls += 1
        return self.intro


def envelope(items: list, total_count: int | None = None, result_code: str = "0000") -> dict:
    body: dict[str, Any] = {"items": {"item": items} if items else ""}
    if total_count is not None:
        body["totalCount"] = total_count
    return {
        "response": {
            "header": {"resultCode": result_code, "resultMsg": "OK"},
            "body": body,
        }
    }


def build_client(session: FakeSession) -> TourApiClient:
    return TourApiClient(
        service_key="test-key",
        base_url="https://api.example.com/KorService2",
        mobile_app="Test",
        session=session,
        max_retries=2,
        retry_backoff=0,
    )


def test_requests_carry_the_expected_params_and_walk_pages() -> None:
    page_one = envelope([{"contentid": str(i)} for i in range(100)], total_count=150)
    page_two = envelope([{"contentid": str(i)} for i in range(100, 150)], total_count=150)
    places = FakeSession([FakeResponse(page_one), FakeResponse(page_two)])
    festivals = FakeSession([FakeResponse(envelope([{"contentid": "100"}], 1))])

    items = list(build_client(places).area_based_list(content_type_id=12))
    list(build_client(festivals).search_festival(event_start_date="20260726"))

    assert len(items) == 150
    assert places.calls[0][1]["serviceKey"] == "test-key"
    assert places.calls[0][1]["contentTypeId"] == 12
    assert places.calls[1][1]["pageNo"] == 2
    assert festivals.calls[0][1]["eventStartDate"] == "20260726"
    assert festivals.calls[0][1]["lDongRegnCd"] == "47"


def test_bad_responses_are_reported_and_only_transient_ones_retry() -> None:
    flaky = FakeSession(
        [httpx.ConnectError("boom"), FakeResponse(envelope([{"contentid": "1"}], 1))]
    )
    assert len(list(build_client(flaky).area_based_list())) == 1
    assert len(flaky.calls) == 2

    forbidden = FakeSession([FakeResponse(None, status_code=403, text="Forbidden")])
    with pytest.raises(TourApiError, match="활용신청"):
        list(build_client(forbidden).area_based_list())
    assert len(forbidden.calls) == 1

    bad_code = FakeSession([FakeResponse(envelope([], result_code="30"))])
    with pytest.raises(TourApiError):
        list(build_client(bad_code).area_based_list())

    xml = FakeSession([FakeResponse(None, text="<OpenAPI_ServiceResponse/>")])
    with pytest.raises(TourApiError, match="인증키"):
        list(build_client(xml).area_based_list())


def test_creates_a_place_with_details(
    database: pymysql.Connection,
    rows: Callable[..., list[dict]],
) -> None:
    client = FakeClient(
        places=[PLACE_ITEM],
        common={"overview": "동양에서 가장 오래된 천문대"},
        intro={"usetime": "상시", "parking": "가능"},
    )

    result = sync_places(database, client, [12], with_detail=True)

    place = rows("SELECT * FROM PLACE")[0]
    assert result.created == 1
    assert place["SOURCE"] == SOURCE_TOUR_API
    assert place["NAME"] == "첨성대"
    assert place["LATITUDE"] == "35.8347351901"
    assert place["LONGITUDE"] == "129.2190247127"
    assert place["TEXT"] == "동양에서 가장 오래된 천문대"
    assert place["OPERATING_HOURS"] == "상시"


def test_resync_updates_in_place_and_keeps_curated_columns(
    database: pymysql.Connection,
    insert: Callable[..., int],
    rows: Callable[..., list[dict]],
) -> None:
    insert("PLACE", SOURCE="MANUAL", CONTENT_ID="126508", NAME="수기 등록 첨성대")
    sync_places(database, FakeClient(places=[PLACE_ITEM]), [12], with_detail=False)
    with database.cursor() as cursor:
        cursor.execute(
            "UPDATE PLACE SET IS_RECOMMENDED = 1, VIEW_COUNT = 1234, IS_DISPLAY = 0"
            " WHERE SOURCE = %s",
            (SOURCE_TOUR_API,),
        )

    renamed = FakeClient(
        places=[{**PLACE_ITEM, "title": "첨성대 (보수 후)"}, {**PLACE_ITEM, "contentid": ""}]
    )
    result = sync_places(database, renamed, [12], with_detail=False)

    synced = rows("SELECT * FROM PLACE WHERE SOURCE = %s", (SOURCE_TOUR_API,))[0]
    manual = rows("SELECT * FROM PLACE WHERE SOURCE = 'MANUAL'")[0]
    assert result.updated == 1
    assert len(result.skipped) == 1
    assert synced["NAME"] == "첨성대 (보수 후)"
    assert synced["IS_RECOMMENDED"] == 1
    assert synced["VIEW_COUNT"] == 1234
    assert synced["IS_DISPLAY"] == 0
    assert manual["NAME"] == "수기 등록 첨성대"


def test_unchanged_places_cost_no_detail_calls(
    database: pymysql.Connection,
    rows: Callable[..., list[dict]],
) -> None:
    dated = {**PLACE_ITEM, "modifiedtime": "20260301120000"}

    first = FakeClient(places=[dated], common={"overview": "천문대"}, intro={"usetime": "상시"})
    sync_places(database, first, [12], with_detail=True)

    # 같은 수정시각으로 한 번 더. 목록만 보고 넘어가야 한다.
    again = FakeClient(places=[dated], common={"overview": "천문대"}, intro={"usetime": "상시"})
    result = sync_places(database, again, [12], with_detail=True)

    assert first.detail_calls == 2
    assert result.unchanged == 1
    assert result.total == 0
    assert again.detail_calls == 0
    # 분류체계 이름표도 넣거나 고칠 게 있을 때만 받는다.
    assert again.category_calls == 0
    assert rows("SELECT * FROM PLACE")[0]["TEXT"] == "천문대"


def test_a_newer_modified_time_pulls_the_details_again(
    database: pymysql.Connection,
    rows: Callable[..., list[dict]],
) -> None:
    old = {**PLACE_ITEM, "modifiedtime": "20260301120000"}
    sync_places(database, FakeClient(places=[old], common={"overview": "옛 소개"}), [12])

    newer = {**PLACE_ITEM, "modifiedtime": "20260408090000", "title": "첨성대 (보수 후)"}
    client = FakeClient(places=[newer], common={"overview": "새 소개"})
    result = sync_places(database, client, [12])

    place = rows("SELECT * FROM PLACE")[0]
    assert result.updated == 1
    assert result.unchanged == 0
    assert client.detail_calls == 2
    assert place["NAME"] == "첨성대 (보수 후)"
    assert place["TEXT"] == "새 소개"
    assert place["MODIFIED_TIME"].isoformat() == "2026-04-08T09:00:00"


def test_force_refetches_everything(database: pymysql.Connection) -> None:
    dated = {**PLACE_ITEM, "modifiedtime": "20260301120000"}
    sync_places(database, FakeClient(places=[dated]), [12])

    client = FakeClient(places=[dated])
    result = sync_places(database, client, [12], force=True)

    assert result.unchanged == 0
    assert result.updated == 1
    assert client.detail_calls == 2


def test_skip_detail_does_not_pass_a_row_off_as_fresh(
    database: pymysql.Connection,
    rows: Callable[..., list[dict]],
) -> None:
    dated = {**PLACE_ITEM, "modifiedtime": "20260301120000"}
    sync_places(database, FakeClient(places=[dated]), [12], with_detail=False)

    # 소개가 빈 채로 들어갔으니 수정시각을 남기면 안 된다. 다음 회차가 채워야 한다.
    assert rows("SELECT * FROM PLACE")[0]["MODIFIED_TIME"] is None

    client = FakeClient(places=[dated], common={"overview": "천문대"})
    result = sync_places(database, client, [12], with_detail=True)

    assert result.unchanged == 0
    assert client.detail_calls == 2
    assert rows("SELECT * FROM PLACE")[0]["TEXT"] == "천문대"


def test_unchanged_festivals_are_left_alone(database: pymysql.Connection) -> None:
    dated = {**FESTIVAL_ITEM, "modifiedtime": "20260210080000"}
    sync_festivals(database, FakeClient(festivals=[dated]), "20260101", with_detail=True)

    client = FakeClient(festivals=[dated])
    result = sync_festivals(database, client, "20260101", with_detail=True)

    assert result.unchanged == 1
    assert client.detail_calls == 0


def test_resync_keeps_a_festival_in_the_trash(
    database: pymysql.Connection,
    rows: Callable[..., list[dict]],
) -> None:
    sync_festivals(database, FakeClient(festivals=[FESTIVAL_ITEM]), "20260101", with_detail=False)
    with database.cursor() as cursor:
        cursor.execute("UPDATE FESTIVAL SET IS_TRASH = 1")
    sync_festivals(database, FakeClient(festivals=[FESTIVAL_ITEM]), "20260101", with_detail=False)

    festival = rows("SELECT * FROM FESTIVAL")[0]
    assert festival["NAME"] == "경주 벚꽃축제"
    assert festival["START_DATE"].date().isoformat() == "2026-04-01"
    assert festival["IS_TRASH"] == 1


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("연중무휴", "연중무휴"),
        ("연중 무휴", "연중무휴"),
        ("매주 화요일", "화"),
        ("매주 월요일, 목요일 ※ 변동될 경우 홈페이지 공지", "월,목"),
        ("매주 화요일 (단, 화요일이 공휴일인 경우 다음날 휴무)", "화"),
        ("매주 일요일 / 법정공휴일", "일"),
        ("점포 별로 상이함", None),
        ("설·추석 당일", None),
        ("", None),
        (None, None),
    ],
)
def test_normalize_rest_date(raw: str | None, expected: str | None) -> None:
    assert normalize_rest_date(raw) == expected


def test_place_fields_name_the_category_and_join_the_menu() -> None:
    tomb = place_fields(
        {**PLACE_ITEM, "lclsSystm3": "HS010800"},
        category_names={"HS010800": ("역사유적지", "고분, 능")},
    )
    restaurant = place_fields(
        {**PLACE_ITEM, "contenttypeid": "39", "lclsSystm3": "FD010100"},
        detail_intro={
            "firstmenu": "장군 갈비살",
            "treatmenu": "장군 안창살 / 장군 살치살",
            "restdatefood": "매주 화요일",
        },
        category_names={"FD010100": ("한식", "관광식당")},
    )
    # 이름표에 없는 코드는 코드를 그대로 넣어 빈칸을 남기지 않는다.
    unnamed = place_fields({**PLACE_ITEM, "lclsSystm3": "ZZ999999"})
    uncategorized = place_fields(PLACE_ITEM)

    assert (tomb["CATEGORY_CODE"], tomb["CATEGORY_MAIN"], tomb["CATEGORY_SUB"]) == (
        "HS010800",
        "역사유적지",
        "고분, 능",
    )
    assert restaurant["MENU"] == "장군 갈비살 / 장군 안창살 / 장군 살치살"
    assert restaurant["REST_DATE"] == "화"
    assert unnamed["CATEGORY_MAIN"] == "ZZ999999"
    assert uncategorized["CATEGORY_CODE"] is None
    # 음식점이 아니면 메뉴 칸은 비어 있어야 한다.
    assert tomb["MENU"] is None


def test_place_fields_map_the_api_item() -> None:
    fields = place_fields(
        PLACE_ITEM,
        detail_common={"overview": "<p>동양 최고의  <br/>천문대</p>"},
        detail_intro={"usetime": "상시"},
    )
    restaurant = place_fields(
        {**PLACE_ITEM, "contenttypeid": "39", "title": "가" * 300},
        detail_intro={"opentimefood": "11:00 - 21:00"},
    )
    unknown = place_fields({**PLACE_ITEM, "contenttypeid": "99"}, detail_intro={"usetime": "상시"})

    # mapx 가 경도, mapy 가 위도다. 이름 순서와 반대라 헷갈리기 쉽다.
    assert fields["LATITUDE"] == "35.8347351901"
    assert fields["LONGITUDE"] == "129.2190247127"
    assert fields["ADDRESS"] == "경상북도 경주시 첨성로 169-5 (인왕동)"
    assert fields["IMG"] == "http://tong.visitkorea.or.kr/cms/a.jpg"
    assert fields["TEXT"] == "동양 최고의 천문대"
    assert fields["OPERATING_HOURS"] == "상시"
    assert restaurant["NAME"] == "가" * PLACE_NAME_MAX
    assert restaurant["OPERATING_HOURS"] == "11:00 - 21:00"
    assert unknown["OPERATING_HOURS"] is None


def test_festival_fields_map_the_api_item() -> None:
    fields = festival_fields(
        FESTIVAL_ITEM,
        detail_common={
            "overview": "벚" * (FESTIVAL_CONTENT_MAX + 50),
            "homepage": '<a href="https://festival.example.com">축제</a>',
        },
        detail_intro={"eventplace": "보문호반광장"},
    )
    undated = festival_fields({**FESTIVAL_ITEM, "eventstartdate": "2026-04-01"})
    described = festival_fields(
        FESTIVAL_ITEM,
        detail_common={"homepage": "공식 홈페이지 https://oar-museum.com"},
    )

    assert fields["START_DATE"].date().isoformat() == "2026-04-01"
    assert fields["END_DATE"].date().isoformat() == "2026-04-10"
    assert fields["LOCATION"] == "보문호반광장"
    assert fields["URL"] == "https://festival.example.com"
    assert described["URL"] == "https://oar-museum.com"
    assert len(fields["CONTENT"]) == FESTIVAL_CONTENT_MAX
    assert undated["START_DATE"] is None


def test_language_client_swaps_the_service_but_keeps_the_host(monkeypatch) -> None:
    monkeypatch.setenv("TOURAPI_SERVICE_KEY", "test-key")

    assert language_client("en").base_url.endswith("/EngService2")
    assert language_client("ja").base_url.endswith("/JpnService2")
    assert language_client("zh").base_url.endswith("/ChsService2")
    assert language_client("ko").base_url.endswith("/KorService2")


def test_unknown_language_is_rejected(monkeypatch) -> None:
    monkeypatch.setenv("TOURAPI_SERVICE_KEY", "test-key")

    with pytest.raises(TourApiError):
        language_client("de")


def test_place_i18n_fields_keep_the_rest_date_as_written() -> None:
    fields = place_i18n_fields(
        {**PLACE_ITEM, "contenttypeid": "39"},
        detail_common={"overview": "<p>동양 최고의  천문대</p>"},
        detail_intro={
            "opentimefood": "11:00 - 21:00",
            "restdatefood": "매주 화요일 (단, 공휴일인 경우 다음날 휴무)",
            "firstmenu": "장군 갈비살",
            "parkingfood": "가능",
        },
    )

    assert fields["NAME"] == "첨성대"
    assert fields["TEXT"] == "동양 최고의 천문대"
    assert fields["OPERATING_HOURS"] == "11:00 - 21:00"
    assert fields["MENU"] == "장군 갈비살"
    assert fields["PARKING"] == "가능"
    # 화면에 보여 줄 칸이라 "화" 로 줄이지 않는다. 줄인 값은 PLACE 쪽에 있다.
    assert fields["REST_DATE"] == "매주 화요일 (단, 공휴일인 경우 다음날 휴무)"


def test_translations_attach_to_the_place_with_the_same_content_id(
    database: pymysql.Connection,
    rows: Callable[..., list[dict]],
) -> None:
    sync_places(database, FakeClient(places=[PLACE_ITEM]), [12], with_detail=False)
    english = FakeClient(
        places=[{**PLACE_ITEM, "title": "Cheomseongdae"}],
        common={"overview": "The oldest observatory in the East"},
        intro={"usetime": "Always open"},
    )

    result = sync_place_translations(database, english, "en", [12])

    place = rows("SELECT IDX FROM PLACE")[0]
    row = rows("SELECT * FROM PLACE_I18N")[0]
    assert result.created == 1
    # 본체는 그대로 하나뿐이고, 번역만 옆에 붙는다.
    assert len(rows("SELECT IDX FROM PLACE")) == 1
    assert row["PLACE_IDX"] == place["IDX"]
    assert row["LANGUAGE_CODE"] == "en"
    assert row["NAME"] == "Cheomseongdae"
    assert row["TEXT"] == "The oldest observatory in the East"


def test_translations_skip_places_that_are_not_stored_yet(
    database: pymysql.Connection,
    rows: Callable[..., list[dict]],
) -> None:
    english = FakeClient(places=[{**PLACE_ITEM, "contentid": "999999"}])

    result = sync_place_translations(database, english, "en", [12])

    # 본체가 없는 장소는 붙일 곳이 없어 넘긴다. 다음 회차에 본체가 생기면 그때 붙는다.
    assert result.created == 0
    assert result.skipped
    assert not rows("SELECT IDX FROM PLACE_I18N")


def test_foreign_content_id_joins_by_unique_name_and_coordinates(
    database: pymysql.Connection,
    rows: Callable[..., list[dict]],
) -> None:
    sync_places(database, FakeClient(places=[PLACE_ITEM]), [12], with_detail=False)
    foreign = {
        **PLACE_ITEM,
        "contentid": "foreign-123",
        "title": "Cheomseongdae Observatory (첨성대)",
    }

    result = sync_place_translations(database, FakeClient(places=[foreign]), "en", [12])

    assert result.created == 1
    link = rows("SELECT PLACE_IDX, CONTENT_ID, MATCH_METHOD FROM PLACE_TOURAPI_LINK")[0]
    assert link["CONTENT_ID"] == "foreign-123"
    assert link["MATCH_METHOD"] == "name_and_coordinates"
    assert rows("SELECT NAME FROM PLACE_I18N WHERE PLACE_IDX = %s", (link["PLACE_IDX"],))[0]["NAME"] == foreign["title"]


def test_nearby_different_place_is_not_joined(
    database: pymysql.Connection,
    rows: Callable[..., list[dict]],
) -> None:
    sync_places(database, FakeClient(places=[PLACE_ITEM]), [12], with_detail=False)
    foreign = {**PLACE_ITEM, "contentid": "foreign-456", "title": "Another monument (다른 장소)"}

    result = sync_place_translations(database, FakeClient(places=[foreign]), "en", [12])

    assert result.created == 0
    assert not rows("SELECT * FROM PLACE_TOURAPI_LINK")


def test_longer_korean_name_is_not_mistaken_for_shorter_place() -> None:
    candidates = [{
        "IDX": 1, "NAME": "경주 오릉", "LATITUDE": "35.8", "LONGITUDE": "129.2",
    }]
    item = {
        "title": "Gyeongju Oreung Hanok (경주오릉한옥)",
        "mapy": "35.8", "mapx": "129.2",
    }

    assert verified_place_match(item, candidates) is None


def test_resyncing_a_language_updates_the_same_row(
    database: pymysql.Connection,
    rows: Callable[..., list[dict]],
) -> None:
    sync_places(database, FakeClient(places=[PLACE_ITEM]), [12], with_detail=False)
    first = FakeClient(places=[{**PLACE_ITEM, "title": "Cheomseongdae"}])
    sync_place_translations(database, first, "en", [12])

    second = FakeClient(places=[{**PLACE_ITEM, "title": "Cheomseongdae Observatory"}])
    result = sync_place_translations(database, second, "en", [12], force=True)

    translations = rows("SELECT * FROM PLACE_I18N")
    assert result.updated == 1
    assert len(translations) == 1
    assert translations[0]["NAME"] == "Cheomseongdae Observatory"


def test_unchanged_translations_cost_no_detail_calls(
    database: pymysql.Connection,
) -> None:
    item = {**PLACE_ITEM, "modifiedtime": "20260101120000"}
    sync_places(database, FakeClient(places=[item]), [12], with_detail=False)
    english = FakeClient(places=[{**item, "title": "Cheomseongdae"}])
    sync_place_translations(database, english, "en", [12])
    before = english.detail_calls

    again = FakeClient(places=[{**item, "title": "Cheomseongdae"}])
    result = sync_place_translations(database, again, "en", [12])

    assert before > 0
    assert result.unchanged == 1
    assert again.detail_calls == 0


def test_category_names_are_stored_per_language(
    database: pymysql.Connection,
    rows: Callable[..., list[dict]],
) -> None:
    korean = FakeClient(categories={"HS010800": ("역사유적지", "고분, 능")})
    english = FakeClient(categories={"HS010800": ("Historic Site", "Royal Tomb")})

    sync_category_names(database, korean, "ko")
    sync_category_names(database, english, "en")

    stored = {
        (row["CATEGORY_CODE"], row["LANGUAGE_CODE"]): row["CATEGORY_SUB"]
        for row in rows("SELECT * FROM CATEGORY_NAME_I18N")
    }
    # 같은 코드에 언어별로 한 줄씩. 장소마다 저장하지 않는다.
    assert stored[("HS010800", "ko")] == "고분, 능"
    assert stored[("HS010800", "en")] == "Royal Tomb"
