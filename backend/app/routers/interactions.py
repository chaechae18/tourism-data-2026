from typing import Annotated
import sqlite3

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status

from ..database import get_database
from ..interactions import create_comment, list_comments, set_reaction
from ..models.common import ReactionType
from ..models.spots import (
    CommentCreateRequest,
    CommentResponse,
    ReactionResponse,
)
from ..spots import SpotNotFoundError, UserNotFoundError


router = APIRouter(prefix="/api/v1/spots", tags=["spot interactions"])


@router.put(
    "/{spot_id}/reactions/{reaction_type}",
    response_model=ReactionResponse,
    response_model_by_alias=True,
)
def add_reaction(
    spot_id: int,
    reaction_type: ReactionType,
    user_no: Annotated[int, Header(alias="X-User-No", ge=1)],
    database: sqlite3.Connection = Depends(get_database),
) -> ReactionResponse:
    return _set_reaction(
        database,
        spot_id=spot_id,
        user_no=user_no,
        reaction_type=reaction_type,
        active=True,
    )


@router.delete(
    "/{spot_id}/reactions/{reaction_type}",
    response_model=ReactionResponse,
    response_model_by_alias=True,
)
def remove_reaction(
    spot_id: int,
    reaction_type: ReactionType,
    user_no: Annotated[int, Header(alias="X-User-No", ge=1)],
    database: sqlite3.Connection = Depends(get_database),
) -> ReactionResponse:
    return _set_reaction(
        database,
        spot_id=spot_id,
        user_no=user_no,
        reaction_type=reaction_type,
        active=False,
    )


def _set_reaction(
    database: sqlite3.Connection,
    *,
    spot_id: int,
    user_no: int,
    reaction_type: ReactionType,
    active: bool,
) -> ReactionResponse:
    try:
        return set_reaction(
            database,
            spot_id=spot_id,
            user_no=user_no,
            reaction_type=reaction_type,
            active=active,
        )
    except UserNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "USER_NOT_FOUND",
                "message": "사용자를 찾을 수 없습니다.",
            },
        ) from error
    except SpotNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "SPOT_NOT_FOUND",
                "message": "승인된 스팟을 찾을 수 없습니다.",
            },
        ) from error


@router.post(
    "/{spot_id}/comments",
    response_model=CommentResponse,
    response_model_by_alias=True,
    status_code=status.HTTP_201_CREATED,
)
def add_comment(
    spot_id: int,
    request: CommentCreateRequest,
    user_no: Annotated[int, Header(alias="X-User-No", ge=1)],
    database: sqlite3.Connection = Depends(get_database),
) -> CommentResponse:
    try:
        return create_comment(
            database,
            spot_id=spot_id,
            user_no=user_no,
            request=request,
        )
    except UserNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "USER_NOT_FOUND",
                "message": "사용자를 찾을 수 없습니다.",
            },
        ) from error
    except SpotNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "SPOT_NOT_FOUND",
                "message": "승인된 스팟을 찾을 수 없습니다.",
            },
        ) from error


@router.get(
    "/{spot_id}/comments",
    response_model=list[CommentResponse],
    response_model_by_alias=True,
)
def get_comments(
    spot_id: int,
    user_no: Annotated[
        int | None,
        Header(alias="X-User-No", ge=1),
    ] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    database: sqlite3.Connection = Depends(get_database),
) -> list[CommentResponse]:
    try:
        return list_comments(
            database,
            spot_id=spot_id,
            viewer_no=user_no,
            limit=limit,
        )
    except SpotNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "SPOT_NOT_FOUND",
                "message": "승인된 스팟을 찾을 수 없습니다.",
            },
        ) from error
