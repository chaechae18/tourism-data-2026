from typing import Annotated
import sqlite3

from fastapi import (
    APIRouter,
    Depends,
    Header,
    HTTPException,
    Query,
    Response,
    status,
)

from ..database import get_database
from ..models.spots import SpotCreateRequest, SpotResponse
from ..spots import (
    SpotForbiddenError,
    SpotNotFoundError,
    UserNotFoundError,
    create_spot,
    delete_spot,
    list_public_spots,
    list_user_spots,
)


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
    "",
    response_model=list[SpotResponse],
    response_model_by_alias=True,
)
def get_public_spots(
    user_no: Annotated[
        int | None,
        Header(alias="X-User-No", ge=1),
    ] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    before_id: Annotated[
        int | None,
        Query(alias="beforeId", ge=1),
    ] = None,
    database: sqlite3.Connection = Depends(get_database),
) -> list[SpotResponse]:
    return list_public_spots(
        database,
        viewer_no=user_no,
        limit=limit,
        before_id=before_id,
    )


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


@router.delete("/{spot_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_spot(
    spot_id: int,
    user_no: Annotated[int, Header(alias="X-User-No", ge=1)],
    database: sqlite3.Connection = Depends(get_database),
) -> Response:
    try:
        delete_spot(database, spot_id=spot_id, user_no=user_no)
    except SpotNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "SPOT_NOT_FOUND",
                "message": "스팟을 찾을 수 없습니다.",
            },
        ) from error
    except SpotForbiddenError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "SPOT_FORBIDDEN",
                "message": "본인이 작성한 스팟만 삭제할 수 있습니다.",
            },
        ) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)
