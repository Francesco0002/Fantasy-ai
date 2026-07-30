"""link auction sessions to users

Revision ID: 097be4461a64
Revises: 34ef2af71112
Create Date: 2026-07-30 16:24:06.556983

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '097be4461a64'
down_revision: Union[str, Sequence[str], None] = '34ef2af71112'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Collega facoltativamente
    le sessioni d'asta agli utenti.
    """

    op.add_column(
        "auction_sessions",
        sa.Column(
            "user_id",
            sa.UUID(),
            nullable=True,
        ),
    )

    op.create_index(
        "ix_auction_sessions_user_id",
        "auction_sessions",
        [
            "user_id",
        ],
        unique=False,
    )

    op.create_foreign_key(
        (
            "fk_auction_sessions_"
            "user_id_users"
        ),
        "auction_sessions",
        "users",
        [
            "user_id",
        ],
        [
            "id",
        ],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    """
    Rimuove il collegamento
    tra sessioni e utenti.
    """

    op.drop_constraint(
        (
            "fk_auction_sessions_"
            "user_id_users"
        ),
        "auction_sessions",
        type_="foreignkey",
    )

    op.drop_index(
        "ix_auction_sessions_user_id",
        table_name="auction_sessions",
    )

    op.drop_column(
        "auction_sessions",
        "user_id",
    )
