"""DB-backed provenance for place fields translated through OpenAI."""

from hashlib import sha256
import pymysql

FIELDS = (
    "NAME", "TEXT", "ADDRESS", "OPERATING_HOURS", "ADMISSION_FEE",
    "PARKING", "REST_DATE", "MENU",
)
FIELD_LIMITS = {
    "NAME": 200, "ADDRESS": 500, "OPERATING_HOURS": 300,
    "ADMISSION_FEE": 300, "PARKING": 300, "REST_DATE": 300, "MENU": 500,
}
LANGUAGES = ("en", "ja", "zh")


def source_hash(value: str) -> str:
    return sha256(value.encode("utf-8")).hexdigest()


def source_rows(connection: pymysql.Connection) -> list[dict]:
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT p.IDX, p.CONTENT_ID, "
            + ", ".join(
                f"COALESCE(NULLIF(k.{field}, ''), p.{field}) AS {field}" for field in FIELDS
            )
            + " FROM PLACE p LEFT JOIN PLACE_I18N k "
            "ON k.PLACE_IDX = p.IDX AND k.LANGUAGE_CODE = 'ko' "
            "WHERE p.SOURCE = 'TOUR_API' AND p.CONTENT_ID IS NOT NULL"
        )
        return list(cursor.fetchall())


def cached_fields(connection: pymysql.Connection, language: str) -> dict[tuple[int, str], dict]:
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT PLACE_IDX, FIELD_NAME, SOURCE_HASH FROM PLACE_TRANSLATION_CACHE "
            "WHERE LANGUAGE_CODE = %s", (language,),
        )
        return {(row["PLACE_IDX"], row["FIELD_NAME"]): row for row in cursor.fetchall()}


def save_machine_translation(
    connection: pymysql.Connection, *, place_idx: int, language: str,
    field: str, source: str, translation: str, model: str,
) -> None:
    if field not in FIELDS or language not in LANGUAGES:
        raise ValueError("unsupported place translation field or language")
    value = translation.strip()
    limit = FIELD_LIMITS.get(field)
    if not value or (limit and len(value) > limit):
        raise ValueError(f"invalid translation length for {field}")
    with connection.cursor() as cursor:
        if field == "NAME":
            cursor.execute(
                "INSERT INTO PLACE_I18N (PLACE_IDX, LANGUAGE_CODE, NAME) VALUES (%s, %s, %s) "
                "ON DUPLICATE KEY UPDATE NAME = VALUES(NAME)",
                (place_idx, language, value),
            )
        else:
            cursor.execute(
                f"UPDATE PLACE_I18N SET {field} = %s WHERE PLACE_IDX = %s AND LANGUAGE_CODE = %s",
                (value, place_idx, language),
            )
            if cursor.rowcount == 0:
                raise RuntimeError("NAME translation must be stored before detail fields")
        cursor.execute(
            "INSERT INTO PLACE_TRANSLATION_CACHE "
            "(PLACE_IDX, LANGUAGE_CODE, FIELD_NAME, SOURCE_HASH, MODEL) "
            "VALUES (%s, %s, %s, %s, %s) ON DUPLICATE KEY UPDATE "
            "SOURCE_HASH = VALUES(SOURCE_HASH), TRANSLATION_SOURCE = 'OPENAI', "
            "MODEL = VALUES(MODEL), STATUS = 'machine', TRANSLATED_AT = CURRENT_TIMESTAMP",
            (place_idx, language, field, source_hash(source), model),
        )


def clear_machine_cache_for_official_fields(
    connection: pymysql.Connection, place_idx: int, language: str, fields: dict,
) -> None:
    names = [name for name in FIELDS if fields.get(name)]
    if not names:
        return
    placeholders = ", ".join(["%s"] * len(names))
    with connection.cursor() as cursor:
        cursor.execute(
            "DELETE FROM PLACE_TRANSLATION_CACHE WHERE PLACE_IDX = %s "
            f"AND LANGUAGE_CODE = %s AND FIELD_NAME IN ({placeholders})",
            (place_idx, language, *names),
        )
