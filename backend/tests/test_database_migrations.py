import pymysql


def test_mysql_schema_contains_user_activity_tables(database: pymysql.Connection) -> None:
    with database.cursor() as cursor:
        cursor.execute("SHOW TABLES")
        tables = {next(iter(row.values())) for row in cursor.fetchall()}
    assert {"USERS", "SPOTS", "SPOT_COMMENT", "SPOT_REACTIONS", "MODERATION_LOG"} <= tables
