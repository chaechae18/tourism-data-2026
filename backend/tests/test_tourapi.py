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
    place_fields,
    sync_festivals,
    sync_places,
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
    def __init__(self, places=(), festivals=(), common=None, intro=None) -> None:
        self.places = list(places)
        self.festivals = list(festivals)
        self.common = common
        self.intro = intro

    def area_based_list(self, content_type_id=None, **kwargs) -> list[dict]:
        return list(self.places)

    def search_festival(self, event_start_date, **kwargs) -> list[dict]:
        return list(self.festivals)

    def detail_common(self, content_id) -> dict | None:
        return self.common

    def detail_intro(self, content_id, content_type_id) -> dict | None:
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
