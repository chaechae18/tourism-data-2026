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
