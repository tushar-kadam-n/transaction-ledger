"""Add account type and contact details.

Revision ID: 20261104_01
Revises:
Create Date: 2026-11-04
"""

from alembic import op
import sqlalchemy as sa


revision = "20261104_01"
down_revision = None
branch_labels = None
depends_on = None


def _table_exists(table_name: str) -> bool:
    return sa.inspect(op.get_bind()).has_table(table_name)


def upgrade() -> None:
    if not _table_exists("accounts"):
        op.create_table(
            "accounts",
            sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
            sa.Column("name", sa.String(length=150), nullable=False),
            sa.Column(
                "balance",
                sa.Numeric(precision=18, scale=2),
                server_default="0.00",
                nullable=False,
            ),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
        )

    if not _table_exists("transactions"):
        op.create_table(
            "transactions",
            sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
            sa.Column(
                "account_id",
                sa.Uuid(),
                sa.ForeignKey("accounts.id", ondelete="RESTRICT"),
                nullable=False,
            ),
            sa.Column("type", sa.String(length=10), nullable=False),
            sa.Column("amount", sa.Numeric(precision=18, scale=2), nullable=False),
            sa.Column("description", sa.Text(), nullable=False),
            sa.Column("reference_id", sa.String(length=255), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.CheckConstraint(
                "type IN ('credit', 'debit')",
                name="ck_transaction_type",
            ),
            sa.CheckConstraint(
                "amount > 0",
                name="ck_transaction_amount_positive",
            ),
            sa.UniqueConstraint(
                "account_id",
                "reference_id",
                name="uq_transaction_account_reference",
            ),
        )
        op.create_index(
            "ix_transactions_account_id",
            "transactions",
            ["account_id"],
            unique=False,
        )

    existing_columns = {
        column["name"] for column in sa.inspect(op.get_bind()).get_columns("accounts")
    }
    new_columns = (
        sa.Column(
            "account_type",
            sa.String(length=32),
            nullable=False,
            server_default="savings",
        ),
        sa.Column("email", sa.String(length=254), nullable=True),
        sa.Column("phone", sa.String(length=32), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
    )
    for column in new_columns:
        if column.name not in existing_columns:
            op.add_column("accounts", column)


def downgrade() -> None:
    existing_columns = {
        column["name"] for column in sa.inspect(op.get_bind()).get_columns("accounts")
    }
    for column_name in ("description", "phone", "email", "account_type"):
        if column_name in existing_columns:
            op.drop_column("accounts", column_name)
