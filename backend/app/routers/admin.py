from hmac import compare_digest
from typing import Annotated, Literal
import sqlite3

from fastapi import APIRouter, Depends, Header, HTTPException, status

from ..config import Settings, get_settings
from ..database import get_database
from ..models.spots import (
    ModerationRequest,
    ModerationResponse,
)
from ..moderation import ModerationTargetNotFoundError, moderate


router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


def require_admin(
    admin_key: Annotated[str, Header(alias="X-Admin-Key")],
    settings: Settings = Depends(get_settings),
) -> None:
    if not settings.admin_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "ADMIN_NOT_CONFIGURED",
                "message": "관리자 API 키가 설정되지 않았습니다.",
            },
        )
    if not compare_digest(admin_key, settings.admin_api_key):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "ADMIN_FORBIDDEN",
                "message": "관리자 권한이 없습니다.",
            },
        )


@router.patch(
    "/{target_type}/{target_id}/moderation",
    response_model=ModerationResponse,
    response_model_by_alias=True,
    dependencies=[Depends(require_admin)],
)
def update_moderation(
    target_type: Literal["spot", "comment"],
    target_id: int,
    request: ModerationRequest,
    database: sqlite3.Connection = Depends(get_database),
) -> ModerationResponse:
    try:
        return moderate(
            database,
            target_type=target_type,
            target_id=target_id,
            moderation_status=request.status,
        )
    except ModerationTargetNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "MODERATION_TARGET_NOT_FOUND",
                "message": "검수 대상을 찾을 수 없습니다.",
            },
        ) from error
