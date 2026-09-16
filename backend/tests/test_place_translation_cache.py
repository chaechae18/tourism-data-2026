import pymysql

from app.place_translation_cache import save_machine_translation, source_hash
from translate_places import pending_places


def test_machine_translation_and_source_hash_are_cached_in_database(
    database: pymysql.Connection, insert, rows
) -> None:
    place_idx = insert(
        "PLACE", SOURCE="TOUR_API", CONTENT_ID="place-1", TYPE="TOUR",
        NAME="첨성대", TEXT="옛 설명",
    )
    save_machine_translation(
        database, place_idx=place_idx, language="en", field="NAME",
        source="첨성대", translation="Cheomseongdae", model="test-model",
    )
    save_machine_translation(
        database, place_idx=place_idx, language="en", field="TEXT",
        source="옛 설명", translation="Old description", model="test-model",
    )

    cached = rows("SELECT * FROM PLACE_TRANSLATION_CACHE ORDER BY FIELD_NAME")
    assert len(cached) == 2
    assert {row["SOURCE_HASH"] for row in cached} == {
        source_hash("첨성대"), source_hash("옛 설명"),
    }
    assert pending_places(database, "en") == []

    database.cursor().execute("UPDATE PLACE SET TEXT='새 설명' WHERE IDX=%s", (place_idx,))
    assert pending_places(database, "en") == [{
        "id": "place-1", "place_idx": place_idx, "fields": {"TEXT": "새 설명"},
    }]


def test_existing_official_value_is_not_selected_for_machine_translation(database, insert) -> None:
    place_idx = insert(
        "PLACE", SOURCE="TOUR_API", CONTENT_ID="place-1", TYPE="TOUR", NAME="첨성대",
    )
    insert("PLACE_I18N", PLACE_IDX=place_idx, LANGUAGE_CODE="en", NAME="Cheomseongdae")
    assert pending_places(database, "en") == []
