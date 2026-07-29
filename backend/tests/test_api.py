from pathlib import Path

from fastapi.testclient import TestClient

from app.database import connect, get_database, initialize_database
from app.kakao import KakaoLocalClient
from app.main import app
from app.naver import NaverLocalClient
from app.routers.places import get_kakao_client, get_naver_client


SPOT_BODY = {
    "place": {
        "id": "12345",
        "name": "첨성대",
        "address": "경북 경주시 인왕동 839-1",
        "roadAddress": "경북 경주시 첨성로 140-25",
        "latitude": 35.8347,
        "longitude": 129.2191,
        "categoryName": "여행 > 관광,명소",
        "categoryGroupCode": "AT4",
        "categoryGroupName": "관광명소",
        "phone": "",
        "placeUrl": "http://place.map.kakao.com/12345",
    },
    "placeType": "TOUR",
    "caption": "해 질 무렵의 첨성대가 아름다워요.",
    "photoUrl": "https://example.com/cheomseongdae.jpg",
}


def test_register_and_list_my_spots(tmp_path: Path) -> None:
    database_path = tmp_path / "api.db"
    initialize_database(database_path)

    def override_database():
        with connect(database_path) as connection:
            yield connection

    app.dependency_overrides[get_database] = override_database
    try:
        client = TestClient(app)
        response = client.post(
            "/api/v1/spots",
            headers={"X-User-No": "1"},
            json=SPOT_BODY,
        )
        assert response.status_code == 201
        assert response.json()["place"]["mapPlaceId"] == "12345"
        assert response.json()["moderationStatus"] == 0

        list_response = client.get(
            "/api/v1/spots/me",
            headers={"X-User-No": "1"},
        )
        assert list_response.status_code == 200
        assert [spot["caption"] for spot in list_response.json()] == [
            "해 질 무렵의 첨성대가 아름다워요."
        ]
    finally:
        app.dependency_overrides.clear()


def test_search_returns_config_error_without_kakao_key() -> None:
    app.dependency_overrides[get_kakao_client] = lambda: KakaoLocalClient("")
    app.dependency_overrides[get_naver_client] = lambda: NaverLocalClient("", "")
    try:
        response = TestClient(app).get(
            "/api/v1/places/search",
            params={"query": "첨성대"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 503
    assert response.json() == {
        "error": {
            "code": "PLACE_SEARCH_NOT_CONFIGURED",
            "message": "장소 검색 API 키가 설정되지 않았습니다.",
        }
    }
