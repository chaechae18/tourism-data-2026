import pymysql

from .models.spots import SpotCreateRequest, SpotResponse


class UserNotFoundError(LookupError):
    pass


class SpotNotFoundError(LookupError):
    pass


class SpotForbiddenError(PermissionError):
    pass


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


def _require_active_user(connection: pymysql.Connection, user_no: int) -> None:
    if _one(connection, "SELECT NO FROM USERS WHERE NO = %s AND STATUS = 1 AND DELETED_AT IS NULL", (user_no,)) is None:
        raise UserNotFoundError


def create_spot(connection: pymysql.Connection, *, user_no: int, request: SpotCreateRequest) -> SpotResponse:
    _require_active_user(connection, user_no)
    place = request.place
    address = place.road_address or place.address
    _execute(connection, """
        INSERT INTO PLACE (SOURCE, CONTENT_ID, TYPE, NAME, ADDRESS, LATITUDE, LONGITUDE)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            TYPE = VALUES(TYPE), NAME = VALUES(NAME), ADDRESS = VALUES(ADDRESS),
            LATITUDE = VALUES(LATITUDE), LONGITUDE = VALUES(LONGITUDE)
        """, (place.provider.value, place.id, request.place_type.value, place.name, address,
               str(place.latitude), str(place.longitude)))
    place_row = _one(connection, "SELECT IDX FROM PLACE WHERE SOURCE = %s AND CONTENT_ID = %s", (place.provider.value, place.id))
    spot_id = _execute(connection, """
        INSERT INTO SPOTS (USER_NO, MAP_PROVIDER, MAP_PLACE_ID, LAT, LNG, PHOTO_URL, CAPTION)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (user_no, place.provider.value, place.id, place.latitude, place.longitude,
               request.photo_url, request.caption))
    return get_spot(connection, spot_id=spot_id, place_id=place_row["IDX"], viewer_no=user_no)


def get_spot(connection: pymysql.Connection, *, spot_id: int, place_id: int | None = None, viewer_no: int | None = None) -> SpotResponse:
    viewer = viewer_no or -1
    place_clause = "AND p.IDX = %s" if place_id is not None else ""
    parameters = (viewer, viewer, viewer, spot_id, place_id) if place_id is not None else (viewer, viewer, viewer, spot_id)
    row = _one(connection, f"""
        SELECT s.IDX AS SPOT_ID, s.USER_NO, u.NICKNAME, p.IDX AS PLACE_ID,
            p.SOURCE AS MAP_PROVIDER, p.CONTENT_ID AS MAP_PLACE_ID, p.TYPE AS PLACE_TYPE,
            p.NAME AS PLACE_NAME, p.ADDRESS, s.LAT, s.LNG, s.PHOTO_URL, s.CAPTION, s.LIKE_COUNT,
            (SELECT COUNT(*) FROM SPOT_COMMENT c WHERE c.SPOT_IDX = s.IDX
                AND c.MODERATION_STATUS = 1 AND c.DELETED_AT IS NULL) AS COMMENT_COUNT,
            EXISTS(SELECT 1 FROM SPOT_REACTIONS r WHERE r.SPOT_IDX = s.IDX AND r.USER_NO = %s AND r.TYPE = 1) AS IS_LIKED,
            EXISTS(SELECT 1 FROM SPOT_REACTIONS r WHERE r.SPOT_IDX = s.IDX AND r.USER_NO = %s AND r.TYPE = 2) AS IS_BOOKMARKED,
            (s.USER_NO = %s) AS IS_OWNER, s.MODERATION_STATUS, s.CREATED_AT
        FROM SPOTS s JOIN USERS u ON u.NO = s.USER_NO
        JOIN PLACE p ON p.SOURCE = s.MAP_PROVIDER AND p.CONTENT_ID = s.MAP_PLACE_ID
        WHERE s.IDX = %s AND s.DELETED_AT IS NULL {place_clause}
        """, parameters)
    if row is None:
        raise SpotNotFoundError
    return _to_response(row)


def list_user_spots(connection: pymysql.Connection, *, user_no: int, limit: int) -> list[SpotResponse]:
    _require_active_user(connection, user_no)
    return _list_spots(connection, where="s.USER_NO = %s AND s.DELETED_AT IS NULL", where_parameters=(user_no,), viewer_no=user_no, limit=limit)


def list_public_spots(connection: pymysql.Connection, *, viewer_no: int | None, limit: int, before_id: int | None) -> list[SpotResponse]:
    where = "s.MODERATION_STATUS = 1 AND s.DELETED_AT IS NULL"
    parameters: tuple = ()
    if before_id is not None:
        where += " AND s.IDX < %s"
        parameters = (before_id,)
    return _list_spots(connection, where=where, where_parameters=parameters, viewer_no=viewer_no, limit=limit)


def _list_spots(connection: pymysql.Connection, *, where: str, where_parameters: tuple, viewer_no: int | None, limit: int) -> list[SpotResponse]:
    viewer = viewer_no or -1
    rows = _all(connection, f"""
        SELECT s.IDX AS SPOT_ID, s.USER_NO, u.NICKNAME, p.IDX AS PLACE_ID,
            p.SOURCE AS MAP_PROVIDER, p.CONTENT_ID AS MAP_PLACE_ID, p.TYPE AS PLACE_TYPE,
            p.NAME AS PLACE_NAME, p.ADDRESS, s.LAT, s.LNG, s.PHOTO_URL, s.CAPTION, s.LIKE_COUNT,
            (SELECT COUNT(*) FROM SPOT_COMMENT c WHERE c.SPOT_IDX = s.IDX
                AND c.MODERATION_STATUS = 1 AND c.DELETED_AT IS NULL) AS COMMENT_COUNT,
            EXISTS(SELECT 1 FROM SPOT_REACTIONS r WHERE r.SPOT_IDX = s.IDX AND r.USER_NO = %s AND r.TYPE = 1) AS IS_LIKED,
            EXISTS(SELECT 1 FROM SPOT_REACTIONS r WHERE r.SPOT_IDX = s.IDX AND r.USER_NO = %s AND r.TYPE = 2) AS IS_BOOKMARKED,
            (s.USER_NO = %s) AS IS_OWNER, s.MODERATION_STATUS, s.CREATED_AT
        FROM SPOTS s JOIN USERS u ON u.NO = s.USER_NO
        JOIN PLACE p ON p.SOURCE = s.MAP_PROVIDER AND p.CONTENT_ID = s.MAP_PLACE_ID
        WHERE {where} ORDER BY s.CREATED_AT DESC, s.IDX DESC LIMIT %s
        """, (viewer, viewer, viewer, *where_parameters, limit))
    return [_to_response(row) for row in rows]


def delete_spot(connection: pymysql.Connection, *, spot_id: int, user_no: int) -> None:
    row = _one(connection, "SELECT USER_NO FROM SPOTS WHERE IDX = %s AND DELETED_AT IS NULL", (spot_id,))
    if row is None:
        raise SpotNotFoundError
    if row["USER_NO"] != user_no:
        raise SpotForbiddenError
    _execute(connection, "UPDATE SPOTS SET DELETED_AT = CURRENT_TIMESTAMP WHERE IDX = %s", (spot_id,))


def _to_response(row: dict) -> SpotResponse:
    return SpotResponse.model_validate({
        "id": row["SPOT_ID"], "userNo": row["USER_NO"], "authorNickname": row["NICKNAME"],
        "place": {"placeId": row["PLACE_ID"], "provider": row["MAP_PROVIDER"], "mapPlaceId": row["MAP_PLACE_ID"], "type": row["PLACE_TYPE"], "name": row["PLACE_NAME"], "address": row["ADDRESS"], "latitude": row["LAT"], "longitude": row["LNG"]},
        "photoUrl": row["PHOTO_URL"], "caption": row["CAPTION"], "likeCount": row["LIKE_COUNT"],
        "commentCount": row["COMMENT_COUNT"], "isLiked": bool(row["IS_LIKED"]),
        "isBookmarked": bool(row["IS_BOOKMARKED"]), "isOwner": bool(row["IS_OWNER"]),
        "moderationStatus": row["MODERATION_STATUS"], "createdAt": row["CREATED_AT"],
    })
