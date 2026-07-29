from pathlib import Path
import sqlite3

from app.database import connect, initialize_database


def test_existing_spots_table_adds_provider_before_indexes(
    tmp_path: Path,
) -> None:
    database_path = tmp_path / "legacy.db"
    with sqlite3.connect(database_path) as connection:
        connection.execute(
            """
            CREATE TABLE SPOTS (
                IDX INTEGER PRIMARY KEY AUTOINCREMENT,
                USER_NO INTEGER NOT NULL,
                MAP_PLACE_ID TEXT,
                CREATED_AT TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

    initialize_database(database_path)

    with connect(database_path) as connection:
        columns = {
            row["name"]
            for row in connection.execute("PRAGMA table_info(SPOTS)").fetchall()
        }
        indexes = {
            row["name"]
            for row in connection.execute("PRAGMA index_list(SPOTS)").fetchall()
        }

    assert "MAP_PROVIDER" in columns
    assert "IX_SPOTS_PROVIDER_PLACE" in indexes
