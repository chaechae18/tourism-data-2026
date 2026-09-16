"""Keep verified foreign TourAPI IDs separate from Korean PLACE content IDs."""

from alembic import op


revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE PLACE_TOURAPI_LINK (
            PLACE_IDX BIGINT NOT NULL,
            LANGUAGE_CODE VARCHAR(10) NOT NULL,
            CONTENT_ID VARCHAR(100) NOT NULL,
            MATCH_METHOD VARCHAR(30) NOT NULL,
            VERIFIED_AT DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (PLACE_IDX, LANGUAGE_CODE),
            UNIQUE KEY UK_PLACE_TOURAPI_LANGUAGE_CONTENT (LANGUAGE_CODE, CONTENT_ID),
            CONSTRAINT FK_PLACE_TOURAPI_LINK_PLACE FOREIGN KEY (PLACE_IDX)
                REFERENCES PLACE(IDX) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE PLACE_TOURAPI_LINK")
