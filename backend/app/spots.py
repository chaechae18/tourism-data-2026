import sqlite3

from .models.spots import SpotCreateRequest, SpotResponse


class UserNotFoundError(LookupError):
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

    return get_spot(connection, spot_id=cursor.lastrowid, place_id=place_row["IDX"])


def get_spot(
    connection: sqlite3.Connection,
    *,
    spot_id: int,
    place_id: int | None = None,
) -> SpotResponse:
    place_clause = "AND p.IDX = ?" if place_id is not None else ""
    parameters = (spot_id, place_id) if place_id is not None else (spot_id,)
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
        raise LookupError
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
        (user_no, limit),
    ).fetchall()
    return [_to_response(row) for row in rows]


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
            "moderationStatus": row["MODERATION_STATUS"],
            "createdAt": row["CREATED_AT"],
        }
    )
