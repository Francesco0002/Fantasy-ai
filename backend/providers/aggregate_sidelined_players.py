"""
Aggrega gli snapshot dell'endpoint /sidelined
di API-Football in un indice di rischio infortuni.

Non effettua richieste API.

Input:
data/raw/api_football/sidelined_players/*.json

Output:
data/processed/player_injury_risk.csv
"""

import argparse
import json
import math

from datetime import date
from pathlib import Path
from typing import Any

import pandas as pd


PROJECT_ROOT = (
    Path(__file__)
    .resolve()
    .parents[2]
)

DEFAULT_INPUT_DIRECTORY = (
    PROJECT_ROOT
    / "data"
    / "raw"
    / "api_football"
    / "sidelined_players"
)

DEFAULT_OUTPUT_PATH = (
    PROJECT_ROOT
    / "data"
    / "processed"
    / "player_injury_risk.csv"
)

DEFAULT_REFERENCE_DATE = date(
    2025,
    6,
    30,
)

EXPECTED_PLAYERS = 583

HISTORY_YEARS = 3

BASE_RISK = 0.20
MAX_RISK = 0.95
RISK_SCALE_DAYS = 180

RECURRENCE_DAYS = 7
MAX_EVENT_DURATION = 180


#
# Assenze che non devono essere considerate
# veri infortuni fisici.
#
EXCLUDED_KEYWORDS = [
    "suspend",
    "yellow card",
    "red card",
    "personal reason",
    "international duty",
    "inactive",
    "rest",
    "illness",
    "virus",
    "cold",
    "flu",
    "fever",
    "covid",
    "tonsillitis",
    "appendicitis",
    "medical condition",
    "heart condition",
]


def parse_arguments() -> argparse.Namespace:
    """
    Legge i parametri passati dal terminale.
    """

    parser = argparse.ArgumentParser(
        description=(
            "Calcola il rischio infortuni "
            "dagli snapshot API-Football."
        )
    )

    parser.add_argument(
        "--input-directory",
        type=Path,
        default=DEFAULT_INPUT_DIRECTORY,
        help=(
            "Cartella contenente i JSON "
            "dell'endpoint /sidelined."
        ),
    )

    parser.add_argument(
        "--output-path",
        type=Path,
        default=DEFAULT_OUTPUT_PATH,
        help=(
            "Percorso del CSV aggregato."
        ),
    )

    parser.add_argument(
        "--reference-date",
        type=date.fromisoformat,
        default=DEFAULT_REFERENCE_DATE,
        help=(
            "Data rispetto alla quale calcolare "
            "il rischio. Formato YYYY-MM-DD."
        ),
    )

    return parser.parse_args()


def parse_optional_date(
    value: Any,
) -> date | None:
    """
    Converte una data ISO quando disponibile.
    """

    if value in (
        None,
        "",
    ):
        return None

    try:
        return date.fromisoformat(
            str(value)
        )

    except ValueError:
        return None


def is_physical_injury(
    event_type: str,
) -> bool:
    """
    Distingue gli infortuni fisici
    dalle altre cause di indisponibilità.
    """

    normalized = (
        event_type
        .lower()
        .strip()
    )

    if normalized == "":
        return False

    return not any(
        keyword in normalized
        for keyword in EXCLUDED_KEYWORDS
    )


def event_type_weight(
    event_type: str,
) -> float:
    """
    Riduce il peso delle descrizioni
    generiche o poco precise.
    """

    normalized = (
        event_type
        .lower()
        .strip()
    )

    if normalized == "knock":
        return 0.50

    if normalized == "unknown":
        return 0.70

    if normalized == "injury":
        return 0.85

    return 1.0


def clamp_duration(
    duration: float,
) -> float:
    """
    Limita la durata utilizzata dalla formula.
    """

    return float(
        max(
            1,
            min(
                duration,
                MAX_EVENT_DURATION,
            ),
        )
    )


def load_snapshots(
    input_directory: Path,
) -> list[dict[str, Any]]:
    """
    Carica e valida tutti i JSON dei giocatori.
    """

    if not input_directory.exists():
        raise FileNotFoundError(
            "Cartella degli snapshot non trovata: "
            f"{input_directory}"
        )

    paths = sorted(
        input_directory.glob("*.json")
    )

    if not paths:
        raise ValueError(
            "Nessuno snapshot JSON trovato."
        )

    snapshots: list[
        dict[str, Any]
    ] = []

    player_ids: set[int] = set()

    for path in paths:
        try:
            payload = json.loads(
                path.read_text(
                    encoding="utf-8",
                )
            )

        except (
            OSError,
            json.JSONDecodeError,
        ) as error:
            raise ValueError(
                f"Snapshot non valido: {path}"
            ) from error

        player_id = int(
            payload.get(
                "player_id",
                0,
            )
        )

        if player_id <= 0:
            raise ValueError(
                "Player ID non valido nel file: "
                f"{path}"
            )

        if player_id in player_ids:
            raise ValueError(
                "Player ID duplicato: "
                f"{player_id}"
            )

        if payload.get(
            "response_missing",
            False,
        ):
            raise ValueError(
                "Risposta API ancora mancante per: "
                f"{player_id}"
            )

        player_ids.add(
            player_id
        )

        events = payload.get(
            "sidelined",
            [],
        )

        if not isinstance(
            events,
            list,
        ):
            raise ValueError(
                "Campo sidelined non valido per: "
                f"{player_id}"
            )

        snapshots.append(
            {
                "player_id": player_id,
                "name": str(
                    payload.get(
                        "name",
                        "",
                    )
                ).strip(),
                "events": [
                    event
                    for event in events
                    if isinstance(
                        event,
                        dict,
                    )
                ],
            }
        )

    if len(snapshots) != EXPECTED_PLAYERS:
        raise ValueError(
            "Numero di giocatori inatteso: "
            f"{len(snapshots)} invece di "
            f"{EXPECTED_PLAYERS}."
        )

    return snapshots


def collect_events(
    snapshots: list[dict[str, Any]],
) -> pd.DataFrame:
    """
    Converte gli eventi grezzi
    in una tabella normalizzata.
    """

    rows: list[
        dict[str, Any]
    ] = []

    for snapshot in snapshots:
        seen_events: set[
            tuple[str, date | None, date | None]
        ] = set()

        for event in snapshot["events"]:
            event_type = str(
                event.get(
                    "type",
                    "",
                )
            ).strip()

            start_date = parse_optional_date(
                event.get("start")
            )

            end_date = parse_optional_date(
                event.get("end")
            )

            if start_date is None:
                continue

            event_key = (
                event_type,
                start_date,
                end_date,
            )

            if event_key in seen_events:
                continue

            seen_events.add(
                event_key
            )

            rows.append(
                {
                    "player_id":
                        snapshot["player_id"],
                    "name":
                        snapshot["name"],
                    "type":
                        event_type,
                    "start":
                        start_date,
                    "end":
                        end_date,
                    "physical":
                        is_physical_injury(
                            event_type
                        ),
                }
            )

    return pd.DataFrame(
        rows,
        columns=[
            "player_id",
            "name",
            "type",
            "start",
            "end",
            "physical",
        ],
    )


def calculate_type_medians(
    events: pd.DataFrame,
    reference_date: date,
) -> tuple[
    dict[str, float],
    float,
]:
    """
    Calcola la durata tipica degli infortuni
    senza utilizzare eventi futuri.
    """

    closed_events = events[
        events["physical"]
        & events["end"].notna()
        & (
            events["end"]
            >= events["start"]
        )
        & (
            events["start"]
            <= reference_date
        )
        & (
            events["end"]
            <= reference_date
        )
    ].copy()

    if closed_events.empty:
        return (
            {},
            14.0,
        )

    closed_events["duration"] = (
        closed_events["end"]
        - closed_events["start"]
    ).apply(
        lambda difference:
        clamp_duration(
            difference.days + 1
        )
    )

    type_medians = (
        closed_events
        .groupby("type")["duration"]
        .median()
        .astype(float)
        .to_dict()
    )

    global_median = float(
        closed_events["duration"]
        .median()
    )

    return (
        type_medians,
        global_median,
    )


def calculate_player_burden(
    player_events: pd.DataFrame,
    reference_date: date,
    window_start: date,
    type_medians: dict[str, float],
    global_median: float,
) -> tuple[
    int,
    float,
]:
    """
    Calcola il carico storico ponderato
    degli infortuni di un giocatore.
    """

    usable_events = player_events[
        player_events["physical"]
        & (
            player_events["start"]
            >= window_start
        )
        & (
            player_events["start"]
            <= reference_date
        )
    ]

    total_burden = 0.0

    for event in usable_events.itertuples(
        index=False
    ):
        if (
            event.end is not None
            and event.end >= event.start
        ):
            effective_end = min(
                event.end,
                reference_date,
            )

            duration = (
                effective_end
                - event.start
            ).days + 1

        else:
            elapsed_days = (
                reference_date
                - event.start
            ).days + 1

            estimated_duration = (
                type_medians.get(
                    event.type,
                    global_median,
                )
            )

            #
            # Non utilizziamo giorni successivi
            # alla data di riferimento.
            #
            duration = min(
                elapsed_days,
                estimated_duration,
            )

        duration = clamp_duration(
            duration
        )

        days_ago = (
            reference_date
            - event.start
        ).days

        #
        # Il peso si dimezza ogni anno.
        #
        recency_weight = (
            0.5
            ** (
                days_ago / 365
            )
        )

        type_weight = event_type_weight(
            event.type
        )

        total_burden += (
            (
                duration
                + RECURRENCE_DAYS
            )
            * recency_weight
            * type_weight
        )

    return (
        len(usable_events),
        float(total_burden),
    )


def burden_to_risk(
    burden: float,
) -> float:
    """
    Converte il carico storico
    in un indice compreso tra 0 e 1.
    """

    risk = (
        BASE_RISK
        + (
            MAX_RISK
            - BASE_RISK
        )
        * (
            1
            - math.exp(
                -burden
                / RISK_SCALE_DAYS
            )
        )
    )

    return float(
        min(
            max(
                risk,
                BASE_RISK,
            ),
            MAX_RISK,
        )
    )


def aggregate_players(
    snapshots: list[dict[str, Any]],
    events: pd.DataFrame,
    reference_date: date,
) -> pd.DataFrame:
    """
    Genera una riga aggregata
    per ogni giocatore.
    """

    window_start = date(
        reference_date.year
        - HISTORY_YEARS,
        reference_date.month,
        reference_date.day,
    )

    (
        type_medians,
        global_median,
    ) = calculate_type_medians(
        events,
        reference_date,
    )

    rows: list[
        dict[str, Any]
    ] = []

    for snapshot in snapshots:
        player_id = int(
            snapshot["player_id"]
        )

        player_events = events[
            events["player_id"]
            == player_id
        ]

        history_available = (
            len(snapshot["events"]) > 0
        )

        (
            injury_events,
            injury_burden,
        ) = calculate_player_burden(
            player_events,
            reference_date,
            window_start,
            type_medians,
            global_median,
        )

        injury_risk = (
            burden_to_risk(
                injury_burden
            )
            if history_available
            else math.nan
        )

        rows.append(
            {
                "player_id":
                    player_id,
                "name":
                    snapshot["name"],
                "injury_history_available":
                    history_available,
                "injury_events_total":
                    len(snapshot["events"]),
                "injury_events_3y":
                    injury_events,
                "injury_burden_3y":
                    round(
                        injury_burden,
                        3,
                    ),
                "injury_risk":
                    (
                        round(
                            injury_risk,
                            3,
                        )
                        if history_available
                        else math.nan
                    ),
                "injury_reference_date":
                    reference_date.isoformat(),
                "injury_source":
                    "api_football_sidelined",
            }
        )

    result = pd.DataFrame(
        rows
    )

    return (
        result
        .sort_values("player_id")
        .reset_index(drop=True)
    )


def validate_result(
    result: pd.DataFrame,
) -> None:
    """
    Verifica la coerenza del CSV prodotto.
    """

    if len(result) != EXPECTED_PLAYERS:
        raise ValueError(
            "Numero di righe aggregato inatteso."
        )

    if result["player_id"].duplicated().any():
        raise ValueError(
            "Sono presenti player ID duplicati."
        )

    available = (
        result[
            "injury_history_available"
        ]
    )

    if result.loc[
        available,
        "injury_risk",
    ].isna().any():
        raise ValueError(
            "Rischio mancante nonostante "
            "lo storico disponibile."
        )

    if result.loc[
        ~available,
        "injury_risk",
    ].notna().any():
        raise ValueError(
            "Rischio valorizzato senza "
            "uno storico disponibile."
        )

    real_risks = result.loc[
        available,
        "injury_risk",
    ]

    if (
        (real_risks < BASE_RISK)
        | (real_risks > MAX_RISK)
    ).any():
        raise ValueError(
            "Rischio fuori intervallo."
        )


def main() -> None:
    """
    Esegue l'aggregazione completa.
    """

    arguments = parse_arguments()

    snapshots = load_snapshots(
        arguments.input_directory
    )

    events = collect_events(
        snapshots
    )

    result = aggregate_players(
        snapshots,
        events,
        arguments.reference_date,
    )

    validate_result(
        result
    )

    arguments.output_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    result.to_csv(
        arguments.output_path,
        index=False,
        encoding="utf-8-sig",
    )

    available = result[
        "injury_history_available"
    ]

    print(
        "Aggregazione completata correttamente."
    )

    print(
        "Giocatori elaborati:",
        len(result),
    )

    print(
        "Storico disponibile:",
        int(available.sum()),
    )

    print(
        "Storico non disponibile:",
        int((~available).sum()),
    )

    print(
        "File creato:",
        arguments.output_path,
    )

    print(
        "\nDISTRIBUZIONE DEL RISCHIO"
    )

    print(
        result.loc[
            available,
            "injury_risk",
        ]
        .describe(
            percentiles=[
                0.25,
                0.50,
                0.75,
                0.90,
                0.95,
            ]
        )
        .round(3)
        .to_string()
    )

    print(
        "\nTOP 20 RISCHIO INFORTUNI"
    )

    print(
        result.loc[
            available,
            [
                "name",
                "injury_events_3y",
                "injury_burden_3y",
                "injury_risk",
            ],
        ]
        .sort_values(
            [
                "injury_risk",
                "injury_events_3y",
            ],
            ascending=False,
        )
        .head(20)
        .to_string(index=False)
    )


if __name__ == "__main__":
    main()
