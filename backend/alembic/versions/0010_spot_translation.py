"""커뮤니티 글의 작성 언어와 GPT 번역 결과를 MySQL 에 둔다."""

from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE SPOTS ADD COLUMN LANGUAGE_CODE VARCHAR(10) NULL AFTER CAPTION"
    )
    op.execute(
        "ALTER TABLE SPOT_COMMENT ADD COLUMN LANGUAGE_CODE VARCHAR(10) NULL AFTER CONTENT"
    )
    # 대상이 스팟과 댓글 둘이라 FK 를 걸 수 없다. 원본이 지워지면 캐시 행만 남는데
    # TARGET_ID 는 AUTO_INCREMENT 라 재사용되지 않으므로 잘못된 번역이 붙지는 않는다.
    op.execute(
        """
        CREATE TABLE SPOT_TRANSLATION_CACHE (
            TARGET_TYPE VARCHAR(10) NOT NULL,
            TARGET_ID BIGINT NOT NULL,
            LANGUAGE_CODE VARCHAR(10) NOT NULL,
            SOURCE_HASH CHAR(64) NOT NULL,
            TRANSLATION TEXT NOT NULL,
            MODEL VARCHAR(100) NULL,
            TRANSLATED_AT DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (TARGET_TYPE, TARGET_ID, LANGUAGE_CODE)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE SPOT_TRANSLATION_CACHE")
    op.execute("ALTER TABLE SPOT_COMMENT DROP COLUMN LANGUAGE_CODE")
    op.execute("ALTER TABLE SPOTS DROP COLUMN LANGUAGE_CODE")
