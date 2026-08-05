import pymysql

from app.interactions import set_reaction
from app.models.common import ReactionType
from app.models.spots import SpotCreateRequest
from app.notifications import list_notifications, mark_notification_read
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
