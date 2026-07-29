import asyncio
from urllib.parse import parse_qs

import httpx

from app.naver import NaverLocalClient


def test_search_places_maps_naver_response() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["X-Naver-Client-Id"] == "client-id"
        assert request.headers["X-Naver-Client-Secret"] == "client-secret"
        query = parse_qs(request.url.query.decode())
        assert query["query"] == ["첨성대"]
        assert query["display"] == ["5"]
        return httpx.Response(
            200,
            json={
                "total": 1,
                "start": 1,
                "display": 1,
                "items": [
                    {
                        "title": "<b>첨성대</b>",
                        "link": "https://map.naver.com/p/entry/place/123",
                        "category": "여행,명소>문화재",
                        "description": "",
                        "telephone": "",
                        "address": "경상북도 경주시 인왕동 839-1",
                        "roadAddress": "경상북도 경주시 첨성로 140-25",
                        "mapx": "1292191020",
                        "mapy": "358347012",
                    }
                ],
            },
        )

    async def search():
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(handler)
        ) as http_client:
            return await NaverLocalClient(
                "client-id",
                "client-secret",
                client=http_client,
            ).search_places(query="첨성대", size=15)

    result = asyncio.run(search())

    assert result.meta.total_count == 1
    assert result.places[0].provider.value == "NAVER"
    assert result.places[0].name == "첨성대"
    assert result.places[0].longitude == 129.219102
    assert result.places[0].latitude == 35.8347012
