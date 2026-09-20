"""Executable security expectations, intentionally not part of default test discovery.

A failed assertion is an OPEN finding, never xfail/skip or an expected exploit success.
Only the runner's disposable database and synthetic accounts are used.
"""
import json
import os
import socket
from base64 import b64encode
from dataclasses import replace
from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from itsdangerous import TimestampSigner
from PIL import Image

from app.config import get_settings
from app.main import app
from app.routers import auth
from app.routers.translations import get_translate_text
from test_journey import add_places
from test_spot_translation import add_spot
from test_spots import spot_request


def session(client, user_no=1, key=None):
    client.cookies.clear()
    payload = b64encode(json.dumps({"user": {"user_no": user_no}}).encode())
    key = key if key is not None else get_settings().session_secret_key
    client.cookies.set("session", TimestampSigner(key).sign(payload).decode())


def status(response, expected, record_property):
    record_property("observed", f"HTTP {response.status_code}")
    assert response.status_code in expected, f"Expected HTTP {expected}, observed {response.status_code}"


def png():
    output = BytesIO()
    Image.new("RGB", (2, 2)).save(output, "PNG")
    return output.getvalue()


@pytest.mark.redteam("high", "로그인 없이 개인 API 호출 시 401")
@pytest.mark.parametrize("method,path,body", [
    ("GET", "/api/v1/auth/me", None),
    ("GET", "/api/v1/auth/visit-place", None),
    ("DELETE", "/api/v1/auth/withdraw", None),
    ("GET", "/api/v1/journey/course", None),
    ("GET", "/api/v1/donggyeong/inventory?persona=king", None),
    ("PUT", "/api/v1/donggyeong/outfit?persona=king", {"outfit": {}}),
    ("GET", "/api/v1/notifications", None),
    ("GET", "/api/v1/users/me/preferences", None),
])
def test_private_routes_reject_header_only_identity(client, method, path, body, record_property):
    status(client.request(method, path, headers={"X-User-No": "1"}, json=body), (401,), record_property)


@pytest.mark.redteam("critical", "서명된 세션 없이 사용자 번호만 보내면 401, 저장·삭제 없음")
@pytest.mark.parametrize("action", ["create", "delete", "mine", "comment", "like", "upload", "translate"])
def test_spot_routes_reject_anonymous_impersonation(client, insert, rows, action, record_property):
    spot_id = add_spot(insert, CAPTION="redteam-caption", LANGUAGE_CODE="en")
    headers = {"X-User-No": "1"}
    if action == "create":
        response = client.post("/api/v1/spots", headers=headers,
                               json=spot_request("redteam-test").model_dump(by_alias=True, mode="json"))
        record_property("effect", f"spots={len(rows('SELECT IDX FROM SPOTS'))}")
    elif action == "delete":
        response = client.delete(f"/api/v1/spots/{spot_id}", headers=headers)
        record_property("effect", f"deleted={rows('SELECT DELETED_AT FROM SPOTS')[0]['DELETED_AT'] is not None}")
    elif action == "mine":
        response = client.get("/api/v1/spots/me", headers=headers)
    elif action == "comment":
        response = client.post(f"/api/v1/spots/{spot_id}/comments", headers=headers, json={"content": "redteam"})
        record_property("effect", f"comments={len(rows('SELECT IDX FROM SPOT_COMMENT'))}")
    elif action == "like":
        response = client.put(f"/api/v1/spots/{spot_id}/reactions/like", headers=headers)
        record_property("effect", f"reactions={len(rows('SELECT IDX FROM SPOT_REACTIONS'))}")
    elif action == "upload":
        response = client.post("/api/v1/uploads/images", headers=headers, files={"file": ("probe.png", png(), "image/png")})
    else:
        calls = []
        def translate(fields, language):
            calls.append(1)
            return {key: "translated" for key in fields}, "redteam-fake"
        app.dependency_overrides[get_translate_text] = lambda: translate
        response = client.post(f"/api/v1/translations/spot/{spot_id}", headers=headers)
        record_property("effect", f"provider_calls={len(calls)} (fake provider)")
    status(response, (401,), record_property)


@pytest.mark.redteam("critical", "사용자 2의 세션에 사용자 1 헤더를 넣어도 타인 글 삭제 불가")
def test_signed_in_user_cannot_delete_another_users_spot(client, insert, rows, record_property):
    spot_id = add_spot(insert)
    insert("USERS", NO=2, ID="redteam-other", NICKNAME="other", EMAIL="other@example.invalid", COUNTRY="KR")
    session(client, 2)
    response = client.delete(f"/api/v1/spots/{spot_id}", headers={"X-User-No": "1"})
    record_property("effect", f"deleted={rows('SELECT DELETED_AT FROM SPOTS')[0]['DELETED_AT'] is not None}")
    status(response, (403, 404), record_property)
    assert rows("SELECT DELETED_AT FROM SPOTS")[0]["DELETED_AT"] is None


@pytest.mark.redteam("high", "비로그인 조회에서 헤더를 바꿔도 미승인 댓글 비공개")
def test_pending_comment_cannot_be_read_by_spoofing_owner(client, insert, record_property):
    spot_id = add_spot(insert)
    comment_id = insert("SPOT_COMMENT", SPOT_IDX=spot_id, USER_NO=1, CONTENT="private-pending", MODERATION_STATUS=0)
    response = client.get(f"/api/v1/spots/{spot_id}/comments", headers={"X-User-No": "1"})
    status(response, (200,), record_property)
    disclosed = any(item["id"] == comment_id for item in response.json())
    record_property("effect", f"pending_comment_disclosed={disclosed}")
    assert not disclosed


@pytest.mark.redteam("high", "변조하거나 잘못 서명한 쿠키는 401")
@pytest.mark.parametrize("key", ["wrong-key", "", "dev-session-secret-key-change-this"])
def test_forged_session_rejected(client, key, record_property):
    session(client, key=key)
    status(client.get("/api/v1/auth/me"), (401,), record_property)


@pytest.mark.redteam("high", "탈퇴 후 남은 쿠키로 개인정보·방문 기록에 접근 불가")
@pytest.mark.parametrize("path", ["/api/v1/auth/me", "/api/v1/auth/visit-place", "/api/v1/journey/course"])
def test_withdrawn_account_cookie_rejected(client, path, record_property):
    session(client)
    cookie = client.cookies.get("session")
    assert client.delete("/api/v1/auth/withdraw").status_code == 200
    client.cookies.clear()
    client.cookies.set("session", cookie)
    status(client.get(path), (401, 403), record_property)


@pytest.mark.redteam("medium", "로그아웃 전에 복사된 세션 쿠키도 서버에서 무효화")
def test_logout_revokes_copied_cookie(client, record_property):
    session(client)
    cookie = client.cookies.get("session")
    assert client.post("/api/v1/auth/logout").status_code == 200
    client.cookies.clear()
    client.cookies.set("session", cookie)
    status(client.get("/api/v1/auth/me"), (401,), record_property)


@pytest.mark.redteam("high", "OAuth state 누락·불일치 요청은 외부 토큰 교환 전에 차단")
@pytest.mark.parametrize("provider", ["google", "kakao", "naver"])
@pytest.mark.parametrize("state", [None, "attacker-state"])
def test_oauth_state_validation(client, monkeypatch, provider, state, record_property):
    async def unexpected_exchange(*args, **kwargs):
        pytest.fail("OAuth provider called before state validation")
    monkeypatch.setattr(auth, f"get_{provider}_user", unexpected_exchange)
    params = {"code": "synthetic-code"}
    if state:
        params["state"] = state
    status(client.get(f"/api/v1/auth/{provider}/callback", params=params), (400,), record_property)


@pytest.mark.redteam("medium", "HTTPS 서비스에서 발행한 로그인 쿠키는 Secure·HttpOnly·SameSite 설정")
def test_https_session_cookie_flags(client, monkeypatch, record_property):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "redteam-client")
    monkeypatch.setenv("GOOGLE_REDIRECT_URI", "https://testserver/api/v1/auth/google/callback")
    response = client.get("https://testserver/api/v1/auth/google/login", follow_redirects=False)
    assert response.status_code == 302
    cookie = response.headers["set-cookie"].lower()
    record_property("observed", f"Secure={'; secure' in cookie}, HttpOnly={'httponly' in cookie}, SameSite={'samesite=lax' in cookie}")
    assert "; secure" in cookie and "httponly" in cookie and "samesite=lax" in cookie


@pytest.mark.redteam("high", "빈 SESSION_SECRET_KEY로 설정 로딩·서명 기능 시작 불가")
def test_empty_session_key_fails_closed(monkeypatch, record_property):
    monkeypatch.setenv("SESSION_SECRET_KEY", "")
    get_settings.cache_clear()
    try:
        try:
            configured = get_settings()
        except ValueError:
            return
        record_property("observed", f"empty_key_accepted={not configured.session_secret_key}")
        assert configured.session_secret_key, "Empty signing key accepted by settings"
    finally:
        get_settings.cache_clear()


@pytest.mark.redteam("medium", "프론트를 우회한 빈 비밀번호·취약 비밀번호 가입 거부")
@pytest.mark.parametrize("password", ["", "a", "password123"])
def test_signup_enforces_password_policy(client, password, record_property):
    response = client.post("/api/v1/auth/signup", json={
        "id": "redteam-signup", "nickname": "test", "country": "KR",
        "email": "redteam@example.invalid", "password": password, "languageCode": "ko",
    })
    status(response, (400, 422), record_property)


@pytest.mark.redteam("medium", "로그인 JSON 타입 오류는 4xx, 내부 오류 500 없음")
@pytest.mark.parametrize("body", [[], {"id": ["bad"], "password": {"bad": True}}])
def test_login_rejects_malformed_input(client, body, record_property):
    with TestClient(app, raise_server_exceptions=False) as probe:
        status(probe.post("/api/v1/auth/login", json=body), (400, 401, 422), record_property)


@pytest.mark.redteam("medium", "동일 클라이언트의 20회 연속 로그인 실패 중 요청 제한 적용")
def test_login_attempts_are_throttled(client, record_property):
    codes = [client.post("/api/v1/auth/login", json={"id": "nonexistent-redteam", "password": "bad"}).status_code
             for _ in range(20)]
    record_property("observed", f"attempts=20, throttled={codes.count(429)}, unauthorized={codes.count(401)}")
    assert 429 in codes, "No throttle observed in a burst of 20 failed logins"


@pytest.mark.redteam("high", "다른 Origin의 text/plain 로그인 요청 거부")
def test_cross_origin_plain_text_login_rejected(client, monkeypatch, record_property):
    # Valid synthetic credentials isolate the HTTP/CSRF boundary; no external account is used.
    monkeypatch.setattr(auth, "login", lambda *args, **kwargs: {
        "userNo": 1, "userId": "attacker-account", "nickname": "test", "country": "KR",
        "email": "test@example.invalid", "language_code": "ko",
    })
    response = client.post("/api/v1/auth/login", headers={"Origin": "https://attacker.invalid", "Content-Type": "text/plain"},
                           content=json.dumps({"id": "attacker-account", "password": "synthetic"}))
    status(response, (400, 403, 415, 422), record_property)


@pytest.mark.redteam("high", "관리자 키 누락·오류 요청은 데이터 변경 없이 차단")
@pytest.mark.parametrize("headers", [{}, {"X-Admin-Key": "wrong"}])
def test_admin_moderation_requires_key(client, insert, rows, headers, record_property):
    spot_id = add_spot(insert, MODERATION_STATUS=0)
    response = client.patch(f"/api/v1/admin/spot/{spot_id}/moderation", headers=headers, json={"status": 1})
    status(response, (401, 403, 422), record_property)
    assert rows("SELECT MODERATION_STATUS FROM SPOTS")[0]["MODERATION_STATUS"] == 0


@pytest.mark.redteam("high", "아이디 SQL 인젝션 문자열은 일반 문자열로 처리")
def test_sql_injection_in_id_check(client, rows, record_property):
    response = client.get("/api/v1/auth/check-id", params={"id": "' OR 1=1 -- "})
    status(response, (200,), record_property)
    assert response.json()["available"] is True
    assert len(rows("SELECT NO FROM USERS")) == 1
    assert client.get("/api/v1/auth/check-id", params={"id": "local-development-user"}).json()["available"] is False


@pytest.mark.redteam("high", "확장자·MIME으로 위장한 비이미지 파일 거부")
@pytest.mark.parametrize("content", [b"<script>alert(1)</script>", b'<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'])
def test_upload_rejects_active_content(client, content, record_property):
    session(client)
    response = client.post("/api/v1/uploads/images", headers={"X-User-No": "1"}, files={"file": ("image.png", content, "image/png")})
    status(response, (415, 422), record_property)


@pytest.mark.redteam("medium", "업로드 용량 제한 및 경로 탈출 방지")
def test_upload_size_limit(client, record_property):
    session(client)
    app.dependency_overrides[get_settings] = lambda: replace(get_settings(), max_upload_bytes=16)
    response = client.post("/api/v1/uploads/images", headers={"X-User-No": "1"}, files={"file": ("image.png", png(), "image/png")})
    status(response, (413,), record_property)


@pytest.mark.redteam("medium", "사용자 파일명 대신 서버 UUID와 실제 이미지 확장자로 저장")
def test_upload_filename_cannot_escape(client, record_property):
    session(client)
    response = client.post("/api/v1/uploads/images", headers={"X-User-No": "1"}, files={"file": ("../../outside.html", png(), "text/html")})
    status(response, (201,), record_property)
    filename = response.json()["filename"]
    assert "/" not in filename and ".." not in filename and filename.endswith(".png")
    assert response.json()["contentType"] == "image/png"


@pytest.mark.redteam("high", "미승인 글은 번역 API로도 내용 조회 불가")
def test_translation_cannot_disclose_pending_spot(client, insert, record_property):
    session(client)
    spot_id = add_spot(insert, CAPTION="private", LANGUAGE_CODE="en", MODERATION_STATUS=0)
    app.dependency_overrides[get_translate_text] = lambda: lambda *args: pytest.fail("Private text sent to translator")
    status(client.post(f"/api/v1/translations/spot/{spot_id}", headers={"X-User-No": "1"}), (404,), record_property)


@pytest.fixture
def course(client, insert):
    session(client)
    add_places(insert)
    response = client.get("/api/v1/journey/course?persona=king")
    assert response.status_code == 200
    return response.json()["stops"]


@pytest.mark.redteam("high", "타인 퀘스트 ID를 알아도 보상 수령 불가")
def test_quest_owner_is_enforced(client, insert, course, rows, record_property):
    insert("USERS", NO=2, ID="redteam-other", NICKNAME="other", EMAIL="other@example.invalid", COUNTRY="KR")
    session(client, 2)
    status(client.post(f"/api/v1/journey/quests/{course[0]['questId']}/complete", json={"demoCompletion": True}), (404,), record_property)
    assert not rows("SELECT IDX FROM USER_ITEM")


@pytest.mark.redteam("control", "승인된 정책: 로그인한 사용자는 위치 없이 본인 퀘스트 완료 가능")
def test_location_free_completion_is_allowed(client, course, rows, record_property):
    response = client.post(f"/api/v1/journey/quests/{course[0]['questId']}/complete", json={"demoCompletion": True})
    record_property("effect", f"reward_rows={len(rows('SELECT IDX FROM USER_ITEM'))}")
    status(response, (200,), record_property)
    assert response.json()["completed"] is True
    assert response.json()["reward"] is not None
    assert len(rows("SELECT IDX FROM USER_ITEM")) == 1


@pytest.mark.redteam("high", "위치 검증을 생략해도 비로그인 사용자는 보상 수령 불가")
def test_location_free_completion_requires_login(client, course, rows, record_property):
    client.cookies.clear()
    response = client.post(f"/api/v1/journey/quests/{course[0]['questId']}/complete", json={"demoCompletion": True})
    status(response, (401,), record_property)
    assert not rows("SELECT IDX FROM USER_ITEM")


@pytest.mark.redteam("high", "동일 퀘스트 재전송은 아이템 하나만 지급")
def test_reward_replay_is_idempotent(client, course, rows, record_property):
    stop = course[0]
    body = {"demoCompletion": True}
    first = client.post(f"/api/v1/journey/quests/{stop['questId']}/complete", json=body)
    second = client.post(f"/api/v1/journey/quests/{stop['questId']}/complete", json=body)
    status(first, (200,), record_property)
    assert second.status_code == 200 and second.json()["reward"] is None
    assert len(rows("SELECT IDX FROM USER_ITEM")) == 1


@pytest.mark.redteam("high", "미보유 아이템·다른 역할 아이템을 착장에 저장할 수 없음")
@pytest.mark.parametrize("outfit", [{"hat": "king_hat"}, {"hat": "merchant_hat"}])
def test_unowned_outfit_rejected(client, outfit, record_property):
    session(client)
    status(client.put("/api/v1/donggyeong/outfit?persona=king", json={"outfit": outfit}), (400,), record_property)


@pytest.mark.redteam("high", "다른 사용자의 알림 읽음 상태 변경 불가")
def test_notification_owner_is_enforced(client, insert, record_property):
    notification_id = insert("NOTIFICATION", USER_NO=1, TYPE="QUEST_COMPLETED", TITLE="test", MESSAGE="private")
    insert("USERS", NO=2, ID="redteam-other", NICKNAME="other", EMAIL="other@example.invalid", COUNTRY="KR")
    session(client, 2)
    status(client.patch(f"/api/v1/notifications/{notification_id}/read"), (404,), record_property)


@pytest.mark.redteam("high", "동시 완료 요청에서도 보상 중복·누락 없음")
@pytest.mark.parametrize("same_quest", [True, False])
def test_concurrent_reward_integrity(database, insert, rows, same_quest):
    from test_quest_rewards import test_concurrent_completions_cannot_duplicate_or_skip_rewards
    test_concurrent_completions_cannot_duplicate_or_skip_rewards(database, insert, rows, same_quest)


@pytest.mark.redteam("control", "정상 회원가입·세션 조회·로그아웃은 정상 동작")
def test_valid_signup_and_logout_control(client, rows, record_property):
    response = client.post("/api/v1/auth/signup", json={
        "id": "redteam-valid", "nickname": "test", "country": "KR",
        "email": "redteam@example.invalid", "password": "password1234!", "languageCode": "ko",
    })
    status(response, (200,), record_property)
    assert client.get("/api/v1/auth/me").json()["user"]["user_id"] == "redteam-valid"
    saved = rows("SELECT PASSWORD_HASH FROM USER_AUTH")[0]["PASSWORD_HASH"]
    assert saved.startswith("$2") and saved != "password1234!"
    assert client.post("/api/v1/auth/logout").status_code == 200
    assert client.get("/api/v1/auth/me").status_code == 401


@pytest.mark.redteam("control", "레드팀 실행 중 외부 소켓 연결 차단")
def test_external_network_guard():
    with socket.socket() as connection:
        with pytest.raises(RuntimeError, match="network guard"):
            connection.connect(("203.0.113.1", 443))
    with socket.socket() as connection:
        with pytest.raises(RuntimeError, match="network guard"):
            connection.connect(("127.0.0.1", int(os.environ["DB_PORT"]) + 1))
