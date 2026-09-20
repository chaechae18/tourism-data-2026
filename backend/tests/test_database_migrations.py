import pymysql
import pytest
from alembic import command

from app.mysql import alembic_config


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


def test_reward_migration_preserves_existing_items_and_ownership(database, insert, rows):
    character = insert("CHARACTER_MASTER", CHARACTER_TYPE="DONGGYEONG")
    user_character = insert("USER_CHARACTER", USER_NO=1, CHARACTER_IDX=character)
    item = insert("ITEM", ITEM_NAME="기존 금관", ITEM_TYPE=1, CHARACTER_IDX=character,
                  ITEM_MODEL_IMAGE="/models/donggyeong/items/crown.glb")
    insert("USER_ITEM", USER_NO=1, USER_CHARACTER_IDX=user_character, ITEM_IDX=item, IS_EQUIPPED=1)
    ownership = rows("SELECT * FROM USER_ITEM")
    config = alembic_config()
    # database fixture는 최신 스키마 생성 후 버전 행까지 비우므로 현재 버전을 복원한다.
    command.stamp(config, "head")
    command.downgrade(config, "0010")
    try:
        old_items = rows("SELECT * FROM ITEM")
        command.upgrade(config, "0011")
        upgraded = rows("SELECT * FROM ITEM")
        assert all(row.pop("ITEM_CODE") is None for row in upgraded)
        assert upgraded == old_items
        assert rows("SELECT * FROM USER_ITEM") == ownership
        # 기존 NULL 식별자는 여러 개 유지할 수 있지만 새 보상 식별자는 중복될 수 없다.
        insert("ITEM", ITEM_NAME="기존 의상", ITEM_TYPE=2, CHARACTER_IDX=character)
        insert("ITEM", ITEM_CODE="king_hat", ITEM_NAME="신라 금관", ITEM_TYPE=1, CHARACTER_IDX=character)
        with pytest.raises(pymysql.err.IntegrityError) as error:
            insert("ITEM", ITEM_CODE="king_hat", ITEM_NAME="중복 금관", ITEM_TYPE=1, CHARACTER_IDX=character)
        assert error.value.args[0] == 1062
    finally:
        command.upgrade(config, "head")
