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
