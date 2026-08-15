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

# 팀 MySQL DDL 중 홈 API 가 읽는 테이블만 옮겨 적었다. MAIN_BANNER / POPUP /
# POPUP_I18N 은 아직 팀 DDL 에 없어서 여기가 유일한 정의다.
TABLES = {
    "MAIN_BANNER": """
        IDX INT AUTO_INCREMENT PRIMARY KEY,
        IMG VARCHAR(800),
        START_DATE DATETIME,
        END_DATE DATETIME,
        IS_DISPLAY TINYINT(1) NOT NULL DEFAULT 0,
        IS_TRASH TINYINT(1) NOT NULL DEFAULT 0,
        LINK VARCHAR(800),
        SORT INT NOT NULL DEFAULT 0,
        TITLE VARCHAR(300),
        SUB_TITLE VARCHAR(200)
    """,
    "POPUP": """
        IDX INT AUTO_INCREMENT PRIMARY KEY,
        TITLE VARCHAR(1000),
        CONTENT TEXT,
        IMG VARCHAR(500),
        LINK VARCHAR(500),
        START_DATE DATETIME,
        END_DATE DATETIME,
        IS_DISPLAY TINYINT(1) NOT NULL DEFAULT 0
    """,
    "POPUP_I18N": """
        IDX INT AUTO_INCREMENT PRIMARY KEY,
        POPUP_IDX INT NOT NULL,
        LANGUAGE_CODE VARCHAR(10) NOT NULL,
        TITLE VARCHAR(300) NOT NULL,
        CONTENT TEXT,
        UNIQUE KEY UK_POPUP_I18N (POPUP_IDX, LANGUAGE_CODE)
    """,
    "FESTIVAL": """
        IDX INT AUTO_INCREMENT PRIMARY KEY,
        SOURCE VARCHAR(20),
        CONTENT_ID VARCHAR(50),
        NAME VARCHAR(300),
        CONTENT VARCHAR(700),
        LOCATION VARCHAR(500),
        START_DATE DATETIME,
        IMG VARCHAR(600),
        URL VARCHAR(600),
        IS_TRASH TINYINT(1) NOT NULL DEFAULT 0,
        END_DATE DATETIME,
        UNIQUE KEY UK_FESTIVAL_SOURCE_CONTENT (SOURCE, CONTENT_ID)
    """,
    "FESTIVAL_I18N": """
        IDX INT AUTO_INCREMENT PRIMARY KEY,
        FESTIVAL_IDX INT NOT NULL,
        LANGUAGE_CODE VARCHAR(10) NOT NULL,
        NAME VARCHAR(300) NOT NULL,
        CONTENT TEXT,
        LOCATION VARCHAR(300),
        UNIQUE KEY UK_FESTIVAL_I18N (FESTIVAL_IDX, LANGUAGE_CODE)
    """,
    "PLACE": """
        IDX INT AUTO_INCREMENT PRIMARY KEY,
        SOURCE VARCHAR(20),
        CONTENT_ID VARCHAR(50),
        TYPE VARCHAR(20) NOT NULL DEFAULT 'TOUR',
        NAME VARCHAR(200),
        TEXT TEXT,
        CONTENT VARCHAR(600),
        IMG VARCHAR(600),
        ADDRESS VARCHAR(500),
        LATITUDE VARCHAR(50),
        LONGITUDE VARCHAR(50),
        OPERATING_HOURS VARCHAR(300),
        ADMISSION_FEE VARCHAR(300),
        PARKING VARCHAR(300),
        REST_DATE VARCHAR(300),
        MENU VARCHAR(500),
        CATEGORY_CODE VARCHAR(20),
        CATEGORY_MAIN VARCHAR(50),
        CATEGORY_SUB VARCHAR(50),
        IS_DISPLAY TINYINT(1) NOT NULL DEFAULT 1,
        IS_RECOMMENDED TINYINT(1) NOT NULL DEFAULT 0,
        VIEW_COUNT INT NOT NULL DEFAULT 0,
        REG_DATE DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY UK_PLACE_SOURCE_CONTENT (SOURCE, CONTENT_ID)
    """,
    "PLACE_I18N": """
        IDX INT AUTO_INCREMENT PRIMARY KEY,
        PLACE_IDX INT NOT NULL,
        LANGUAGE_CODE VARCHAR(10) NOT NULL,
        NAME VARCHAR(200) NOT NULL,
        TEXT TEXT,
        ADDRESS VARCHAR(500),
        OPERATING_HOURS VARCHAR(300),
        ADMISSION_FEE VARCHAR(300),
        UNIQUE KEY UK_PLACE_I18N (PLACE_IDX, LANGUAGE_CODE)
    """,
}


@pytest.fixture(scope="session")
def mysql_database() -> Iterator[pymysql.Connection]:
    server = connect(database=None)
    with server.cursor() as cursor:
        cursor.execute(f"DROP DATABASE IF EXISTS {TEST_DATABASE}")
        cursor.execute(f"CREATE DATABASE {TEST_DATABASE} CHARACTER SET utf8mb4")
    server.close()

    connection = connect(database=TEST_DATABASE)
    with connection.cursor() as cursor:
        for table, columns in TABLES.items():
            cursor.execute(f"CREATE TABLE {table} ({columns})")
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
