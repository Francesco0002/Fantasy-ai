"""add auction league rules

Revision ID: e92072a27560
Revises: 3bd7e5079fb1
Create Date: 2026-07-28 18:05:20.864501
"""

from __future__ import annotations

import json

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "e92072a27560"

down_revision: Union[
    str,
    Sequence[str],
    None,
] = "3bd7e5079fb1"

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


DEFAULT_LEAGUE_RULES = {
    "scoring": {
        "goalByRole": {
            "P": 3,
            "D": 3,
            "C": 3,
            "A": 3,
        },
        "assist": 1,
        "cleanSheet": 1,
        "goalConceded": -1,
        "penaltyScored": 3,
        "penaltyMissed": -3,
        "penaltySaved": 3,
        "yellowCard": -0.5,
        "redCard": -1,
        "ownGoal": -2,
    },

    "defenseModifier": {
        "enabled": False,
        "minimumDefenders": 4,
        "includeGoalkeeper": True,
        "consideredPlayers": 4,
        "bands": [
            {
                "minimumAverage": 6,
                "bonus": 1,
            },
            {
                "minimumAverage": 6.25,
                "bonus": 2,
            },
            {
                "minimumAverage": 6.5,
                "bonus": 3,
            },
            {
                "minimumAverage": 7,
                "bonus": 6,
            },
        ],
    },

    "midfieldModifier": {
        "enabled": False,
        "minimumMidfielders": 4,
        "consideredPlayers": 4,
        "bands": [
            {
                "minimumAverage": 6,
                "bonus": 1,
            },
            {
                "minimumAverage": 6.25,
                "bonus": 2,
            },
            {
                "minimumAverage": 6.5,
                "bonus": 3,
            },
            {
                "minimumAverage": 7,
                "bonus": 6,
            },
        ],
    },
}


def upgrade() -> None:
    """
    Aggiunge strategia budget e regole lega.

    Le colonne vengono inizialmente create
    come nullable per permettere la migrazione
    delle sessioni già presenti.
    """

    op.add_column(
        "auction_sessions",
        sa.Column(
            "budget_strategy",
            sa.String(length=20),
            nullable=True,
        ),
    )

    op.add_column(
        "auction_sessions",
        sa.Column(
            "league_rules",
            postgresql.JSONB(
                astext_type=sa.Text(),
            ),
            nullable=True,
        ),
    )

    # Le vecchie sessioni vengono considerate
    # configurazioni con budget manuale.
    op.execute(
        sa.text(
            """
            UPDATE auction_sessions
            SET budget_strategy = 'MANUAL'
            WHERE budget_strategy IS NULL
            """
        )
    )

    default_rules_json = json.dumps(
        DEFAULT_LEAGUE_RULES,
        ensure_ascii=False,
    )

    # Inserisce le regole classiche
    # nelle sessioni già esistenti.
    op.execute(
        sa.text(
            """
            UPDATE auction_sessions
            SET league_rules =
                CAST(:default_rules AS JSONB)
            WHERE league_rules IS NULL
            """
        ).bindparams(
            default_rules=(
                default_rules_json
            )
        )
    )

    # Dopo aver valorizzato le vecchie righe,
    # le colonne possono diventare obbligatorie.
    op.alter_column(
        "auction_sessions",
        "budget_strategy",
        existing_type=sa.String(
            length=20,
        ),
        nullable=False,
    )

    op.alter_column(
        "auction_sessions",
        "league_rules",
        existing_type=postgresql.JSONB(
            astext_type=sa.Text(),
        ),
        nullable=False,
    )

    op.create_check_constraint(
        "ck_auction_sessions_"
        "budget_strategy_valid",
        "auction_sessions",
        (
            "budget_strategy IN "
            "('AUTOMATIC', 'MANUAL')"
        ),
    )


def downgrade() -> None:
    """
    Rimuove strategia budget
    e regole della lega.
    """

    op.drop_constraint(
        "ck_auction_sessions_"
        "budget_strategy_valid",
        "auction_sessions",
        type_="check",
    )

    op.drop_column(
        "auction_sessions",
        "league_rules",
    )

    op.drop_column(
        "auction_sessions",
        "budget_strategy",
    )