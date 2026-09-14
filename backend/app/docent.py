from hashlib import sha256

import pymysql


# 고른 언어 -> 없으면 한국어 -> 없으면 PLACE 원본. 다른 조회들과 같은 순서다.
DOCENT_SQL = """
    SELECT p.IDX,
           COALESCE(NULLIF(t.NAME, ''), NULLIF(k.NAME, ''), p.NAME) AS NAME,
           COALESCE(NULLIF(t.TEXT, ''), NULLIF(k.TEXT, ''), NULLIF(p.TEXT, '')) AS TEXT,
           -- 원고가 어느 언어로 나왔는지. 읽어 줄 목소리를 이걸로 고른다.
           CASE
             WHEN NULLIF(t.TEXT, '') IS NOT NULL THEN %s
             ELSE 'ko'
           END AS LANGUAGE_CODE
    FROM PLACE p
    LEFT JOIN PLACE_I18N t ON t.PLACE_IDX = p.IDX AND t.LANGUAGE_CODE = %s
    LEFT JOIN PLACE_I18N k ON k.PLACE_IDX = p.IDX AND k.LANGUAGE_CODE = 'ko'
    WHERE p.IDX = %s
      AND COALESCE(NULLIF(t.TEXT, ''), NULLIF(k.TEXT, ''), NULLIF(p.TEXT, '')) IS NOT NULL
"""


class DocentNotFoundError(Exception):
    """그 장소에는 읽어 줄 설명이 없다."""


def find_docent(
    connection: pymysql.Connection, place_id: int, language: str = "ko"
) -> dict:
    with connection.cursor() as cursor:
        cursor.execute(DOCENT_SQL, (language, language, place_id))
        row = cursor.fetchone()
    if not row:
        raise DocentNotFoundError(place_id)

    return {
        "place_id": row["IDX"],
        "name": row["NAME"],
        "text": row["TEXT"],
        "language": row["LANGUAGE_CODE"],
    }


def audio_cache_key(*, place_id: int, text: str, voice: str, speaking_rate: float) -> str:
    # 원고나 목소리 설정이 바뀌면 캐시도 자동으로 갈린다.
    fingerprint = sha256(f"{text}|{voice}|{speaking_rate}".encode("utf-8")).hexdigest()[:32]
    return f"docent:{place_id}:{fingerprint}"
