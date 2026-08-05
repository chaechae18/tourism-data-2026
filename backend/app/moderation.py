import json
import pymysql

from .models.spots import ModerationResponse
from .spots import transaction


class ModerationTargetNotFoundError(LookupError):
    pass


TARGETS = {"spot": ("SPOTS", 1), "comment": ("SPOT_COMMENT", 2)}


def moderate(connection: pymysql.Connection, *, target_type: str, target_id: int, moderation_status: int) -> ModerationResponse:
    table, target_type_value = TARGETS[target_type]
    with transaction(connection):
        with connection.cursor() as cursor:
            cursor.execute(f"SELECT IDX FROM {table} WHERE IDX = %s AND DELETED_AT IS NULL", (target_id,))
            if cursor.fetchone() is None:
                raise ModerationTargetNotFoundError
            cursor.execute(f"UPDATE {table} SET MODERATION_STATUS = %s WHERE IDX = %s", (moderation_status, target_id))
            cursor.execute("""
                INSERT INTO MODERATION_LOG (TARGET_TYPE, TARGET_IDX, PROVIDER, RESULT, RAW_SCORE)
                VALUES (%s, %s, 'ADMIN', 1, %s)
                """, (target_type_value, target_id, json.dumps({"status": moderation_status})))
    return ModerationResponse(targetType=target_type, targetId=target_id, status=moderation_status)
