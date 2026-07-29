import asyncio
from urllib.parse import parse_qs

import httpx
import pytest

from app.kakao import KakaoLocalClient, KakaoNotConfiguredError


def test_search_places_maps_kakao_response() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["Authorization"] == "KakaoAK test-key"
        query = parse_qs(request.url.query.decode())
        assert query["query"] == ["첨성대"]
        assert query["x"] == ["129.2191"]
        assert query["y"] == ["35.8347"]
        return httpx.Response(
            200,
            json={
                "meta": {
                    "total_count": 1,
                    "pageable_count": 1,
                    "is_end": True,
                },
                "documents": [
                    {
                        "id": "12345",
                        "place_name": "첨성대",
                        "category_name": "여행 > 관광,명소",
                        "category_group_code": "AT4",
                        "category_group_name": "관광명소",
                        "phone": "",
                        "address_name": "경북 경주시 인왕동 839-1",
                        "road_address_name": "경북 경주시 첨성로 140-25",
                        "x": "129.2191",
                        "y": "35.8347",
                        "place_url": "http://place.map.kakao.com/12345",
                        "distance": "120",
                    }
                ],
            },
        )

    async def search():
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(handler)
        ) as http_client:
            return await KakaoLocalClient(
                "test-key",
                client=http_client,
            ).search_places(
                query="첨성대",
                longitude=129.2191,
                latitude=35.8347,
                radius=5_000,
                sort="distance",
            )

    result = asyncio.run(search())

    assert result.meta.total_count == 1
    assert result.places[0].provider.value == "KAKAO"
    assert result.places[0].id == "12345"
    assert result.places[0].name == "첨성대"
    assert result.places[0].latitude == 35.8347
    assert result.places[0].distance == 120


def test_search_places_requires_api_key() -> None:
    with pytest.raises(KakaoNotConfiguredError):
        asyncio.run(KakaoLocalClient("").search_places(query="첨성대"))
