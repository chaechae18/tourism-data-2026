import pymysql

from .models.common import ReactionType
from .models.spots import CommentCreateRequest, CommentResponse, ReactionResponse
from .notifications import create_notification
from .spots import SpotNotFoundError, UserNotFoundError, transaction


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


def require_active_user(connection: pymysql.Connection, user_no: int) -> None:
    if _one(connection, "SELECT NO FROM USERS WHERE NO = %s AND STATUS = 1 AND DELETED_AT IS NULL", (user_no,)) is None:
        raise UserNotFoundError


def require_approved_spot(connection: pymysql.Connection, spot_id: int) -> None:
    if _one(connection, "SELECT IDX FROM SPOTS WHERE IDX = %s AND MODERATION_STATUS = 1 AND DELETED_AT IS NULL", (spot_id,)) is None:
        raise SpotNotFoundError


def set_reaction(connection: pymysql.Connection, *, spot_id: int, user_no: int, reaction_type: ReactionType, active: bool) -> ReactionResponse:
    require_active_user(connection, user_no)
    require_approved_spot(connection, spot_id)
    inserted = False
    with transaction(connection):
        if active:
            with connection.cursor() as cursor:
                cursor.execute(
                    "INSERT IGNORE INTO SPOT_REACTIONS (SPOT_IDX, USER_NO, TYPE) VALUES (%s, %s, %s)",
                    (spot_id, user_no, reaction_type.database_value),
                )
                inserted = cursor.rowcount > 0
        else:
            _execute(connection, "DELETE FROM SPOT_REACTIONS WHERE SPOT_IDX = %s AND USER_NO = %s AND TYPE = %s", (spot_id, user_no, reaction_type.database_value))
        _execute(connection, """
            UPDATE SPOTS SET LIKE_COUNT = (
                SELECT COUNT(*) FROM SPOT_REACTIONS AS reactions
                WHERE reactions.SPOT_IDX = %s AND reactions.TYPE = 1
            ) WHERE IDX = %s
            """, (spot_id, spot_id))
        if inserted and reaction_type == ReactionType.LIKE:
            spot = _one(
                connection,
                "SELECT USER_NO, PLACE_NAME FROM SPOTS WHERE IDX = %s",
                (spot_id,),
            )
            if spot and spot["USER_NO"] != user_no:
                create_notification(
                    connection,
                    user_no=spot["USER_NO"],
                    notification_type="SPOT_LIKE",
                    title="새로운 좋아요",
                    message=f"{spot['PLACE_NAME']} 스팟에 좋아요가 눌렸어요.",
                    target_type="SPOT",
                    target_id=spot_id,
                )
    like_count = _one(connection, "SELECT LIKE_COUNT FROM SPOTS WHERE IDX = %s", (spot_id,))["LIKE_COUNT"]
    return ReactionResponse(spotId=spot_id, type=reaction_type, active=active, likeCount=like_count)


def create_comment(connection: pymysql.Connection, *, spot_id: int, user_no: int, request: CommentCreateRequest) -> CommentResponse:
    require_active_user(connection, user_no)
    require_approved_spot(connection, spot_id)
    comment_id = _execute(connection, "INSERT INTO SPOT_COMMENT (SPOT_IDX, USER_NO, CONTENT) VALUES (%s, %s, %s)", (spot_id, user_no, request.content))
    return get_comment(connection, comment_id=comment_id, viewer_no=user_no)


def get_comment(connection: pymysql.Connection, *, comment_id: int, viewer_no: int | None) -> CommentResponse:
    row = _one(connection, """
        SELECT c.IDX, c.SPOT_IDX, c.USER_NO, u.NICKNAME, c.CONTENT, c.MODERATION_STATUS,
            (c.USER_NO = %s) AS IS_OWNER, c.CREATED_AT
        FROM SPOT_COMMENT c JOIN USERS u ON u.NO = c.USER_NO
        WHERE c.IDX = %s AND c.DELETED_AT IS NULL
        """, (viewer_no or -1, comment_id))
    if row is None:
        raise LookupError
    return _to_comment_response(row)


def list_comments(connection: pymysql.Connection, *, spot_id: int, viewer_no: int | None, limit: int) -> list[CommentResponse]:
    require_approved_spot(connection, spot_id)
    viewer = viewer_no or -1
    rows = _all(connection, """
        SELECT c.IDX, c.SPOT_IDX, c.USER_NO, u.NICKNAME, c.CONTENT, c.MODERATION_STATUS,
            (c.USER_NO = %s) AS IS_OWNER, c.CREATED_AT
        FROM SPOT_COMMENT c JOIN USERS u ON u.NO = c.USER_NO
        WHERE c.SPOT_IDX = %s AND c.DELETED_AT IS NULL
          AND (c.MODERATION_STATUS = 1 OR c.USER_NO = %s)
        ORDER BY c.IDX ASC LIMIT %s
        """, (viewer, spot_id, viewer, limit))
    return [_to_comment_response(row) for row in rows]


def _to_comment_response(row: dict) -> CommentResponse:
    return CommentResponse.model_validate({
        "id": row["IDX"], "spotId": row["SPOT_IDX"], "userNo": row["USER_NO"],
        "authorNickname": row["NICKNAME"], "content": row["CONTENT"],
        "moderationStatus": row["MODERATION_STATUS"], "isOwner": bool(row["IS_OWNER"]),
        "createdAt": row["CREATED_AT"],
    })
