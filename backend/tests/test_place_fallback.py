from pathlib import Path

from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.kakao import KakaoUpstreamError
from app.main import app
from app.models.common import PlaceProvider
from app.models.places import (
    PlaceSearchItem,
    PlaceSearchMeta,
    PlaceSearchResponse,
)
from app.routers.places import (
    get_kakao_client,
    get_naver_client,
    search_cache,
    search_rate_limiter,
)


class FailingKakao:
    async def search_places(self, **_):
        raise KakaoUpstreamError(500)


class WorkingNaver:
    def __init__(self) -> None:
        self.calls = 0

    async def search_places(self, **_):
        self.calls += 1
        return PlaceSearchResponse(
            meta=PlaceSearchMeta(
                totalCount=1,
                pageableCount=1,
                isEnd=True,
            ),
            places=[
                PlaceSearchItem(
                    provider=PlaceProvider.NAVER,
                    id="naver-place",
                    name="첨성대",
                    latitude=35.8347,
                    longitude=129.2191,
                )
            ],
        )


class WorkingNearbyKakao:
    def __init__(self) -> None:
        self.calls: list[str] = []

    async def search_places_by_category(
        self,
        *,
        category_group_code: str,
        **_,
    ) -> PlaceSearchResponse:
        self.calls.append(category_group_code)
        distances = {"AT4": 300, "FD6": 100, "CE7": 200}
        names = {"AT4": "첨성대", "FD6": "교리김밥", "CE7": "카페능"}
        return PlaceSearchResponse(
            meta=PlaceSearchMeta(
                totalCount=1,
                pageableCount=1,
                isEnd=True,
            ),
            places=[
                PlaceSearchItem(
                    provider=PlaceProvider.KAKAO,
                    id=category_group_code,
                    name=names[category_group_code],
                    latitude=35.8347,
                    longitude=129.2191,
                    categoryGroupCode=category_group_code,
                    distance=distances[category_group_code],
                )
            ],
        )


def settings(tmp_path: Path, *, rate_limit: int = 30) -> Settings:
    return Settings(
        kakao_rest_api_key="",
        naver_client_id="client-id",
        naver_client_secret="client-secret",
        upload_dir=tmp_path / "uploads",
        max_upload_bytes=10 * 1024 * 1024,
        search_cache_ttl_seconds=300,
        search_rate_limit=rate_limit,
        search_rate_window_seconds=60,
        admin_api_key="test-admin-key",
        cors_origins=("http://localhost:3000",),
    )


def test_search_falls_back_to_naver_and_caches_result(
    tmp_path: Path,
) -> None:
    naver = WorkingNaver()
    search_cache.clear()
    search_rate_limiter.clear()
    app.dependency_overrides[get_settings] = lambda: settings(tmp_path)
    app.dependency_overrides[get_kakao_client] = lambda: FailingKakao()
    app.dependency_overrides[get_naver_client] = lambda: naver
    try:
        client = TestClient(app)
        first = client.get(
            "/api/v1/places/search",
            params={"query": "첨성대"},
        )
        second = client.get(
            "/api/v1/places/search",
            params={"query": "첨성대"},
        )
    finally:
        app.dependency_overrides.clear()
        search_cache.clear()
        search_rate_limiter.clear()

    assert first.status_code == 200
    assert first.headers["X-Place-Provider"] == "NAVER"
    assert first.headers["X-Search-Cache"] == "MISS"
    assert first.json()["places"][0]["provider"] == "NAVER"
    assert second.headers["X-Search-Cache"] == "HIT"
    assert naver.calls == 1


def test_search_rate_limit_returns_retry_after(tmp_path: Path) -> None:
    naver = WorkingNaver()
    search_cache.clear()
    search_rate_limiter.clear()
    app.dependency_overrides[get_settings] = lambda: settings(
        tmp_path,
        rate_limit=1,
    )
    app.dependency_overrides[get_kakao_client] = lambda: FailingKakao()
    app.dependency_overrides[get_naver_client] = lambda: naver
    try:
        client = TestClient(app)
        first = client.get(
            "/api/v1/places/search",
            params={"query": "첨성대"},
        )
        second = client.get(
            "/api/v1/places/search",
            params={"query": "첨성대"},
        )
    finally:
        app.dependency_overrides.clear()
        search_cache.clear()
        search_rate_limiter.clear()

    assert first.status_code == 200
    assert second.status_code == 429
    assert second.headers["Retry-After"]
    assert second.json()["error"]["code"] == "SEARCH_RATE_LIMITED"


def test_nearby_search_merges_categories_by_distance_and_caches(
    tmp_path: Path,
) -> None:
    kakao = WorkingNearbyKakao()
    search_cache.clear()
    search_rate_limiter.clear()
    app.dependency_overrides[get_settings] = lambda: settings(tmp_path)
    app.dependency_overrides[get_kakao_client] = lambda: kakao
    try:
        client = TestClient(app)
        first = client.get(
            "/api/v1/places/nearby",
            params={
                "longitude": 129.2191,
                "latitude": 35.8347,
                "radius": 2_000,
            },
        )
        second = client.get(
            "/api/v1/places/nearby",
            params={
                "longitude": 129.21911,
                "latitude": 35.83471,
                "radius": 2_000,
            },
        )
    finally:
        app.dependency_overrides.clear()
        search_cache.clear()
        search_rate_limiter.clear()

    assert first.status_code == 200
    assert first.headers["X-Place-Provider"] == "KAKAO"
    assert first.headers["X-Search-Cache"] == "MISS"
    assert [place["name"] for place in first.json()["places"]] == [
        "교리김밥",
        "카페능",
        "첨성대",
    ]
    assert second.headers["X-Search-Cache"] == "HIT"
    assert kakao.calls == ["AT4", "FD6", "CE7"]
