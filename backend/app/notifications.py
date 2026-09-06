from datetime import datetime

import pymysql

from .home import DEFAULT_LANGUAGE
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


# 공지는 운영자가 POPUP 에 한 번 넣으면 끝이라 사용자별 알림 행이 없다. 알림을 열 때
# 아직 받지 않은 공지만 채워 넣는다. 여기 적히는 문구는 POPUP 이 지워졌을 때만 쓰인다.
def sync_popup_notifications(connection: pymysql.Connection, *, user_no: int) -> None:
    now = datetime.now()
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO NOTIFICATION (
                USER_NO, TYPE, TITLE, MESSAGE, TARGET_TYPE, TARGET_IDX
            )
            SELECT
                %s,
                'NOTICE',
                LEFT(COALESCE(NULLIF(p.TITLE, ''), '공지'), 200),
                LEFT(COALESCE(NULLIF(p.CONTENT, ''), NULLIF(p.TITLE, ''), '공지'), 500),
                'POPUP',
                p.IDX
            FROM POPUP p
            WHERE p.IS_DISPLAY = 1
              AND (p.START_DATE IS NULL OR p.START_DATE <= %s)
              AND (p.END_DATE IS NULL OR p.END_DATE >= %s)
              AND NOT EXISTS (
                  SELECT 1
                  FROM NOTIFICATION n
                  WHERE n.USER_NO = %s
                    AND n.TARGET_TYPE = 'POPUP'
                    AND n.TARGET_IDX = p.IDX
              )
            """,
            (user_no, now, now, user_no),
        )


# 공지 문구는 알림 행이 아니라 POPUP 을 그때그때 읽는다. 운영자가 공지를 고치면
# 알림도 같이 바뀌고, 요청 언어의 번역이 있으면 그것부터 쓴다.
def list_notifications(
    connection: pymysql.Connection,
    *,
    user_no: int,
    unread_only: bool,
    limit: int,
    language: str = DEFAULT_LANGUAGE,
) -> list[NotificationResponse]:
    unread_clause = "AND n.IS_READ = 0" if unread_only else ""
    with connection.cursor() as cursor:
        cursor.execute(
            f"""
            SELECT
                n.IDX,
                n.TYPE,
                COALESCE(NULLIF(t.TITLE, ''), NULLIF(k.TITLE, ''), p.TITLE, n.TITLE)
                    AS TITLE,
                COALESCE(NULLIF(t.CONTENT, ''), NULLIF(k.CONTENT, ''), p.CONTENT, n.MESSAGE)
                    AS MESSAGE,
                n.TARGET_TYPE,
                n.TARGET_IDX,
                n.IS_READ,
                n.CREATED_AT
            FROM NOTIFICATION n
            LEFT JOIN POPUP p ON n.TARGET_TYPE = 'POPUP' AND p.IDX = n.TARGET_IDX
            LEFT JOIN POPUP_I18N t ON t.POPUP_IDX = p.IDX AND t.LANGUAGE_CODE = %s
            LEFT JOIN POPUP_I18N k ON k.POPUP_IDX = p.IDX AND k.LANGUAGE_CODE = %s
            WHERE n.USER_NO = %s {unread_clause}
            ORDER BY n.CREATED_AT DESC, n.IDX DESC
            LIMIT %s
            """,
            (language, DEFAULT_LANGUAGE, user_no, limit),
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
