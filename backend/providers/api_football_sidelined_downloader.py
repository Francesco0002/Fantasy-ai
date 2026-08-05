"""
Scarica progressivamente lo storico delle assenze
dei giocatori tramite l'endpoint /sidelined
di API-Football.

Ogni giocatore viene salvato in un JSON separato.

Questo permette di:

- interrompere e riprendere il download;
- evitare di consumare nuovamente richieste;
- conservare il dato grezzo prima di calcolare
  il rischio infortunio.

Output:

data/raw/api_football/sidelined_players/<player_id>.json
"""

import argparse
import json
import math
import time

from datetime import (
    datetime,
    timezone,
)
from pathlib import Path
from typing import Any, Iterator

import pandas as pd

from backend.providers.api_football import (
    api_get,
    safe_int,
)


PROJECT_ROOT = (
    Path(__file__)
    .resolve()
    .parents[2]
)

DEFAULT_INPUT_PATH = (
    PROJECT_ROOT
    / "data"
    / "players.csv"
)

DEFAULT_OUTPUT_DIRECTORY = (
    PROJECT_ROOT
    / "data"
    / "raw"
    / "api_football"
    / "sidelined_players"
)

DEFAULT_BATCH_SIZE = 20
DEFAULT_MAX_NEW_PLAYERS = 600
DEFAULT_REQUEST_DELAY = 6.5


def parse_arguments() -> argparse.Namespace:
    """
    Legge i parametri passati dal terminale.
    """

    parser = argparse.ArgumentParser(
        description=(
            "Scarica progressivamente lo storico "
            "delle assenze dei giocatori."
        )
    )

    parser.add_argument(
        "--input-path",
        type=Path,
        default=DEFAULT_INPUT_PATH,
        help=(
            "CSV contenente player_id e name. "
            "Predefinito: data/players.csv"
        ),
    )

    parser.add_argument(
        "--output-directory",
        type=Path,
        default=DEFAULT_OUTPUT_DIRECTORY,
        help=(
            "Cartella in cui salvare un JSON "
            "per ogni giocatore."
        ),
    )

    parser.add_argument(
        "--batch-size",
        type=int,
        default=DEFAULT_BATCH_SIZE,
        help=(
            "Numero di giocatori richiesti "
            "contemporaneamente."
        ),
    )

    parser.add_argument(
        "--max-new-players",
        type=int,
        default=DEFAULT_MAX_NEW_PLAYERS,
        help=(
            "Numero massimo di nuovi giocatori "
            "da scaricare nell'esecuzione."
        ),
    )

    parser.add_argument(
        "--request-delay",
        type=float,
        default=DEFAULT_REQUEST_DELAY,
        help=(
            "Secondi di attesa tra due richieste."
        ),
    )

    parser.add_argument(
        "--player-ids",
        type=int,
        nargs="+",
        default=None,
        help=(
            "Scarica soltanto gli ID indicati. "
            "Utile per effettuare test."
        ),
    )

    parser.add_argument(
        "--force",
        action="store_true",
        help=(
            "Riscarica anche i giocatori "
            "che possiedono già un JSON."
        ),
    )

    return parser.parse_args()


def load_players(
    input_path: Path,
) -> pd.DataFrame:
    """
    Carica gli identificativi dei giocatori.
    """

    if not input_path.exists():
        raise FileNotFoundError(
            f"File giocatori non trovato: "
            f"{input_path}"
        )

    players = pd.read_csv(
        input_path,
        encoding="utf-8-sig",
    )

    required_columns = [
        "player_id",
        "name",
    ]

    missing_columns = [
        column
        for column in required_columns
        if column not in players.columns
    ]

    if missing_columns:
        raise ValueError(
            "Colonne mancanti nel file giocatori: "
            + ", ".join(missing_columns)
        )

    players = players[
        required_columns
    ].copy()

    players["player_id"] = pd.to_numeric(
        players["player_id"],
        errors="coerce",
    )

    players = players.dropna(
        subset=["player_id"]
    )

    players["player_id"] = (
        players["player_id"]
        .astype(int)
    )

    players = players[
        players["player_id"] > 0
    ]

    players["name"] = (
        players["name"]
        .fillna("")
        .astype(str)
        .str.strip()
    )

    players = players.drop_duplicates(
        subset=["player_id"],
        keep="first",
    )

    return players.reset_index(
        drop=True
    )


def snapshot_path(
    output_directory: Path,
    player_id: int,
) -> Path:
    """
    Restituisce il percorso del JSON
    relativo al giocatore.
    """

    return (
        output_directory
        / f"{player_id}.json"
    )


def split_batches(
    players: pd.DataFrame,
    batch_size: int,
) -> Iterator[pd.DataFrame]:
    """
    Divide i giocatori in gruppi.
    """

    for start in range(
        0,
        len(players),
        batch_size,
    ):
        yield players.iloc[
            start:start + batch_size
        ]


def normalize_sidelined_events(
    value: Any,
) -> list[dict[str, Any]]:
    """
    Garantisce che gli eventi siano
    rappresentati da una lista valida.
    """

    if not isinstance(value, list):
        return []

    return [
        event
        for event in value
        if isinstance(event, dict)
    ]


def fetch_batch(
    player_ids: list[int],
) -> tuple[
    dict[int, list[dict[str, Any]]],
    str | None,
]:
    """
    Recupera le assenze per uno o più giocatori.
    """

    if len(player_ids) == 1:
        player_id = player_ids[0]

        data, remaining_requests = api_get(
            endpoint="sidelined",
            parameters={
                "player": player_id,
            },
        )

        return (
            {
                player_id:
                normalize_sidelined_events(
                    data.get(
                        "response",
                        [],
                    )
                )
            },
            remaining_requests,
        )

    data, remaining_requests = api_get(
        endpoint="sidelined",
        parameters={
            "players": "-".join(
                str(player_id)
                for player_id
                in player_ids
            ),
        },
    )

    events_by_player: dict[
        int,
        list[dict[str, Any]],
    ] = {}

    for item in data.get(
        "response",
        [],
    ):
        if not isinstance(item, dict):
            continue

        player_id = safe_int(
            item.get("id")
        )

        if player_id <= 0:
            continue

        events_by_player[player_id] = (
            normalize_sidelined_events(
                item.get(
                    "sidelined",
                    [],
                )
            )
        )

    return (
        events_by_player,
        remaining_requests,
    )


def save_player_snapshot(
    output_directory: Path,
    player_id: int,
    player_name: str,
    events: list[dict[str, Any]],
    response_missing: bool,
) -> Path:
    """
    Salva lo storico grezzo di un giocatore.
    """

    output_directory.mkdir(
        parents=True,
        exist_ok=True,
    )

    path = snapshot_path(
        output_directory,
        player_id,
    )

    payload = {
        "player_id": player_id,
        "name": player_name,
        "fetched_at": datetime.now(
            timezone.utc
        ).isoformat(),
        "source": "api_football_sidelined",
        "response_missing": response_missing,
        "sidelined": events,
    }

    path.write_text(
        json.dumps(
            payload,
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    return path


def main() -> None:
    """
    Esegue il download progressivo.
    """

    arguments = parse_arguments()

    if arguments.batch_size <= 0:
        raise ValueError(
            "--batch-size deve essere "
            "maggiore di zero."
        )

    if arguments.max_new_players <= 0:
        raise ValueError(
            "--max-new-players deve essere "
            "maggiore di zero."
        )

    players = load_players(
        arguments.input_path
    )

    if arguments.player_ids:
        requested_ids = set(
            arguments.player_ids
        )

        available_ids = set(
            players["player_id"]
            .astype(int)
            .tolist()
        )

        missing_ids = sorted(
            requested_ids
            - available_ids
        )

        if missing_ids:
            raise ValueError(
                "Player ID non presenti nel CSV: "
                + ", ".join(
                    str(player_id)
                    for player_id
                    in missing_ids
                )
            )

        players = players[
            players["player_id"]
            .isin(requested_ids)
        ]

    if not arguments.force:
        players = players[
            ~players["player_id"].apply(
                lambda player_id:
                snapshot_path(
                    arguments.output_directory,
                    int(player_id),
                ).exists()
            )
        ]

    players = (
        players
        .head(arguments.max_new_players)
        .reset_index(drop=True)
    )

    if players.empty:
        print(
            "Nessun nuovo giocatore "
            "da scaricare."
        )
        return

    total_players = len(players)

    total_batches = math.ceil(
        total_players
        / arguments.batch_size
    )

    print(
        f"Giocatori da scaricare: "
        f"{total_players}"
    )

    print(
        f"Dimensione gruppi: "
        f"{arguments.batch_size}"
    )

    print(
        f"Richieste previste: "
        f"{total_batches}"
    )

    saved_players = 0

    for batch_number, batch in enumerate(
        split_batches(
            players,
            arguments.batch_size,
        ),
        start=1,
    ):
        player_ids = (
            batch["player_id"]
            .astype(int)
            .tolist()
        )

        print(
            f"\nRichiesta "
            f"{batch_number}/{total_batches}"
        )

        print(
            "Player ID: "
            + "-".join(
                str(player_id)
                for player_id
                in player_ids
            )
        )

        (
            events_by_player,
            remaining_requests,
        ) = fetch_batch(
            player_ids
        )

        for player in batch.itertuples(
            index=False
        ):
            player_id = int(
                player.player_id
            )

            response_missing = (
                player_id
                not in events_by_player
            )

            events = events_by_player.get(
                player_id,
                [],
            )

            save_player_snapshot(
                output_directory=(
                    arguments
                    .output_directory
                ),
                player_id=player_id,
                player_name=str(
                    player.name
                ),
                events=events,
                response_missing=(
                    response_missing
                ),
            )

            saved_players += 1

            print(
                f"  {player_id} - "
                f"{player.name}: "
                f"{len(events)} eventi"
            )

        print(
            "Richieste residue: "
            f"{remaining_requests}"
        )

        if batch_number < total_batches:
            time.sleep(
                arguments.request_delay
            )

    print(
        "\nDownload completato."
    )

    print(
        f"Giocatori salvati: "
        f"{saved_players}"
    )

    print(
        "Cartella output: "
        f"{arguments.output_directory}"
    )


if __name__ == "__main__":
    main()
