from dataclasses import dataclass
from typing import Any

import httpx

from .models.places import KakaoPlace, PlaceSearchMeta, PlaceSearchResponse


KAKAO_KEYWORD_SEARCH_URL = (
    "https://dapi.kakao.com/v2/local/search/keyword.json"
)


class KakaoNotConfiguredError(RuntimeError):
    pass


@dataclass
class KakaoUpstreamError(RuntimeError):
    status_code: int | None = None


class KakaoLocalClient:
    def __init__(
        self,
        api_key: str,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.api_key = api_key
        self.client = client

    async def search_places(
        self,
        *,
        query: str,
        page: int = 1,
        size: int = 15,
        category_group_code: str | None = None,
        longitude: float | None = None,
        latitude: float | None = None,
        radius: int | None = None,
        sort: str = "accuracy",
    ) -> PlaceSearchResponse:
        if not self.api_key:
            raise KakaoNotConfiguredError

        params: dict[str, str | int | float] = {
            "query": query,
            "page": page,
            "size": size,
            "sort": sort,
        }
        optional_params = {
            "category_group_code": category_group_code,
            "x": longitude,
            "y": latitude,
            "radius": radius,
        }
        params.update(
            {key: value for key, value in optional_params.items() if value is not None}
        )

        try:
            if self.client:
                response = await self.client.get(
                    KAKAO_KEYWORD_SEARCH_URL,
                    params=params,
                    headers=self._headers(),
                )
            else:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    response = await client.get(
                        KAKAO_KEYWORD_SEARCH_URL,
                        params=params,
                        headers=self._headers(),
                    )
            response.raise_for_status()
        except httpx.HTTPStatusError as error:
            raise KakaoUpstreamError(error.response.status_code) from error
        except httpx.HTTPError as error:
            raise KakaoUpstreamError from error

        payload = response.json()
        return PlaceSearchResponse(
            meta=self._map_meta(payload.get("meta", {})),
            places=[
                self._map_place(document)
                for document in payload.get("documents", [])
            ],
        )

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"KakaoAK {self.api_key}"}

    @staticmethod
    def _map_meta(meta: dict[str, Any]) -> PlaceSearchMeta:
        return PlaceSearchMeta(
            totalCount=meta.get("total_count", 0),
            pageableCount=meta.get("pageable_count", 0),
            isEnd=meta.get("is_end", True),
        )

    @staticmethod
    def _map_place(document: dict[str, Any]) -> KakaoPlace:
        distance = document.get("distance")
        return KakaoPlace(
            id=document["id"],
            name=document["place_name"],
            address=document.get("address_name", ""),
            roadAddress=document.get("road_address_name", ""),
            latitude=float(document["y"]),
            longitude=float(document["x"]),
            categoryName=document.get("category_name", ""),
            categoryGroupCode=document.get("category_group_code", ""),
            categoryGroupName=document.get("category_group_name", ""),
            phone=document.get("phone", ""),
            placeUrl=document.get("place_url", ""),
            distance=int(distance) if distance else None,
        )
