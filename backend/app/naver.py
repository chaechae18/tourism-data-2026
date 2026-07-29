from dataclasses import dataclass
from hashlib import sha256
from html import unescape
import re
from typing import Any

import httpx

from .models.common import PlaceProvider
from .models.places import (
    PlaceSearchItem,
    PlaceSearchMeta,
    PlaceSearchResponse,
)


NAVER_LOCAL_SEARCH_URL = (
    "https://openapi.naver.com/v1/search/local.json"
)
HTML_TAG_PATTERN = re.compile(r"<[^>]+>")


class NaverNotConfiguredError(RuntimeError):
    pass


@dataclass
class NaverUpstreamError(RuntimeError):
    status_code: int | None = None


class NaverLocalClient:
    def __init__(
        self,
        client_id: str,
        client_secret: str,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.client_id = client_id
        self.client_secret = client_secret
        self.client = client

    async def search_places(
        self,
        *,
        query: str,
        page: int = 1,
        size: int = 5,
    ) -> PlaceSearchResponse:
        if not self.client_id or not self.client_secret:
            raise NaverNotConfiguredError

        display = min(size, 5)
        start = ((page - 1) * display) + 1
        params = {
            "query": query,
            "display": display,
            "start": start,
            "sort": "random",
        }
        try:
            if self.client:
                response = await self.client.get(
                    NAVER_LOCAL_SEARCH_URL,
                    params=params,
                    headers=self._headers(),
                )
            else:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    response = await client.get(
                        NAVER_LOCAL_SEARCH_URL,
                        params=params,
                        headers=self._headers(),
                    )
            response.raise_for_status()
        except httpx.HTTPStatusError as error:
            raise NaverUpstreamError(error.response.status_code) from error
        except httpx.HTTPError as error:
            raise NaverUpstreamError from error

        payload = response.json()
        items = payload.get("items", [])
        total = int(payload.get("total", 0))
        return PlaceSearchResponse(
            meta=PlaceSearchMeta(
                totalCount=total,
                pageableCount=total,
                isEnd=start + len(items) > total or len(items) < display,
            ),
            places=[self._map_place(item) for item in items],
        )

    def _headers(self) -> dict[str, str]:
        return {
            "X-Naver-Client-Id": self.client_id,
            "X-Naver-Client-Secret": self.client_secret,
        }

    @classmethod
    def _map_place(cls, item: dict[str, Any]) -> PlaceSearchItem:
        name = cls._plain_text(item.get("title", ""))
        address = cls._plain_text(item.get("address", ""))
        road_address = cls._plain_text(item.get("roadAddress", ""))
        longitude = cls._coordinate(item.get("mapx", 0), maximum=180)
        latitude = cls._coordinate(item.get("mapy", 0), maximum=90)
        raw_id = "|".join(
            [
                item.get("link", ""),
                name,
                road_address or address,
                str(item.get("mapx", "")),
                str(item.get("mapy", "")),
            ]
        )
        return PlaceSearchItem(
            provider=PlaceProvider.NAVER,
            id=sha256(raw_id.encode("utf-8")).hexdigest()[:24],
            name=name,
            address=address,
            roadAddress=road_address,
            latitude=latitude,
            longitude=longitude,
            categoryName=cls._plain_text(item.get("category", "")),
            placeUrl=item.get("link", ""),
        )

    @staticmethod
    def _plain_text(value: str) -> str:
        return unescape(HTML_TAG_PATTERN.sub("", value)).strip()

    @staticmethod
    def _coordinate(value: str | int, *, maximum: int) -> float:
        coordinate = float(value)
        if abs(coordinate) > maximum:
            coordinate /= 10_000_000
        return coordinate
