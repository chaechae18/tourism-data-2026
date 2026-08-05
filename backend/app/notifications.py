import pymysql

from .models.notifications import NotificationResponse, NotificationType


class NotificationNotFoundError(LookupError):
    pass


def create_notification(
    connection: pymysql.Connection,
    *,
    user_no: int,
    notification_type: NotificationType,
    title: str,
    message: str,
    target_type: str | None = None,
    target_id: int | None = None,
) -> int:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO NOTIFICATION (
                USER_NO, TYPE, TITLE, MESSAGE, TARGET_TYPE, TARGET_IDX
            )
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (user_no, notification_type, title, message, target_type, target_id),
        )
        return cursor.lastrowid


def list_notifications(
    connection: pymysql.Connection,
    *,
    user_no: int,
    unread_only: bool,
    limit: int,
) -> list[NotificationResponse]:
    unread_clause = "AND IS_READ = 0" if unread_only else ""
    with connection.cursor() as cursor:
        cursor.execute(
            f"""
            SELECT IDX, TYPE, TITLE, MESSAGE, TARGET_TYPE, TARGET_IDX,
                IS_READ, CREATED_AT
            FROM NOTIFICATION
            WHERE USER_NO = %s {unread_clause}
            ORDER BY CREATED_AT DESC, IDX DESC
            LIMIT %s
            """,
            (user_no, limit),
        )
        rows = cursor.fetchall()
    return [_to_response(row) for row in rows]


def get_notification(
    connection: pymysql.Connection,
    *,
    user_no: int,
    notification_id: int,
) -> NotificationResponse:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT IDX, TYPE, TITLE, MESSAGE, TARGET_TYPE, TARGET_IDX,
                IS_READ, CREATED_AT
            FROM NOTIFICATION
            WHERE IDX = %s AND USER_NO = %s
            """,
            (notification_id, user_no),
        )
        row = cursor.fetchone()
    if row is None:
        raise NotificationNotFoundError
    return _to_response(row)


def mark_notification_read(
    connection: pymysql.Connection,
    *,
    user_no: int,
    notification_id: int,
) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            UPDATE NOTIFICATION
            SET IS_READ = 1, READ_AT = COALESCE(READ_AT, CURRENT_TIMESTAMP)
            WHERE IDX = %s AND USER_NO = %s
            """,
            (notification_id, user_no),
        )
        if cursor.rowcount == 0:
            raise NotificationNotFoundError


def _to_response(row: dict) -> NotificationResponse:
    return NotificationResponse.model_validate(
        {
            "id": row["IDX"],
            "type": row["TYPE"],
            "title": row["TITLE"],
            "message": row["MESSAGE"],
            "targetType": row["TARGET_TYPE"],
            "targetId": row["TARGET_IDX"],
            "isRead": bool(row["IS_READ"]),
            "createdAt": row["CREATED_AT"],
        }
    )
