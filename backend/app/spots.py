import sqlite3

from .models.spots import SpotCreateRequest, SpotResponse


class UserNotFoundError(LookupError):
    pass


class SpotNotFoundError(LookupError):
    pass


class SpotForbiddenError(PermissionError):
    pass


def create_spot(
    connection: sqlite3.Connection,
    *,
    user_no: int,
    request: SpotCreateRequest,
) -> SpotResponse:
    user = connection.execute(
        "SELECT NO FROM USERS WHERE NO = ? AND STATUS = 1 AND DELETED_AT IS NULL",
        (user_no,),
    ).fetchone()
    if user is None:
        raise UserNotFoundError

    place = request.place
    address = place.road_address or place.address

    with connection:
        connection.execute(
            """
            INSERT INTO PLACE (
                SOURCE,
                CONTENT_ID,
                TYPE,
                NAME,
                ADDRESS,
                LATITUDE,
                LONGITUDE
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(SOURCE, CONTENT_ID) DO UPDATE SET
                TYPE = excluded.TYPE,
                NAME = excluded.NAME,
                ADDRESS = excluded.ADDRESS,
                LATITUDE = excluded.LATITUDE,
                LONGITUDE = excluded.LONGITUDE
            """,
            (
                place.provider.value,
                place.id,
                request.place_type.value,
                place.name,
                address,
                str(place.latitude),
                str(place.longitude),
            ),
        )
        place_row = connection.execute(
            """
            SELECT IDX
            FROM PLACE
            WHERE SOURCE = ? AND CONTENT_ID = ?
            """,
            (place.provider.value, place.id),
        ).fetchone()
        cursor = connection.execute(
            """
            INSERT INTO SPOTS (
                USER_NO,
                MAP_PROVIDER,
                MAP_PLACE_ID,
                LAT,
                LNG,
                PHOTO_URL,
                CAPTION
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_no,
                place.provider.value,
                place.id,
                place.latitude,
                place.longitude,
                request.photo_url,
                request.caption,
            ),
        )

    return get_spot(
        connection,
        spot_id=cursor.lastrowid,
        place_id=place_row["IDX"],
        viewer_no=user_no,
    )


def get_spot(
    connection: sqlite3.Connection,
    *,
    spot_id: int,
    place_id: int | None = None,
    viewer_no: int | None = None,
) -> SpotResponse:
    viewer = viewer_no or -1
    place_clause = "AND p.IDX = ?" if place_id is not None else ""
    parameters = (
        (viewer, viewer, viewer, spot_id, place_id)
        if place_id is not None
        else (viewer, viewer, viewer, spot_id)
    )
    row = connection.execute(
        f"""
        SELECT
            s.IDX AS SPOT_ID,
            s.USER_NO,
            u.NICKNAME,
            p.IDX AS PLACE_ID,
            p.SOURCE AS MAP_PROVIDER,
            p.CONTENT_ID AS MAP_PLACE_ID,
            p.TYPE AS PLACE_TYPE,
            p.NAME AS PLACE_NAME,
            p.ADDRESS,
            s.LAT,
            s.LNG,
            s.PHOTO_URL,
            s.CAPTION,
            s.LIKE_COUNT,
            (
                SELECT COUNT(*)
                FROM SPOT_COMMENT c
                WHERE c.SPOT_IDX = s.IDX
                  AND c.MODERATION_STATUS = 1
                  AND c.DELETED_AT IS NULL
            ) AS COMMENT_COUNT,
            EXISTS(
                SELECT 1
                FROM SPOT_REACTIONS r
                WHERE r.SPOT_IDX = s.IDX
                  AND r.USER_NO = ?
                  AND r.TYPE = 1
            ) AS IS_LIKED,
            EXISTS(
                SELECT 1
                FROM SPOT_REACTIONS r
                WHERE r.SPOT_IDX = s.IDX
                  AND r.USER_NO = ?
                  AND r.TYPE = 2
            ) AS IS_BOOKMARKED,
            (s.USER_NO = ?) AS IS_OWNER,
            s.MODERATION_STATUS,
            s.CREATED_AT
        FROM SPOTS s
        JOIN USERS u ON u.NO = s.USER_NO
        JOIN PLACE p
          ON p.SOURCE = s.MAP_PROVIDER
         AND p.CONTENT_ID = s.MAP_PLACE_ID
        WHERE s.IDX = ?
          AND s.DELETED_AT IS NULL
          {place_clause}
        """,
        parameters,
    ).fetchone()
    if row is None:
        raise SpotNotFoundError
    return _to_response(row)


def list_user_spots(
    connection: sqlite3.Connection,
    *,
    user_no: int,
    limit: int,
) -> list[SpotResponse]:
    user = connection.execute(
        "SELECT NO FROM USERS WHERE NO = ? AND STATUS = 1 AND DELETED_AT IS NULL",
        (user_no,),
    ).fetchone()
    if user is None:
        raise UserNotFoundError

    rows = connection.execute(
        """
        SELECT
            s.IDX AS SPOT_ID,
            s.USER_NO,
            u.NICKNAME,
            p.IDX AS PLACE_ID,
            p.SOURCE AS MAP_PROVIDER,
            p.CONTENT_ID AS MAP_PLACE_ID,
            p.TYPE AS PLACE_TYPE,
            p.NAME AS PLACE_NAME,
            p.ADDRESS,
            s.LAT,
            s.LNG,
            s.PHOTO_URL,
            s.CAPTION,
            s.LIKE_COUNT,
            (
                SELECT COUNT(*)
                FROM SPOT_COMMENT c
                WHERE c.SPOT_IDX = s.IDX
                  AND c.MODERATION_STATUS = 1
                  AND c.DELETED_AT IS NULL
            ) AS COMMENT_COUNT,
            EXISTS(
                SELECT 1
                FROM SPOT_REACTIONS r
                WHERE r.SPOT_IDX = s.IDX
                  AND r.USER_NO = ?
                  AND r.TYPE = 1
            ) AS IS_LIKED,
            EXISTS(
                SELECT 1
                FROM SPOT_REACTIONS r
                WHERE r.SPOT_IDX = s.IDX
                  AND r.USER_NO = ?
                  AND r.TYPE = 2
            ) AS IS_BOOKMARKED,
            1 AS IS_OWNER,
            s.MODERATION_STATUS,
            s.CREATED_AT
        FROM SPOTS s
        JOIN USERS u ON u.NO = s.USER_NO
        JOIN PLACE p
          ON p.SOURCE = s.MAP_PROVIDER
         AND p.CONTENT_ID = s.MAP_PLACE_ID
        WHERE s.USER_NO = ?
          AND s.DELETED_AT IS NULL
        ORDER BY s.CREATED_AT DESC, s.IDX DESC
        LIMIT ?
        """,
        (user_no, user_no, user_no, limit),
    ).fetchall()
    return [_to_response(row) for row in rows]


def list_public_spots(
    connection: sqlite3.Connection,
    *,
    viewer_no: int | None,
    limit: int,
    before_id: int | None,
) -> list[SpotResponse]:
    viewer = viewer_no or -1
    before_clause = "AND s.IDX < ?" if before_id is not None else ""
    parameters = (
        (viewer, viewer, viewer, before_id, limit)
        if before_id is not None
        else (viewer, viewer, viewer, limit)
    )
    rows = connection.execute(
        f"""
        SELECT
            s.IDX AS SPOT_ID,
            s.USER_NO,
            u.NICKNAME,
            p.IDX AS PLACE_ID,
            p.SOURCE AS MAP_PROVIDER,
            p.CONTENT_ID AS MAP_PLACE_ID,
            p.TYPE AS PLACE_TYPE,
            p.NAME AS PLACE_NAME,
            p.ADDRESS,
            s.LAT,
            s.LNG,
            s.PHOTO_URL,
            s.CAPTION,
            s.LIKE_COUNT,
            (
                SELECT COUNT(*)
                FROM SPOT_COMMENT c
                WHERE c.SPOT_IDX = s.IDX
                  AND c.MODERATION_STATUS = 1
                  AND c.DELETED_AT IS NULL
            ) AS COMMENT_COUNT,
            EXISTS(
                SELECT 1
                FROM SPOT_REACTIONS r
                WHERE r.SPOT_IDX = s.IDX
                  AND r.USER_NO = ?
                  AND r.TYPE = 1
            ) AS IS_LIKED,
            EXISTS(
                SELECT 1
                FROM SPOT_REACTIONS r
                WHERE r.SPOT_IDX = s.IDX
                  AND r.USER_NO = ?
                  AND r.TYPE = 2
            ) AS IS_BOOKMARKED,
            (s.USER_NO = ?) AS IS_OWNER,
            s.MODERATION_STATUS,
            s.CREATED_AT
        FROM SPOTS s
        JOIN USERS u ON u.NO = s.USER_NO
        JOIN PLACE p
          ON p.SOURCE = s.MAP_PROVIDER
         AND p.CONTENT_ID = s.MAP_PLACE_ID
        WHERE s.MODERATION_STATUS = 1
          AND s.DELETED_AT IS NULL
          {before_clause}
        ORDER BY s.IDX DESC
        LIMIT ?
        """,
        parameters,
    ).fetchall()
    return [_to_response(row) for row in rows]


def delete_spot(
    connection: sqlite3.Connection,
    *,
    spot_id: int,
    user_no: int,
) -> None:
    row = connection.execute(
        "SELECT USER_NO FROM SPOTS WHERE IDX = ? AND DELETED_AT IS NULL",
        (spot_id,),
    ).fetchone()
    if row is None:
        raise SpotNotFoundError
    if row["USER_NO"] != user_no:
        raise SpotForbiddenError
    with connection:
        connection.execute(
            "UPDATE SPOTS SET DELETED_AT = CURRENT_TIMESTAMP WHERE IDX = ?",
            (spot_id,),
        )


def _to_response(row: sqlite3.Row) -> SpotResponse:
    return SpotResponse.model_validate(
        {
            "id": row["SPOT_ID"],
            "userNo": row["USER_NO"],
            "authorNickname": row["NICKNAME"],
            "place": {
                "placeId": row["PLACE_ID"],
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
            "likeCount": row["LIKE_COUNT"],
            "commentCount": (
                row["COMMENT_COUNT"] if "COMMENT_COUNT" in row.keys() else 0
            ),
            "isLiked": bool(row["IS_LIKED"]) if "IS_LIKED" in row.keys() else False,
            "isBookmarked": (
                bool(row["IS_BOOKMARKED"])
                if "IS_BOOKMARKED" in row.keys()
                else False
            ),
            "isOwner": bool(row["IS_OWNER"]) if "IS_OWNER" in row.keys() else False,
            "moderationStatus": row["MODERATION_STATUS"],
            "createdAt": row["CREATED_AT"],
        }
    )
