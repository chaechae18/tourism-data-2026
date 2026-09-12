from fastapi import APIRouter, HTTPException, Depends, Request
import pymysql
import os
import httpx
from fastapi.responses import RedirectResponse
import secrets
from urllib.parse import urlencode
from ..models.auth import SignupRequest, SignupResponse, UpdateUserRequest
from ..auth import (
    signup,
    login,
    get_naver_user,
    login_with_naver,
    get_kakao_user,
    login_with_kakao,
    get_google_user,
    login_with_google,
    UserAlreadyExistsError,
    InvalidCredentialsError,
)

from ..mysql import get_mysql

router = APIRouter(
    prefix="/api/v1/auth",
    tags=["auth"],
)


# 회원가입
@router.post(
    "/signup",
    response_model=SignupResponse,
    response_model_by_alias=True,
)
def create_signup(
    request: SignupRequest,
    http_request: Request,
    database: pymysql.Connection = Depends(get_mysql),
) -> SignupResponse:

    print("signup request:", request)

    try:
        user = signup(
            database,
            user_id=request.id,
            nickname=request.nickname,
            country=request.country,
            birth_date=request.birth_date,
            email=request.email,
            password=request.password,
            language_code=request.language_code,
        )

        # 회원가입 직후 바로 로그인 상태로 만든다.
        http_request.session.clear()

        http_request.session["user"] = {
            "user_no": user["userNo"],
            "user_id": user["userId"],
            "nickname": user["nickname"],
            "country": user["country"],
            "email": user["email"],
            "language_code": user["languageCode"],
        }

        return {
            "userNo": user["userNo"],
            "message": "회원가입 성공",
            "user": user,
        }

    except UserAlreadyExistsError:
        raise HTTPException(
            status_code=400,
            detail="이미 존재하는 아이디입니다.",
        )


# 로그인
@router.post("/login")
async def create_login(
    request: Request,
    database: pymysql.Connection = Depends(get_mysql),
):
    try:
        body = await request.json()

        print("login body:", body)

        user_id = body.get("id")
        password = body.get("password")

        if not user_id or not password:
            raise HTTPException(
                status_code=400,
                detail="아이디와 비밀번호를 입력해주세요.",
            )

        user = login(
            database,
            user_id=user_id,
            password=password,
        )

    except InvalidCredentialsError:
        raise HTTPException(
            status_code=401,
            detail="아이디 또는 비밀번호가 올바르지 않습니다.",
        )

    request.session.clear()

    request.session["user"] = {
        "user_no": user["userNo"],
        "user_id": user["userId"],
        "nickname": user["nickname"],
        "country": user["country"],
        "email": user["email"],
        "language_code": user["language_code"],
    }

    return {
        "message": "로그인 성공",
        "user": user,
    }


# 현재 로그인 사용자
@router.get("/me")
def get_current_user(
    request: Request,
    database: pymysql.Connection = Depends(get_mysql),
):
    # 세션 안의 user에서 user_no를 가져온다.
    session_user = request.session.get("user")
    user_no = session_user.get("user_no") if session_user else None

    if not user_no:
        raise HTTPException(
            status_code=401,
            detail="로그인이 필요합니다.",
        )

    with database.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                NO AS user_no,
                ID AS user_id,
                NICKNAME AS nickname,
                EMAIL AS email,
                COUNTRY AS country,
                PROFILE_IMAGE AS profile_image,
                LANGUAGE_CODE AS language_code
            FROM USERS
            WHERE NO = %s
              AND STATUS = 1
              AND DELETED_AT IS NULL
            LIMIT 1
            """,
            (user_no,),
        )

        user = cursor.fetchone()

    if not user:
        request.session.clear()

        raise HTTPException(
            status_code=401,
            detail="사용자를 찾을 수 없습니다.",
        )

    return {
        "user": user,
    }


# 아이디 중복확인
@router.get("/check-id")
def check_id(
    id: str,
    database: pymysql.Connection = Depends(get_mysql),
):
    with database.cursor() as cursor:
        cursor.execute(
            """
            SELECT NO
            FROM USERS
            WHERE ID = %s
              AND DELETED_AT IS NULL
            LIMIT 1
            """,
            (id,),
        )

        user = cursor.fetchone()

    if user:
        return {
            "available": False,
            "message": "이미 사용 중인 아이디입니다.",
        }

    return {
        "available": True,
        "message": "사용 가능한 아이디입니다.",
    }


# 로그아웃
@router.post("/logout")
def logout(
    request: Request,
):
    request.session.clear()

    return {
        "message": "로그아웃 성공",
    }
    
# =========================================================
# 네이버 로그인 시작
# =========================================================
@router.get("/naver/login")
def naver_login(request: Request):

    client_id = os.getenv("NAVER_CLIENT_ID")
    redirect_uri = os.getenv("NAVER_REDIRECT_URI")

    if not client_id:
        raise HTTPException(
            status_code=500,
            detail="NAVER_CLIENT_ID가 설정되지 않았습니다.",
        )

    if not redirect_uri:
        raise HTTPException(
            status_code=500,
            detail="NAVER_REDIRECT_URI가 설정되지 않았습니다.",
        )

    # OAuth state 생성
    state = secrets.token_urlsafe(32)

    # 세션에 저장
    request.session["naver_oauth_state"] = state

    # 네이버 로그인 페이지
    naver_login_url = (
        "https://nid.naver.com/oauth2.0/authorize"
        "?response_type=code"
        f"&client_id={client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&state={state}"
    )

    return RedirectResponse(
        url=naver_login_url,
        status_code=302,
    )

# =========================================================
# 네이버 로그인 Callback
# =========================================================
@router.get("/naver/callback")
async def naver_callback(
    request: Request,
    connection: pymysql.Connection = Depends(get_mysql),
):
    code = request.query_params.get("code")
    state = request.query_params.get("state")

    if not code:
        raise HTTPException(
            status_code=400,
            detail="네이버 authorization code가 없습니다.",
        )

    if not state:
        raise HTTPException(
            status_code=400,
            detail="네이버 state가 없습니다.",
        )

    # 세션에 저장했던 state
    saved_state = request.session.get("naver_oauth_state")

    if not saved_state or saved_state != state:
        raise HTTPException(
            status_code=400,
            detail="잘못된 OAuth state입니다.",
        )

    # state는 한 번 사용했으므로 삭제
    request.session.pop("naver_oauth_state", None)

    # =====================================================
    # 1. 네이버 사용자 정보 가져오기
    # =====================================================
    try:
        naver_user = await get_naver_user(
            code=code,
            state=state,
        )

    except Exception as e:
        print("NAVER OAUTH ERROR:", e)

        raise HTTPException(
            status_code=400,
            detail="네이버 로그인에 실패했습니다.",
        )

    print("NAVER USER:", naver_user)

    # =====================================================
    # 2. DB에서 네이버 회원 조회 / 신규 회원 생성
    # =====================================================
    try:
        user = login_with_naver(
            connection,
            naver_user=naver_user,
        )

    except Exception as e:
        connection.rollback()

        print("NAVER DB LOGIN ERROR:", e)

        raise HTTPException(
            status_code=500,
            detail="네이버 회원 처리에 실패했습니다.",
        )

    # =====================================================
    # 3. 기존 로그인과 동일하게 세션 저장
    # =====================================================
    request.session.clear()

    request.session["user"] = {
        "user_no": user["userNo"],
        "user_id": user["userId"],
        "nickname": user["nickname"],
        "email": user["email"],
        "country": user["country"],
        "profile_image": user["profile_image"],
        "language_code": user["language_code"],
    }

    # =====================================================
    # 4. 프론트엔드로 이동
    # =====================================================
    frontend_url = os.getenv("CORS_ORIGINS")

    if not frontend_url:
        raise HTTPException(
            status_code=500,
            detail="CORS_ORIGINS이 설정되지 않았습니다.",
        )

    return RedirectResponse(
        url=frontend_url,
        status_code=302,
    )
    

# =========================================================
# 카카오 로그인 시작
# =========================================================
@router.get("/kakao/login")
def kakao_login(request: Request):

    client_id = os.getenv("KAKAO_CLIENT_ID")
    redirect_uri = os.getenv("KAKAO_REDIRECT_URI")

    if not client_id:
        raise HTTPException(
            status_code=500,
            detail="KAKAO_CLIENT_ID가 설정되지 않았습니다.",
        )

    if not redirect_uri:
        raise HTTPException(
            status_code=500,
            detail="KAKAO_REDIRECT_URI가 설정되지 않았습니다.",
        )

    # OAuth state 생성
    state = secrets.token_urlsafe(32)

    # 세션에 state 저장
    request.session["kakao_oauth_state"] = state

    # 카카오 로그인 URL
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "state": state,
    }

    kakao_login_url = (
        "https://kauth.kakao.com/oauth/authorize?"
        + urlencode(params)
    )

    return RedirectResponse(
        url=kakao_login_url,
        status_code=302,
    )


# =========================================================
# 카카오 로그인 Callback
# =========================================================
@router.get("/kakao/callback")
async def kakao_callback(
    request: Request,
    connection: pymysql.Connection = Depends(get_mysql),
):
    code = request.query_params.get("code")
    state = request.query_params.get("state")
    error = request.query_params.get("error")

    # -----------------------------------------------------
    # 카카오 인증 실패
    # -----------------------------------------------------
    if error:
        error_description = request.query_params.get(
            "error_description"
        )

        print(
            "KAKAO OAUTH ERROR:",
            error,
            error_description,
        )

        raise HTTPException(
            status_code=400,
            detail="카카오 로그인이 취소되었거나 실패했습니다.",
        )

    # -----------------------------------------------------
    # authorization code 확인
    # -----------------------------------------------------
    if not code:
        raise HTTPException(
            status_code=400,
            detail="카카오 authorization code가 없습니다.",
        )

    # -----------------------------------------------------
    # state 확인
    # -----------------------------------------------------
    if not state:
        raise HTTPException(
            status_code=400,
            detail="카카오 state가 없습니다.",
        )

    saved_state = request.session.get(
        "kakao_oauth_state"
    )

    if not saved_state or saved_state != state:
        raise HTTPException(
            status_code=400,
            detail="잘못된 OAuth state입니다.",
        )

    # state는 한 번 사용했으므로 삭제
    request.session.pop(
        "kakao_oauth_state",
        None,
    )

    # =====================================================
    # 1. 카카오 사용자 정보 가져오기
    # =====================================================
    try:
        kakao_user = await get_kakao_user(
            code=code,
            state=state,
        )

    except Exception as e:
        print(
            "KAKAO OAUTH ERROR:",
            repr(e),
        )

        raise HTTPException(
            status_code=400,
            detail="카카오 로그인에 실패했습니다.",
        )

    print("KAKAO USER:", kakao_user)

    # =====================================================
    # 2. DB에서 카카오 회원 조회 / 신규 회원 생성
    # =====================================================
    try:
        user = login_with_kakao(
            connection,
            kakao_user=kakao_user,
        )

    except Exception as e:
        connection.rollback()

        print(
            "KAKAO DB LOGIN ERROR:",
            repr(e),
        )

        raise HTTPException(
            status_code=500,
            detail="카카오 회원 처리에 실패했습니다.",
        )

    # =====================================================
    # 3. 기존 로그인과 동일하게 세션 저장
    # =====================================================
    request.session.clear()

    request.session["user"] = {
        "user_no": user["userNo"],
        "user_id": user["userId"],
        "nickname": user["nickname"],
        "email": user["email"],
        "country": user["country"],
        "profile_image": user.get("profile_image"),
        "language_code": user.get("language_code"),
    }

    # =====================================================
    # 4. 프론트엔드로 이동
    # =====================================================
    frontend_url = os.getenv("CORS_ORIGINS")

    if not frontend_url:
        raise HTTPException(
            status_code=500,
            detail="CORS_ORIGINS이 설정되지 않았습니다.",
        )

    return RedirectResponse(
        url=frontend_url,
        status_code=302,
    )

# =========================================================
# 구글 로그인 시작
# =========================================================
@router.get("/google/login")
def google_login(request: Request):

    client_id = os.getenv("GOOGLE_CLIENT_ID")
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI")

    if not client_id:
        raise HTTPException(
            status_code=500,
            detail="GOOGLE_CLIENT_ID가 설정되지 않았습니다.",
        )

    if not redirect_uri:
        raise HTTPException(
            status_code=500,
            detail="GOOGLE_REDIRECT_URI가 설정되지 않았습니다.",
        )

    # OAuth state 생성
    state = secrets.token_urlsafe(32)

    # 세션에 state 저장
    request.session["google_oauth_state"] = state

    # 구글 로그인 URL
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "offline",
        "prompt": "select_account",
    }

    google_login_url = (
        "https://accounts.google.com/o/oauth2/v2/auth?"
        + urlencode(params)
    )

    return RedirectResponse(
        url=google_login_url,
        status_code=302,
    )
    
# =========================================================
# 구글 로그인 Callback
# =========================================================
@router.get("/google/callback")
async def google_callback(
    request: Request,
    connection: pymysql.Connection = Depends(get_mysql),
):
    code = request.query_params.get("code")
    state = request.query_params.get("state")
    error = request.query_params.get("error")

    # -----------------------------------------------------
    # 구글 인증 실패
    # -----------------------------------------------------
    if error:
        error_description = request.query_params.get(
            "error_description"
        )

        print(
            "GOOGLE OAUTH ERROR:",
            error,
            error_description,
        )

        raise HTTPException(
            status_code=400,
            detail="구글 로그인이 취소되었거나 실패했습니다.",
        )

    # -----------------------------------------------------
    # authorization code 확인
    # -----------------------------------------------------
    if not code:
        raise HTTPException(
            status_code=400,
            detail="구글 authorization code가 없습니다.",
        )

    # -----------------------------------------------------
    # state 확인
    # -----------------------------------------------------
    if not state:
        raise HTTPException(
            status_code=400,
            detail="구글 state가 없습니다.",
        )

    saved_state = request.session.get(
        "google_oauth_state"
    )

    if not saved_state or saved_state != state:
        raise HTTPException(
            status_code=400,
            detail="잘못된 OAuth state입니다.",
        )

    # state는 한 번 사용했으므로 삭제
    request.session.pop(
        "google_oauth_state",
        None,
    )

    # =====================================================
    # 1. 구글 사용자 정보 가져오기
    # =====================================================
    try:
        google_user = await get_google_user(
            code=code,
            state=state,
        )

    except Exception as e:
        print(
            "GOOGLE OAUTH ERROR:",
            repr(e),
        )

        raise HTTPException(
            status_code=400,
            detail="구글 로그인에 실패했습니다.",
        )

    print("GOOGLE USER:", google_user)

    # =====================================================
    # 2. DB에서 구글 회원 조회 / 신규 회원 생성
    # =====================================================
    try:
        user = login_with_google(
            connection,
            google_user=google_user,
        )

    except Exception as e:
        connection.rollback()

        print(
            "GOOGLE DB LOGIN ERROR:",
            repr(e),
        )

        raise HTTPException(
            status_code=500,
            detail="구글 회원 처리에 실패했습니다.",
        )

    # =====================================================
    # 3. 세션 저장
    # =====================================================
    request.session.clear()

    request.session["user"] = {
        "user_no": user["userNo"],
        "user_id": user["userId"],
        "nickname": user["nickname"],
        "email": user["email"],
        "country": user["country"],
        "profile_image": user.get("profile_image"),
        "language_code": user.get("language_code"),
    }

    # =====================================================
    # 4. 프론트엔드로 이동
    # =====================================================
    frontend_url = os.getenv("CORS_ORIGINS")

    if not frontend_url:
        raise HTTPException(
            status_code=500,
            detail="CORS_ORIGINS이 설정되지 않았습니다.",
        )

    return RedirectResponse(
        url=frontend_url,
        status_code=302,
    )
    

# 회원정보 수정
@router.put("/update-user")
def update_user(
    request: UpdateUserRequest,
    http_request: Request,
    database: pymysql.Connection = Depends(get_mysql),
):
    # 현재 로그인 사용자 확인
    session_user = http_request.session.get("user")
    user_no = session_user.get("user_no") if session_user else None

    if not user_no:
        raise HTTPException(
            status_code=401,
            detail="로그인이 필요합니다.",
        )

    # 회원정보 수정
    with database.cursor() as cursor:
        cursor.execute(
            """
            UPDATE USERS
            SET
                NICKNAME = %s,
                COUNTRY = %s,
                BIRTH_DATE = %s,
                EMAIL = %s
            WHERE NO = %s
              AND STATUS = 1
              AND DELETED_AT IS NULL
            """,
            (
                request.nickname,
                request.country,
                request.birth_date,
                request.email,
                user_no,
            ),
        )

    database.commit()

    # 수정된 사용자 정보 다시 조회
    with database.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                NO AS user_no,
                ID AS user_id,
                NICKNAME AS nickname,
                EMAIL AS email,
                COUNTRY AS country,
                BIRTH_DATE AS birth_date,
                PROFILE_IMAGE AS profile_image,
                LANGUAGE_CODE AS language_code
            FROM USERS
            WHERE NO = %s
              AND STATUS = 1
              AND DELETED_AT IS NULL
            LIMIT 1
            """,
            (user_no,),
        )

        user = cursor.fetchone()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="사용자를 찾을 수 없습니다.",
        )

    # 세션 정보도 최신 정보로 변경
    http_request.session["user"] = {
        "user_no": user["user_no"],
        "user_id": user["user_id"],
        "nickname": user["nickname"],
        "email": user["email"],
        "country": user["country"],
        "profile_image": user["profile_image"],
        "language_code": user["language_code"],
    }

    return {
        "message": "회원정보 수정 성공",
        "user": user,
    }
    
    
    
# 내가 방문한 장소 조회
@router.get("/visit-place")
def get_visit_places(
    request: Request,
    database: pymysql.Connection = Depends(get_mysql),
):
    # 현재 로그인 사용자 확인
    session_user = request.session.get("user")
    user_no = session_user.get("user_no") if session_user else None

    if not user_no:
        raise HTTPException(
            status_code=401,
            detail="로그인이 필요합니다.",
        )

    with database.cursor() as cursor:
        cursor.execute(
            """
            SELECT DISTINCT
                p.IDX AS place_idx,
                p.NAME AS name,
                p.TEXT AS text,
                p.CONTENT AS content,
                p.IMG AS img,
                p.ADDRESS AS address,
                p.LATITUDE AS latitude,
                p.LONGITUDE AS longitude,
                p.OPERATING_HOURS AS operating_hours,
                p.ADMISSION_FEE AS admission_fee,
                p.PARKING AS parking,
                p.REST_DATE AS rest_date,
                p.MENU AS menu,
                p.CATEGORY_CODE AS category_code,
                p.CATEGORY_MAIN AS category_main,
                p.CATEGORY_SUB AS category_sub
            FROM USER_CHARACTER uc
            JOIN USER_QUEST uq
                ON uq.USER_CHARACTER_IDX = uc.IDX
            JOIN QUEST q
                ON q.IDX = uq.QUEST_IDX
            JOIN PLACE p
                ON p.IDX = q.MAP_PLACE_IDX
            WHERE uc.USER_NO = %s
              AND uq.STATUS = 2
            ORDER BY p.NAME
            """,
            (user_no,),
        )

        places = cursor.fetchall()

    return {
        "places": places,
    }
    
@router.delete("/withdraw")
def withdraw(
    request: Request,
    database: pymysql.Connection = Depends(get_mysql),
):
    session_user = request.session.get("user")
    user_no = session_user.get("user_no") if session_user else None

    if not user_no:
        raise HTTPException(
            status_code=401,
            detail="로그인이 필요합니다.",
        )

    with database.cursor() as cursor:
        cursor.execute(
            """
            UPDATE USERS
            SET
                STATUS = 0,
                DELETED_AT = NOW(),
                UPDATED_AT = NOW()
            WHERE NO = %s
              AND DELETED_AT IS NULL
            """,
            (user_no,),
        )

        if cursor.rowcount == 0:
            raise HTTPException(
                status_code=404,
                detail="탈퇴할 사용자를 찾을 수 없습니다.",
            )

    database.commit()

    # 세션 제거
    request.session.clear()

    return {
        "message": "회원탈퇴가 완료되었습니다."
    }