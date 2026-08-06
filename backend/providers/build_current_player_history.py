"""
Costruisce il dataset dei giocatori correnti 2026/27 collegando:

1. il listone Fantacalcio corrente;
2. la mappa Fantacalcio ID -> API-Football ID;
3. le statistiche storiche API-Football 2024/25.

Il file generato resta locale perché contiene dati derivati
dai listoni Fantacalcio.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd
from pandas.api.types import is_bool_dtype


PROJECT_ROOT = Path(__file__).resolve().parents[2]

COMPARISON_PATH = (
    PROJECT_ROOT
    / "data"
    / "raw"
    / "fantacalcio"
    / "derived"
    / "fantacalcio_listone_comparison_2025_26_vs_2026_27.csv"
)

PLAYER_MAP_PATH = (
    PROJECT_ROOT
    / "data"
    / "processed"
    / "fantacalcio_api_football_player_map_2024_25.csv"
)

HISTORY_PATH = (
    PROJECT_ROOT
    / "data"
    / "processed"
    / "player_season_stats_with_classic_roles.csv"
)

OUTPUT_PATH = (
    PROJECT_ROOT
    / "data"
    / "raw"
    / "fantacalcio"
    / "derived"
    / "fantacalcio_current_players_with_history_2026_27.csv"
)


def validate_source_files() -> None:
    """Controlla che tutti i file necessari esistano."""

    source_files = [
        COMPARISON_PATH,
        PLAYER_MAP_PATH,
        HISTORY_PATH,
    ]

    missing_files = [
        path
        for path in source_files
        if not path.exists()
    ]

    if missing_files:
        formatted_paths = "\n".join(
            str(path)
            for path in missing_files
        )

        raise FileNotFoundError(
            "File sorgente mancanti:\n"
            f"{formatted_paths}"
        )


def normalize_boolean_series(
    series: pd.Series,
) -> pd.Series:
    """Converte valori booleani o testuali in True/False."""

    if is_bool_dtype(series):
        return series.fillna(False)

    normalized = (
        series
        .astype(str)
        .str.strip()
        .str.lower()
    )

    return normalized.isin(
        {
            "true",
            "1",
            "yes",
            "y",
        }
    )


def validate_unique_column(
    dataframe: pd.DataFrame,
    column: str,
    dataset_name: str,
) -> None:
    """Verifica che una colonna identificativa sia univoca."""

    duplicated_values = dataframe.loc[
        dataframe[column].notna()
        & dataframe[column].duplicated(keep=False),
        column,
    ]

    if not duplicated_values.empty:
        raise ValueError(
            f"Valori duplicati in {dataset_name}.{column}: "
            f"{sorted(duplicated_values.unique().tolist())}"
        )


def main() -> None:
    """Genera il dataset corrente arricchito con lo storico."""

    validate_source_files()

    comparison = pd.read_csv(
        COMPARISON_PATH,
    )

    player_map = pd.read_csv(
        PLAYER_MAP_PATH,
    )

    history = pd.read_csv(
        HISTORY_PATH,
    )

    # --------------------------------------------------------------
    # 1. Validazione delle chiavi
    # --------------------------------------------------------------

    validate_unique_column(
        comparison,
        "fantacalcio_id",
        "comparison",
    )

    validate_unique_column(
        player_map,
        "fantacalcio_id",
        "player_map",
    )

    validate_unique_column(
        player_map,
        "api_football_player_id",
        "player_map",
    )

    validate_unique_column(
        history,
        "player_id",
        "history",
    )

    # --------------------------------------------------------------
    # 2. Collegamento tra listone corrente e mappa permanente
    # --------------------------------------------------------------

    map_columns = [
        "fantacalcio_id",
        "api_football_player_id",
        "source_season",
        "api_football_name",
        "api_football_team",
        "role_match_method",
        "role_match_score",
    ]

    current_players = comparison.merge(
        player_map[map_columns],
        on="fantacalcio_id",
        how="left",
        validate="one_to_one",
    )

    mapped_api_ids = current_players.loc[
        current_players[
            "api_football_player_id"
        ].notna(),
        "api_football_player_id",
    ]

    if mapped_api_ids.duplicated().any():
        raise ValueError(
            "Uno stesso ID API-Football è associato "
            "a più giocatori correnti"
        )

    # --------------------------------------------------------------
    # 3. Preparazione e collegamento dello storico 2024/25
    # --------------------------------------------------------------

    history_renames = {
        column: (
            "history_2024_25_player_id"
            if column == "player_id"
            else f"history_2024_25_{column}"
        )
        for column in history.columns
    }

    history_export = history.rename(
        columns=history_renames,
    )

    current_players = current_players.merge(
        history_export,
        left_on="api_football_player_id",
        right_on="history_2024_25_player_id",
        how="left",
        validate="many_to_one",
    )

    has_map = current_players[
        "api_football_player_id"
    ].notna()

    has_history = current_players[
        "history_2024_25_player_id"
    ].notna()

    mapped_without_history = current_players[
        has_map & ~has_history
    ]

    if not mapped_without_history.empty:
        raise ValueError(
            "Alcuni ID mappati non trovano lo storico:\n"
            + mapped_without_history[
                [
                    "fantacalcio_id",
                    "name_2026_27",
                    "api_football_player_id",
                ]
            ].to_string(index=False)
        )

    # --------------------------------------------------------------
    # 4. Classificazione della copertura
    # --------------------------------------------------------------

    present_2025_26 = normalize_boolean_series(
        current_players["present_2025_26"]
    )

    is_new_2026_27 = normalize_boolean_series(
        current_players["is_new_2026_27"]
    )

    invalid_status_rows = current_players[
        present_2025_26 & is_new_2026_27
    ]

    if not invalid_status_rows.empty:
        raise ValueError(
            "Alcuni giocatori risultano contemporaneamente "
            "presenti nel 2025/26 e nuovi nel 2026/27"
        )

    current_players["history_available"] = (
        has_history
    )

    current_players["coverage_status"] = (
        "UNCLASSIFIED"
    )

    current_players.loc[
        has_history,
        "coverage_status",
    ] = "HISTORY_2024_25"

    current_players.loc[
        ~has_history & present_2025_26,
        "coverage_status",
    ] = "NO_2024_25_HISTORY"

    current_players.loc[
        ~has_history & is_new_2026_27,
        "coverage_status",
    ] = "NEW_2026_27"

    unclassified = current_players[
        current_players["coverage_status"].eq(
            "UNCLASSIFIED"
        )
    ]

    if not unclassified.empty:
        raise ValueError(
            "Sono presenti giocatori non classificati:\n"
            + unclassified[
                [
                    "fantacalcio_id",
                    "name_2026_27",
                    "team_2026_27",
                ]
            ].to_string(index=False)
        )

    # --------------------------------------------------------------
    # 5. Ordinamento delle colonne principali
    # --------------------------------------------------------------

    priority_columns = [
        "fantacalcio_id",
        "name_2026_27",
        "team_2026_27",
        "role_2026_27",
        "mantra_role_2026_27",
        "coverage_status",
        "history_available",
        "api_football_player_id",
        "role_match_method",
        "role_match_score",
    ]

    remaining_columns = [
        column
        for column in current_players.columns
        if column not in priority_columns
    ]

    current_players = current_players[
        priority_columns + remaining_columns
    ]

    # --------------------------------------------------------------
    # 6. Scrittura del file derivato
    # --------------------------------------------------------------

    OUTPUT_PATH.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    current_players.to_csv(
        OUTPUT_PATH,
        index=False,
        encoding="utf-8-sig",
        lineterminator="\n",
    )

    coverage_summary = (
        current_players["coverage_status"]
        .value_counts()
    )

    quality_column = (
        "history_2024_25_data_quality"
    )

    quality_summary = (
        current_players.loc[
            current_players["history_available"],
            quality_column,
        ]
        .value_counts(dropna=False)
    )

    print("\nGENERAZIONE COMPLETATA")
    print(
        f"Giocatori correnti: "
        f"{len(current_players)}"
    )

    print("\nSTATI DI COPERTURA")
    print(
        coverage_summary.to_string()
    )

    print("\nQUALITÀ DELLO STORICO")
    print(
        quality_summary.to_string()
    )

    print("\nFILE GENERATO")
    print(
        OUTPUT_PATH.relative_to(
            PROJECT_ROOT
        )
    )


if __name__ == "__main__":
    main()