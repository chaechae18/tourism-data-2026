import json
import logging
from datetime import datetime
from threading import Timer

import pymysql

from .mysql import connect
from .spots import transaction


logger = logging.getLogger(__name__)

# 실제 검수 연동 전까지 사용하는 임시 승인 지연 시간이다.
TEMPORARY_SPOT_APPROVAL_DELAY_SECONDS = 10


def approve_pending_spot(
    connection: pymysql.Connection,
    *,
    spot_id: int,
    now: datetime | None = None,
) -> bool:
    """검수 대기 중인 스팟만 임시 승인하고 이력을 남긴다."""
    ranking_date = (now or datetime.now()).date()
    with transaction(connection):
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE SPOTS
                SET MODERATION_STATUS = 1
                WHERE IDX = %s
                  AND MODERATION_STATUS = 0
                  AND DELETED_AT IS NULL
                """,
                (spot_id,),
            )
            if cursor.rowcount == 0:
                return False
            cursor.execute(
                """
                INSERT INTO MODERATION_LOG (
                    TARGET_TYPE, TARGET_IDX, PROVIDER, RESULT, RAW_SCORE
                )
                VALUES (1, %s, 'TEMPORARY_AUTO_APPROVAL', 1, %s)
                """,
                (
                    spot_id,
                    json.dumps(
                        {
                            "status": 1,
                            "delaySeconds": TEMPORARY_SPOT_APPROVAL_DELAY_SECONDS,
                        }
                    ),
                ),
            )
            cursor.execute(
                "DELETE FROM SPOT_RANKING_DAILY WHERE RANK_DATE = %s",
                (ranking_date,),
            )
            cursor.execute(
                "DELETE FROM SPOT_RANKING_RUN WHERE RANK_DATE = %s",
                (ranking_date,),
            )
    return True


def _run_temporary_spot_approval(spot_id: int) -> None:
    try:
        with connect() as connection:
            approve_pending_spot(connection, spot_id=spot_id)
    except Exception:
        logger.exception("스팟 임시 자동 승인에 실패했습니다: spot_id=%s", spot_id)


def schedule_temporary_spot_approval(spot_id: int) -> None:
    """프로세스가 실행 중인 동안 10초 뒤 승인 작업을 예약한다."""
    timer = Timer(
        TEMPORARY_SPOT_APPROVAL_DELAY_SECONDS,
        _run_temporary_spot_approval,
        args=(spot_id,),
    )
    timer.daemon = True
    timer.start()
