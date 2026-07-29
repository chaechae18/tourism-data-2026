import json
import sqlite3

from .models.spots import ModerationResponse


class ModerationTargetNotFoundError(LookupError):
    pass


TARGETS = {
    "spot": ("SPOTS", 1),
    "comment": ("SPOT_COMMENT", 2),
}


def moderate(
    connection: sqlite3.Connection,
    *,
    target_type: str,
    target_id: int,
    moderation_status: int,
) -> ModerationResponse:
    table, target_type_value = TARGETS[target_type]
    deleted_column = "DELETED_AT"
    target = connection.execute(
        f"""
        SELECT IDX
        FROM {table}
        WHERE IDX = ? AND {deleted_column} IS NULL
        """,
        (target_id,),
    ).fetchone()
    if target is None:
        raise ModerationTargetNotFoundError

    with connection:
        connection.execute(
            f"UPDATE {table} SET MODERATION_STATUS = ? WHERE IDX = ?",
            (moderation_status, target_id),
        )
        connection.execute(
            """
            INSERT INTO MODERATION_LOG (
                TARGET_TYPE,
                TARGET_IDX,
                PROVIDER,
                RESULT,
                RAW_SCORE
            )
            VALUES (?, ?, 'ADMIN', 1, ?)
            """,
            (
                target_type_value,
                target_id,
                json.dumps({"status": moderation_status}),
            ),
        )

    return ModerationResponse(
        targetType=target_type,
        targetId=target_id,
        status=moderation_status,
    )
