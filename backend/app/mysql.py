from collections.abc import Iterator
import os

from dotenv import load_dotenv
import pymysql
from pymysql.cursors import DictCursor

from .config import BACKEND_DIR


load_dotenv(BACKEND_DIR / ".env")


def connection_settings() -> dict:
    return {
        "host": os.getenv("DB_HOST", "127.0.0.1"),
        "port": int(os.getenv("DB_PORT", "3306")),
        "user": os.getenv("DB_USER") or "root",
        "password": os.getenv("DB_PASSWORD", ""),
        "database": os.getenv("DB_NAME") or "play_gyeongju",
        "charset": "utf8mb4",
        "cursorclass": DictCursor,
        "autocommit": True,
    }


def connect(**overrides) -> pymysql.Connection:
    # database=None 을 넘기면 DB 를 고르지 않고 붙는다 (테스트 DB 생성용).
    return pymysql.connect(**{**connection_settings(), **overrides})


def get_mysql() -> Iterator[pymysql.Connection]:
    connection = connect()
    try:
        yield connection
    finally:
        connection.close()


def fetch_all(connection: pymysql.Connection, sql: str, parameters: tuple = ()) -> list[dict]:
    with connection.cursor() as cursor:
        cursor.execute(sql, parameters)
        return cursor.fetchall()


def initialize_database() -> None:
    """Apply the single MySQL schema used by every API feature."""
    schema_path = BACKEND_DIR / "db" / "schema.mysql.sql"
    statements = [
        statement.strip()
        for statement in schema_path.read_text(encoding="utf-8").split(";")
        if statement.strip()
    ]
    with connect() as connection:
        with connection.cursor() as cursor:
            for statement in statements:
                cursor.execute(statement)
            cursor.execute("SHOW COLUMNS FROM SPOTS")
            spot_columns = {row["Field"] for row in cursor.fetchall()}
            required_columns = {
                "PLACE_TYPE": "VARCHAR(20) NOT NULL DEFAULT 'TOUR'",
                "PLACE_NAME": "VARCHAR(200) NOT NULL DEFAULT ''",
                "PLACE_ADDRESS": "VARCHAR(500) NULL",
            }
            added_snapshot_column = False
            for column, definition in required_columns.items():
                if column in spot_columns:
                    continue
                cursor.execute(f"ALTER TABLE SPOTS ADD COLUMN {column} {definition}")
                added_snapshot_column = True
            if added_snapshot_column:
                cursor.execute(
                    """
                    UPDATE SPOTS s
                    LEFT JOIN PLACE p
                      ON p.SOURCE = s.MAP_PROVIDER
                     AND p.CONTENT_ID = s.MAP_PLACE_ID
                    SET s.PLACE_TYPE = COALESCE(p.TYPE, s.PLACE_TYPE),
                        s.PLACE_NAME = COALESCE(NULLIF(s.PLACE_NAME, ''), p.NAME, ''),
                        s.PLACE_ADDRESS = COALESCE(s.PLACE_ADDRESS, p.ADDRESS)
                    WHERE s.PLACE_NAME = ''
                    """
                )
            cursor.execute("SHOW INDEX FROM SPOTS")
            spot_indexes = {row["Key_name"] for row in cursor.fetchall()}
            if "IX_SPOTS_RANKING" not in spot_indexes:
                cursor.execute(
                    """
                    ALTER TABLE SPOTS ADD INDEX IX_SPOTS_RANKING (
                        MODERATION_STATUS, DELETED_AT, LIKE_COUNT, CREATED_AT
                    )
                    """
                )
