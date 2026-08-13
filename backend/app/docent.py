from hashlib import sha256

import pymysql


DOCENT_SQL = """
    SELECT IDX, NAME, TEXT
    FROM PLACE
    WHERE IDX = %s AND TEXT IS NOT NULL AND TEXT <> ''
"""


class DocentNotFoundError(Exception):
    """그 장소에는 읽어 줄 설명이 없다."""


def find_docent(connection: pymysql.Connection, place_id: int) -> dict:
    with connection.cursor() as cursor:
        cursor.execute(DOCENT_SQL, (place_id,))
        row = cursor.fetchone()
    if not row:
        raise DocentNotFoundError(place_id)

    return {
        "place_id": row["IDX"],
        "name": row["NAME"],
        "text": row["TEXT"],
    }


def audio_cache_key(*, place_id: int, text: str, voice: str, speaking_rate: float) -> str:
    # 원고나 목소리 설정이 바뀌면 캐시도 자동으로 갈린다.
    fingerprint = sha256(f"{text}|{voice}|{speaking_rate}".encode("utf-8")).hexdigest()[:32]
    return f"docent:{place_id}:{fingerprint}"
