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
