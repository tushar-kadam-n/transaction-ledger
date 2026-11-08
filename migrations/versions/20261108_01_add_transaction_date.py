"""Add transaction date.

Revision ID: 20261108_01
Revises: 20261104_01
Create Date: 2026-11-08
"""

from alembic import op
import sqlalchemy as sa


revision = "20261108_01"
down_revision = "20261104_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = {
        column["name"]
        for column in sa.inspect(op.get_bind()).get_columns("transactions")
    }
    if "transaction_date" not in columns:
        op.add_column(
            "transactions",
            sa.Column("transaction_date", sa.DateTime(timezone=True), nullable=True),
        )
        op.execute(sa.text("UPDATE transactions SET transaction_date = created_at"))
        op.alter_column(
            "transactions",
            "transaction_date",
            existing_type=sa.DateTime(timezone=True),
            nullable=False,
        )


def downgrade() -> None:
    columns = {
        column["name"]
        for column in sa.inspect(op.get_bind()).get_columns("transactions")
    }
    if "transaction_date" in columns:
        op.drop_column("transactions", "transaction_date")
