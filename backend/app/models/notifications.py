from datetime import datetime
from typing import Literal

from pydantic import Field

from .common import CamelModel


NotificationType = Literal["SPOT_LIKE", "QUEST_COMPLETED", "NOTICE"]


class NotificationResponse(CamelModel):
    id: int
    type: NotificationType
    title: str
    message: str
    target_type: str | None = Field(alias="targetType")
    target_id: int | None = Field(alias="targetId")
    is_read: bool = Field(alias="isRead")
    created_at: datetime = Field(alias="createdAt")


class QuestCompletedNotificationRequest(CamelModel):
    quest_id: str = Field(alias="questId", min_length=1, max_length=100)
    quest_name: str = Field(alias="questName", min_length=1, max_length=200)
