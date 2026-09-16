import pymysql

from sync_tourapi import database_needs_place_bootstrap


FIELDS = {
    "NAME": "첨성대",
    "TEXT": "설명",
    "ADDRESS": "경주시",
    "OPERATING_HOURS": "09:00~18:00",
    "REST_DATE": "연중무휴",
    "PARKING": "가능",
    "MENU": "대표 메뉴",
}


def test_empty_database_needs_automatic_bootstrap(database: pymysql.Connection) -> None:
    assert database_needs_place_bootstrap(database, ["en", "ja", "zh"]) == (
        True,
        "TourAPI PLACE가 비어 있음",
    )


def test_complete_database_skips_automatic_bootstrap(database, insert) -> None:
    place_idx = insert(
        "PLACE", SOURCE="TOUR_API", CONTENT_ID="place-1", TYPE="TOUR", **FIELDS,
    )
    insert("PLACE_I18N", PLACE_IDX=place_idx, LANGUAGE_CODE="ko", **FIELDS)
    for language in ("en", "ja", "zh"):
        insert("PLACE_I18N", PLACE_IDX=place_idx, LANGUAGE_CODE=language, **FIELDS)

    needed, reason = database_needs_place_bootstrap(database, ["en", "ja", "zh"])

    assert needed is False
    assert "이미 준비됨" in reason


def test_missing_translated_field_forces_automatic_bootstrap(database, insert) -> None:
    place_idx = insert(
        "PLACE", SOURCE="TOUR_API", CONTENT_ID="place-1", TYPE="TOUR", **FIELDS,
    )
    insert("PLACE_I18N", PLACE_IDX=place_idx, LANGUAGE_CODE="ko", **FIELDS)
    for language in ("en", "ja", "zh"):
        values = {**FIELDS}
        if language == "en":
            values["OPERATING_HOURS"] = None
        insert("PLACE_I18N", PLACE_IDX=place_idx, LANGUAGE_CODE=language, **values)

    needed, reason = database_needs_place_bootstrap(database, ["en", "ja", "zh"])

    assert needed is True
    assert reason == "en 장소/번역 1건 누락"
