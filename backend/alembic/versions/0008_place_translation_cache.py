"""Store GPT place translations and their Korean source hashes in MySQL."""

from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE PLACE_TRANSLATION_CACHE (
            PLACE_IDX BIGINT NOT NULL,
            LANGUAGE_CODE VARCHAR(10) NOT NULL,
            FIELD_NAME VARCHAR(30) NOT NULL,
            SOURCE_HASH CHAR(64) NOT NULL,
            TRANSLATION_SOURCE VARCHAR(20) NOT NULL DEFAULT 'OPENAI',
            MODEL VARCHAR(100) NULL,
            STATUS VARCHAR(20) NOT NULL DEFAULT 'machine',
            TRANSLATED_AT DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (PLACE_IDX, LANGUAGE_CODE, FIELD_NAME),
            CONSTRAINT FK_PLACE_TRANSLATION_CACHE_PLACE FOREIGN KEY (PLACE_IDX)
                REFERENCES PLACE(IDX) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE PLACE_TRANSLATION_CACHE")
