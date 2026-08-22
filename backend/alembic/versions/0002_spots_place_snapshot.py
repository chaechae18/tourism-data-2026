"""SPOTS 에 장소 스냅샷 컬럼과 랭킹 인덱스를 추가한다.

기존에는 app/mysql.py 가 부팅할 때마다 손으로 확인해서 ALTER 를 걸던 부분이다.
마이그레이션으로 옮겨서 "언제 무엇이 바뀌었는지"가 이력에 남게 한다.

Revision ID: 0002
Revises: 0001
"""

from alembic import op
import sqlalchemy as sa


revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

SNAPSHOT_COLUMNS = {
    "PLACE_TYPE": "VARCHAR(20) NOT NULL DEFAULT 'TOUR'",
    "PLACE_NAME": "VARCHAR(200) NOT NULL DEFAULT ''",
    "PLACE_ADDRESS": "VARCHAR(500) NULL",
}
RANKING_INDEX = "IX_SPOTS_RANKING"

# 이미 컬럼을 갖고 있는 DB 도 있어서(예전에 mysql.py 가 걸어 둔 것) 있으면 건너뛴다.
# MySQL 은 ADD COLUMN IF NOT EXISTS 를 지원하지 않아 직접 확인해야 한다.
COLUMN_EXISTS_SQL = sa.text(
    """SELECT COUNT(*) FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SPOTS' AND COLUMN_NAME = :column"""
)
INDEX_EXISTS_SQL = sa.text(
    """SELECT COUNT(*) FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SPOTS' AND INDEX_NAME = :index"""
)


def upgrade() -> None:
    connection = op.get_bind()
    added = False
    for column, definition in SNAPSHOT_COLUMNS.items():
        if connection.execute(COLUMN_EXISTS_SQL, {"column": column}).scalar():
            continue
        op.execute(f"ALTER TABLE SPOTS ADD COLUMN {column} {definition}")
        added = True

    if added:
        # 새로 만든 컬럼을 PLACE 의 값으로 한 번 채워 준다.
        op.execute(
            """
            UPDATE SPOTS s
            LEFT JOIN PLACE p
              ON p.SOURCE = s.MAP_PROVIDER AND p.CONTENT_ID = s.MAP_PLACE_ID
            SET s.PLACE_TYPE = COALESCE(p.TYPE, s.PLACE_TYPE),
                s.PLACE_NAME = COALESCE(NULLIF(s.PLACE_NAME, ''), p.NAME, ''),
                s.PLACE_ADDRESS = COALESCE(s.PLACE_ADDRESS, p.ADDRESS)
            WHERE s.PLACE_NAME = ''
            """
        )

    if not connection.execute(INDEX_EXISTS_SQL, {"index": RANKING_INDEX}).scalar():
        op.execute(
            f"""ALTER TABLE SPOTS ADD INDEX {RANKING_INDEX} (
                    MODERATION_STATUS, DELETED_AT, LIKE_COUNT, CREATED_AT
                )"""
        )


def downgrade() -> None:
    op.execute(f"ALTER TABLE SPOTS DROP INDEX {RANKING_INDEX}")
    for column in SNAPSHOT_COLUMNS:
        op.execute(f"ALTER TABLE SPOTS DROP COLUMN {column}")
