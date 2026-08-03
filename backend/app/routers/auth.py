from fastapi import APIRouter, HTTPException, Depends
import pymysql

from ..models.auth import SignupRequest, SignupResponse
from ..auth import signup, UserAlreadyExistsError
from ..mysql import get_mysql


router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


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