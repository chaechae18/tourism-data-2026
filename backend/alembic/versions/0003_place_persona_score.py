
from alembic import op


revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS PLACE_PERSONA_SCORE (
            IDX BIGINT NOT NULL AUTO_INCREMENT COMMENT '순번',
            PLACE_IDX BIGINT NOT NULL COMMENT '장소 IDX',
            -- personas.py 의 역할 key (king, scholar, monk, hwarang, court_lady, merchant).
            -- 역할이 늘어도 컬럼을 추가할 필요가 없도록 값으로 둔다.
            PERSONA_KEY VARCHAR(30) NOT NULL COMMENT '역할 키',
            SCORE TINYINT NOT NULL COMMENT '적합도 0(안 어울림) ~ 5(딱 맞음)',
            -- llm: 자동 채점 / manual: 사람이 고친 값 (자동 채점이 덮어쓰지 않는다)
            SOURCE VARCHAR(20) NOT NULL DEFAULT 'llm' COMMENT '점수 출처',
            -- 설명문이 바뀐 장소만 다시 채점하기 위한 비교값
            TEXT_HASH CHAR(32) DEFAULT NULL COMMENT '채점에 쓴 설명문 해시',
            CREATED_AT TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',
            UPDATED_AT TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일시',
            PRIMARY KEY (IDX),
            UNIQUE KEY UK_PLACE_PERSONA (PLACE_IDX, PERSONA_KEY),
            KEY IX_PERSONA_SCORE (PERSONA_KEY, SCORE),
            CONSTRAINT FK_PLACE_PERSONA_SCORE_PLACE
                FOREIGN KEY (PLACE_IDX) REFERENCES PLACE(IDX) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='장소별 역할 적합도'
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS PLACE_PERSONA_SCORE")
