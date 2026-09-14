"""PLACE / FESTIVAL 에 공사 수정시각(MODIFIED_TIME)을 추가한다.

동기화가 목록의 modifiedtime 을 이 컬럼과 비교해, 그대로인 건은 상세 조회
두 번(detailCommon2 + detailIntro2)을 통째로 건너뛴다.

기존 행은 NULL 로 시작하므로 이 마이그레이션 직후 첫 동기화는 전량을 다시 받는다.
그때 컬럼이 채워지고, 다음 회차부터 바뀐 것만 받는다.

Revision ID: 0005
Revises: 0004
"""

from alembic import op


revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE PLACE ADD COLUMN MODIFIED_TIME DATETIME NULL "
        "COMMENT '공사 목록의 modifiedtime. 상세까지 받아 둔 회차에만 기록한다'"
    )
    op.execute(
        "ALTER TABLE FESTIVAL ADD COLUMN MODIFIED_TIME DATETIME NULL "
        "COMMENT '공사 목록의 modifiedtime. 상세까지 받아 둔 회차에만 기록한다'"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE FESTIVAL DROP COLUMN MODIFIED_TIME")
    op.execute("ALTER TABLE PLACE DROP COLUMN MODIFIED_TIME")
