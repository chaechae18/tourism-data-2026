import sqlite3

from .models.common import ReactionType
from .models.spots import (
    CommentCreateRequest,
    CommentResponse,
    ReactionResponse,
)
from .spots import SpotNotFoundError, UserNotFoundError


def require_active_user(
    connection: sqlite3.Connection,
    user_no: int,
) -> None:
    user = connection.execute(
        "SELECT NO FROM USERS WHERE NO = ? AND STATUS = 1 AND DELETED_AT IS NULL",
        (user_no,),
    ).fetchone()
    if user is None:
        raise UserNotFoundError


def require_approved_spot(
    connection: sqlite3.Connection,
    spot_id: int,
) -> None:
    spot = connection.execute(
        """
        SELECT IDX
        FROM SPOTS
        WHERE IDX = ?
          AND MODERATION_STATUS = 1
          AND DELETED_AT IS NULL
        """,
        (spot_id,),
    ).fetchone()
    if spot is None:
        raise SpotNotFoundError


def set_reaction(
    connection: sqlite3.Connection,
    *,
    spot_id: int,
    user_no: int,
    reaction_type: ReactionType,
    active: bool,
) -> ReactionResponse:
    require_active_user(connection, user_no)
    require_approved_spot(connection, spot_id)

    with connection:
        if active:
            connection.execute(
                """
                INSERT INTO SPOT_REACTIONS (SPOT_IDX, USER_NO, TYPE)
                VALUES (?, ?, ?)
                ON CONFLICT(SPOT_IDX, USER_NO, TYPE) DO NOTHING
                """,
                (spot_id, user_no, reaction_type.database_value),
            )
        else:
            connection.execute(
                """
                DELETE FROM SPOT_REACTIONS
                WHERE SPOT_IDX = ? AND USER_NO = ? AND TYPE = ?
                """,
                (spot_id, user_no, reaction_type.database_value),
            )
        connection.execute(
            """
            UPDATE SPOTS
            SET LIKE_COUNT = (
                SELECT COUNT(*)
                FROM SPOT_REACTIONS
                WHERE SPOT_IDX = ? AND TYPE = 1
            )
            WHERE IDX = ?
            """,
            (spot_id, spot_id),
        )
        like_count = connection.execute(
            "SELECT LIKE_COUNT FROM SPOTS WHERE IDX = ?",
            (spot_id,),
        ).fetchone()["LIKE_COUNT"]

    return ReactionResponse(
        spotId=spot_id,
        type=reaction_type,
        active=active,
        likeCount=like_count,
    )


def create_comment(
    connection: sqlite3.Connection,
    *,
    spot_id: int,
    user_no: int,
    request: CommentCreateRequest,
) -> CommentResponse:
    require_active_user(connection, user_no)
    require_approved_spot(connection, spot_id)
    with connection:
        cursor = connection.execute(
            """
            INSERT INTO SPOT_COMMENT (SPOT_IDX, USER_NO, CONTENT)
            VALUES (?, ?, ?)
            """,
            (spot_id, user_no, request.content),
        )
    return get_comment(
        connection,
        comment_id=cursor.lastrowid,
        viewer_no=user_no,
    )


def get_comment(
    connection: sqlite3.Connection,
    *,
    comment_id: int,
    viewer_no: int | None,
) -> CommentResponse:
    row = connection.execute(
        """
        SELECT
            c.IDX,
            c.SPOT_IDX,
            c.USER_NO,
            u.NICKNAME,
            c.CONTENT,
            c.MODERATION_STATUS,
            (c.USER_NO = ?) AS IS_OWNER,
            c.CREATED_AT
        FROM SPOT_COMMENT c
        JOIN USERS u ON u.NO = c.USER_NO
        WHERE c.IDX = ? AND c.DELETED_AT IS NULL
        """,
        (viewer_no or -1, comment_id),
    ).fetchone()
    if row is None:
        raise LookupError
    return _to_comment_response(row)


def list_comments(
    connection: sqlite3.Connection,
    *,
    spot_id: int,
    viewer_no: int | None,
    limit: int,
) -> list[CommentResponse]:
    require_approved_spot(connection, spot_id)
    viewer = viewer_no or -1
    rows = connection.execute(
        """
        SELECT
            c.IDX,
            c.SPOT_IDX,
            c.USER_NO,
            u.NICKNAME,
            c.CONTENT,
            c.MODERATION_STATUS,
            (c.USER_NO = ?) AS IS_OWNER,
            c.CREATED_AT
        FROM SPOT_COMMENT c
        JOIN USERS u ON u.NO = c.USER_NO
        WHERE c.SPOT_IDX = ?
          AND c.DELETED_AT IS NULL
          AND (c.MODERATION_STATUS = 1 OR c.USER_NO = ?)
        ORDER BY c.IDX ASC
        LIMIT ?
        """,
        (viewer, spot_id, viewer, limit),
    ).fetchall()
    return [_to_comment_response(row) for row in rows]


def _to_comment_response(row: sqlite3.Row) -> CommentResponse:
    return CommentResponse.model_validate(
        {
            "id": row["IDX"],
            "spotId": row["SPOT_IDX"],
            "userNo": row["USER_NO"],
            "authorNickname": row["NICKNAME"],
            "content": row["CONTENT"],
            "moderationStatus": row["MODERATION_STATUS"],
            "isOwner": bool(row["IS_OWNER"]),
            "createdAt": row["CREATED_AT"],
        }
    )
