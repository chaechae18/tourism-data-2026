from fastapi import APIRouter, HTTPException, Depends, Request
import pymysql

from ..models.auth import SignupRequest, SignupResponse
from ..auth import (
    signup,
    login,
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
    database: pymysql.Connection = Depends(get_mysql),
) -> SignupResponse:

    print("signup request:", request)

    try:
        return signup(
            database,
            user_id=request.id,
            nickname=request.nickname,
            country=request.country,
            birth_date=request.birth_date,
            email=request.email,
            password=request.password,
        )

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
        "profile_image": user["profile_image"],
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
    user_no = request.session.get("user_no")

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


# 로그아웃
@router.post("/logout")
def logout(
    request: Request,
):
    request.session.clear()

    return {
        "message": "로그아웃 성공",
    }