import pymysql

from app.interactions import set_reaction
from app.models.common import ReactionType
from app.models.spots import SpotCreateRequest
from app.notifications import (
    list_notifications,
    mark_notification_read,
    sync_popup_notifications,
)
from app.spots import create_spot


def test_like_creates_notification_for_spot_owner(
    database: pymysql.Connection,
) -> None:
    with database.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO USERS (NO, ID, NICKNAME, COUNTRY, EMAIL)
            VALUES (2, 'liker', 'liker', 'KR', 'liker@example.com')
            """
        )
    request = SpotCreateRequest.model_validate(
        {
            "place": {
                "id": "notification-place",
                "name": "월정교",
                "latitude": 35.8,
                "longitude": 129.2,
            },
            "placeType": "TOUR",
            "caption": "야경이 아름다워요.",
        }
    )
    spot = create_spot(database, user_no=1, request=request)
    with database.cursor() as cursor:
        cursor.execute(
            "UPDATE SPOTS SET MODERATION_STATUS = 1 WHERE IDX = %s",
            (spot.id,),
        )

    set_reaction(
        database,
        spot_id=spot.id,
        user_no=2,
        reaction_type=ReactionType.LIKE,
        active=True,
    )

    notifications = list_notifications(
        database,
        user_no=1,
        unread_only=True,
        limit=10,
    )
    assert len(notifications) == 1
    assert notifications[0].type == "SPOT_LIKE"
    mark_notification_read(
        database,
        user_no=1,
        notification_id=notifications[0].id,
    )
    assert list_notifications(
        database,
        user_no=1,
        unread_only=True,
        limit=10,
    ) == []


def test_popup_becomes_notification_once(database: pymysql.Connection) -> None:
    with database.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO POPUP (TITLE, CONTENT, IS_DISPLAY)
            VALUES ('시스템 점검 안내', '새벽 2시 점검', 1), ('지난 공지', NULL, 0)
            """
        )

    sync_popup_notifications(database, user_no=1)
    sync_popup_notifications(database, user_no=1)

    notifications = list_notifications(
        database,
        user_no=1,
        unread_only=False,
        limit=10,
    )
    assert [(item.type, item.title) for item in notifications] == [
        ("NOTICE", "시스템 점검 안내")
    ]
    assert notifications[0].target_type == "POPUP"

    with database.cursor() as cursor:
        cursor.execute("UPDATE POPUP SET CONTENT = '새벽 3시 점검' WHERE IS_DISPLAY = 1")
        cursor.execute(
            """
            INSERT INTO POPUP_I18N (POPUP_IDX, LANGUAGE_CODE, TITLE, CONTENT)
            SELECT IDX, 'en', 'Scheduled maintenance', 'Starting at 3 AM'
            FROM POPUP WHERE IS_DISPLAY = 1
            """
        )

    korean = list_notifications(database, user_no=1, unread_only=False, limit=10)
    english = list_notifications(
        database,
        user_no=1,
        unread_only=False,
        limit=10,
        language="en",
    )
    assert korean[0].message == "새벽 3시 점검"
    assert english[0].title == "Scheduled maintenance"
