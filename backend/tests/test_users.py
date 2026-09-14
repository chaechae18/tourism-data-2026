from base64 import b64encode
import json

from fastapi.testclient import TestClient
from itsdangerous import TimestampSigner
import pytest


def set_session(client: TestClient, user_no: int | None) -> None:
    if user_no is None:
        client.cookies.delete("session")
        return
    payload = b64encode(json.dumps({"user": {"user_no": user_no}}).encode())
    client.cookies.set(
        "session",
        TimestampSigner("dev-session-secret-key-change-this").sign(payload).decode(),
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
