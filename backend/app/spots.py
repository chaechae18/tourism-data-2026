from contextlib import contextmanager
from datetime import datetime, time
from typing import Iterator, Literal

import pymysql

from . import content_guardrails
from .models.spots import RankedSpotResponse, SpotCreateRequest, SpotResponse


class UserNotFoundError(LookupError):
    pass


class SpotNotFoundError(LookupError):
    pass


class SpotForbiddenError(PermissionError):
    pass


SpotSort = Literal["likes", "newest"]

SPOT_SELECT = """
    SELECT s.IDX AS SPOT_ID, s.USER_NO, u.NICKNAME,
        s.MAP_PROVIDER, s.MAP_PLACE_ID, s.PLACE_TYPE,
        s.PLACE_NAME, s.PLACE_ADDRESS AS ADDRESS,
        s.LAT, s.LNG, s.PHOTO_URL, s.CAPTION, s.LANGUAGE_CODE, s.LIKE_COUNT,
        (SELECT COUNT(*) FROM SPOT_COMMENT c
            WHERE c.SPOT_IDX = s.IDX
              AND c.MODERATION_STATUS = 1
              AND c.DELETED_AT IS NULL) AS COMMENT_COUNT,
        EXISTS(SELECT 1 FROM SPOT_REACTIONS r
            WHERE r.SPOT_IDX = s.IDX AND r.USER_NO = %s AND r.TYPE = 1) AS IS_LIKED,
        EXISTS(SELECT 1 FROM SPOT_REACTIONS r
            WHERE r.SPOT_IDX = s.IDX AND r.USER_NO = %s AND r.TYPE = 2) AS IS_BOOKMARKED,
        (s.USER_NO = %s) AS IS_OWNER,
        s.MODERATION_STATUS, s.CREATED_AT
    FROM SPOTS s
    JOIN USERS u ON u.NO = s.USER_NO
"""


def _one(connection: pymysql.Connection, sql: str, parameters: tuple = ()) -> dict | None:
    with connection.cursor() as cursor:
        cursor.execute(sql, parameters)
        return cursor.fetchone()


def _all(connection: pymysql.Connection, sql: str, parameters: tuple = ()) -> list[dict]:
    with connection.cursor() as cursor:
        cursor.execute(sql, parameters)
        return cursor.fetchall()


def _execute(connection: pymysql.Connection, sql: str, parameters: tuple = ()) -> int:
    with connection.cursor() as cursor:
        cursor.execute(sql, parameters)
        return cursor.lastrowid


@contextmanager
def transaction(connection: pymysql.Connection) -> Iterator[None]:
    connection.begin()
    try:
        yield
    except Exception:
        connection.rollback()
        raise
    else:
        connection.commit()


def _require_active_user(connection: pymysql.Connection, user_no: int) -> None:
    user = _one(
        connection,
        "SELECT NO FROM USERS WHERE NO = %s AND STATUS = 1 AND DELETED_AT IS NULL",
        (user_no,),
    )
    if user is None:
        raise UserNotFoundError


def create_spot(
    connection: pymysql.Connection,
    *,
    user_no: int,
    request: SpotCreateRequest,
) -> SpotResponse:
    _require_active_user(connection, user_no)
    # 검수 서버가 응답하지 않으면 글은 받아 두고 비공개(0)로 둔다. review_pending_spots.py 가 다시 검수한다.
    try:
        approval = content_guardrails.check_content(request.caption, request.photo_url)
    except content_guardrails.ModerationUnavailableError:
        approval = None
    place = request.place
    address = place.road_address or place.address

    with transaction(connection):
        spot_id = _execute(
            connection,
            """
            INSERT INTO SPOTS (
                USER_NO, MAP_PROVIDER, MAP_PLACE_ID, PLACE_TYPE,
                PLACE_NAME, PLACE_ADDRESS, LAT, LNG, PHOTO_URL, CAPTION, LANGUAGE_CODE, MODERATION_STATUS
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                (SELECT LANGUAGE_CODE FROM USERS WHERE NO = %s), %s)
            """,
            (
                user_no,
                place.provider.value,
                place.id,
                request.place_type.value,
                place.name,
                address,
                place.latitude,
                place.longitude,
                request.photo_url,
                request.caption,
                user_no,
                1 if approval else 0,
            ),
        )

        if approval:
            approval.log(connection, target_type=1, target_id=spot_id)
        with connection.cursor() as cursor:
            cursor.execute("DELETE FROM SPOT_RANKING_DAILY WHERE RANK_DATE = %s", (datetime.now().date(),))
            cursor.execute("DELETE FROM SPOT_RANKING_RUN WHERE RANK_DATE = %s", (datetime.now().date(),))

    return get_spot(connection, spot_id=spot_id, viewer_no=user_no)


def get_spot(
    connection: pymysql.Connection,
    *,
    spot_id: int,
    viewer_no: int | None = None,
) -> SpotResponse:
    viewer = viewer_no or -1
    row = _one(
        connection,
        f"{SPOT_SELECT} WHERE s.IDX = %s AND s.DELETED_AT IS NULL",
        (viewer, viewer, viewer, spot_id),
    )
    if row is None:
        raise SpotNotFoundError
    return _to_response(row)


def list_user_spots(
    connection: pymysql.Connection,
    *,
    user_no: int,
    limit: int,
) -> list[SpotResponse]:
    _require_active_user(connection, user_no)
    return _list_spots(
        connection,
        where="s.USER_NO = %s AND s.DELETED_AT IS NULL",
        where_parameters=(user_no,),
        viewer_no=user_no,
        limit=limit,
        sort="newest",
    )


def list_public_spots(
    connection: pymysql.Connection,
    *,
    viewer_no: int | None,
    limit: int,
    before_id: int | None,
    sort: SpotSort,
) -> list[SpotResponse]:
    where = "s.MODERATION_STATUS = 1 AND s.DELETED_AT IS NULL"
    parameters: tuple = ()
    if before_id is not None and sort == "newest":
        where += " AND s.IDX < %s"
        parameters = (before_id,)
    return _list_spots(
        connection,
        where=where,
        where_parameters=parameters,
        viewer_no=viewer_no,
        limit=limit,
        sort=sort,
    )


def _list_spots(
    connection: pymysql.Connection,
    *,
    where: str,
    where_parameters: tuple,
    viewer_no: int | None,
    limit: int,
    sort: SpotSort,
) -> list[SpotResponse]:
    viewer = viewer_no or -1
    order_by = (
        "s.LIKE_COUNT DESC, s.CREATED_AT DESC, s.IDX DESC"
        if sort == "likes"
        else "s.CREATED_AT DESC, s.IDX DESC"
    )
    rows = _all(
        connection,
        f"{SPOT_SELECT} WHERE {where} ORDER BY {order_by} LIMIT %s",
        (viewer, viewer, viewer, *where_parameters, limit),
    )
    return [_to_response(row) for row in rows]


def list_daily_ranking(
    connection: pymysql.Connection,
    *,
    viewer_no: int | None,
    limit: int,
    now: datetime | None = None,
) -> list[RankedSpotResponse]:
    current = now or datetime.now()
    ranking_date = current.date()
    updated_at = datetime.combine(ranking_date, time.min)

    with transaction(connection):
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT IGNORE INTO SPOT_RANKING_RUN (RANK_DATE, UPDATED_AT)
                VALUES (%s, %s)
                """,
                (ranking_date, updated_at),
            )
            if cursor.rowcount:
                cursor.execute(
                    """
                    INSERT INTO SPOT_RANKING_DAILY (
                        RANK_DATE, SPOT_IDX, RANK_POSITION, LIKE_COUNT
                    )
                    SELECT %s, s.IDX,
                        ROW_NUMBER() OVER (
                            ORDER BY s.LIKE_COUNT DESC, s.CREATED_AT DESC, s.IDX DESC
                        ),
                        s.LIKE_COUNT
                    FROM SPOTS s
                    WHERE s.MODERATION_STATUS = 1 AND s.DELETED_AT IS NULL
                    """,
                    (ranking_date,),
                )

    viewer = viewer_no or -1
    ranked_select = SPOT_SELECT.replace(
        "FROM SPOTS s",
        ", daily.RANK_POSITION, run.UPDATED_AT AS RANKING_UPDATED_AT\n    FROM SPOTS s",
    )
    rows = _all(
        connection,
        f"""
        {ranked_select}
        JOIN SPOT_RANKING_DAILY daily
          ON daily.SPOT_IDX = s.IDX AND daily.RANK_DATE = %s
        JOIN SPOT_RANKING_RUN run ON run.RANK_DATE = daily.RANK_DATE
        WHERE s.DELETED_AT IS NULL
        ORDER BY daily.RANK_POSITION
        LIMIT %s
        """,
        (viewer, viewer, viewer, ranking_date, limit),
    )
    # 순서는 하루치 스냅샷을 따르되 번호는 다시 매긴다.
    # RANK_POSITION 을 그대로 쓰면 글이 지워진 자리가 비어 2위부터 보인다.
    return [
        RankedSpotResponse(
            **_to_response(row).model_dump(by_alias=True),
            rank=position,
            rankingUpdatedAt=row["RANKING_UPDATED_AT"],
        )
        for position, row in enumerate(rows, start=1)
    ]


def delete_spot(connection: pymysql.Connection, *, spot_id: int, user_no: int) -> None:
    row = _one(
        connection,
        "SELECT USER_NO FROM SPOTS WHERE IDX = %s AND DELETED_AT IS NULL",
        (spot_id,),
    )
    if row is None:
        raise SpotNotFoundError
    if row["USER_NO"] != user_no:
        raise SpotForbiddenError
    _execute(
        connection,
        "UPDATE SPOTS SET DELETED_AT = CURRENT_TIMESTAMP WHERE IDX = %s",
        (spot_id,),
    )


def _to_response(row: dict) -> SpotResponse:
    return SpotResponse.model_validate(
        {
            "id": row["SPOT_ID"],
            "userNo": row["USER_NO"],
            "authorNickname": row["NICKNAME"],
            "place": {
                "provider": row["MAP_PROVIDER"],
                "mapPlaceId": row["MAP_PLACE_ID"],
                "type": row["PLACE_TYPE"],
                "name": row["PLACE_NAME"],
                "address": row["ADDRESS"],
                "latitude": row["LAT"],
                "longitude": row["LNG"],
            },
            "photoUrl": row["PHOTO_URL"],
            "caption": row["CAPTION"],
            "languageCode": row["LANGUAGE_CODE"],
            "likeCount": row["LIKE_COUNT"],
            "commentCount": row["COMMENT_COUNT"],
            "isLiked": bool(row["IS_LIKED"]),
            "isBookmarked": bool(row["IS_BOOKMARKED"]),
            "isOwner": bool(row["IS_OWNER"]),
            "moderationStatus": row["MODERATION_STATUS"],
            "createdAt": row["CREATED_AT"],
        }
    )
