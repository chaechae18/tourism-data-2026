from pathlib import Path

from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.database import connect, get_database, initialize_database
from app.main import app


SPOT_BODY = {
    "place": {
        "provider": "KAKAO",
        "id": "8089382",
        "name": "첨성대",
        "address": "경북 경주시 인왕동 839-1",
        "roadAddress": "",
        "latitude": 35.8347,
        "longitude": 129.2191,
        "categoryName": "여행 > 관광,명소",
        "categoryGroupCode": "AT4",
        "categoryGroupName": "관광명소",
        "phone": "",
        "placeUrl": "http://place.map.kakao.com/8089382",
    },
    "placeType": "TOUR",
    "caption": "밤에 다시 보고 싶은 장소예요.",
    "photoUrl": None,
}


def test_public_spot_interactions_and_owner_delete(tmp_path: Path) -> None:
    database_path = tmp_path / "api.db"
    initialize_database(database_path)
    with connect(database_path) as connection:
        connection.execute(
            """
            INSERT INTO USERS (NO, ID, NICKNAME, COUNTRY, EMAIL)
            VALUES (2, 'other-user', 'other', 'KR', 'other@example.com')
            """
        )
        connection.commit()

    def override_database():
        with connect(database_path) as connection:
            yield connection

    def override_settings() -> Settings:
        return Settings(
            kakao_rest_api_key="",
            naver_client_id="",
            naver_client_secret="",
            database_path=database_path,
            upload_dir=tmp_path / "uploads",
            max_upload_bytes=10 * 1024 * 1024,
            search_cache_ttl_seconds=300,
            search_rate_limit=30,
            search_rate_window_seconds=60,
            admin_api_key="test-admin-key",
            cors_origins=("http://localhost:3000",),
        )

    app.dependency_overrides[get_database] = override_database
    app.dependency_overrides[get_settings] = override_settings
    try:
        client = TestClient(app)
        created = client.post(
            "/api/v1/spots",
            headers={"X-User-No": "1"},
            json=SPOT_BODY,
        )
        assert created.status_code == 201
        spot_id = created.json()["id"]
        assert client.get("/api/v1/spots").json() == []

        approved = client.patch(
            f"/api/v1/admin/spot/{spot_id}/moderation",
            headers={"X-Admin-Key": "test-admin-key"},
            json={"status": 1},
        )
        assert approved.status_code == 200

        liked = client.put(
            f"/api/v1/spots/{spot_id}/reactions/like",
            headers={"X-User-No": "1"},
        )
        client.put(
            f"/api/v1/spots/{spot_id}/reactions/like",
            headers={"X-User-No": "1"},
        )
        bookmarked = client.put(
            f"/api/v1/spots/{spot_id}/reactions/bookmark",
            headers={"X-User-No": "1"},
        )
        assert liked.json()["likeCount"] == 1
        assert bookmarked.json()["active"] is True

        public = client.get(
            "/api/v1/spots",
            headers={"X-User-No": "1"},
        ).json()
        assert public[0]["isLiked"] is True
        assert public[0]["isBookmarked"] is True
        assert public[0]["isOwner"] is True
        assert public[0]["likeCount"] == 1

        comment = client.post(
            f"/api/v1/spots/{spot_id}/comments",
            headers={"X-User-No": "1"},
            json={"content": "야경이 정말 좋아요."},
        )
        assert comment.status_code == 201
        comment_id = comment.json()["id"]
        assert comment.json()["moderationStatus"] == 0
        assert client.get(f"/api/v1/spots/{spot_id}/comments").json() == []
        own_comments = client.get(
            f"/api/v1/spots/{spot_id}/comments",
            headers={"X-User-No": "1"},
        ).json()
        assert len(own_comments) == 1

        client.patch(
            f"/api/v1/admin/comment/{comment_id}/moderation",
            headers={"X-Admin-Key": "test-admin-key"},
            json={"status": 1},
        )
        assert len(client.get(f"/api/v1/spots/{spot_id}/comments").json()) == 1

        forbidden = client.delete(
            f"/api/v1/spots/{spot_id}",
            headers={"X-User-No": "2"},
        )
        assert forbidden.status_code == 403
        deleted = client.delete(
            f"/api/v1/spots/{spot_id}",
            headers={"X-User-No": "1"},
        )
        assert deleted.status_code == 204
        assert client.get("/api/v1/spots").json() == []
    finally:
        app.dependency_overrides.clear()
