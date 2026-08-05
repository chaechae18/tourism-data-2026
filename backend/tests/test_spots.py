from datetime import datetime

import pymysql

from app.models.spots import SpotCreateRequest
from app.spots import (
    create_spot,
    list_daily_ranking,
    list_public_spots,
    list_user_spots,
)
from app.temporary_spot_approval import approve_pending_spot


def spot_request(caption: str) -> SpotCreateRequest:
    return SpotCreateRequest.model_validate(
        {
            "place": {
                "id": "12345",
                "name": "첨성대",
                "address": "경북 경주시 인왕동 839-1",
                "roadAddress": "경북 경주시 첨성로 140-25",
                "latitude": 35.8347,
                "longitude": 129.2191,
                "categoryName": "여행 > 관광,명소",
                "categoryGroupCode": "AT4",
                "categoryGroupName": "관광명소",
                "phone": "",
                "placeUrl": "http://place.map.kakao.com/12345",
            },
            "placeType": "TOUR",
            "caption": caption,
            "photoUrl": "https://example.com/cheomseongdae.jpg",
        }
    )


def test_create_spot_keeps_snapshot_without_writing_place(
    database: pymysql.Connection,
) -> None:
    first = create_spot(
        database,
        user_no=1,
        request=spot_request("해 질 무렵이 아름다워요."),
    )
    second = create_spot(
        database,
        user_no=1,
        request=spot_request("밤에도 다시 보고 싶어요."),
    )
    with database.cursor() as cursor:
        cursor.execute("SELECT COUNT(*) AS COUNT FROM PLACE")
        place_count = cursor.fetchone()["COUNT"]
        cursor.execute(
            """
            SELECT MAP_PROVIDER, MAP_PLACE_ID, PLACE_TYPE, PLACE_NAME, PLACE_ADDRESS
            FROM SPOTS WHERE IDX = %s
            """,
            (first.id,),
        )
        snapshot = cursor.fetchone()

    spots = list_user_spots(database, user_no=1, limit=20)
    assert first.id != second.id
    assert place_count == 0
    assert snapshot == {
        "MAP_PROVIDER": "KAKAO",
        "MAP_PLACE_ID": "12345",
        "PLACE_TYPE": "TOUR",
        "PLACE_NAME": "첨성대",
        "PLACE_ADDRESS": "경북 경주시 첨성로 140-25",
    }
    assert [spot.caption for spot in spots] == [
        "밤에도 다시 보고 싶어요.",
        "해 질 무렵이 아름다워요.",
    ]


def test_temporary_approval_publishes_pending_spot(
    database: pymysql.Connection,
) -> None:
    spot = create_spot(database, user_no=1, request=spot_request("임시 승인 대상"))
    ranking_time = datetime(2026, 8, 5, 12, 0)
    assert list_daily_ranking(
        database,
        viewer_no=1,
        limit=20,
        now=ranking_time,
    ) == []

    assert approve_pending_spot(
        database,
        spot_id=spot.id,
        now=ranking_time,
    ) is True
    with database.cursor() as cursor:
        cursor.execute(
            "SELECT MODERATION_STATUS FROM SPOTS WHERE IDX = %s",
            (spot.id,),
        )
        moderation_status = cursor.fetchone()["MODERATION_STATUS"]
        cursor.execute(
            "SELECT PROVIDER, RESULT FROM MODERATION_LOG WHERE TARGET_IDX = %s",
            (spot.id,),
        )
        moderation_log = cursor.fetchone()

    assert moderation_status == 1
    assert moderation_log == {
        "PROVIDER": "TEMPORARY_AUTO_APPROVAL",
        "RESULT": 1,
    }
    refreshed_ranking = list_daily_ranking(
        database,
        viewer_no=1,
        limit=20,
        now=ranking_time,
    )
    assert [(ranked.id, ranked.rank) for ranked in refreshed_ranking] == [
        (spot.id, 1)
    ]


def test_public_spots_support_like_and_newest_sort(
    database: pymysql.Connection,
) -> None:
    first = create_spot(database, user_no=1, request=spot_request("첫 번째"))
    second = create_spot(database, user_no=1, request=spot_request("두 번째"))
    with database.cursor() as cursor:
        cursor.execute(
            "UPDATE SPOTS SET MODERATION_STATUS = 1, LIKE_COUNT = 5 WHERE IDX = %s",
            (first.id,),
        )
        cursor.execute(
            "UPDATE SPOTS SET MODERATION_STATUS = 1, LIKE_COUNT = 1 WHERE IDX = %s",
            (second.id,),
        )

    by_likes = list_public_spots(
        database,
        viewer_no=1,
        limit=20,
        before_id=None,
        sort="likes",
    )
    newest = list_public_spots(
        database,
        viewer_no=1,
        limit=20,
        before_id=None,
        sort="newest",
    )
    assert [spot.id for spot in by_likes] == [first.id, second.id]
    assert [spot.id for spot in newest] == [second.id, first.id]


def test_daily_ranking_is_fixed_until_the_next_day(
    database: pymysql.Connection,
) -> None:
    first = create_spot(database, user_no=1, request=spot_request("첫 번째"))
    second = create_spot(database, user_no=1, request=spot_request("두 번째"))
    with database.cursor() as cursor:
        cursor.execute(
            "UPDATE SPOTS SET MODERATION_STATUS = 1, LIKE_COUNT = 5 WHERE IDX = %s",
            (first.id,),
        )
        cursor.execute(
            "UPDATE SPOTS SET MODERATION_STATUS = 1, LIKE_COUNT = 1 WHERE IDX = %s",
            (second.id,),
        )

    first_snapshot = list_daily_ranking(
        database,
        viewer_no=1,
        limit=20,
        now=datetime(2026, 8, 3, 0, 0),
    )
    with database.cursor() as cursor:
        cursor.execute(
            "UPDATE SPOTS SET LIKE_COUNT = 10 WHERE IDX = %s",
            (second.id,),
        )
    same_day = list_daily_ranking(
        database,
        viewer_no=1,
        limit=20,
        now=datetime(2026, 8, 3, 12, 0),
    )
    next_day = list_daily_ranking(
        database,
        viewer_no=1,
        limit=20,
        now=datetime(2026, 8, 4, 0, 0),
    )

    assert [(spot.id, spot.rank) for spot in first_snapshot] == [
        (first.id, 1),
        (second.id, 2),
    ]
    assert [(spot.id, spot.rank) for spot in same_day] == [
        (first.id, 1),
        (second.id, 2),
    ]
    assert [(spot.id, spot.rank) for spot in next_day] == [
        (second.id, 1),
        (first.id, 2),
    ]
