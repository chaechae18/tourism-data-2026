"""번역문이 한국어 원문보다 길어져 PLACE_I18N 상세 컬럼을 넓힌다."""

from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None

# 원문(한국어) 최대 213자인 입장료가 영어로 437자까지 늘어 varchar(300) 을 넘겼다.
WIDENED = ("OPERATING_HOURS", "ADMISSION_FEE", "PARKING", "REST_DATE")


def upgrade() -> None:
    for column in WIDENED:
        op.execute(f"ALTER TABLE PLACE_I18N MODIFY COLUMN {column} VARCHAR(1000) NULL")
    op.execute("ALTER TABLE PLACE_I18N MODIFY COLUMN MENU VARCHAR(1000) NULL")


def downgrade() -> None:
    for column in WIDENED:
        op.execute(f"ALTER TABLE PLACE_I18N MODIFY COLUMN {column} VARCHAR(300) NULL")
    op.execute("ALTER TABLE PLACE_I18N MODIFY COLUMN MENU VARCHAR(500) NULL")
