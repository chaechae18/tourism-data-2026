# Play Gyeongju 레드팀 실행 결과

- 시나리오 버전: v2-2026-09-20
- 실행 시각(UTC): 2026-09-20T14:18:13.173285+00:00
- 기준 커밋: `3980289c6e0f7dbf3260f2161d516727affaf2e3`
- 미커밋 변경 포함: True
- 환경: ASGI TestClient + disposable mysql:8.4; external network blocked; synthetic users only
- 백엔드 소스·테스트 SHA-256: `e9220ef34394b9dedddeb063383ce4eccee1af74495b13ffdd45553a66a58e0f`
- 결과: {'PASS': 47, 'OPEN': 11, 'ERROR': 0, 'SKIP': 0}

OPEN은 보안 기대 조건을 충족하지 못한 재현 결과입니다. ERROR/SKIP은 검증 완료로 세지 않습니다.
위험도는 해당 검사가 실패했을 때의 영향이며 PASS 항목의 위험을 뜻하지 않습니다.
통과 항목만으로 전체 서비스의 안전성을 보장하지 않습니다. 배포 환경·실제 LLM·브라우저 공격은 별도 검증 대상입니다.

재실행: `backend/.venv/bin/python backend/scripts/redteam.py`

검토와 대응 우선순위: [review.md](review.md)

| 시나리오 | 위험도 | 기대 조건 | 관찰 | 판정 |
|---|---|---|---|---|
| test_private_routes_reject_header_only_identity[GET-/api/v1/auth/me-None] | high | 로그인 없이 개인 API 호출 시 401 | HTTP 401 | PASS |
| test_private_routes_reject_header_only_identity[GET-/api/v1/auth/visit-place-None] | high | 로그인 없이 개인 API 호출 시 401 | HTTP 401 | PASS |
| test_private_routes_reject_header_only_identity[DELETE-/api/v1/auth/withdraw-None] | high | 로그인 없이 개인 API 호출 시 401 | HTTP 401 | PASS |
| test_private_routes_reject_header_only_identity[GET-/api/v1/journey/course-None] | high | 로그인 없이 개인 API 호출 시 401 | HTTP 401 | PASS |
| test_private_routes_reject_header_only_identity[GET-/api/v1/donggyeong/inventory?persona=king-None] | high | 로그인 없이 개인 API 호출 시 401 | HTTP 401 | PASS |
| test_private_routes_reject_header_only_identity[PUT-/api/v1/donggyeong/outfit?persona=king-body5] | high | 로그인 없이 개인 API 호출 시 401 | HTTP 401 | PASS |
| test_private_routes_reject_header_only_identity[GET-/api/v1/notifications-None] | high | 로그인 없이 개인 API 호출 시 401 | HTTP 401 | PASS |
| test_private_routes_reject_header_only_identity[GET-/api/v1/users/me/preferences-None] | high | 로그인 없이 개인 API 호출 시 401 | HTTP 401 | PASS |
| test_spot_routes_reject_anonymous_impersonation[create] | critical | 서명된 세션 없이 사용자 번호만 보내면 401, 저장·삭제 없음 | HTTP 401; spots=1 | PASS |
| test_spot_routes_reject_anonymous_impersonation[delete] | critical | 서명된 세션 없이 사용자 번호만 보내면 401, 저장·삭제 없음 | HTTP 401; deleted=False | PASS |
| test_spot_routes_reject_anonymous_impersonation[mine] | critical | 서명된 세션 없이 사용자 번호만 보내면 401, 저장·삭제 없음 | HTTP 401 | PASS |
| test_spot_routes_reject_anonymous_impersonation[comment] | critical | 서명된 세션 없이 사용자 번호만 보내면 401, 저장·삭제 없음 | HTTP 401; comments=0 | PASS |
| test_spot_routes_reject_anonymous_impersonation[like] | critical | 서명된 세션 없이 사용자 번호만 보내면 401, 저장·삭제 없음 | HTTP 401; reactions=0 | PASS |
| test_spot_routes_reject_anonymous_impersonation[upload] | critical | 서명된 세션 없이 사용자 번호만 보내면 401, 저장·삭제 없음 | HTTP 401 | PASS |
| test_spot_routes_reject_anonymous_impersonation[translate] | critical | 서명된 세션 없이 사용자 번호만 보내면 401, 저장·삭제 없음 | HTTP 200; provider_calls=1 (fake provider) | OPEN |
| test_signed_in_user_cannot_delete_another_users_spot | critical | 사용자 2의 세션에 사용자 1 헤더를 넣어도 타인 글 삭제 불가 | HTTP 403; deleted=False | PASS |
| test_pending_comment_cannot_be_read_by_spoofing_owner | high | 비로그인 조회에서 헤더를 바꿔도 미승인 댓글 비공개 | HTTP 200; pending_comment_disclosed=False | PASS |
| test_forged_session_rejected[wrong-key] | high | 변조하거나 잘못 서명한 쿠키는 401 | HTTP 401 | PASS |
| test_forged_session_rejected[] | high | 변조하거나 잘못 서명한 쿠키는 401 | HTTP 401 | PASS |
| test_forged_session_rejected[dev-session-secret-key-change-this] | high | 변조하거나 잘못 서명한 쿠키는 401 | HTTP 401 | PASS |
| test_withdrawn_account_cookie_rejected[/api/v1/auth/me] | high | 탈퇴 후 남은 쿠키로 개인정보·방문 기록에 접근 불가 | HTTP 401 | PASS |
| test_withdrawn_account_cookie_rejected[/api/v1/auth/visit-place] | high | 탈퇴 후 남은 쿠키로 개인정보·방문 기록에 접근 불가 | HTTP 200 | OPEN |
| test_withdrawn_account_cookie_rejected[/api/v1/journey/course] | high | 탈퇴 후 남은 쿠키로 개인정보·방문 기록에 접근 불가 | HTTP 401 | PASS |
| test_logout_revokes_copied_cookie | medium | 로그아웃 전에 복사된 세션 쿠키도 서버에서 무효화 | HTTP 200 | OPEN |
| test_oauth_state_validation[None-google] | high | OAuth state 누락·불일치 요청은 외부 토큰 교환 전에 차단 | HTTP 400 | PASS |
| test_oauth_state_validation[None-kakao] | high | OAuth state 누락·불일치 요청은 외부 토큰 교환 전에 차단 | HTTP 400 | PASS |
| test_oauth_state_validation[None-naver] | high | OAuth state 누락·불일치 요청은 외부 토큰 교환 전에 차단 | HTTP 400 | PASS |
| test_oauth_state_validation[attacker-state-google] | high | OAuth state 누락·불일치 요청은 외부 토큰 교환 전에 차단 | HTTP 400 | PASS |
| test_oauth_state_validation[attacker-state-kakao] | high | OAuth state 누락·불일치 요청은 외부 토큰 교환 전에 차단 | HTTP 400 | PASS |
| test_oauth_state_validation[attacker-state-naver] | high | OAuth state 누락·불일치 요청은 외부 토큰 교환 전에 차단 | HTTP 400 | PASS |
| test_https_session_cookie_flags | medium | HTTPS 서비스에서 발행한 로그인 쿠키는 Secure·HttpOnly·SameSite 설정 | Secure=False, HttpOnly=True, SameSite=True | OPEN |
| test_empty_session_key_fails_closed | high | 빈 SESSION_SECRET_KEY로 설정 로딩·서명 기능 시작 불가 | empty_key_accepted=True | OPEN |
| test_signup_enforces_password_policy[] | medium | 프론트를 우회한 빈 비밀번호·취약 비밀번호 가입 거부 | HTTP 200 | OPEN |
| test_signup_enforces_password_policy[a] | medium | 프론트를 우회한 빈 비밀번호·취약 비밀번호 가입 거부 | HTTP 200 | OPEN |
| test_signup_enforces_password_policy[password123] | medium | 프론트를 우회한 빈 비밀번호·취약 비밀번호 가입 거부 | HTTP 200 | OPEN |
| test_login_rejects_malformed_input[body0] | medium | 로그인 JSON 타입 오류는 4xx, 내부 오류 500 없음 | HTTP 500 | OPEN |
| test_login_rejects_malformed_input[body1] | medium | 로그인 JSON 타입 오류는 4xx, 내부 오류 500 없음 | HTTP 401 | PASS |
| test_login_attempts_are_throttled | medium | 동일 클라이언트의 20회 연속 로그인 실패 중 요청 제한 적용 | attempts=20, throttled=0, unauthorized=20 | OPEN |
| test_cross_origin_plain_text_login_rejected | high | 다른 Origin의 text/plain 로그인 요청 거부 | HTTP 200 | OPEN |
| test_admin_moderation_requires_key[headers0] | high | 관리자 키 누락·오류 요청은 데이터 변경 없이 차단 | HTTP 422 | PASS |
| test_admin_moderation_requires_key[headers1] | high | 관리자 키 누락·오류 요청은 데이터 변경 없이 차단 | HTTP 403 | PASS |
| test_sql_injection_in_id_check | high | 아이디 SQL 인젝션 문자열은 일반 문자열로 처리 | HTTP 200 | PASS |
| test_upload_rejects_active_content[<script>alert(1)</script>] | high | 확장자·MIME으로 위장한 비이미지 파일 거부 | HTTP 422 | PASS |
| test_upload_rejects_active_content[<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>] | high | 확장자·MIME으로 위장한 비이미지 파일 거부 | HTTP 422 | PASS |
| test_upload_size_limit | medium | 업로드 용량 제한 및 경로 탈출 방지 | HTTP 413 | PASS |
| test_upload_filename_cannot_escape | medium | 사용자 파일명 대신 서버 UUID와 실제 이미지 확장자로 저장 | HTTP 201 | PASS |
| test_translation_cannot_disclose_pending_spot | high | 미승인 글은 번역 API로도 내용 조회 불가 | HTTP 404 | PASS |
| test_quest_owner_is_enforced | high | 타인 퀘스트 ID를 알아도 보상 수령 불가 | HTTP 404 | PASS |
| test_location_free_completion_is_allowed | control | 승인된 정책: 로그인한 사용자는 위치 없이 본인 퀘스트 완료 가능 | HTTP 200; reward_rows=1 | PASS |
| test_location_free_completion_requires_login | high | 위치 검증을 생략해도 비로그인 사용자는 보상 수령 불가 | HTTP 401 | PASS |
| test_reward_replay_is_idempotent | high | 동일 퀘스트 재전송은 아이템 하나만 지급 | HTTP 200 | PASS |
| test_unowned_outfit_rejected[outfit0] | high | 미보유 아이템·다른 역할 아이템을 착장에 저장할 수 없음 | HTTP 400 | PASS |
| test_unowned_outfit_rejected[outfit1] | high | 미보유 아이템·다른 역할 아이템을 착장에 저장할 수 없음 | HTTP 400 | PASS |
| test_notification_owner_is_enforced | high | 다른 사용자의 알림 읽음 상태 변경 불가 | HTTP 404 | PASS |
| test_concurrent_reward_integrity[True] | high | 동시 완료 요청에서도 보상 중복·누락 없음 |  | PASS |
| test_concurrent_reward_integrity[False] | high | 동시 완료 요청에서도 보상 중복·누락 없음 |  | PASS |
| test_valid_signup_and_logout_control | control | 정상 회원가입·세션 조회·로그아웃은 정상 동작 | HTTP 200 | PASS |
| test_external_network_guard | control | 레드팀 실행 중 외부 소켓 연결 차단 |  | PASS |
