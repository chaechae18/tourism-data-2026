from collections.abc import Iterator
import logging
import os

from alembic import command
from alembic.config import Config
from dotenv import load_dotenv
import pymysql
from pymysql.cursors import DictCursor

from .config import BACKEND_DIR


logger = logging.getLogger(__name__)


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


def alembic_config() -> Config:
    # 어느 폴더에서 실행하든 같은 설정을 보도록 절대 경로로 고정한다.
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    return config


def initialize_database() -> None:
    """DB 구조를 최신 마이그레이션까지 맞춘다. (백엔드가 뜰 때마다 실행)

    팀원은 코드를 받은 뒤 백엔드만 다시 띄우면 된다. 손으로 ALTER 를 칠 필요가 없다.
    직접 돌리고 싶으면 backend 폴더에서 `alembic upgrade head` 를 실행하면 된다.
    """
    logger.info("[마이그레이션] 최신 상태로 맞추는 중")
    command.upgrade(alembic_config(), "head")
    logger.info("[마이그레이션] 완료")
