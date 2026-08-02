from datetime import datetime

import pymysql

from .models.home import (
    BannerResponse,
    FestivalResponse,
    PopupResponse,
    RecommendedPlaceResponse,
)
from .mysql import fetch_all


SUPPORTED_LANGUAGES = ("ko", "en", "ja", "zh")
DEFAULT_LANGUAGE = "ko"


def normalize_language(raw: str | None) -> str:
    if not raw:
        return DEFAULT_LANGUAGE
    primary = raw.split(",")[0].split(";")[0].split("-")[0].strip().lower()
    return primary if primary in SUPPORTED_LANGUAGES else DEFAULT_LANGUAGE


def resolve_language(lang: str | None, accept_language: str | None) -> str:
    return normalize_language(lang or accept_language)


# 번역은 요청 언어 행 → 한국어 행 → 원본 컬럼 순으로 고른다.
# 빈 문자열도 "번역 없음" 으로 본다.
def _translated(column: str, source_alias: str) -> str:
    return (
        f"COALESCE(NULLIF(t.{column}, ''), NULLIF(k.{column}, ''), {source_alias}.{column})"
        f" AS {column}"
    )


def list_banners(connection: pymysql.Connection) -> list[BannerResponse]:
    now = datetime.now()
    rows = fetch_all(
        connection,
        """
        SELECT IMG, TITLE, SUB_TITLE, LINK
        FROM MAIN_BANNER
        WHERE IS_TRASH = 0
          AND IS_DISPLAY = 1
          AND (START_DATE IS NULL OR START_DATE <= %s)
          AND (END_DATE IS NULL OR END_DATE >= %s)
        ORDER BY SORT, IDX
        """,
        (now, now),
    )
    return [
        BannerResponse(
            img=row["IMG"],
            title=row["TITLE"],
            sub_title=row["SUB_TITLE"],
            link=row["LINK"],
        )
        for row in rows
    ]


def list_popups(connection: pymysql.Connection, *, language: str) -> list[PopupResponse]:
    now = datetime.now()
    rows = fetch_all(
        connection,
        f"""
        SELECT
            {_translated("TITLE", "p")},
            {_translated("CONTENT", "p")},
            p.IMG,
            p.LINK
        FROM POPUP p
        LEFT JOIN POPUP_I18N t ON t.POPUP_IDX = p.IDX AND t.LANGUAGE_CODE = %s
        LEFT JOIN POPUP_I18N k ON k.POPUP_IDX = p.IDX AND k.LANGUAGE_CODE = %s
        WHERE p.IS_DISPLAY = 1
          AND (p.START_DATE IS NULL OR p.START_DATE <= %s)
          AND (p.END_DATE IS NULL OR p.END_DATE >= %s)
        ORDER BY p.IDX DESC
        """,
        (language, DEFAULT_LANGUAGE, now, now),
    )
    return [
        PopupResponse(
            title=row["TITLE"],
            content=row["CONTENT"],
            img=row["IMG"],
            link=row["LINK"],
        )
        for row in rows
    ]


def list_festivals(connection: pymysql.Connection, *, language: str) -> list[FestivalResponse]:
    rows = fetch_all(
        connection,
        f"""
        SELECT
            {_translated("NAME", "f")},
            {_translated("CONTENT", "f")},
            {_translated("LOCATION", "f")},
            f.START_DATE,
            f.END_DATE,
            f.IMG,
            f.URL
        FROM FESTIVAL f
        LEFT JOIN FESTIVAL_I18N t ON t.FESTIVAL_IDX = f.IDX AND t.LANGUAGE_CODE = %s
        LEFT JOIN FESTIVAL_I18N k ON k.FESTIVAL_IDX = f.IDX AND k.LANGUAGE_CODE = %s
        WHERE f.IS_TRASH = 0
          AND (f.END_DATE IS NULL OR f.END_DATE >= %s)
        ORDER BY f.START_DATE, f.IDX
        """,
        (language, DEFAULT_LANGUAGE, datetime.now()),
    )
    return [
        FestivalResponse(
            name=row["NAME"],
            content=row["CONTENT"],
            location=row["LOCATION"],
            start_date=row["START_DATE"],
            end_date=row["END_DATE"],
            img=row["IMG"],
            url=row["URL"],
        )
        for row in rows
    ]


def list_recommended_places(
    connection: pymysql.Connection,
    *,
    language: str,
) -> list[RecommendedPlaceResponse]:
    rows = fetch_all(
        connection,
        f"""
        SELECT
            {_translated("NAME", "p")},
            {_translated("TEXT", "p")},
            {_translated("ADDRESS", "p")},
            {_translated("ADMISSION_FEE", "p")},
            p.LATITUDE,
            p.LONGITUDE
        FROM PLACE p
        LEFT JOIN PLACE_I18N t ON t.PLACE_IDX = p.IDX AND t.LANGUAGE_CODE = %s
        LEFT JOIN PLACE_I18N k ON k.PLACE_IDX = p.IDX AND k.LANGUAGE_CODE = %s
        WHERE p.IS_RECOMMENDED = 1
          AND p.IS_DISPLAY = 1
        ORDER BY p.VIEW_COUNT DESC, p.IDX
        """,
        (language, DEFAULT_LANGUAGE),
    )
    return [
        RecommendedPlaceResponse(
            name=row["NAME"],
            text=row["TEXT"],
            address=row["ADDRESS"],
            latitude=row["LATITUDE"],
            longitude=row["LONGITUDE"],
            admission_fee=row["ADMISSION_FEE"],
        )
        for row in rows
    ]
