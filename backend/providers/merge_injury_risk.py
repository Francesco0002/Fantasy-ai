"""
Unisce il rischio infortuni aggregato
al dataset dei giocatori con ruoli classici.

Input:
- data/processed/player_season_stats_with_classic_roles.csv
- data/processed/player_injury_risk.csv

Output:
- aggiorna player_season_stats_with_classic_roles.csv
  aggiungendo le colonne relative agli infortuni.
"""

from pathlib import Path

import pandas as pd


PROJECT_ROOT = (
    Path(__file__)
    .resolve()
    .parents[2]
)

PLAYERS_PATH = (
    PROJECT_ROOT
    / "data"
    / "processed"
    / "player_season_stats_with_classic_roles.csv"
)

INJURY_RISK_PATH = (
    PROJECT_ROOT
    / "data"
    / "processed"
    / "player_injury_risk.csv"
)


INJURY_COLUMNS = [
    "injury_history_available",
    "injury_events_total",
    "injury_events_3y",
    "injury_burden_3y",
    "injury_risk",
    "injury_reference_date",
    "injury_source",
]


def main() -> None:
    """
    Esegue l'unione tramite player_id.
    """

    if not PLAYERS_PATH.exists():
        raise FileNotFoundError(
            "Dataset giocatori non trovato: "
            f"{PLAYERS_PATH}"
        )

    if not INJURY_RISK_PATH.exists():
        raise FileNotFoundError(
            "Dataset rischio infortuni non trovato: "
            f"{INJURY_RISK_PATH}"
        )

    players = pd.read_csv(
        PLAYERS_PATH,
        encoding="utf-8-sig",
    )

    injuries = pd.read_csv(
        INJURY_RISK_PATH,
        encoding="utf-8-sig",
    )

    required_player_columns = [
        "player_id",
        "name",
    ]

    required_injury_columns = [
        "player_id",
        *INJURY_COLUMNS,
    ]

    missing_player_columns = [
        column
        for column in required_player_columns
        if column not in players.columns
    ]

    missing_injury_columns = [
        column
        for column in required_injury_columns
        if column not in injuries.columns
    ]

    if missing_player_columns:
        raise ValueError(
            "Colonne mancanti nel dataset giocatori: "
            + ", ".join(missing_player_columns)
        )

    if missing_injury_columns:
        raise ValueError(
            "Colonne mancanti nel dataset infortuni: "
            + ", ".join(missing_injury_columns)
        )

    if players["player_id"].duplicated().any():
        raise ValueError(
            "Player ID duplicati nel dataset giocatori."
        )

    if injuries["player_id"].duplicated().any():
        raise ValueError(
            "Player ID duplicati nel dataset infortuni."
        )

    player_ids = set(
        players["player_id"]
        .astype(int)
    )

    injury_ids = set(
        injuries["player_id"]
        .astype(int)
    )

    if player_ids != injury_ids:
        raise ValueError(
            "Gli ID dei due dataset "
            "non coincidono esattamente."
        )

    history_available = (
        injuries["injury_history_available"]
        .astype(str)
        .str.strip()
        .str.lower()
        .map(
            {
                "true": True,
                "false": False,
            }
        )
    )

    if history_available.isna().any():
        raise ValueError(
            "Valori non validi in "
            "injury_history_available."
        )

    injuries[
        "injury_history_available"
    ] = history_available.astype(bool)

    available = injuries[
        "injury_history_available"
    ]

    if injuries.loc[
        available,
        "injury_risk",
    ].isna().any():
        raise ValueError(
            "Rischio mancante nonostante "
            "lo storico disponibile."
        )

    if injuries.loc[
        ~available,
        "injury_risk",
    ].notna().any():
        raise ValueError(
            "Rischio presente senza "
            "uno storico disponibile."
        )

    #
    # Rende lo script idempotente:
    # eventuali colonne già presenti
    # vengono sostituite con i nuovi valori.
    #
    existing_injury_columns = [
        column
        for column in INJURY_COLUMNS
        if column in players.columns
    ]

    players = players.drop(
        columns=existing_injury_columns,
    )

    enriched_players = players.merge(
        injuries[
            [
                "player_id",
                *INJURY_COLUMNS,
            ]
        ],
        on="player_id",
        how="left",
        validate="one_to_one",
    )

    if len(enriched_players) != len(players):
        raise ValueError(
            "Il numero di giocatori è cambiato "
            "durante l'unione."
        )

    enriched_players.to_csv(
        PLAYERS_PATH,
        index=False,
        encoding="utf-8-sig",
    )

    print(
        "Rischio infortuni unito correttamente."
    )

    print(
        "Giocatori elaborati:",
        len(enriched_players),
    )

    print(
        "Storico disponibile:",
        int(
            enriched_players[
                "injury_history_available"
            ].sum()
        ),
    )

    print(
        "Storico non disponibile:",
        int(
            (
                ~enriched_players[
                    "injury_history_available"
                ]
            ).sum()
        ),
    )

    print(
        "File aggiornato:",
        PLAYERS_PATH,
    )


if __name__ == "__main__":
    main()
