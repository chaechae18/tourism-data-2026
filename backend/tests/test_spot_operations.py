import pymysql
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.main import app


SPOT_BODY = {"place": {"provider": "KAKAO", "id": "8089382", "name": "첨성대", "address": "경북 경주시 인왕동 839-1", "roadAddress": "", "latitude": 35.8347, "longitude": 129.2191, "categoryName": "여행 > 관광,명소", "categoryGroupCode": "AT4", "categoryGroupName": "관광명소", "phone": "", "placeUrl": "http://place.map.kakao.com/8089382"}, "placeType": "TOUR", "caption": "밤에 다시 보고 싶은 장소예요.", "photoUrl": None}


def test_public_spot_interactions_and_owner_delete(client: TestClient, database: pymysql.Connection, tmp_path) -> None:
    with database.cursor() as cursor:
        cursor.execute("INSERT INTO USERS (NO, ID, NICKNAME, COUNTRY, EMAIL) VALUES (2, 'other-user', 'other', 'KR', 'other@example.com')")
    app.dependency_overrides[get_settings] = lambda: Settings(
        kakao_rest_api_key="", naver_client_id="", naver_client_secret="", upload_dir=tmp_path / "uploads",
        max_upload_bytes=10 * 1024 * 1024, search_cache_ttl_seconds=300, search_rate_limit=30,
        search_rate_window_seconds=60, admin_api_key="test-admin-key", cors_origins=("http://localhost:3000",),
    )
    try:
        created = client.post("/api/v1/spots", headers={"X-User-No": "1"}, json=SPOT_BODY)
        spot_id = created.json()["id"]
        assert client.get("/api/v1/spots").json() == []
        assert client.patch(f"/api/v1/admin/spot/{spot_id}/moderation", headers={"X-Admin-Key": "test-admin-key"}, json={"status": 1}).status_code == 200
        assert client.put(f"/api/v1/spots/{spot_id}/reactions/like", headers={"X-User-No": "1"}).json()["likeCount"] == 1
        assert client.put(f"/api/v1/spots/{spot_id}/reactions/bookmark", headers={"X-User-No": "1"}).json()["active"] is True
        public = client.get("/api/v1/spots", headers={"X-User-No": "1"}).json()[0]
        assert public["isLiked"] and public["isBookmarked"] and public["isOwner"]
        comment = client.post(f"/api/v1/spots/{spot_id}/comments", headers={"X-User-No": "1"}, json={"content": "야경이 정말 좋아요."}).json()
        assert client.get(f"/api/v1/spots/{spot_id}/comments").json() == []
        assert len(client.get(f"/api/v1/spots/{spot_id}/comments", headers={"X-User-No": "1"}).json()) == 1
        assert client.patch(f"/api/v1/admin/comment/{comment['id']}/moderation", headers={"X-Admin-Key": "test-admin-key"}, json={"status": 1}).status_code == 200
        assert len(client.get(f"/api/v1/spots/{spot_id}/comments").json()) == 1
        assert client.delete(f"/api/v1/spots/{spot_id}", headers={"X-User-No": "2"}).status_code == 403
        assert client.delete(f"/api/v1/spots/{spot_id}", headers={"X-User-No": "1"}).status_code == 204
    finally:
        app.dependency_overrides.pop(get_settings, None)
