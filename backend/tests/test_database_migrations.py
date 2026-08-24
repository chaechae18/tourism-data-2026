import pymysql


def test_mysql_schema_contains_feature_tables(database: pymysql.Connection) -> None:
    with database.cursor() as cursor:
        cursor.execute("SHOW TABLES")
        tables = {next(iter(row.values())) for row in cursor.fetchall()}
    assert {
        "USERS",
        "SPOTS",
        "SPOT_COMMENT",
        "SPOT_REACTIONS",
        "SPOT_RANKING_DAILY",
        "NOTIFICATION",
        "ITEM",
    } <= tables


def test_spots_store_place_snapshot_columns(database: pymysql.Connection) -> None:
    with database.cursor() as cursor:
        cursor.execute("SHOW COLUMNS FROM SPOTS")
        columns = {row["Field"] for row in cursor.fetchall()}
    assert {"PLACE_TYPE", "PLACE_NAME", "PLACE_ADDRESS"} <= columns


def test_quest_references_place_directly(database: pymysql.Connection) -> None:
    with database.cursor() as cursor:
        cursor.execute("SHOW COLUMNS FROM QUEST WHERE Field = 'PLACE_IDX'")
        column = cursor.fetchone()
        cursor.execute(
            """SELECT REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
               FROM information_schema.KEY_COLUMN_USAGE
               WHERE TABLE_SCHEMA = DATABASE()
                 AND TABLE_NAME = 'QUEST'
                 AND CONSTRAINT_NAME = 'FK_QUEST_PLACE'"""
        )
        foreign_key = cursor.fetchone()

    assert column["Type"] == "bigint"
    assert column["Null"] == "NO"
    assert foreign_key == {
        "REFERENCED_TABLE_NAME": "PLACE",
        "REFERENCED_COLUMN_NAME": "IDX",
    }
