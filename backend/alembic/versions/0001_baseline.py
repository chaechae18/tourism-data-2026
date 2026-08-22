"""기준선(baseline) — 지금까지 손으로 관리하던 스키마를 마이그레이션의 출발점으로 삼는다.

db/schema.mysql.sql 을 그대로 실행한다. 전부 CREATE TABLE IF NOT EXISTS 라서
테이블이 이미 있는 DB(기존 개발 DB)에서 돌려도 아무것도 바꾸지 않는다.

⚠️ db/schema.mysql.sql 은 이제 "기준선 스냅샷"이다. 앞으로 테이블·컬럼을 바꿀 때는
이 파일을 고치지 말고 새 마이그레이션 파일을 추가한다.

Revision ID: 0001
Revises:
"""

from pathlib import Path

from alembic import op


revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

SCHEMA_PATH = Path(__file__).resolve().parents[2] / "db" / "schema.mysql.sql"


def upgrade() -> None:
    for statement in SCHEMA_PATH.read_text(encoding="utf-8").split(";"):
        if statement.strip():
            op.execute(statement)


def downgrade() -> None:
    # 기준선은 되돌리지 않는다. (되돌리면 DB 전체가 사라진다)
    raise RuntimeError("기준선 마이그레이션은 되돌릴 수 없습니다.")
