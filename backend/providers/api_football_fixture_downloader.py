"""
Downloader progressivo delle statistiche giocatore
per le partite di Serie A tramite API-Football.

Funzionamento:

1. recupera l'elenco delle partite concluse;
2. controlla quali partite sono già state salvate;
3. scarica solo quelle mancanti;
4. salva ogni partita immediatamente in JSON;
5. può essere interrotto e ripreso senza perdere dati.

I dati vengono salvati in:

data/raw/api_football/season_<stagione>/fixture_players/
"""

import argparse
import csv
import json
import time

from datetime import (
    datetime,
    timezone,
)
from pathlib import Path
from typing import Any

from api_football import (
    api_get,
    safe_int,
)


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

DEFAULT_LEAGUE_ID = 135
DEFAULT_SEASON = 2024
DEFAULT_MAX_NEW_FIXTURES = 60
DEFAULT_REQUEST_DELAY = 6.5


def parse_arguments() -> argparse.Namespace:
    """
    Legge i parametri passati da terminale.
    """

    parser = argparse.ArgumentParser(
        description=(
            "Scarica progressivamente le "
            "statistiche dei giocatori per "
            "le partite di Serie A."
        )
    )

    parser.add_argument(
        "--league-id",
        type=int,
        default=DEFAULT_LEAGUE_ID,
        help=(
            "Identificativo API-Football "
            "della competizione."
        ),
    )

    parser.add_argument(
        "--season",
        type=int,
        default=DEFAULT_SEASON,
        help=(
            "Anno iniziale della stagione. "
            "Esempio: 2024 per la stagione "
            "2024/2025."
        ),
    )

    parser.add_argument(
        "--max-new-fixtures",
        type=int,
        default=DEFAULT_MAX_NEW_FIXTURES,
        help=(
            "Numero massimo di nuove partite "
            "da scaricare in questa esecuzione."
        ),
    )

    parser.add_argument(
        "--request-delay",
        type=float,
        default=DEFAULT_REQUEST_DELAY,
        help=(
            "Secondi di attesa tra due "
            "richieste consecutive."
        ),
    )

    return parser.parse_args()


def season_directory(
    season: int,
) -> Path:
    """
    Restituisce la cartella della stagione.
    """

    return (
        RAW_ROOT
        / f"season_{season}"
    )


def snapshots_directory(
    season: int,
) -> Path:
    """
    Restituisce la cartella contenente
    un JSON per ogni partita.
    """

    return (
        season_directory(season)
        / "fixture_players"
    )


def snapshot_path(
    season: int,
    fixture_id: int,
) -> Path:
    """
    Restituisce il percorso del JSON
    relativo a una singola partita.
    """

    return (
        snapshots_directory(season)
        / f"{fixture_id}.json"
    )


def fetch_finished_fixtures(
    league_id: int,
    season: int,
) -> tuple[
    list[dict[str, Any]],
    int | None,
]:
    """
    Recupera tutte le partite concluse
    della competizione.
    """

    data, remaining_requests = api_get(
        endpoint="fixtures",
        parameters={
            "league": league_id,
            "season": season,
            "status": "FT-AET-PEN",
        },
    )

    fixtures: list[
        dict[str, Any]
    ] = []

    for item in data.get(
        "response",
        [],
    ):
        fixture = item.get(
            "fixture",
            {},
        )

        teams = item.get(
            "teams",
            {},
        )

        goals = item.get(
            "goals",
            {},
        )

        home_team = teams.get(
            "home",
            {},
        )

        away_team = teams.get(
            "away",
            {},
        )

        fixture_id = safe_int(
            fixture.get("id")
        )

        if fixture_id <= 0:
            continue

        fixtures.append(
            {
                "fixture_id": fixture_id,
                "date": fixture.get(
                    "date",
                    "",
                ),
                "timestamp": fixture.get(
                    "timestamp",
                    0,
                ),
                "status": (
                    fixture
                    .get(
                        "status",
                        {},
                    )
                    .get(
                        "short",
                        "",
                    )
                ),
                "home_team_id": safe_int(
                    home_team.get("id")
                ),
                "home_team": str(
                    home_team.get(
                        "name",
                        "Sconosciuta",
                    )
                ),
                "away_team_id": safe_int(
                    away_team.get("id")
                ),
                "away_team": str(
                    away_team.get(
                        "name",
                        "Sconosciuta",
                    )
                ),
                "home_goals": safe_int(
                    goals.get("home")
                ),
                "away_goals": safe_int(
                    goals.get("away")
                ),
            }
        )

    fixtures = sorted(
        fixtures,
        key=lambda item: (
            item["date"],
            item["fixture_id"],
        ),
    )

    if len(fixtures) == 0:
        raise RuntimeError(
            "Nessuna partita conclusa trovata."
        )

    return (
        fixtures,
        remaining_requests,
    )


def fetch_fixture_players(
    fixture_id: int,
) -> tuple[
    dict[str, Any],
    int | None,
]:
    """
    Recupera le statistiche individuali
    dei giocatori di una partita.
    """

    return api_get(
        endpoint="fixtures/players",
        parameters={
            "fixture": fixture_id,
        },
    )


def count_player_records(
    response_items: list[dict[str, Any]],
) -> int:
    """
    Conta i record giocatore contenuti
    nella risposta dell'API.
    """

    total = 0

    for team_block in response_items:
        players = team_block.get(
            "players",
            [],
        )

        if isinstance(
            players,
            list,
        ):
            total += len(players)

    return total


def save_json_atomically(
    output_path: Path,
    payload: dict[str, Any],
) -> None:
    """
    Salva un file JSON usando prima
    un file temporaneo.

    Questo evita file corrotti se il processo
    viene interrotto durante il salvataggio.
    """

    output_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    temporary_path = (
        output_path.with_suffix(
            ".json.tmp"
        )
    )

    with temporary_path.open(
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(
            payload,
            file,
            ensure_ascii=False,
            indent=2,
        )

    temporary_path.replace(
        output_path
    )


def save_fixture_snapshot(
    season: int,
    league_id: int,
    fixture: dict[str, Any],
    api_response: dict[str, Any],
) -> Path:
    """
    Salva la risposta grezza completa
    relativa a una partita.
    """

    fixture_id = int(
        fixture["fixture_id"]
    )

    output_path = snapshot_path(
        season=season,
        fixture_id=fixture_id,
    )

    payload = {
        "source": "api_football",
        "downloaded_at": (
            datetime
            .now(timezone.utc)
            .isoformat()
        ),
        "league_id": league_id,
        "season": season,
        "fixture": fixture,
        "api_response": api_response,
    }

    save_json_atomically(
        output_path=output_path,
        payload=payload,
    )

    return output_path


def is_valid_snapshot(
    path: Path,
) -> bool:
    """
    Verifica che un file già presente
    sia un JSON valido e contenga dati.
    """

    if not path.exists():
        return False

    try:
        with path.open(
            "r",
            encoding="utf-8",
        ) as file:
            payload = json.load(
                file
            )

    except (
        OSError,
        json.JSONDecodeError,
    ):
        return False

    api_response = payload.get(
        "api_response",
        {},
    )

    response_items = api_response.get(
        "response",
        [],
    )

    return (
        isinstance(
            response_items,
            list,
        )
        and len(response_items) > 0
    )


def write_manifest(
    fixtures: list[dict[str, Any]],
    season: int,
) -> Path:
    """
    Crea un CSV riepilogativo che indica
    quali partite sono già state scaricate.
    """

    output_directory = (
        season_directory(season)
    )

    output_directory.mkdir(
        parents=True,
        exist_ok=True,
    )

    manifest_path = (
        output_directory
        / "fixtures_manifest.csv"
    )

    fieldnames = [
        "fixture_id",
        "date",
        "status",
        "home_team_id",
        "home_team",
        "away_team_id",
        "away_team",
        "home_goals",
        "away_goals",
        "snapshot_downloaded",
    ]

    with manifest_path.open(
        "w",
        encoding="utf-8",
        newline="",
    ) as file:
        writer = csv.DictWriter(
            file,
            fieldnames=fieldnames,
        )

        writer.writeheader()

        for fixture in fixtures:
            fixture_id = int(
                fixture["fixture_id"]
            )

            downloaded = is_valid_snapshot(
                snapshot_path(
                    season=season,
                    fixture_id=fixture_id,
                )
            )

            writer.writerow(
                {
                    "fixture_id": fixture_id,
                    "date": fixture["date"],
                    "status": fixture["status"],
                    "home_team_id":
                        fixture["home_team_id"],
                    "home_team":
                        fixture["home_team"],
                    "away_team_id":
                        fixture["away_team_id"],
                    "away_team":
                        fixture["away_team"],
                    "home_goals":
                        fixture["home_goals"],
                    "away_goals":
                        fixture["away_goals"],
                    "snapshot_downloaded":
                        downloaded,
                }
            )

    return manifest_path


def main() -> None:
    """
    Avvia il download progressivo.
    """

    arguments = parse_arguments()

    if arguments.league_id <= 0:
        print(
            "--league-id deve essere "
            "maggiore di zero."
        )
        return

    if arguments.season <= 0:
        print(
            "--season deve essere "
            "maggiore di zero."
        )
        return

    if arguments.max_new_fixtures <= 0:
        print(
            "--max-new-fixtures deve essere "
            "maggiore di zero."
        )
        return

    if arguments.request_delay < 0:
        print(
            "--request-delay non può essere "
            "negativo."
        )
        return

    try:
        (
            fixtures,
            remaining_requests,
        ) = fetch_finished_fixtures(
            league_id=arguments.league_id,
            season=arguments.season,
        )

        print(
            "Partite concluse trovate: "
            f"{len(fixtures)}"
        )

        print(
            "Richieste giornaliere rimanenti: "
            f"{remaining_requests}"
        )

        already_downloaded = [
            fixture
            for fixture in fixtures
            if is_valid_snapshot(
                snapshot_path(
                    season=arguments.season,
                    fixture_id=int(
                        fixture["fixture_id"]
                    ),
                )
            )
        ]

        missing_fixtures = [
            fixture
            for fixture in fixtures
            if not is_valid_snapshot(
                snapshot_path(
                    season=arguments.season,
                    fixture_id=int(
                        fixture["fixture_id"]
                    ),
                )
            )
        ]

        fixtures_to_download = (
            missing_fixtures[
                :arguments.max_new_fixtures
            ]
        )

        print(
            "Partite già scaricate: "
            f"{len(already_downloaded)}"
        )

        print(
            "Partite mancanti: "
            f"{len(missing_fixtures)}"
        )

        print(
            "Partite da scaricare "
            "in questa esecuzione: "
            f"{len(fixtures_to_download)}"
        )

        downloaded_now = 0
        empty_responses = 0

        for index, fixture in enumerate(
            fixtures_to_download,
            start=1,
        ):
            time.sleep(
                arguments.request_delay
            )

            fixture_id = int(
                fixture["fixture_id"]
            )

            print(
                "\n"
                f"[{index}/"
                f"{len(fixtures_to_download)}] "
                f"{fixture['home_team']} - "
                f"{fixture['away_team']} "
                f"(fixture {fixture_id})"
            )

            try:
                (
                    api_response,
                    remaining_requests,
                ) = fetch_fixture_players(
                    fixture_id=fixture_id,
                )

            except RuntimeError as error:
                print(
                    "Download interrotto "
                    "senza perdere i dati "
                    "già salvati."
                )

                print(
                    f"Motivo: {error}"
                )

                break

            response_items = api_response.get(
                "response",
                [],
            )

            player_records = (
                count_player_records(
                    response_items
                )
            )

            print(
                "Record giocatore: "
                f"{player_records}"
            )

            print(
                "Richieste giornaliere "
                "rimanenti: "
                f"{remaining_requests}"
            )

            if player_records == 0:
                print(
                    "Risposta vuota: "
                    "la partita verrà riprovata "
                    "in una futura esecuzione."
                )

                empty_responses += 1
                continue

            output_path = (
                save_fixture_snapshot(
                    season=arguments.season,
                    league_id=arguments.league_id,
                    fixture=fixture,
                    api_response=api_response,
                )
            )

            downloaded_now += 1

            print(
                "Snapshot salvato: "
                f"{output_path.name}"
            )

        manifest_path = write_manifest(
            fixtures=fixtures,
            season=arguments.season,
        )

        total_downloaded = sum(
            1
            for fixture in fixtures
            if is_valid_snapshot(
                snapshot_path(
                    season=arguments.season,
                    fixture_id=int(
                        fixture["fixture_id"]
                    ),
                )
            )
        )

        print(
            "\n"
            "================================"
        )

        print(
            "DOWNLOAD TERMINATO"
        )

        print(
            "Nuove partite scaricate: "
            f"{downloaded_now}"
        )

        print(
            "Risposte vuote: "
            f"{empty_responses}"
        )

        print(
            "Partite totali disponibili: "
            f"{len(fixtures)}"
        )

        print(
            "Partite complessivamente salvate: "
            f"{total_downloaded}"
        )

        print(
            "Partite ancora mancanti: "
            f"{len(fixtures) - total_downloaded}"
        )

        print(
            "Manifest aggiornato: "
            f"{manifest_path}"
        )

    except (
        RuntimeError,
        ValueError,
        TypeError,
        OSError,
    ) as error:
        print(
            "\nErrore durante il download:\n"
            f"{error}"
        )


if __name__ == "__main__":
    main()