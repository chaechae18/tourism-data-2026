from io import BytesIO

from fastapi.testclient import TestClient
from PIL import Image

from app.config import Settings, get_settings
from app.main import app


def create_png() -> bytes:
    output = BytesIO()
    Image.new("RGB", (1, 1), color="white").save(output, format="PNG")
    return output.getvalue()


def test_upload_image_returns_local_url(client: TestClient, tmp_path) -> None:
    upload_dir = tmp_path / "uploads"
    app.dependency_overrides[get_settings] = lambda: Settings(
        kakao_rest_api_key="", naver_client_id="", naver_client_secret="", upload_dir=upload_dir,
        max_upload_bytes=10 * 1024 * 1024, search_cache_ttl_seconds=300, search_rate_limit=30,
        search_rate_window_seconds=60, admin_api_key="", cors_origins=("http://localhost:3000",),
    )
    try:
        image = create_png()
        response = client.post("/api/v1/uploads/images", headers={"X-User-No": "1"}, files={"file": ("spot.png", image, "image/png")})
    finally:
        app.dependency_overrides.pop(get_settings, None)
    assert response.status_code == 201
    payload = response.json()
    assert payload["contentType"] == "image/png"
    assert (upload_dir / payload["filename"]).read_bytes() == image


def test_upload_rejects_non_image(client: TestClient) -> None:
    response = client.post("/api/v1/uploads/images", headers={"X-User-No": "1"}, files={"file": ("fake.png", b"not-an-image", "image/png")})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_IMAGE"
