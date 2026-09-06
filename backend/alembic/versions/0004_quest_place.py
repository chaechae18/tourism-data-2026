"""QUEST 가 PLACE 를 직접 참조하도록 PLACE_IDX 를 추가한다.

기존 QUEST.MAP_PLACE_IDX 연결은 하위 호환과 지도 메타데이터를 위해 유지한다.

Revision ID: 0004
Revises: 0003
"""

from alembic import op


revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE QUEST ADD COLUMN PLACE_IDX BIGINT NULL COMMENT '장소 IDX'")
    op.execute(
        """
        UPDATE QUEST q
        JOIN MAP_PLACE mp ON mp.IDX = q.MAP_PLACE_IDX
        SET q.PLACE_IDX = mp.PLACE_IDX
        """
    )
    op.execute("ALTER TABLE QUEST MODIFY PLACE_IDX BIGINT NOT NULL COMMENT '장소 IDX'")
    op.execute(
        """
        ALTER TABLE QUEST
        ADD CONSTRAINT FK_QUEST_PLACE
        FOREIGN KEY (PLACE_IDX) REFERENCES PLACE(IDX)
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE QUEST DROP FOREIGN KEY FK_QUEST_PLACE")
    op.execute("ALTER TABLE QUEST DROP COLUMN PLACE_IDX")
