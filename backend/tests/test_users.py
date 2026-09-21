from base64 import b64encode
import json

from fastapi.testclient import TestClient
from itsdangerous import TimestampSigner
import pytest

from app.config import get_settings


def set_session(client: TestClient, user_no: int | None) -> None:
    if user_no is None:
        client.cookies.delete("session")
        return
    payload = b64encode(json.dumps({"user": {"user_no": user_no}}).encode())
    client.cookies.set(
        "session",
        TimestampSigner(get_settings().session_secret_key).sign(payload).decode(),
    )


@pytest.fixture(autouse=True)
def signed_in_user_client(client: TestClient) -> None:
    set_session(client, 1)


def test_user_preferences_follow_session_not_user_header(client: TestClient, insert) -> None:
    insert("USERS", NO=2, ID="second-user", NICKNAME="second", COUNTRY="KR", EMAIL="second@example.com", LANGUAGE_CODE="en")

    set_session(client, None)
    assert client.get("/api/v1/users/me/preferences", headers={"X-User-No": "1"}).status_code == 401

    set_session(client, 2)
    assert client.get("/api/v1/users/me/preferences", headers={"X-User-No": "1"}).json() == {"language": "en"}
    assert client.patch("/api/v1/users/me/preferences", json={"language": "ja"}).json() == {"language": "ja"}

    set_session(client, 1)
    assert client.get("/api/v1/users/me/preferences").json() == {"language": "ko"}


def test_user_preferences_follow_saved_language(client) -> None:
    headers = {"X-User-No": "1"}

    initial = client.get("/api/v1/users/me/preferences", headers=headers)
    assert initial.status_code == 200
    assert initial.json() == {"language": "ko"}

    updated = client.patch(
        "/api/v1/users/me/preferences",
        headers=headers,
        json={"language": "ja"},
    )
    assert updated.status_code == 200
    assert updated.json() == {"language": "ja"}

    persisted = client.get("/api/v1/users/me/preferences", headers=headers)
    assert persisted.json() == {"language": "ja"}


def test_user_preferences_reject_unsupported_language(client) -> None:
    response = client.patch(
        "/api/v1/users/me/preferences",
        headers={"X-User-No": "1"},
        json={"language": "fr"},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_profile_update_keeps_birth_date_and_rejects_blank_nickname(client, insert, rows) -> None:
    insert("USERS", NO=3, ID="third-user", NICKNAME="third", COUNTRY="KR", EMAIL="third@example.com", BIRTH_DATE="2000-01-02")
    set_session(client, 3)

    saved = client.put("/api/v1/auth/update-user", json={"nickname": "새 이름", "country": "KR", "email": "third@example.com"})
    blank = client.put("/api/v1/auth/update-user", json={"nickname": "  ", "country": "KR", "email": "third@example.com"})

    assert saved.status_code == 200
    assert blank.status_code == 422
    user = rows("SELECT NICKNAME, BIRTH_DATE FROM USERS WHERE NO = 3")[0]
    assert user["NICKNAME"] == "새 이름"
    assert user["BIRTH_DATE"].isoformat() == "2000-01-02"


def test_kakao_cancel_returns_to_one_frontend_url(client) -> None:
    response = client.get("/api/v1/auth/kakao/callback?error=access_denied", follow_redirects=False)

    assert response.status_code == 302
    assert response.headers["location"] == f"{get_settings().frontend_url}?error=KAKAO_LOGIN_ERROR"
    assert "," not in response.headers["location"]
