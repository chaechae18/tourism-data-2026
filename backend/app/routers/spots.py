from typing import Annotated
import sqlite3

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status

from ..database import get_database
from ..models.spots import SpotCreateRequest, SpotResponse
from ..spots import UserNotFoundError, create_spot, list_user_spots


router = APIRouter(prefix="/api/v1/spots", tags=["spots"])


@router.post(
    "",
    response_model=SpotResponse,
    response_model_by_alias=True,
    status_code=status.HTTP_201_CREATED,
)
def register_spot(
    request: SpotCreateRequest,
    user_no: Annotated[int, Header(alias="X-User-No", ge=1)],
    database: sqlite3.Connection = Depends(get_database),
) -> SpotResponse:
    try:
        return create_spot(database, user_no=user_no, request=request)
    except UserNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "USER_NOT_FOUND",
                "message": "사용자를 찾을 수 없습니다.",
            },
        ) from error


@router.get(
    "/me",
    response_model=list[SpotResponse],
    response_model_by_alias=True,
)
def get_my_spots(
    user_no: Annotated[int, Header(alias="X-User-No", ge=1)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    database: sqlite3.Connection = Depends(get_database),
) -> list[SpotResponse]:
    try:
        return list_user_spots(database, user_no=user_no, limit=limit)
    except UserNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "USER_NOT_FOUND",
                "message": "사용자를 찾을 수 없습니다.",
            },
        ) from error
