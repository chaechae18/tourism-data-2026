from collections.abc import Iterable, Iterator
from dataclasses import dataclass, field
from datetime import datetime
import logging
import os
import re
import time
import unicodedata
from typing import Any

import httpx
import pymysql


logger = logging.getLogger(__name__)

SOURCE_TOUR_API = "TOUR_API"
RESULT_CODE_OK = "0000"

CONTENT_TYPE_TOURIST_SPOT = 12
CONTENT_TYPE_CULTURAL_FACILITY = 14
CONTENT_TYPE_FESTIVAL = 15
CONTENT_TYPE_LEPORTS = 28
CONTENT_TYPE_SHOPPING = 38
CONTENT_TYPE_RESTAURANT = 39

PLACE_TYPE_TOUR = "TOUR"
PLACE_TYPE_FOOD = "FOOD"

# 언어마다 서비스가 따로 있다. 같은 장소라도 contentId 는 다를 수 있다.
TOURAPI_ROOT = "https://apis.data.go.kr/B551011"
LANGUAGE_SERVICES = {
    "ko": "KorService2",
    "en": "EngService2",
    "ja": "JpnService2",
    "zh": "ChsService2",
}
DEFAULT_LANGUAGE = "ko"


class TourApiError(RuntimeError):
    pass


class TourApiClient:
    def __init__(
        self,
        service_key: str | None = None,
        base_url: str | None = None,
        mobile_app: str | None = None,
        session: httpx.Client | None = None,
        timeout: float = 10,
        max_retries: int = 3,
        retry_backoff: float = 1.0,
    ) -> None:
        self.service_key = (
            service_key if service_key is not None else os.getenv("TOURAPI_SERVICE_KEY", "")
        )
        self.base_url = (
            base_url
            or os.getenv("TOURAPI_BASE_URL", "https://apis.data.go.kr/B551011/KorService2")
        ).rstrip("/")
        self.mobile_app = mobile_app or os.getenv("TOURAPI_MOBILE_APP", "PlayGyeongju")
        self.session = session or httpx.Client(timeout=timeout)
        self.timeout = timeout
        self.max_retries = max_retries
        self.retry_backoff = retry_backoff

        if not self.service_key:
            raise TourApiError(
                "TOURAPI_SERVICE_KEY is not set. "
                "공공데이터포털에서 발급받은 인증키를 backend/.env 에 넣어주세요."
            )

    def _get(self, operation: str, params: dict[str, Any]) -> dict[str, Any]:
        url = f"{self.base_url}/{operation}"
        query = {
            "serviceKey": self.service_key,
            "MobileOS": "ETC",
            "MobileApp": self.mobile_app,
            "_type": "json",
            **params,
        }

        last_error: TourApiError | None = None
        for attempt in range(1, self.max_retries + 1):
            try:
                response = self.session.get(url, params=query, timeout=self.timeout)
            except httpx.HTTPError as exc:
                last_error = TourApiError(f"{operation} 요청 실패: {exc}")
            else:
                if response.status_code >= 500:
                    last_error = TourApiError(self._describe(operation, response))
                elif response.status_code != 200:
                    # 4xx 는 잘못된 요청이거나 잘못된 키라 재시도해도 소용없다.
                    raise TourApiError(self._describe(operation, response))
                else:
                    return self._parse(operation, response)

            if attempt < self.max_retries:
                logger.warning("%s retry %s/%s", operation, attempt, self.max_retries)
                time.sleep(self.retry_backoff * attempt)

        raise last_error

    @staticmethod
    def _describe(operation: str, response: httpx.Response) -> str:
        hints = {
            401: (
                "인증키를 인식하지 못했습니다. .env 의 TOURAPI_SERVICE_KEY 를 "
                "확인해주세요 (공백·따옴표가 섞이지 않았는지)."
            ),
            403: (
                "인증키는 유효하지만 이 서비스 사용 권한이 없습니다. "
                "공공데이터포털 마이페이지 > 오픈API > 개발계정에서 해당 API 의 "
                "활용신청이 승인되었는지 확인해주세요. 방금 신청했다면 반영까지 "
                "시간이 걸릴 수 있습니다."
            ),
            404: "요청 주소가 잘못되었습니다. TOURAPI_BASE_URL 을 확인해주세요.",
        }
        body = " ".join((response.text or "").split())[:200]
        message = f"{operation} 응답 {response.status_code}"
        if body:
            message += f" ({body})"
        hint = hints.get(response.status_code)
        return f"{message}\n  → {hint}" if hint else message

    def _parse(self, operation: str, response: httpx.Response) -> dict[str, Any]:
        # _type=json 을 보내도 오류는 XML 로 오는 경우가 있다.
        try:
            payload = response.json()
        except ValueError:
            raise TourApiError(
                f"{operation} 응답을 JSON으로 읽지 못했습니다. "
                f"인증키를 확인해주세요: {response.text[:200]}"
            )

        envelope = payload.get("response") or {}
        header = envelope.get("header") or {}
        code = str(header.get("resultCode", ""))
        if code != RESULT_CODE_OK:
            raise TourApiError(
                f"{operation} 오류 {code}: {header.get('resultMsg', 'unknown')}"
            )

        return envelope.get("body") or {}

    @staticmethod
    def _items(body: dict[str, Any]) -> list[dict[str, Any]]:
        # 결과가 없으면 빈 문자열, 하나뿐이면 리스트가 아닌 객체가 온다.
        items = (body.get("items") or {}) if isinstance(body.get("items"), dict) else {}
        item = items.get("item")
        if item is None:
            return []
        return item if isinstance(item, list) else [item]

    def iter_items(
        self,
        operation: str,
        params: dict[str, Any],
        page_size: int = 100,
        max_pages: int | None = None,
    ) -> Iterator[dict[str, Any]]:
        page = 1
        seen = 0
        while True:
            body = self._get(operation, {**params, "numOfRows": page_size, "pageNo": page})
            items = self._items(body)
            if not items:
                return

            for item in items:
                yield item
            seen += len(items)

            total = int(body.get("totalCount") or 0)
            if seen >= total or (max_pages is not None and page >= max_pages):
                return
            page += 1

    def area_based_list(
        self,
        content_type_id: int | None = None,
        ldong_regn_cd: str | None = None,
        ldong_signgu_cd: str | None = None,
        **kwargs: Any,
    ) -> Iterator[dict[str, Any]]:
        params: dict[str, Any] = {
            "lDongRegnCd": (
                ldong_regn_cd
                if ldong_regn_cd is not None
                else os.getenv("TOURAPI_LDONG_REGN_CD", "47")
            ),
            "lDongSignguCd": (
                ldong_signgu_cd
                if ldong_signgu_cd is not None
                else os.getenv("TOURAPI_LDONG_SIGNGU_CD", "130")
            ),
            "arrange": "C",
        }
        if content_type_id is not None:
            params["contentTypeId"] = content_type_id
        params.update(kwargs)
        return self.iter_items("areaBasedList2", params)

    def search_festival(
        self,
        event_start_date: str,
        ldong_regn_cd: str | None = None,
        ldong_signgu_cd: str | None = None,
        **kwargs: Any,
    ) -> Iterator[dict[str, Any]]:
        params: dict[str, Any] = {
            "eventStartDate": event_start_date,
            "lDongRegnCd": (
                ldong_regn_cd
                if ldong_regn_cd is not None
                else os.getenv("TOURAPI_LDONG_REGN_CD", "47")
            ),
            "lDongSignguCd": (
                ldong_signgu_cd
                if ldong_signgu_cd is not None
                else os.getenv("TOURAPI_LDONG_SIGNGU_CD", "130")
            ),
            "arrange": "C",
        }
        params.update(kwargs)
        return self.iter_items("searchFestival2", params)

    def detail_common(self, content_id: str) -> dict[str, Any] | None:
        body = self._get("detailCommon2", {"contentId": content_id, "numOfRows": 1, "pageNo": 1})
        items = self._items(body)
        return items[0] if items else None

    def _lcls_codes(self, **params: str) -> list[tuple[str, str]]:
        body = self._get("lclsSystmCode2", {**params, "numOfRows": 100, "pageNo": 1})
        return [
            (str(item.get("code", "")), str(item.get("name", "")))
            for item in self._items(body)
        ]

    def lcls_systm_names(self) -> dict[str, tuple[str, str]]:
        """분류체계 소분류 코드 -> (중분류 이름, 소분류 이름).

        HS010800 -> ("역사유적지", "고분, 능") 처럼 코드를 사람이 읽는 이름으로
        바꾸는 표를 만든다. 다음 단계 목록을 받으려면 그 단계 파라미터를 빈 값으로
        함께 보내야 한다 (lclsSystm1 만 보내면 1단계 목록이 그대로 돌아온다).
        """
        names: dict[str, tuple[str, str]] = {}
        for top, _ in self._lcls_codes():
            for middle, middle_name in self._lcls_codes(lclsSystm1=top, lclsSystm2=""):
                for leaf, leaf_name in self._lcls_codes(
                    lclsSystm1=top, lclsSystm2=middle, lclsSystm3=""
                ):
                    names[leaf] = (middle_name, leaf_name)
        return names

    def detail_intro(self, content_id: str, content_type_id: int) -> dict[str, Any] | None:
        body = self._get(
            "detailIntro2",
            {
                "contentId": content_id,
                "contentTypeId": content_type_id,
                "numOfRows": 1,
                "pageNo": 1,
            },
        )
        items = self._items(body)
        return items[0] if items else None


# 팀 DDL 의 컬럼 길이. MySQL STRICT 모드에서 행 전체가 거부되지 않게 잘라 넣는다.
PLACE_NAME_MAX = 200
PLACE_ADDRESS_MAX = 500
PLACE_TEXT_FIELD_MAX = 300
PLACE_IMG_MAX = 600
PLACE_MENU_MAX = 500
CATEGORY_CODE_MAX = 20
CATEGORY_NAME_MAX = 50
FESTIVAL_NAME_MAX = 300
FESTIVAL_CONTENT_MAX = 700
FESTIVAL_LOCATION_MAX = 500
FESTIVAL_IMG_MAX = 600
FESTIVAL_URL_MAX = 600

INTRO_FIELDS = {
    CONTENT_TYPE_TOURIST_SPOT: {
        "OPERATING_HOURS": "usetime",
        "ADMISSION_FEE": None,
        "PARKING": "parking",
        "REST_DATE": "restdate",
    },
    CONTENT_TYPE_CULTURAL_FACILITY: {
        "OPERATING_HOURS": "usetimeculture",
        "ADMISSION_FEE": "usefee",
        "PARKING": "parkingculture",
        "REST_DATE": "restdateculture",
    },
    CONTENT_TYPE_LEPORTS: {
        "OPERATING_HOURS": "usetimeleports",
        "ADMISSION_FEE": "usefeeleports",
        "PARKING": "parkingleports",
        "REST_DATE": "restdateleports",
    },
    CONTENT_TYPE_SHOPPING: {
        "OPERATING_HOURS": "opentime",
        "ADMISSION_FEE": None,
        "PARKING": "parkingshopping",
        "REST_DATE": "restdateshopping",
    },
    CONTENT_TYPE_RESTAURANT: {
        "OPERATING_HOURS": "opentimefood",
        "ADMISSION_FEE": None,
        "PARKING": "parkingfood",
        "REST_DATE": "restdatefood",
    },
    CONTENT_TYPE_FESTIVAL: {
        "OPERATING_HOURS": "playtime",
        "ADMISSION_FEE": "usetimefestival",  # 이름은 시간 같지만 이용요금이다
        "PARKING": "parkingfestival",
    },
}

# 다국어 서비스는 같은 관광 유형에 국문과 다른 contentTypeId 를 쓴다.
INTRO_FIELDS.update({
    75: INTRO_FIELDS[CONTENT_TYPE_LEPORTS],
    76: INTRO_FIELDS[CONTENT_TYPE_TOURIST_SPOT],
    78: INTRO_FIELDS[CONTENT_TYPE_CULTURAL_FACILITY],
    79: INTRO_FIELDS[CONTENT_TYPE_SHOPPING],
    82: INTRO_FIELDS[CONTENT_TYPE_RESTAURANT],
    85: INTRO_FIELDS[CONTENT_TYPE_FESTIVAL],
})

_HREF = re.compile(r'href=["\']([^"\']+)["\']', re.IGNORECASE)
_BARE_URL = re.compile(r"https?://[^\s\"'<>]+")
_TAG = re.compile(r"<[^>]+>")

ALWAYS_OPEN = "연중무휴"
WEEKDAYS = "월화수목금토일"
_WEEKDAY = re.compile(rf"([{WEEKDAYS}])요일")
_ALWAYS_OPEN = re.compile(r"연중\s*무휴")


def clean(value: object, limit: int | None = None) -> str | None:
    if value is None:
        return None
    text = _TAG.sub(" ", str(value))
    text = " ".join(text.split())
    if not text:
        return None
    return text[:limit] if limit else text


def normalize_rest_date(value: object) -> str | None:
    """자유 서술인 쉬는날을 코스 추천이 바로 쓸 수 있는 형태로 줄인다.

    "매주 화요일 (단, 화요일이 공휴일인 경우 다음날 휴무)" -> "화"
    "연중무휴"                                        -> "연중무휴"
    "점포 별로 상이함"                                 -> None (모름)

    요일을 먼저 본다. "마을 연중무휴 / 문화관 매주 월요일" 처럼 둘이 같이 있으면
    쉬는 날이 있는 쪽으로 읽어야 헛걸음을 시키지 않는다.
    """
    text = clean(value)
    if not text:
        return None

    found = {match.group(1) for match in _WEEKDAY.finditer(text)}
    if found:
        return ",".join(day for day in WEEKDAYS if day in found)
    return ALWAYS_OPEN if _ALWAYS_OPEN.search(text) else None


def parse_coordinate(value: object) -> str | None:
    if value in (None, ""):
        return None
    try:
        return str(float(str(value).strip()))
    except (TypeError, ValueError):
        return None


def parse_tour_date(value: object) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.strptime(str(value).strip(), "%Y%m%d")
    except ValueError:
        return None


def parse_tour_datetime(value: object) -> datetime | None:
    """목록의 modifiedtime (YYYYMMDDHHMMSS). 형식이 다르면 모르는 것으로 둔다."""
    if not value:
        return None
    try:
        return datetime.strptime(str(value).strip(), "%Y%m%d%H%M%S")
    except ValueError:
        return None


def extract_homepage_url(value: object) -> str | None:
    if not value:
        return None
    text = str(value)
    # homepage 는 <a href> 로 올 때도 있고 "공식 홈페이지 https://..." 처럼
    # 설명이 앞에 붙은 맨텍스트로 올 때도 있다.
    anchor = _HREF.search(text)
    if anchor:
        return anchor.group(1)[:FESTIVAL_URL_MAX]
    bare = _BARE_URL.search(text)
    return bare.group()[:FESTIVAL_URL_MAX] if bare else None


def join_address(item: dict[str, Any]) -> str | None:
    parts = [clean(item.get("addr1")), clean(item.get("addr2"))]
    joined = " ".join(part for part in parts if part)
    return joined[:PLACE_ADDRESS_MAX] if joined else None


def category_fields(
    item: dict[str, Any],
    category_names: dict[str, tuple[str, str]] | None = None,
) -> dict[str, Any]:
    """분류체계 코드와 그 이름. 이름을 못 찾으면 코드를 그대로 넣어 빈칸을 남기지 않는다."""
    code = clean(item.get("lclsSystm3"), CATEGORY_CODE_MAX)
    if not code:
        return {"CATEGORY_CODE": None, "CATEGORY_MAIN": None, "CATEGORY_SUB": None}

    main, sub = (category_names or {}).get(code, (code, code))
    return {
        "CATEGORY_CODE": code,
        "CATEGORY_MAIN": (main or code)[:CATEGORY_NAME_MAX],
        "CATEGORY_SUB": (sub or code)[:CATEGORY_NAME_MAX],
    }


def intro_fields(item: dict[str, Any], detail_intro: dict[str, Any]) -> dict[str, Any]:
    """상세 응답에서 운영시간·주차·쉬는날·메뉴를 꺼낸다. 쉬는날은 원문 그대로다."""
    # 콘텐츠 종류마다 같은 뜻의 키 이름이 다르다.
    mapping = INTRO_FIELDS.get(int(item.get("contenttypeid") or 0), {})
    fields = {
        column: clean(detail_intro.get(source_key), PLACE_TEXT_FIELD_MAX)
        for column, source_key in mapping.items()
        if source_key
    }
    # 대표메뉴·취급메뉴는 음식점에만 온다. 코스에서 "고기집" 을 가려내는 근거라
    # 둘을 합쳐 하나로 둔다.
    menu = " / ".join(
        part
        for part in (
            clean(detail_intro.get("firstmenu")),
            clean(detail_intro.get("treatmenu")),
        )
        if part
    )
    fields["MENU"] = menu[:PLACE_MENU_MAX] or None
    return fields


def place_fields(
    item: dict[str, Any],
    detail_common: dict[str, Any] | None = None,
    detail_intro: dict[str, Any] | None = None,
    category_names: dict[str, tuple[str, str]] | None = None,
) -> dict[str, Any]:
    fields: dict[str, Any] = {
        "NAME": clean(item.get("title"), PLACE_NAME_MAX),
        "ADDRESS": join_address(item),
        # mapx 가 경도, mapy 가 위도다. 이름 순서와 반대라 헷갈리기 쉽다.
        "LATITUDE": parse_coordinate(item.get("mapy")),
        "LONGITUDE": parse_coordinate(item.get("mapx")),
        "IMG": clean(item.get("firstimage") or item.get("firstimage2"), PLACE_IMG_MAX),
        "TEXT": None,
        "OPERATING_HOURS": None,
        "ADMISSION_FEE": None,
        "PARKING": None,
        "REST_DATE": None,
        "MENU": None,
        **category_fields(item, category_names),
    }

    if detail_common:
        fields["TEXT"] = clean(detail_common.get("overview"))

    if detail_intro:
        fields.update(intro_fields(item, detail_intro))
        # 코스 추천이 요일을 맞춰 볼 수 있게 줄인다. 원문은 PLACE_I18N 이 들고 있다.
        fields["REST_DATE"] = normalize_rest_date(fields["REST_DATE"])

    return fields


# 지도 상세 카드에서 언어를 타는 항목만 모은다. 좌표·사진은 PLACE 쪽에 한 벌만 둔다.
def place_i18n_fields(
    item: dict[str, Any],
    detail_common: dict[str, Any] | None = None,
    detail_intro: dict[str, Any] | None = None,
) -> dict[str, Any]:
    fields: dict[str, Any] = {
        "NAME": clean(item.get("title"), PLACE_NAME_MAX),
        "ADDRESS": join_address(item),
        "TEXT": None,
        "OPERATING_HOURS": None,
        "ADMISSION_FEE": None,
        "PARKING": None,
        "REST_DATE": None,
        "MENU": None,
    }

    if detail_common:
        fields["TEXT"] = clean(detail_common.get("overview"))

    if detail_intro:
        # 쉬는날은 줄이지 않고 원문을 그대로 둔다. 사람이 읽을 칸이다.
        fields.update(intro_fields(item, detail_intro))

    return fields


def festival_fields(
    item: dict[str, Any],
    detail_common: dict[str, Any] | None = None,
    detail_intro: dict[str, Any] | None = None,
) -> dict[str, Any]:
    fields: dict[str, Any] = {
        "NAME": clean(item.get("title"), FESTIVAL_NAME_MAX),
        "LOCATION": join_address(item),
        "START_DATE": parse_tour_date(item.get("eventstartdate")),
        "END_DATE": parse_tour_date(item.get("eventenddate")),
        "IMG": clean(item.get("firstimage") or item.get("firstimage2"), FESTIVAL_IMG_MAX),
        "CONTENT": None,
        "URL": None,
    }

    if detail_common:
        fields["CONTENT"] = clean(detail_common.get("overview"), FESTIVAL_CONTENT_MAX)
        fields["URL"] = extract_homepage_url(detail_common.get("homepage"))

    if detail_intro:
        venue = clean(detail_intro.get("eventplace"), FESTIVAL_LOCATION_MAX)
        if venue:
            fields["LOCATION"] = venue

    return fields


@dataclass
class SyncResult:
    created: int = 0
    updated: int = 0
    # 공사 쪽 수정시각이 그대로라 상세 조회 없이 넘어간 건수.
    unchanged: int = 0
    skipped: list[str] = field(default_factory=list)

    @property
    def total(self) -> int:
        return self.created + self.updated

    def __str__(self) -> str:
        return (
            f"created={self.created} updated={self.updated} "
            f"unchanged={self.unchanged} skipped={len(self.skipped)}"
        )


def place_type_for(content_type_id: object) -> str:
    is_food = int(content_type_id or 0) == CONTENT_TYPE_RESTAURANT
    return PLACE_TYPE_FOOD if is_food else PLACE_TYPE_TOUR


def _content_id(item: dict[str, Any]) -> str | None:
    raw = item.get("contentid")
    return str(raw).strip() if raw not in (None, "") else None


def _fetch_details(
    client: TourApiClient,
    content_id: str,
    content_type_id: int,
    with_detail: bool,
) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    if not with_detail:
        return None, None
    common = client.detail_common(content_id)
    intro = client.detail_intro(content_id, content_type_id)
    return common, intro


def fetch_festivals(
    client: TourApiClient,
    event_start_date: str,
    with_detail: bool = True,
    limit: int | None = None,
    event_end_date: str | None = None,
) -> list[dict[str, Any]]:
    # 두 날짜는 시작·종료일 조건이 아니라 조회 구간이다. 구간에 하루라도 걸치면 내려온다.
    window = {"eventEndDate": event_end_date} if event_end_date else {}
    festivals: list[dict[str, Any]] = []
    for item in client.search_festival(event_start_date, **window):
        if limit is not None and len(festivals) >= limit:
            break
        content_id = _content_id(item)
        common, intro = (
            _fetch_details(client, content_id, CONTENT_TYPE_FESTIVAL, with_detail)
            if content_id
            else (None, None)
        )
        festivals.append({"CONTENT_ID": content_id, **festival_fields(item, common, intro)})
    return festivals


def _upsert(
    connection: pymysql.Connection,
    table: str,
    content_id: str,
    fields: dict[str, Any],
) -> bool:
    columns = ("SOURCE", "CONTENT_ID", *fields)
    assignments = ", ".join(f"{column} = VALUES({column})" for column in fields)
    sql = (
        f"INSERT INTO {table} ({', '.join(columns)}) "
        f"VALUES ({', '.join(['%s'] * len(columns))}) "
        f"ON DUPLICATE KEY UPDATE {assignments}"
    )
    # IS_RECOMMENDED·VIEW_COUNT 처럼 대입 목록에 없는 컬럼은 재동기화해도 그대로 남는다.
    with connection.cursor() as cursor:
        cursor.execute(sql, (SOURCE_TOUR_API, content_id, *fields.values()))
        return cursor.rowcount == 1


def _upsert_i18n(
    connection: pymysql.Connection,
    place_idx: int,
    language: str,
    fields: dict[str, Any],
) -> bool:
    columns = ("PLACE_IDX", "LANGUAGE_CODE", *fields)
    assignments = ", ".join(f"{column} = VALUES({column})" for column in fields)
    sql = (
        f"INSERT INTO PLACE_I18N ({', '.join(columns)}) "
        f"VALUES ({', '.join(['%s'] * len(columns))}) "
        f"ON DUPLICATE KEY UPDATE {assignments}"
    )
    with connection.cursor() as cursor:
        cursor.execute(sql, (place_idx, language, *fields.values()))
        created = cursor.rowcount == 1
    from .place_translation_cache import clear_machine_cache_for_official_fields
    clear_machine_cache_for_official_fields(connection, place_idx, language, fields)
    return created


def _upsert_category_name(
    connection: pymysql.Connection,
    code: str,
    language: str,
    main: str | None,
    sub: str | None,
) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            "INSERT INTO CATEGORY_NAME_I18N "
            "(CATEGORY_CODE, LANGUAGE_CODE, CATEGORY_MAIN, CATEGORY_SUB) "
            "VALUES (%s, %s, %s, %s) "
            "ON DUPLICATE KEY UPDATE "
            "CATEGORY_MAIN = VALUES(CATEGORY_MAIN), CATEGORY_SUB = VALUES(CATEGORY_SUB)",
            (
                code[:CATEGORY_CODE_MAX],
                language,
                (main or None) and main[:CATEGORY_NAME_MAX],
                (sub or None) and sub[:CATEGORY_NAME_MAX],
            ),
        )


def load_category_names(client: TourApiClient) -> dict[str, tuple[str, str]]:
    # 이름표를 못 받아도 코드는 그대로 저장되므로 동기화 자체는 계속 진행한다.
    try:
        return client.lcls_systm_names()
    except TourApiError as exc:
        logger.warning("분류체계 이름을 받지 못했다. 코드만 저장한다: %s", exc)
        return {}


class LazyCategoryNames:
    """분류체계 이름표를 처음 필요할 때 한 번만 받아 둔다.

    이름표 한 벌을 만들려면 코드 3단계를 훑어야 해서 lclsSystmCode2 호출이 수십 번
    나간다. 바뀐 장소가 하나도 없는 주에는 쓸 일이 없으므로, 실제로 넣거나 고칠
    행이 나왔을 때까지 미룬다.
    """

    def __init__(self, client: TourApiClient) -> None:
        self._client = client
        self._names: dict[str, tuple[str, str]] | None = None

    def get(self) -> dict[str, tuple[str, str]]:
        if self._names is None:
            self._names = load_category_names(self._client)
        return self._names


def language_client(language: str, **kwargs: Any) -> TourApiClient:
    if language not in LANGUAGE_SERVICES:
        raise TourApiError(
            f"지원하지 않는 언어입니다: {language!r} "
            f"(가능: {', '.join(LANGUAGE_SERVICES)})"
        )
    root = os.getenv("TOURAPI_ROOT", TOURAPI_ROOT).rstrip("/")
    return TourApiClient(base_url=f"{root}/{LANGUAGE_SERVICES[language]}", **kwargs)


def load_place_ids(connection: pymysql.Connection) -> dict[str, int]:
    """Korean CONTENT_ID -> PLACE.IDX."""
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT CONTENT_ID, IDX FROM PLACE "
            "WHERE SOURCE = %s AND CONTENT_ID IS NOT NULL",
            (SOURCE_TOUR_API,),
        )
        rows = cursor.fetchall()
    return {str(row["CONTENT_ID"]): row["IDX"] for row in rows}


def load_place_match_candidates(connection: pymysql.Connection) -> list[dict[str, Any]]:
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT IDX, CONTENT_ID, NAME, LATITUDE, LONGITUDE FROM PLACE "
            "WHERE SOURCE = %s AND NAME IS NOT NULL",
            (SOURCE_TOUR_API,),
        )
        return list(cursor.fetchall())


def load_place_tourapi_links(
    connection: pymysql.Connection, language: str
) -> dict[str, int]:
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT CONTENT_ID, PLACE_IDX FROM PLACE_TOURAPI_LINK WHERE LANGUAGE_CODE = %s",
            (language,),
        )
        return {str(row["CONTENT_ID"]): row["PLACE_IDX"] for row in cursor.fetchall()}


def _match_name(value: str | None) -> str:
    normalized = unicodedata.normalize("NFKC", value or "").casefold()
    return "".join(char for char in normalized if char.isalnum())


def _contains_korean_name(title: str | None, name: str | None) -> bool:
    """Match a Korean label in parentheses without treating longer names as the same place."""
    compact_title = re.sub(r"\s+", "", unicodedata.normalize("NFKC", title or ""))
    compact_name = re.sub(r"\s+", "", unicodedata.normalize("NFKC", name or ""))
    if len(_match_name(compact_name)) < 3:
        return False
    return re.search(
        rf"(?<![가-힣]){re.escape(compact_name)}(?![가-힣])", compact_title
    ) is not None


def _distance_meters(place: dict[str, Any], item: dict[str, Any]) -> float | None:
    try:
        latitude = float(place["LATITUDE"])
        longitude = float(place["LONGITUDE"])
        other_latitude = float(item["mapy"])
        other_longitude = float(item["mapx"])
    except (KeyError, TypeError, ValueError):
        return None
    # 경주 부근에서 후보를 좁히는 근사 거리. 확정에는 이름도 반드시 필요하다.
    return ((latitude - other_latitude) ** 2 * 111_000 ** 2
            + (longitude - other_longitude) ** 2 * 91_000 ** 2) ** .5


def verified_place_match(
    item: dict[str, Any], candidates: list[dict[str, Any]]
) -> int | None:
    """Accept only a unique Korean name embedded in the foreign title near its coordinates."""
    matches = []
    for place in candidates:
        distance = _distance_meters(place, item)
        if (_contains_korean_name(item.get("title"), place.get("NAME"))
                and distance is not None and distance <= 1_000):
            matches.append(place["IDX"])
    return matches[0] if len(matches) == 1 else None


def save_place_tourapi_link(
    connection: pymysql.Connection,
    *,
    place_idx: int,
    language: str,
    content_id: str,
    method: str,
) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            "INSERT INTO PLACE_TOURAPI_LINK "
            "(PLACE_IDX, LANGUAGE_CODE, CONTENT_ID, MATCH_METHOD) VALUES (%s, %s, %s, %s)",
            (place_idx, language, content_id, method),
        )


def load_synced_i18n_modified_times(
    connection: pymysql.Connection, language: str
) -> dict[str, datetime]:
    """그 언어로 마지막까지 받아 둔 공사 수정시각. 언어마다 따로 센다."""
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT l.CONTENT_ID, t.MODIFIED_TIME FROM PLACE_I18N t "
            "JOIN PLACE_TOURAPI_LINK l ON l.PLACE_IDX = t.PLACE_IDX "
            "AND l.LANGUAGE_CODE = t.LANGUAGE_CODE "
            "WHERE t.LANGUAGE_CODE = %s AND t.MODIFIED_TIME IS NOT NULL",
            (language,),
        )
        rows = cursor.fetchall()
    return {str(row["CONTENT_ID"]): row["MODIFIED_TIME"] for row in rows}


def load_synced_modified_times(
    connection: pymysql.Connection, table: str
) -> dict[str, datetime]:
    """CONTENT_ID -> 마지막으로 상세까지 받아 둔 공사 수정시각.

    MODIFIED_TIME 이 비어 있는 행은 담지 않는다. --skip-detail 로 넣은 행과
    수기 등록 행이 여기 해당하고, 둘 다 다음 회차에서 다시 받아야 한다.
    """
    with connection.cursor() as cursor:
        cursor.execute(
            f"SELECT CONTENT_ID, MODIFIED_TIME FROM {table} "
            "WHERE SOURCE = %s AND CONTENT_ID IS NOT NULL AND MODIFIED_TIME IS NOT NULL",
            (SOURCE_TOUR_API,),
        )
        rows = cursor.fetchall()
    return {str(row["CONTENT_ID"]): row["MODIFIED_TIME"] for row in rows}


def is_unchanged(
    synced: dict[str, datetime], content_id: str, modified: datetime | None
) -> bool:
    # 목록에 수정시각이 없으면 비교할 근거가 없으니 평소대로 받아 둔다.
    if modified is None:
        return False
    previous = synced.get(content_id)
    return previous is not None and previous >= modified


def sync_places(
    connection: pymysql.Connection,
    client: TourApiClient,
    content_type_ids: Iterable[int],
    with_detail: bool = True,
    limit: int | None = None,
    force: bool = False,
) -> SyncResult:
    result = SyncResult()
    processed = 0
    synced = {} if force else load_synced_modified_times(connection, "PLACE")
    category_names = LazyCategoryNames(client)

    for content_type_id in content_type_ids:
        for item in client.area_based_list(content_type_id=content_type_id):
            if limit is not None and processed >= limit:
                return result

            content_id = _content_id(item)
            if not content_id:
                result.skipped.append(f"contentid 없음: {item.get('title')!r}")
                continue

            # 상세 두 번을 부르기 전에 목록의 수정시각부터 본다. 호출을 줄이는 곳은 여기다.
            modified = parse_tour_datetime(item.get("modifiedtime"))
            if is_unchanged(synced, content_id, modified):
                result.unchanged += 1
                continue

            common, intro = _fetch_details(client, content_id, content_type_id, with_detail)
            fields = place_fields(item, common, intro, category_names.get())
            fields["TYPE"] = place_type_for(item.get("contenttypeid"))
            # 상세를 건너뛴 회차는 수정시각을 남기지 않는다. 남기면 소개·운영시간이
            # 빈 행이 최신으로 굳어서 영영 채워지지 않는다.
            if with_detail:
                fields["MODIFIED_TIME"] = modified

            created = _upsert(connection, "PLACE", content_id, fields)
            result.created += created
            result.updated += not created
            processed += 1

    return result


def sync_category_names(
    connection: pymysql.Connection,
    client: TourApiClient,
    language: str,
) -> int:
    names = load_category_names(client)
    for code, (main, sub) in names.items():
        _upsert_category_name(connection, code, language, main, sub)
    return len(names)


def sync_place_translations(
    connection: pymysql.Connection,
    client: TourApiClient,
    language: str,
    content_type_ids: Iterable[int | None],
    limit: int | None = None,
    force: bool = False,
    place_ids: dict[str, int] | None = None,
) -> SyncResult:
    """한 언어의 번역을 PLACE_I18N 에 채운다. 본체(PLACE)는 건드리지 않는다."""
    result = SyncResult()
    processed = 0
    # 기존 링크를 우선한다. 신규는 한국어 이름이 외국어 제목에 포함되고 좌표도 가까울 때만 연결한다.
    ids = load_place_ids(connection) if place_ids is None else place_ids
    links = load_place_tourapi_links(connection, language)
    candidates = load_place_match_candidates(connection)
    synced = {} if force else load_synced_i18n_modified_times(connection, language)

    for content_type_id in content_type_ids:
        for item in client.area_based_list(content_type_id=content_type_id):
            if limit is not None and processed >= limit:
                return result

            content_id = _content_id(item)
            if not content_id:
                result.skipped.append(f"{language}: contentid 없음 {item.get('title')!r}")
                continue

            place_idx = links.get(content_id)
            method = None
            if place_idx is None and content_id in ids:
                place_idx = ids[content_id]
                method = "shared_content_id"
            if place_idx is None:
                place_idx = verified_place_match(item, candidates)
                if place_idx is not None:
                    method = "name_and_coordinates"
            if place_idx is None:
                result.skipped.append(f"{language}: 검토 필요 {content_id} {item.get('title')!r}")
                continue

            if method is not None:
                # 이미 다른 외국어 ID 가 같은 장소에 연결돼 있으면 확정하지 않는다.
                if place_idx in links.values():
                    result.skipped.append(f"{language}: 연결 충돌 {content_id}")
                    continue
                save_place_tourapi_link(
                    connection, place_idx=place_idx, language=language,
                    content_id=content_id, method=method,
                )
                links[content_id] = place_idx

            modified = parse_tour_datetime(item.get("modifiedtime"))
            if is_unchanged(synced, content_id, modified):
                result.unchanged += 1
                continue

            detail_type = int(item.get("contenttypeid") or content_type_id or 0)
            common, intro = _fetch_details(client, content_id, detail_type, True)
            fields = place_i18n_fields(item, common, intro)
            # NAME 은 NOT NULL 이다. 이름이 없으면 넣을 수 없으니 넘긴다.
            if not fields["NAME"]:
                result.skipped.append(f"{language}: 이름 없음 {content_id}")
                continue

            fields["MODIFIED_TIME"] = modified
            created = _upsert_i18n(connection, place_idx, language, fields)
            result.created += created
            result.updated += not created
            processed += 1

    return result


def sync_festivals(
    connection: pymysql.Connection,
    client: TourApiClient,
    event_start_date: str,
    with_detail: bool = True,
    limit: int | None = None,
    force: bool = False,
) -> SyncResult:
    result = SyncResult()
    processed = 0
    synced = {} if force else load_synced_modified_times(connection, "FESTIVAL")

    for item in client.search_festival(event_start_date):
        if limit is not None and processed >= limit:
            return result

        content_id = _content_id(item)
        if not content_id:
            result.skipped.append(f"contentid 없음: {item.get('title')!r}")
            continue

        modified = parse_tour_datetime(item.get("modifiedtime"))
        if is_unchanged(synced, content_id, modified):
            result.unchanged += 1
            continue

        common, intro = _fetch_details(client, content_id, CONTENT_TYPE_FESTIVAL, with_detail)
        fields = festival_fields(item, common, intro)
        if with_detail:
            fields["MODIFIED_TIME"] = modified

        created = _upsert(connection, "FESTIVAL", content_id, fields)
        result.created += created
        result.updated += not created
        processed += 1

    return result
