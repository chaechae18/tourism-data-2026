from base64 import b64encode
from io import BytesIO
import json

from fastapi.testclient import TestClient
from itsdangerous import TimestampSigner
from PIL import Image

from app.config import Settings, get_settings
from app.main import app


# SessionMiddleware 는 앱을 만들 때 시크릿을 굳히므로 설정 override 로는 못 바꾼다.
def set_session(client: TestClient, user_no: int) -> None:
    payload = b64encode(json.dumps({"user": {"user_no": user_no}}).encode())
    client.cookies.set(
        "session",
        TimestampSigner(get_settings().session_secret_key).sign(payload).decode(),
    )


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
        session_secret_key="test-only-session-secret",
    )
    try:
        set_session(client, 1)
        image = create_png()
        response = client.post("/api/v1/uploads/images", files={"file": ("spot.png", image, "image/png")})
    finally:
        app.dependency_overrides.pop(get_settings, None)
    assert response.status_code == 201
    payload = response.json()
    assert payload["contentType"] == "image/png"
    assert (upload_dir / payload["filename"]).read_bytes() == image


def test_upload_rejects_non_image(client: TestClient) -> None:
    set_session(client, 1)
    response = client.post("/api/v1/uploads/images", files={"file": ("fake.png", b"not-an-image", "image/png")})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_IMAGE"
