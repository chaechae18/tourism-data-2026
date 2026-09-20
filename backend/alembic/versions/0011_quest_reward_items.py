"""Give role reward items stable identifiers without changing legacy items."""

from alembic import op
import sqlalchemy as sa

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("ITEM", sa.Column("ITEM_CODE", sa.String(64), nullable=True))
    op.create_unique_constraint("UK_ITEM_CODE", "ITEM", ["ITEM_CODE"])


def downgrade() -> None:
    op.drop_constraint("UK_ITEM_CODE", "ITEM", type_="unique")
    op.drop_column("ITEM", "ITEM_CODE")
