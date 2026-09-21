import pytest

from app import content_guardrails as guardrails
from test_spot_operations import SPOT_BODY


@pytest.mark.parametrize("target", ["spot", "comment"])
def test_approved_content_is_immediately_visible_to_another_user(client, session_headers, rows, target):
    spot = client.post("/api/v1/spots", headers=session_headers(1), json=SPOT_BODY).json()
    path = "/api/v1/spots"
    result = spot
    if target == "comment":
        path += f"/{spot['id']}/comments"
        response = client.post(path, headers=session_headers(1), json={"content": "다음 여행에 가볼게요."})
        assert response.status_code == 201
        result = response.json()
    assert result["moderationStatus"] == 1
    assert result["id"] in [item["id"] for item in client.get(path).json()]
    logs = rows("SELECT PROVIDER, RESULT FROM MODERATION_LOG WHERE TARGET_TYPE = %s AND TARGET_IDX = %s", (1 if target == "spot" else 2, result["id"]))
    assert logs == [{"PROVIDER": "OPENAI", "RESULT": 1}]
    if target == "comment":
        assert client.get("/api/v1/spots").json()[0]["commentCount"] == 1


@pytest.mark.parametrize("target", ["spot", "comment"])
@pytest.mark.parametrize("error,status,code", [
    (guardrails.ContentRejectedError, 422, "CONTENT_REJECTED"),
    (guardrails.InvalidModerationImageError, 422, "INVALID_MODERATION_IMAGE"),
])
def test_rejected_or_failed_review_does_not_create_pending_or_public_content(client, session_headers, rows, monkeypatch, target, error, status, code):
    path, body, table = "/api/v1/spots", SPOT_BODY, "SPOTS"
    if target == "comment":
        spot = client.post(path, headers=session_headers(1), json=body).json()
        path += f"/{spot['id']}/comments"
        body, table = {"content": "검수 대상"}, "SPOT_COMMENT"
    def reject(*args):
        raise error
    monkeypatch.setattr(guardrails, "check_content", reject)
    response = client.post(path, headers=session_headers(1), json=body)
    assert response.status_code == status
    assert response.json()["error"]["code"] == code
    assert rows(f"SELECT COUNT(*) AS n FROM {table}")[0]["n"] == 0


@pytest.mark.parametrize("target", ["spot", "comment"])
def test_unavailable_review_keeps_post_private(client, session_headers, rows, monkeypatch, target):
    path, body = "/api/v1/spots", SPOT_BODY
    if target == "comment":
        spot = client.post(path, headers=session_headers(1), json=body).json()
        path += f"/{spot['id']}/comments"
        body = {"content": "검수 대상"}
    def unavailable(*args):
        raise guardrails.ModerationUnavailableError
    monkeypatch.setattr(guardrails, "check_content", unavailable)
    response = client.post(path, headers=session_headers(1), json=body)
    assert response.status_code == 201
    assert response.json()["moderationStatus"] == 0
    assert response.json()["id"] not in [item["id"] for item in client.get(path).json()]
    assert rows("SELECT COUNT(*) AS n FROM MODERATION_LOG WHERE TARGET_TYPE = %s", (1 if target == "spot" else 2,))[0]["n"] == 0


def test_approval_log_failure_rolls_back_post(client, session_headers, rows, monkeypatch):
    def fail(*args, **kwargs):
        raise RuntimeError("audit unavailable")
    monkeypatch.setattr(guardrails.ContentApproval, "log", fail)
    with pytest.raises(RuntimeError, match="audit unavailable"):
        client.post("/api/v1/spots", headers=session_headers(1), json=SPOT_BODY)
    assert rows("SELECT COUNT(*) AS n FROM SPOTS")[0]["n"] == 0


@pytest.mark.parametrize("target", ["spot", "comment"])
@pytest.mark.parametrize("error,expected,status", [
    (None, "approved", 1),
    (guardrails.ContentRejectedError, "rejected", 2),
    (guardrails.ModerationUnavailableError, "retry", 0),
])
def test_existing_pending_content_is_reviewed_instead_of_blindly_approved(database, insert, rows, monkeypatch, target, error, expected, status):
    from review_pending_spots import review_pending
    spot_id = insert("SPOTS", USER_NO=1, MAP_PROVIDER="KAKAO", MAP_PLACE_ID="1", PLACE_TYPE="TOUR", PLACE_NAME="경주", LAT=35.8, LNG=129.2, CAPTION="여행 후기", MODERATION_STATUS=0)
    target_id, table = spot_id, "SPOTS"
    if target == "comment":
        target_id = insert("SPOT_COMMENT", SPOT_IDX=spot_id, USER_NO=1, CONTENT="댓글", MODERATION_STATUS=0)
        table = "SPOT_COMMENT"
    if error:
        def reject(*args):
            raise error
        monkeypatch.setattr(guardrails, "check_content", reject)
    assert review_pending(database, target, target_id) == expected
    assert rows(f"SELECT MODERATION_STATUS FROM {table} WHERE IDX = %s", (target_id,))[0]["MODERATION_STATUS"] == status
    if status:
        assert review_pending(database, target, target_id) == "skipped"
