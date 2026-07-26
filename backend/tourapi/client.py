"""HTTP client for the 한국관광공사 TourAPI (KorService2).

Kept free of any model or serializer knowledge: it returns raw response items
and nothing else. Field mapping lives in `mappers.py` so it can be tested
without a network.
"""
import logging
import time

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

# 공사 API가 정상 응답에 쓰는 결과 코드
RESULT_CODE_OK = "0000"

CONTENT_TYPE_TOURIST_SPOT = 12
CONTENT_TYPE_CULTURAL_FACILITY = 14
CONTENT_TYPE_FESTIVAL = 15
CONTENT_TYPE_LEPORTS = 28
CONTENT_TYPE_SHOPPING = 38
CONTENT_TYPE_RESTAURANT = 39


class TourApiError(RuntimeError):
    """The 공사 API answered, but not with usable data."""


class TourApiClient:
    def __init__(
        self,
        service_key=None,
        base_url=None,
        mobile_app=None,
        session=None,
        timeout=10,
        max_retries=3,
        retry_backoff=1.0,
    ):
        self.service_key = (
            service_key if service_key is not None else settings.TOURAPI_SERVICE_KEY
        )
        self.base_url = (base_url or settings.TOURAPI_BASE_URL).rstrip("/")
        self.mobile_app = mobile_app or settings.TOURAPI_MOBILE_APP
        self.session = session or requests.Session()
        self.timeout = timeout
        self.max_retries = max_retries
        self.retry_backoff = retry_backoff

        if not self.service_key:
            raise TourApiError(
                "TOURAPI_SERVICE_KEY is not set. "
                "공공데이터포털에서 발급받은 인증키를 backend/.env 에 넣어주세요."
            )

    # -- transport ---------------------------------------------------------

    def _get(self, operation, params):
        url = f"{self.base_url}/{operation}"
        query = {
            "serviceKey": self.service_key,
            "MobileOS": "ETC",
            "MobileApp": self.mobile_app,
            "_type": "json",
            **params,
        }

        last_error = None
        for attempt in range(1, self.max_retries + 1):
            try:
                response = self.session.get(url, params=query, timeout=self.timeout)
            except requests.RequestException as exc:
                last_error = TourApiError(f"{operation} 요청 실패: {exc}")
            else:
                if response.status_code >= 500:
                    last_error = TourApiError(self._describe(operation, response))
                elif response.status_code != 200:
                    # 4xx is a bad request or a bad key; retrying will not help.
                    raise TourApiError(self._describe(operation, response))
                else:
                    return self._parse(operation, response)

            if attempt < self.max_retries:
                logger.warning("%s retry %s/%s", operation, attempt, self.max_retries)
                time.sleep(self.retry_backoff * attempt)

        raise last_error

    @staticmethod
    def _describe(operation, response):
        """Turn an HTTP failure into something actionable.

        data.go.kr answers the useful part in the body, and its 401/403 split
        is the fastest way to tell a bad key from an unapproved one:

        - 401 Unauthorized — the gateway does not recognise the key at all
        - 403 Forbidden    — the key is real, but this service is not approved
                             for it (활용신청 미승인 또는 반영 대기)
        """
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

    def _parse(self, operation, response):
        """Pull the body out of a TourAPI envelope.

        Errors often come back as XML even when `_type=json` was requested
        (an unregistered key is the usual case), so a JSON decode failure is
        reported as an API error rather than crashing.
        """
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

    # -- paging ------------------------------------------------------------

    @staticmethod
    def _items(body):
        """Normalise `body.items` into a list.

        The API returns an empty string instead of an empty list when nothing
        matches, and a bare object instead of a list for a single hit.
        """
        items = (body.get("items") or {}) if isinstance(body.get("items"), dict) else {}
        item = items.get("item")
        if item is None:
            return []
        return item if isinstance(item, list) else [item]

    def iter_items(self, operation, params, page_size=100, max_pages=None):
        """Yield every item across pages, stopping at totalCount."""
        page = 1
        seen = 0
        while True:
            body = self._get(
                operation, {**params, "numOfRows": page_size, "pageNo": page}
            )
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

    # -- operations --------------------------------------------------------

    def area_based_list(self, content_type_id=None, area_code=None, sigungu_code=None, **kwargs):
        """지역기반 관광정보 조회."""
        params = {
            "areaCode": area_code if area_code is not None else settings.TOURAPI_AREA_CODE,
            "sigunguCode": (
                sigungu_code if sigungu_code is not None else settings.TOURAPI_SIGUNGU_CODE
            ),
            "arrange": "C",  # 수정일순
        }
        if content_type_id is not None:
            params["contentTypeId"] = content_type_id
        params.update(kwargs)
        return self.iter_items("areaBasedList2", params)

    def search_festival(
        self,
        event_start_date,
        ldong_regn_cd=None,
        ldong_signgu_cd=None,
        **kwargs,
    ):
        """행사정보 조회. `event_start_date` is YYYYMMDD."""
        params = {
            "eventStartDate": event_start_date,
            "lDongRegnCd": (
                ldong_regn_cd if ldong_regn_cd is not None else settings.TOURAPI_LDONG_REGN_CD
            ),
            "lDongSignguCd": (
                ldong_signgu_cd
                if ldong_signgu_cd is not None
                else settings.TOURAPI_LDONG_SIGNGU_CD
            ),
            "arrange": "C",
        }
        params.update(kwargs)
        return self.iter_items("searchFestival2", params)


    def detail_common(self, content_id):
        """공통정보 조회 — overview, homepage. Returns a dict or None."""
        body = self._get("detailCommon2", {"contentId": content_id, "numOfRows": 1, "pageNo": 1})
        items = self._items(body)
        return items[0] if items else None

    def detail_intro(self, content_id, content_type_id):
        """소개정보 조회 — 운영시간, 입장료, 주차. Returns a dict or None."""
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
