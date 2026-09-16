from alembic import op


revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 지도 상세 카드에서 언어를 타는데 아직 번역 칸이 없던 셋
    op.execute(
        "ALTER TABLE PLACE_I18N "
        "ADD COLUMN MENU VARCHAR(500) NULL, "
        "ADD COLUMN PARKING VARCHAR(300) NULL, "
        # 화면 표시용 원문. 코스 추천은 계속 PLACE.REST_DATE 를 본다
        "ADD COLUMN REST_DATE VARCHAR(300) NULL, "
        # 언어별로 따로 센다. 안 바뀐 건은 상세 조회를 건너뛰는 근거
        "ADD COLUMN MODIFIED_TIME DATETIME NULL"
    )
    # 분류체계 이름은 같은 코드를 쓰는 장소가 공유하므로 코드별로 한 줄만 둔다
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS CATEGORY_NAME_I18N (
            CATEGORY_CODE VARCHAR(20) NOT NULL,
            LANGUAGE_CODE VARCHAR(10) NOT NULL,
            CATEGORY_MAIN VARCHAR(50) NULL,
            CATEGORY_SUB VARCHAR(50) NULL,
            UPDATED_AT DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (CATEGORY_CODE, LANGUAGE_CODE)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS CATEGORY_NAME_I18N")
    op.execute(
        "ALTER TABLE PLACE_I18N DROP COLUMN MODIFIED_TIME, "
        "DROP COLUMN REST_DATE, DROP COLUMN PARKING, DROP COLUMN MENU"
    )
