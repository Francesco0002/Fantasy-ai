"""
Aggrega gli snapshot di /fixtures/players
in statistiche stagionali per giocatore.

Non effettua richieste API.

Input:
data/raw/api_football/season_<stagione>/fixture_players/*.json

Output:
data/raw/api_football/season_<stagione>/
player_season_stats_partial.csv
"""

import argparse
import json

from collections import Counter
from pathlib import Path
from typing import Any

import pandas as pd


PROJECT_ROOT = (
    Path(__file__)
    .resolve()
    .parents[2]
)

RAW_ROOT = (
    PROJECT_ROOT
    / "data"
    / "raw"
    / "api_football"
)

DEFAULT_SEASON = 2024
EXPECTED_SERIE_A_FIXTURES = 380


ROLE_MAP = {
    "G": "P",
    "Goalkeeper": "P",
    "D": "D",
    "Defender": "D",
    "M": "C",
    "Midfielder": "C",
    "F": "A",
    "Attacker": "A",
    "Forward": "A",
}


def safe_int(value: Any) -> int:
    """
    Converte un valore in intero.
    """

    if value is None:
        return 0

    try:
        return int(float(value))

    except (
        TypeError,
        ValueError,
    ):
        return 0


def safe_float(value: Any) -> float:
    """
    Converte un valore in float.
    """

    if value is None:
        return 0.0

    try:
        return float(value)

    except (
        TypeError,
        ValueError,
    ):
        return 0.0


def calculate_fantasy_average(
    role: str,
    appearances: int,
    average_rating: float,
    goals: int,
    assists: int,
    goals_conceded: int,
    penalties_saved: int,
    yellow_cards: int,
    red_cards: int,
) -> float:
    """
    Calcola una prima stima della fantamedia
    usando i dati aggregati delle partite.

    Bonus e malus:
    - +3 per ogni gol;
    - +1 per ogni assist;
    - -0,5 per ogni ammonizione;
    - -1 per ogni espulsione;
    - per i portieri:
      -1 per ogni gol subito;
      +3 per ogni rigore parato.
    """

    if appearances <= 0:
        return 0.0

    total_points = (
        average_rating
        * appearances
    )

    total_points += goals * 3
    total_points += assists
    total_points -= yellow_cards * 0.5
    total_points -= red_cards

    if role == "P":
        total_points -= goals_conceded
        total_points += penalties_saved * 3

    fantasy_average = (
        total_points
        / appearances
    )

    return round(
        min(
            max(
                fantasy_average,
                0.0,
            ),
            15.0,
        ),
        2,
    )


def normalize_role(value: Any) -> str:
    """
    Converte il ruolo API nel formato
    utilizzato da Fantasy AI.
    """

    role = str(
        value or ""
    ).strip()

    return ROLE_MAP.get(
        role,
        "",
    )


def parse_arguments() -> argparse.Namespace:
    """
    Legge gli argomenti del comando.
    """

    parser = argparse.ArgumentParser(
        description=(
            "Aggrega le statistiche dei giocatori "
            "salvate negli snapshot API-Football."
        )
    )

    parser.add_argument(
        "--season",
        type=int,
        default=DEFAULT_SEASON,
        help=(
            "Anno iniziale della stagione. "
            "Esempio: 2024 per il 2024/2025."
        ),
    )

    return parser.parse_args()


def snapshots_directory(
    season: int,
) -> Path:
    """
    Restituisce la cartella degli snapshot.
    """

    return (
        RAW_ROOT
        / f"season_{season}"
        / "fixture_players"
    )


def output_path(
    season: int,
) -> Path:
    """
    Restituisce il percorso del CSV aggregato.
    """

    return (
        RAW_ROOT
        / f"season_{season}"
        / "player_season_stats_partial.csv"
    )


def player_profiles_path(
    season: int,
) -> Path:
    """
    Restituisce il percorso del CSV
    contenente i profili anagrafici.
    """

    return (
        PROJECT_ROOT
        / "data"
        / "raw"
        / f"api_football_players_{season}.csv"
    )


def load_player_ages(
    season: int,
) -> dict[int, int]:
    """
    Carica l'associazione player_id -> age
    dal CSV generato da api_football.py.
    """

    path = player_profiles_path(
        season
    )

    if not path.exists():
        raise FileNotFoundError(
            "CSV dei profili anagrafici non trovato: "
            f"{path}"
        )

    dataframe = pd.read_csv(
        path,
        usecols=[
            "player_id",
            "age",
        ],
    )

    player_ages: dict[int, int] = {}

    for row in dataframe.itertuples(
        index=False
    ):
        player_id = safe_int(
            row.player_id
        )

        age = safe_int(
            row.age
        )

        if (
            player_id > 0
            and 15 <= age <= 50
        ):
            player_ages[player_id] = age

    return player_ages


def load_snapshot(
    path: Path,
) -> dict[str, Any]:
    """
    Legge un singolo snapshot JSON.
    """

    with path.open(
        "r",
        encoding="utf-8",
    ) as file:
        payload = json.load(
            file
        )

    if not isinstance(
        payload,
        dict,
    ):
        raise ValueError(
            f"Snapshot non valido: {path.name}"
        )

    return payload


def create_player_record(
    player_id: int,
    player_name: str,
) -> dict[str, Any]:
    """
    Crea la struttura utilizzata
    per aggregare un giocatore.
    """

    return {
        "player_id": player_id,
        "name": player_name,
        "fixture_ids": set(),
        "starts": 0,
        "minutes": 0,
        "goals": 0,
        "assists": 0,
        "clean_sheets": 0,
        "goals_conceded": 0,
        "saves": 0,
        "penalties_scored": 0,
        "penalties_missed": 0,
        "penalties_saved": 0,
        "yellow_cards": 0,
        "red_cards": 0,
        "rating_weighted_sum": 0.0,
        "rating_minutes": 0,
        "rating_matches": 0,
        "role_minutes": Counter(),
        "team_minutes": Counter(),
    }


def aggregate_snapshot(
    payload: dict[str, Any],
    players: dict[int, dict[str, Any]],
) -> None:
    """
    Aggiunge all'aggregazione i dati
    contenuti in una partita.
    """

    fixture = payload.get(
        "fixture",
        {},
    )

    fixture_id = safe_int(
        fixture.get("fixture_id")
    )

    home_team_id = safe_int(
        fixture.get("home_team_id")
    )

    away_team_id = safe_int(
        fixture.get("away_team_id")
    )

    home_goals = safe_int(
        fixture.get("home_goals")
    )

    away_goals = safe_int(
        fixture.get("away_goals")
    )

    api_response = payload.get(
        "api_response",
        {},
    )

    team_blocks = api_response.get(
        "response",
        [],
    )

    if not isinstance(
        team_blocks,
        list,
    ):
        return

    for team_block in team_blocks:
        team = team_block.get(
            "team",
            {},
        )

        team_id = safe_int(
            team.get("id")
        )

        team_name = str(
            team.get(
                "name",
                "Squadra sconosciuta",
            )
        ).strip()

        if team_id == home_team_id:
            final_goals_conceded = away_goals

        elif team_id == away_team_id:
            final_goals_conceded = home_goals

        else:
            final_goals_conceded = 0

        player_items = team_block.get(
            "players",
            [],
        )

        if not isinstance(
            player_items,
            list,
        ):
            continue

        for player_item in player_items:
            player = player_item.get(
                "player",
                {},
            )

            player_id = safe_int(
                player.get("id")
            )

            player_name = str(
                player.get(
                    "name",
                    "",
                )
            ).strip()

            if (
                player_id <= 0
                or player_name == ""
            ):
                continue

            statistics_list = player_item.get(
                "statistics",
                [],
            )

            if (
                not isinstance(
                    statistics_list,
                    list,
                )
                or len(statistics_list) == 0
            ):
                continue

            statistics = statistics_list[0]

            games = statistics.get(
                "games",
                {},
            )

            minutes = safe_int(
                games.get("minutes")
            )

            # I giocatori rimasti sempre in panchina
            # possono essere presenti nella risposta,
            # ma non contano come presenze.
            if minutes <= 0:
                continue

            role = normalize_role(
                games.get("position")
            )

            if role == "":
                continue

            if player_id not in players:
                players[player_id] = (
                    create_player_record(
                        player_id=player_id,
                        player_name=player_name,
                    )
                )

            record = players[
                player_id
            ]

            record["fixture_ids"].add(
                fixture_id
            )

            substitute = games.get(
                "substitute"
            )

            if substitute is False:
                record["starts"] += 1

            record["minutes"] += minutes

            record["role_minutes"][
                role
            ] += minutes

            record["team_minutes"][
                team_name
            ] += minutes

            goals = statistics.get(
                "goals",
                {},
            )

            record["goals"] += safe_int(
                goals.get("total")
            )

            record["assists"] += safe_int(
                goals.get("assists")
            )

            record[
                "goals_conceded"
            ] += safe_int(
                goals.get("conceded")
            )

            record["saves"] += safe_int(
                goals.get("saves")
            )

            penalty = statistics.get(
                "penalty",
                {},
            )

            record[
                "penalties_scored"
            ] += safe_int(
                penalty.get("scored")
            )

            record[
                "penalties_missed"
            ] += safe_int(
                penalty.get("missed")
            )

            record[
                "penalties_saved"
            ] += safe_int(
                penalty.get("saved")
            )

            cards = statistics.get(
                "cards",
                {},
            )

            record[
                "yellow_cards"
            ] += safe_int(
                cards.get("yellow")
            )

            # Un'espulsione per doppio giallo viene
            # considerata come cartellino rosso.
            record[
                "red_cards"
            ] += (
                safe_int(
                    cards.get("red")
                )
                + safe_int(
                    cards.get("yellowred")
                )
            )

            rating = safe_float(
                games.get("rating")
            )

            if rating > 0:
                record[
                    "rating_weighted_sum"
                ] += rating * minutes

                record[
                    "rating_minutes"
                ] += minutes

                record[
                    "rating_matches"
                ] += 1

            if (
                role in {"P", "D"}
                and final_goals_conceded == 0
                and minutes >= 60
            ):
                record[
                    "clean_sheets"
                ] += 1


def choose_primary_value(
    counter: Counter,
) -> str:
    """
    Restituisce il valore associato
    al maggior numero di minuti.
    """

    if len(counter) == 0:
        return ""

    return counter.most_common(
        1
    )[0][0]


def build_rows(
    players: dict[int, dict[str, Any]],
    player_ages: dict[int, int],
    season: int,
    snapshot_count: int,
) -> list[dict[str, Any]]:
    """
    Trasforma le strutture aggregate
    in righe esportabili nel CSV.
    """

    rows: list[
        dict[str, Any]
    ] = []

    for record in players.values():
        player_id = safe_int(
            record["player_id"]
        )

        age = player_ages.get(
            player_id
        )

        appearances = len(
            record["fixture_ids"]
        )

        starts = safe_int(
            record["starts"]
        )

        minutes = safe_int(
            record["minutes"]
        )

        if appearances <= 0:
            continue

        rating_minutes = safe_int(
            record["rating_minutes"]
        )

        if rating_minutes > 0:
            average_rating = (
                record["rating_weighted_sum"]
                / rating_minutes
            )

        else:
            average_rating = 0.0

        primary_role = choose_primary_value(
            record["role_minutes"]
        )

        primary_team = choose_primary_value(
            record["team_minutes"]
        )
        
        rating_matches = safe_int(
            record["rating_matches"]
        )

        rating_coverage = (
            rating_matches / appearances
            if appearances > 0
            else 0.0
        )

        primary_role_minutes = max(
            record["role_minutes"].values(),
            default=0,
        )

        role_confidence = (
            primary_role_minutes / minutes
            if minutes > 0
            else 0.0
        )

        #
        # Le soglie delle presenze crescono
        # automaticamente con la copertura
        # della stagione.
        #
        # Con 153 fixture:
        # HIGH richiede circa 8 presenze.
        # MEDIUM richiede circa 4 presenze.
        #
        # Con 380 fixture:
        # HIGH richiederà 20 presenze.
        # MEDIUM richiederà 10 presenze.
        #
        season_coverage = min(
            snapshot_count / 380,
            1.0,
        )

        high_min_appearances = max(
            1,
            round(
                20 * season_coverage
            ),
        )

        medium_min_appearances = max(
            1,
            round(
                10 * season_coverage
            ),
        )

        rating_needs_review = (
            rating_coverage < 0.8
        )

        role_needs_review = (
            role_confidence < 0.8
        )

        if (
            appearances >=
            high_min_appearances
            and rating_coverage >= 0.8
        ):
            data_quality = "HIGH"

        elif (
            appearances >=
            medium_min_appearances
            and rating_coverage >= 0.5
        ):
            data_quality = "MEDIUM"

        else:
            data_quality = "LOW"

        teams_played_for = "; ".join(
            sorted(
                record["team_minutes"].keys()
            )
        )

        fantasy_average = (
            calculate_fantasy_average(
                role=primary_role,
                appearances=appearances,
                average_rating=average_rating,
                goals=safe_int(
                    record["goals"]
                ),
                assists=safe_int(
                    record["assists"]
                ),
                goals_conceded=safe_int(
                    record["goals_conceded"]
                ),
                penalties_saved=safe_int(
                    record["penalties_saved"]
                ),
                yellow_cards=safe_int(
                    record["yellow_cards"]
                ),
                red_cards=safe_int(
                    record["red_cards"]
                ),
            )
        )

        rows.append(
            {
                "player_id":
                    player_id,

                "name":
                    record["name"],

                "team":
                    primary_team,

                "teams_played_for":
                    teams_played_for,

                "role":
                    primary_role,

                "age":
                    age,

                "season":
                    season,

                "appearances_last_season":
                    appearances,

                "starts_last_season":
                    starts,

                "minutes_last_season":
                    minutes,

                "goals_last_season":
                    record["goals"],

                "assists_last_season":
                    record["assists"],

                "clean_sheets_last_season":
                    record["clean_sheets"],

                "goals_conceded_last_season":
                    record["goals_conceded"],

                "saves_last_season":
                    record["saves"],

                "penalties_scored_last_season":
                    record["penalties_scored"],

                "penalties_missed_last_season":
                    record["penalties_missed"],

                "penalties_saved_last_season":
                    record["penalties_saved"],

                "average_rating_last_season":
                    round(
                        average_rating,
                        3,
                    ),

                "fantasy_average_last_season":
                    fantasy_average,
                    
                "rating_matches":
                    rating_matches,

                "rating_coverage":
                    round(
                        rating_coverage,
                        3,
                    ),

                "role_confidence":
                    round(
                        role_confidence,
                        3,
                    ),

                "data_quality":
                    data_quality,

                "role_needs_review":
                    role_needs_review,

                "rating_needs_review":
                    rating_needs_review,

                "yellow_cards_last_season":
                    record["yellow_cards"],

                "red_cards_last_season":
                    record["red_cards"],

                "source_fixture_count":
                    snapshot_count,

                "data_source":
                    f"api_football_fixtures_{season}",
            }
        )

    rows.sort(
        key=lambda row: (
            row["role"],
            -row["minutes_last_season"],
            row["name"],
        )
    )

    return rows


def main() -> None:
    """
    Legge tutti gli snapshot disponibili
    e crea il CSV aggregato.
    """

    arguments = parse_arguments()

    try:
        player_ages = load_player_ages(
            arguments.season
        )

    except (
        OSError,
        ValueError,
    ) as error:
        print(
            "Impossibile caricare "
            f"le età dei giocatori: {error}"
        )
        return

    directory = snapshots_directory(
        arguments.season
    )

    if not directory.exists():
        print(
            "Cartella snapshot non trovata:\n"
            f"{directory}"
        )
        return

    snapshot_paths = sorted(
        directory.glob("*.json")
    )

    if len(snapshot_paths) == 0:
        print(
            "Nessuno snapshot JSON trovato."
        )
        return

    players: dict[
        int,
        dict[str, Any],
    ] = {}

    valid_snapshots = 0
    invalid_snapshots = 0

    for path in snapshot_paths:
        try:
            payload = load_snapshot(
                path
            )

            aggregate_snapshot(
                payload=payload,
                players=players,
            )

            valid_snapshots += 1

        except (
            OSError,
            ValueError,
            TypeError,
            json.JSONDecodeError,
        ) as error:
            invalid_snapshots += 1

            print(
                f"Snapshot ignorato "
                f"{path.name}: {error}"
            )

    rows = build_rows(
        players=players,
        player_ages=player_ages,
        season=arguments.season,
        snapshot_count=valid_snapshots,
    )

    if len(rows) == 0:
        print(
            "Nessun giocatore aggregato."
        )
        return

    dataframe = pd.DataFrame(
        rows
    )

    destination = output_path(
        arguments.season
    )

    destination.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    dataframe.to_csv(
        destination,
        index=False,
        encoding="utf-8",
    )

    coverage = (
        valid_snapshots
        / EXPECTED_SERIE_A_FIXTURES
        * 100
    )

    print(
        "\n"
        "================================"
    )

    print(
        "AGGREGAZIONE COMPLETATA"
    )

    print(
        "Snapshot validi: "
        f"{valid_snapshots}"
    )

    print(
        "Snapshot non validi: "
        f"{invalid_snapshots}"
    )

    print(
        "Copertura stagione: "
        f"{coverage:.1f}%"
    )

    print(
        "Giocatori con almeno "
        "una presenza: "
        f"{len(dataframe)}"
    )

    print(
        "\nGiocatori per ruolo:"
    )

    print(
        dataframe[
            "role"
        ]
        .value_counts()
        .reindex(
            ["P", "D", "C", "A"],
            fill_value=0,
        )
        .to_string()
    )

    print(
        "\nControlli:"
    )

    duplicated_ids = int(
        dataframe[
            "player_id"
        ]
        .duplicated()
        .sum()
    )

    invalid_starts = int(
        (
            dataframe[
                "starts_last_season"
            ]
            > dataframe[
                "appearances_last_season"
            ]
        ).sum()
    )

    players_without_minutes = int(
        (
            dataframe[
                "minutes_last_season"
            ]
            <= 0
        ).sum()
    )

    print(
        "ID duplicati: "
        f"{duplicated_ids}"
    )

    print(
        "Titolarità superiori alle presenze: "
        f"{invalid_starts}"
    )

    print(
        "Giocatori senza minuti: "
        f"{players_without_minutes}"
    )

    print(
        "\nCSV creato:"
    )

    print(
        destination
    )

    if (
        valid_snapshots
        < EXPECTED_SERIE_A_FIXTURES
    ):
        print(
            "\nATTENZIONE: statistiche parziali. "
            "Non importare ancora questo CSV "
            "in data/players.csv."
        )


if __name__ == "__main__":
    main()