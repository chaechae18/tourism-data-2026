from typing import Annotated

import pymysql
from fastapi import APIRouter, Depends, Header, HTTPException, status

from ..models.users import UserPreferencesResponse, UserPreferencesUpdate
from ..mysql import get_mysql
from ..users import UserNotFoundError, get_user_preferences, update_user_language


router = APIRouter(prefix="/api/v1/users/me", tags=["users"])
UserNo = Annotated[int, Header(alias="X-User-No", ge=1)]


def user_not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"code": "USER_NOT_FOUND", "message": "사용자를 찾을 수 없습니다."},
    )


@router.get(
    "/preferences",
    response_model=UserPreferencesResponse,
    response_model_by_alias=True,
)
def read_preferences(
    user_no: UserNo,
    database: pymysql.Connection = Depends(get_mysql),
) -> UserPreferencesResponse:
    try:
        return get_user_preferences(database, user_no=user_no)
    except UserNotFoundError as error:
        raise user_not_found() from error


@router.patch(
    "/preferences",
    response_model=UserPreferencesResponse,
    response_model_by_alias=True,
)
def change_preferences(
    request: UserPreferencesUpdate,
    user_no: UserNo,
    database: pymysql.Connection = Depends(get_mysql),
) -> UserPreferencesResponse:
    try:
        return update_user_language(
            database,
            user_no=user_no,
            language=request.language,
        )
    except UserNotFoundError as error:
        raise user_not_found() from error
