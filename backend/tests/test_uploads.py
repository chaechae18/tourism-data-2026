from io import BytesIO
from pathlib import Path

from fastapi.testclient import TestClient
from PIL import Image

from app.config import Settings, get_settings
from app.database import connect, get_database, initialize_database
from app.main import app


def create_png() -> bytes:
    output = BytesIO()
    Image.new("RGB", (1, 1), color="white").save(output, format="PNG")
    return output.getvalue()


def test_upload_image_returns_local_url(tmp_path: Path) -> None:
    database_path = tmp_path / "api.db"
    upload_dir = tmp_path / "uploads"
    initialize_database(database_path)

    def override_database():
        with connect(database_path) as connection:
            yield connection

    def override_settings() -> Settings:
        return Settings(
            kakao_rest_api_key="",
            naver_client_id="",
            naver_client_secret="",
            database_path=database_path,
            upload_dir=upload_dir,
            max_upload_bytes=10 * 1024 * 1024,
            search_cache_ttl_seconds=300,
            search_rate_limit=30,
            search_rate_window_seconds=60,
            cors_origins=("http://localhost:3000",),
        )

    app.dependency_overrides[get_database] = override_database
    app.dependency_overrides[get_settings] = override_settings
    image = create_png()
    try:
        response = TestClient(app).post(
            "/api/v1/uploads/images",
            headers={"X-User-No": "1"},
            files={"file": ("spot.png", image, "image/png")},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    payload = response.json()
    assert payload["contentType"] == "image/png"
    assert payload["url"].startswith("http://testserver/uploads/")
    assert (upload_dir / payload["filename"]).read_bytes() == image


def test_upload_rejects_non_image(tmp_path: Path) -> None:
    database_path = tmp_path / "api.db"
    initialize_database(database_path)

    def override_database():
        with connect(database_path) as connection:
            yield connection

    app.dependency_overrides[get_database] = override_database
    try:
        response = TestClient(app).post(
            "/api/v1/uploads/images",
            headers={"X-User-No": "1"},
            files={"file": ("fake.png", b"not-an-image", "image/png")},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_IMAGE"
