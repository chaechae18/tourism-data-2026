from typing import Annotated

import pymysql
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response, status

from ..models.notifications import (
    NotificationResponse,
    QuestCompletedNotificationRequest,
)
from ..mysql import get_mysql
from ..notifications import (
    NotificationNotFoundError,
    create_notification,
    get_notification,
    list_notifications,
    mark_notification_read,
)


router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationResponse], response_model_by_alias=True)
def get_notifications(
    user_no: Annotated[int, Header(alias="X-User-No", ge=1)],
    unread_only: Annotated[bool, Query(alias="unreadOnly")] = False,
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
    database: pymysql.Connection = Depends(get_mysql),
) -> list[NotificationResponse]:
    return list_notifications(
        database,
        user_no=user_no,
        unread_only=unread_only,
        limit=limit,
    )


@router.patch("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def read_notification(
    notification_id: int,
    user_no: Annotated[int, Header(alias="X-User-No", ge=1)],
    database: pymysql.Connection = Depends(get_mysql),
) -> Response:
    try:
        mark_notification_read(
            database,
            user_no=user_no,
            notification_id=notification_id,
        )
    except NotificationNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOTIFICATION_NOT_FOUND", "message": "알림을 찾을 수 없습니다."},
        ) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/quest-completed",
    response_model=NotificationResponse,
    response_model_by_alias=True,
    status_code=status.HTTP_201_CREATED,
)
def notify_quest_completed(
    request: QuestCompletedNotificationRequest,
    user_no: Annotated[int, Header(alias="X-User-No", ge=1)],
    database: pymysql.Connection = Depends(get_mysql),
) -> NotificationResponse:
    notification_id = create_notification(
        database,
        user_no=user_no,
        notification_type="QUEST_COMPLETED",
        title="퀘스트 달성",
        message=f"{request.quest_name} 퀘스트를 완료했어요.",
        target_type="QUEST",
    )
    return get_notification(
        database,
        user_no=user_no,
        notification_id=notification_id,
    )
