"""create season leagues

Revision ID: a5d1c8e7b2f4
Revises: 097be4461a64
Create Date: 2026-08-02 18:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a5d1c8e7b2f4"
down_revision: Union[
    str,
    Sequence[str],
    None,
] = "097be4461a64"
branch_labels: Union[
    str,
    Sequence[str],
    None,
] = None
depends_on: Union[
    str,
    Sequence[str],
    None,
] = None


def upgrade() -> None:
    """Crea le leghe personali della Stagione."""

    op.create_table(
        "season_leagues",
        sa.Column(
            "id",
            sa.UUID(),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.UUID(),
            nullable=False,
        ),
        sa.Column(
            "league_name",
            sa.String(length=120),
            nullable=False,
        ),
        sa.Column(
            "team_name",
            sa.String(length=120),
            nullable=False,
        ),
        sa.Column(
            "season",
            sa.String(length=7),
            nullable=False,
        ),
        sa.Column(
            "mode",
            sa.String(length=20),
            server_default="CLASSIC",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "mode IN ('CLASSIC')",
            name=(
                "ck_season_leagues_"
                "mode_valid"
            ),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=(
                "fk_season_leagues_"
                "user_id_users"
            ),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "season",
            "league_name",
            name=(
                "uq_season_leagues_"
                "user_season_name"
            ),
        ),
    )

    op.create_index(
        "ix_season_leagues_user_id",
        "season_leagues",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    """Rimuove le leghe create dallo step."""

    op.drop_index(
        "ix_season_leagues_user_id",
        table_name="season_leagues",
    )

    op.drop_table(
        "season_leagues"
    )
