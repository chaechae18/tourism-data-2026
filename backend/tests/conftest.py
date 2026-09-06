from collections.abc import Callable, Iterator
import os

from fastapi.testclient import TestClient
import pymysql
import pytest

from app.home import festival_cache, get_tour_api_client
from app.main import app
from app.mysql import connect, get_mysql, initialize_database
from app.routers.spots import get_temporary_spot_approval_scheduler


TEST_DATABASE = os.getenv("TEST_DB_NAME", "play_gyeongju_test")
# 테스트는 반드시 테스트 DB 만 건드린다. 마이그레이션도 이 DB 에 적용된다.
os.environ["DB_NAME"] = TEST_DATABASE

# 테이블은 전부 마이그레이션(db/schema.mysql.sql + alembic)이 만든다.
# 여기서 따로 CREATE 하면 실제 스키마와 달라져(컬럼 타입 등) 진짜 버그를 놓친다.


@pytest.fixture(scope="session")
def mysql_database() -> Iterator[pymysql.Connection]:
    server = connect(database=None)
    with server.cursor() as cursor:
        cursor.execute(f"DROP DATABASE IF EXISTS {TEST_DATABASE}")
        cursor.execute(f"CREATE DATABASE {TEST_DATABASE} CHARACTER SET utf8mb4")
    server.close()

    connection = connect(database=TEST_DATABASE)
    # 테스트 DB 도 운영과 같은 경로(마이그레이션)로 만든다.
    # 그래야 마이그레이션이 깨지면 테스트가 먼저 알려 준다.
    initialize_database()
    yield connection
    connection.close()

    server = connect(database=None)
    with server.cursor() as cursor:
        cursor.execute(f"DROP DATABASE {TEST_DATABASE}")
    server.close()


@pytest.fixture
def database(mysql_database: pymysql.Connection) -> pymysql.Connection:
    with mysql_database.cursor() as cursor:
        cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
        cursor.execute("SHOW TABLES")
        for row in cursor.fetchall():
            cursor.execute(f"TRUNCATE TABLE `{next(iter(row.values()))}`")
        cursor.execute("SET FOREIGN_KEY_CHECKS = 1")
        cursor.execute(
            """INSERT INTO USERS (NO, ID, NICKNAME, COUNTRY, EMAIL, LANGUAGE_CODE)
            VALUES (1, 'local-development-user', 'lotus_traveler', 'KR', 'traveler@example.com', 'ko')"""
        )
    return mysql_database


@pytest.fixture
def scheduled_spot_ids() -> list[int]:
    return []


@pytest.fixture
def client(
    database: pymysql.Connection,
    scheduled_spot_ids: list[int],
) -> Iterator[TestClient]:
    festival_cache.clear()
    app.dependency_overrides[get_mysql] = lambda: database
    app.dependency_overrides[get_temporary_spot_approval_scheduler] = (
        lambda: scheduled_spot_ids.append
    )
    # 기본값은 TourAPI 없음. 실제 호출은 행사 테스트가 가짜 클라이언트로 덮어쓴다.
    app.dependency_overrides[get_tour_api_client] = lambda: None
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.pop(get_mysql)
        app.dependency_overrides.pop(get_temporary_spot_approval_scheduler)
        app.dependency_overrides.pop(get_tour_api_client)


@pytest.fixture
def insert(database: pymysql.Connection) -> Callable[..., int]:
    def add(table: str, **values: object) -> int:
        placeholders = ", ".join(["%s"] * len(values))
        with database.cursor() as cursor:
            cursor.execute(
                f"INSERT INTO {table} ({', '.join(values)}) VALUES ({placeholders})",
                tuple(values.values()),
            )
            return cursor.lastrowid

    return add


@pytest.fixture
def rows(database: pymysql.Connection) -> Callable[..., list[dict]]:
    def select(sql: str, parameters: tuple = ()) -> list[dict]:
        with database.cursor() as cursor:
            cursor.execute(sql, parameters)
            return cursor.fetchall()

    return select
