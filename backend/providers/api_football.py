"""
Download dei giocatori e delle statistiche
stagionali da API-Football.

Il risultato viene salvato nella cartella:

data/raw/

Il file generato potrà poi essere elaborato
tramite backend/import_players.py.
"""

import argparse
import json
import os
import time

from datetime import (
    datetime,
    timezone,
)

from pathlib import Path
from typing import Any
from urllib.error import (
    HTTPError,
    URLError,
)
from urllib.parse import urlencode
from urllib.request import (
    Request,
    urlopen,
)

import pandas as pd

from dotenv import load_dotenv


# Cartella principale fantasy-ai.
PROJECT_ROOT = (
    Path(__file__)
    .resolve()
    .parents[2]
)


# Caricamento delle variabili locali.
load_dotenv(
    PROJECT_ROOT / ".env"
)


# Configurazione API.
API_KEY = os.getenv(
    "API_FOOTBALL_KEY",
    "",
).strip()

API_BASE_URL = os.getenv(
    "API_FOOTBALL_BASE_URL",
    "https://v3.football.api-sports.io",
).strip().rstrip("/")

DEFAULT_SEASON = int(
    os.getenv(
        "API_FOOTBALL_SEASON",
        "2025",
    )
)


# Limite di paginazione imposto
# dal piano gratuito.
FREE_PLAN_MAX_PAGE = 3

# Il piano gratuito permette
# 10 richieste al minuto.
REQUEST_DELAY_SECONDS = 6.5


# Ruoli restituiti da API-Football
# convertiti nel formato Fantasy AI.
POSITION_TO_ROLE = {
    "GOALKEEPER": "P",
    "DEFENDER": "D",
    "MIDFIELDER": "C",
    "ATTACKER": "A",
}


# Colonne del CSV grezzo.
OUTPUT_COLUMNS = [
    "player_id",
    "name",
    "team",
    "role",
    "age",

    "appearances_last_season",
    "starts_last_season",
    "minutes_last_season",

    "goals_last_season",
    "assists_last_season",
    "clean_sheets_last_season",
    "goals_conceded_last_season",
    "saves_last_season",
    "penalties_scored_last_season",

    "average_rating_last_season",
    "fantasy_average_last_season",

    "yellow_cards_last_season",
    "red_cards_last_season",

    "data_source",
    "notes",
]


def safe_int(
    value: Any,
) -> int:
    """
    Converte un valore in intero.

    I valori nulli o non validi
    vengono convertiti in zero.
    """

    if value is None:
        return 0

    try:
        return int(
            float(value)
        )

    except (
        TypeError,
        ValueError,
    ):
        return 0


def safe_float(
    value: Any,
) -> float:
    """
    Converte un valore in numero decimale.

    I valori nulli o non validi
    vengono convertiti in zero.
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


def api_get(
    endpoint: str,
    parameters: dict[str, Any],
) -> tuple[dict[str, Any], str | None]:
    """
    Esegue una richiesta GET verso API-Football.

    Restituisce:
    - il JSON della risposta;
    - il numero di richieste giornaliere rimaste,
      quando presente negli header.
    """

    if API_KEY == "":
        raise RuntimeError(
            "API_FOOTBALL_KEY non è configurata "
            "nel file .env."
        )

    query_string = urlencode(
        parameters
    )

    url = (
        f"{API_BASE_URL}/{endpoint}"
        f"?{query_string}"
    )

    request = Request(
        url=url,
        method="GET",
        headers={
            "x-apisports-key":
                API_KEY,

            "Accept":
                "application/json",

            "User-Agent":
                "Fantasy-AI/1.0",
        },
    )

    try:
        with urlopen(
            request,
            timeout=40,
        ) as response:
            response_body = (
                response
                .read()
                .decode("utf-8")
            )

            remaining_requests = (
                response.headers.get(
                    "x-ratelimit-requests-remaining"
                )
            )

    except HTTPError as error:
        error_body = (
            error
            .read()
            .decode(
                "utf-8",
                errors="replace",
            )
        )

        raise RuntimeError(
            "API-Football ha restituito "
            f"l'errore HTTP {error.code}: "
            f"{error_body}"
        ) from error

    except URLError as error:
        raise RuntimeError(
            "Impossibile raggiungere "
            "API-Football: "
            f"{error.reason}"
        ) from error


    try:
        data: dict[str, Any] = (
            json.loads(
                response_body
            )
        )

    except json.JSONDecodeError as error:
        raise RuntimeError(
            "API-Football ha restituito "
            "una risposta JSON non valida."
        ) from error


    api_errors = data.get(
        "errors"
    )

    if api_errors:
        raise RuntimeError(
            "Errore restituito da "
            "API-Football: "
            + json.dumps(
                api_errors,
                ensure_ascii=False,
            )
        )


    if not isinstance(
        data.get("response"),
        list,
    ):
        raise RuntimeError(
            "La risposta API non contiene "
            "un elenco valido nel campo "
            "'response'."
        )


    return (
        data,
        remaining_requests,
    )


def find_serie_a_league_id(
    season: int,
) -> int:
    """
    Cerca dinamicamente l'identificativo
    della Serie A italiana.
    """

    data, remaining_requests = api_get(
        endpoint="leagues",
        parameters={
            "country": "Italy",
            "season": season,
        },
    )


    candidates: list[int] = []

    for item in data["response"]:
        league = item.get(
            "league",
            {},
        )

        country = item.get(
            "country",
            {},
        )

        league_name = str(
            league.get(
                "name",
                "",
            )
        ).strip()

        country_name = str(
            country.get(
                "name",
                "",
            )
        ).strip()

        league_type = str(
            league.get(
                "type",
                "",
            )
        ).strip()


        if (
            league_name.casefold()
            == "serie a"
            and country_name.casefold()
            == "italy"
            and league_type.casefold()
            == "league"
        ):
            league_id = safe_int(
                league.get("id")
            )

            if league_id > 0:
                candidates.append(
                    league_id
                )


    if len(candidates) == 0:
        raise RuntimeError(
            "Serie A italiana non trovata "
            f"per la stagione {season}."
        )


    league_id = candidates[0]

    print(
        "Serie A individuata:"
        f" league_id={league_id}"
    )

    if remaining_requests is not None:
        print(
            "Richieste giornaliere "
            "rimanenti: "
            f"{remaining_requests}"
        )


    return league_id


def get_matching_statistics(
    player_item: dict[str, Any],
    league_id: int,
    season: int,
) -> list[dict[str, Any]]:
    """
    Seleziona solamente i blocchi statistici
    relativi alla Serie A e alla stagione scelta.
    """

    statistics = player_item.get(
        "statistics",
        [],
    )

    if not isinstance(
        statistics,
        list,
    ):
        return []


    matching_statistics = []

    for statistic in statistics:
        league = statistic.get(
            "league",
            {},
        )

        current_league_id = safe_int(
            league.get("id")
        )

        current_season = safe_int(
            league.get("season")
        )

        if (
            current_league_id
            == league_id
            and current_season
            == season
        ):
            matching_statistics.append(
                statistic
            )


    return matching_statistics


def calculate_average_rating(
    statistics: list[dict[str, Any]],
) -> float:
    """
    Calcola una media voto pesata
    utilizzando i minuti disputati.
    """

    weighted_total = 0.0
    total_weight = 0


    for statistic in statistics:
        games = statistic.get(
            "games",
            {},
        )

        rating = safe_float(
            games.get("rating")
        )

        if rating <= 0:
            continue

        minutes = safe_int(
            games.get("minutes")
        )

        appearances = safe_int(
            games.get("appearences")
        )

        weight = max(
            minutes,
            appearances,
            1,
        )

        weighted_total += (
            rating * weight
        )

        total_weight += weight


    if total_weight == 0:
        return 0.0


    return round(
        weighted_total
        / total_weight,
        2,
    )


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
    Calcola una prima stima della fantamedia.

    Formula provvisoria:
    - voto medio;
    - +3 per ogni gol;
    - +1 per ogni assist;
    - -0,5 per ogni giallo;
    - -1 per ogni rosso;
    - per i portieri:
      -1 per gol subito,
      +3 per rigore parato.
    """

    if appearances <= 0:
        return 0.0


    total_points = (
        average_rating
        * appearances
    )

    total_points += (
        goals * 3
    )

    total_points += assists

    total_points -= (
        yellow_cards * 0.5
    )

    total_points -= red_cards


    if role == "P":
        total_points -= (
            goals_conceded
        )

        total_points += (
            penalties_saved * 3
        )


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


def build_player_row(
    player_item: dict[str, Any],
    league_id: int,
    season: int,
) -> dict[str, Any] | None:
    """
    Converte un giocatore API-Football
    nel formato richiesto dall'importatore.
    """

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

    player_age = safe_int(
        player.get("age")
    )


    if (
        player_id <= 0
        or player_name == ""
        or player_age < 15
        or player_age > 50
    ):
        return None


    statistics = get_matching_statistics(
        player_item,
        league_id,
        season,
    )


    if len(statistics) == 0:
        return None


    # Il blocco con più minuti viene usato
    # per determinare squadra e ruolo.
    primary_statistic = max(
        statistics,
        key=lambda statistic: safe_int(
            statistic
            .get(
                "games",
                {},
            )
            .get("minutes")
        ),
    )


    games = primary_statistic.get(
        "games",
        {},
    )

    team = primary_statistic.get(
        "team",
        {},
    )


    team_name = str(
        team.get(
            "name",
            "",
        )
    ).strip()

    position = str(
        games.get(
            "position",
            "",
        )
    ).strip().upper()

    role = POSITION_TO_ROLE.get(
        position
    )


    if (
        team_name == ""
        or role is None
    ):
        return None


    appearances = sum(
        safe_int(
            statistic
            .get(
                "games",
                {},
            )
            .get("appearences")
        )
        for statistic in statistics
    )

    starts = sum(
        safe_int(
            statistic
            .get(
                "games",
                {},
            )
            .get("lineups")
        )
        for statistic in statistics
    )

    minutes = sum(
        safe_int(
            statistic
            .get(
                "games",
                {},
            )
            .get("minutes")
        )
        for statistic in statistics
    )

    goals = sum(
        safe_int(
            statistic
            .get(
                "goals",
                {},
            )
            .get("total")
        )
        for statistic in statistics
    )

    assists = sum(
        safe_int(
            statistic
            .get(
                "goals",
                {},
            )
            .get("assists")
        )
        for statistic in statistics
    )

    goals_conceded = sum(
        safe_int(
            statistic
            .get(
                "goals",
                {},
            )
            .get("conceded")
        )
        for statistic in statistics
    )

    saves = sum(
        safe_int(
            statistic
            .get(
                "goals",
                {},
            )
            .get("saves")
        )
        for statistic in statistics
    )

    penalties_scored = sum(
        safe_int(
            statistic
            .get(
                "penalty",
                {},
            )
            .get("scored")
        )
        for statistic in statistics
    )

    penalties_saved = sum(
        safe_int(
            statistic
            .get(
                "penalty",
                {},
            )
            .get("saved")
        )
        for statistic in statistics
    )

    yellow_cards = sum(
        safe_int(
            statistic
            .get(
                "cards",
                {},
            )
            .get("yellow")
        )
        for statistic in statistics
    )

    red_cards = sum(
        safe_int(
            statistic
            .get(
                "cards",
                {},
            )
            .get("red")
        )
        +
        safe_int(
            statistic
            .get(
                "cards",
                {},
            )
            .get("yellowred")
        )
        for statistic in statistics
    )


    average_rating = (
        calculate_average_rating(
            statistics
        )
    )


    fantasy_average = (
        calculate_fantasy_average(
            role=role,
            appearances=appearances,
            average_rating=average_rating,
            goals=goals,
            assists=assists,
            goals_conceded=goals_conceded,
            penalties_saved=penalties_saved,
            yellow_cards=yellow_cards,
            red_cards=red_cards,
        )
    )


    return {
        "player_id":
            player_id,

        "name":
            player_name,

        "team":
            team_name,

        "role":
            role,

        "age":
            player_age,

        "appearances_last_season":
            appearances,

        "starts_last_season":
            starts,

        "minutes_last_season":
            minutes,

        "goals_last_season":
            goals,

        "assists_last_season":
            assists,

        # Non disponibile direttamente
        # nell'endpoint /players.
        "clean_sheets_last_season":
            0,

        "goals_conceded_last_season":
            goals_conceded,

        "saves_last_season":
            saves,

        "penalties_scored_last_season":
            penalties_scored,

        "average_rating_last_season":
            average_rating,

        "fantasy_average_last_season":
            fantasy_average,

        "yellow_cards_last_season":
            yellow_cards,

        "red_cards_last_season":
            red_cards,

        "data_source":
            f"api_football_{season}",

        "notes": (
            "Fantamedia stimata da Fantasy AI; "
            "clean sheet individuali non ancora "
            "importati."
        ),
    }


def fetch_serie_a_teams(
    league_id: int,
    season: int,
) -> list[dict[str, Any]]:
    """
    Recupera tutte le squadre della competizione.

    L'endpoint /teams non richiede paginazione
    per una normale competizione di Serie A.
    """

    data, remaining_requests = api_get(
        endpoint="teams",
        parameters={
            "league": league_id,
            "season": season,
        },
    )

    teams: list[dict[str, Any]] = []

    for item in data["response"]:
        team = item.get(
            "team",
            {},
        )

        team_id = safe_int(
            team.get("id")
        )

        team_name = str(
            team.get(
                "name",
                "",
            )
        ).strip()

        if (
            team_id > 0
            and team_name != ""
        ):
            teams.append(
                {
                    "id": team_id,
                    "name": team_name,
                }
            )

    if len(teams) == 0:
        raise RuntimeError(
            "Nessuna squadra trovata "
            f"per league_id={league_id} "
            f"e season={season}."
        )

    teams = sorted(
        teams,
        key=lambda team: team["name"],
    )

    print(
        f"Squadre trovate: {len(teams)}"
    )

    if remaining_requests is not None:
        print(
            "Richieste giornaliere "
            "rimanenti: "
            f"{remaining_requests}"
        )

    return teams


def fetch_players_for_team(
    team_id: int,
    team_name: str,
    league_id: int,
    season: int,
    max_pages: int | None,
) -> list[dict[str, Any]]:
    """
    Recupera i giocatori di una singola squadra.

    Dividendo la competizione per squadra,
    evitiamo il limite che impedisce al piano
    gratuito di superare page=3.
    """

    team_items: list[
        dict[str, Any]
    ] = []

    page = 1
    total_pages = 1

    while page <= total_pages:
        data, remaining_requests = api_get(
            endpoint="players",
            parameters={
                "league": league_id,
                "team": team_id,
                "season": season,
                "page": page,
            },
        )

        response_items = data[
            "response"
        ]

        team_items.extend(
            response_items
        )

        paging = data.get(
            "paging",
            {},
        )

        total_pages = max(
            safe_int(
                paging.get("total")
            ),
            1,
        )

        print(
            f"{team_name} - "
            f"pagina {page}/{total_pages}: "
            f"{len(response_items)} giocatori"
        )

        if remaining_requests is not None:
            print(
                "Richieste giornaliere "
                "rimanenti: "
                f"{remaining_requests}"
            )

        # Durante un test parziale possiamo
        # fermarci prima.
        effective_total_pages = total_pages

        if max_pages is not None:
            effective_total_pages = min(
                effective_total_pages,
                max_pages,
            )

        # Sul piano gratuito non possiamo
        # richiedere pagine superiori a 3.
        effective_total_pages = min(
            effective_total_pages,
            FREE_PLAN_MAX_PAGE,
        )

        if page >= effective_total_pages:
            break

        page += 1

        time.sleep(
            REQUEST_DELAY_SECONDS
        )

    # Durante il download completo non vogliamo
    # accettare silenziosamente una rosa incompleta.
    if (
        max_pages is None
        and total_pages
        > FREE_PLAN_MAX_PAGE
    ):
        raise RuntimeError(
            f"La squadra '{team_name}' richiede "
            f"{total_pages} pagine, ma il piano "
            "gratuito permette al massimo "
            f"{FREE_PLAN_MAX_PAGE} pagine."
        )

    return team_items


def player_profiles_directory(
    season: int,
) -> Path:
    """
    Restituisce la cartella degli snapshot
    dei profili, divisi per squadra.
    """

    return (
        PROJECT_ROOT
        / "data"
        / "raw"
        / "api_football"
        / f"season_{season}"
        / "player_profiles"
    )


def team_profile_snapshot_path(
    season: int,
    team_id: int,
) -> Path:
    """
    Restituisce il percorso dello snapshot
    relativo a una squadra.
    """

    return (
        player_profiles_directory(season)
        / f"team_{team_id}.json"
    )


def save_json_atomically(
    path: Path,
    payload: dict[str, Any],
) -> None:
    """
    Salva un JSON tramite file temporaneo.

    Evita di lasciare un file incompleto
    in caso di interruzione durante la scrittura.
    """

    path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    temporary_path = path.with_suffix(
        ".json.tmp"
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

    temporary_path.replace(path)


def load_valid_team_snapshot(
    path: Path,
    league_id: int,
    season: int,
    team_id: int,
) -> list[dict[str, Any]] | None:
    """
    Carica uno snapshot già presente.

    Restituisce None quando il file manca,
    è corrotto o appartiene a un'altra ricerca.
    """

    if not path.exists():
        return None

    try:
        with path.open(
            "r",
            encoding="utf-8",
        ) as file:
            payload = json.load(file)

    except (
        OSError,
        json.JSONDecodeError,
    ):
        return None

    if not isinstance(payload, dict):
        return None

    if safe_int(
        payload.get("league_id")
    ) != league_id:
        return None

    if safe_int(
        payload.get("season")
    ) != season:
        return None

    team = payload.get(
        "team",
        {},
    )

    if safe_int(
        team.get("id")
    ) != team_id:
        return None

    players = payload.get(
        "players"
    )

    if (
        not isinstance(players, list)
        or len(players) == 0
    ):
        return None

    return players


def save_team_profile_snapshot(
    league_id: int,
    season: int,
    team_id: int,
    team_name: str,
    players: list[dict[str, Any]],
) -> None:
    """
    Salva tutti i profili recuperati
    per una singola squadra.
    """

    path = team_profile_snapshot_path(
        season=season,
        team_id=team_id,
    )

    payload = {
        "source": "api_football",
        "downloaded_at": (
            datetime.now(timezone.utc)
            .isoformat()
        ),
        "league_id": league_id,
        "season": season,
        "team": {
            "id": team_id,
            "name": team_name,
        },
        "players": players,
    }

    save_json_atomically(
        path=path,
        payload=payload,
    )


def fetch_all_players(
    league_id: int,
    season: int,
    max_pages: int | None,
    max_teams: int | None,
) -> list[dict[str, Any]]:
    """
    Recupera tutti i giocatori della competizione
    interrogando una squadra alla volta.

    Durante un download completo, ogni squadra
    viene salvata immediatamente in uno snapshot.

    Alla successiva esecuzione gli snapshot validi
    vengono riutilizzati senza nuove richieste.
    """

    teams = fetch_serie_a_teams(
        league_id=league_id,
        season=season,
    )

    if max_teams is not None:
        teams = teams[
            :max_teams
        ]

    all_items: list[
        dict[str, Any]
    ] = []

    #
    # Gli snapshot vengono utilizzati soltanto
    # quando scarichiamo tutte le pagine.
    #
    # Un test con --max-pages non deve essere
    # considerato una rosa completa.
    #
    use_snapshots = (
        max_pages is None
    )

    time.sleep(
        REQUEST_DELAY_SECONDS
    )

    for team_index, team in enumerate(
        teams,
        start=1,
    ):
        team_id = int(
            team["id"]
        )

        team_name = str(
            team["name"]
        )

        print(
            "\n"
            f"SQUADRA {team_index}/"
            f"{len(teams)}: "
            f"{team_name}"
        )

        team_items: (
            list[dict[str, Any]]
            | None
        ) = None

        if use_snapshots:
            snapshot_path = (
                team_profile_snapshot_path(
                    season=season,
                    team_id=team_id,
                )
            )

            team_items = (
                load_valid_team_snapshot(
                    path=snapshot_path,
                    league_id=league_id,
                    season=season,
                    team_id=team_id,
                )
            )

            if team_items is not None:
                print(
                    "Snapshot già presente: "
                    f"{len(team_items)} giocatori. "
                    "Nessuna richiesta effettuata."
                )

        if team_items is None:
            team_items = fetch_players_for_team(
                team_id=team_id,
                team_name=team_name,
                league_id=league_id,
                season=season,
                max_pages=max_pages,
            )

            if (
                use_snapshots
                and len(team_items) > 0
            ):
                save_team_profile_snapshot(
                    league_id=league_id,
                    season=season,
                    team_id=team_id,
                    team_name=team_name,
                    players=team_items,
                )

                print(
                    "Snapshot squadra salvato."
                )

        all_items.extend(
            team_items
        )

        if team_index < len(teams):
            time.sleep(
                REQUEST_DELAY_SECONDS
            )

    return all_items


def convert_players(
    api_players: list[dict[str, Any]],
    league_id: int,
    season: int,
) -> pd.DataFrame:
    """
    Converte e ordina i giocatori scaricati.
    """

    rows_by_player_id: dict[
        int,
        dict[str, Any],
    ] = {}


    for player_item in api_players:
        row = build_player_row(
            player_item,
            league_id,
            season,
        )

        if row is None:
            continue


        player_id = int(
            row["player_id"]
        )

        existing_row = (
            rows_by_player_id.get(
                player_id
            )
        )


        if (
            existing_row is None
            or int(
                row[
                    "minutes_last_season"
                ]
            )
            >
            int(
                existing_row[
                    "minutes_last_season"
                ]
            )
        ):
            rows_by_player_id[
                player_id
            ] = row


    if len(rows_by_player_id) == 0:
        raise RuntimeError(
            "Nessun giocatore valido "
            "è stato convertito."
        )


    players = pd.DataFrame(
        rows_by_player_id.values()
    )


    role_order = {
        "P": 0,
        "D": 1,
        "C": 2,
        "A": 3,
    }


    players["_role_order"] = (
        players["role"]
        .map(role_order)
    )


    players = (
        players
        .sort_values(
            by=[
                "_role_order",
                "team",
                "name",
            ],
        )
        .drop(
            columns=[
                "_role_order",
            ]
        )
        .reset_index(
            drop=True
        )
    )


    return players[
        OUTPUT_COLUMNS
    ]


def parse_arguments(
) -> argparse.Namespace:
    """
    Legge gli argomenti del terminale.
    """

    parser = argparse.ArgumentParser(
        description=(
            "Scarica i giocatori reali "
            "della Serie A da API-Football."
        )
    )


    parser.add_argument(
        "--season",
        type=int,
        default=DEFAULT_SEASON,
        help=(
            "Anno iniziale della stagione. "
            "Esempio: 2025 = 2025/2026."
        ),
    )


    parser.add_argument(
        "--league-id",
        type=int,
        default=None,
        help=(
            "ID della Serie A. "
            "Se omesso viene cercato "
            "automaticamente."
        ),
    )


    parser.add_argument(
        "--max-pages",
        type=int,
        default=None,
        help=(
            "Numero massimo di pagine "
            "da scaricare. Utile per i test."
        ),
    )
    
    
    parser.add_argument(
        "--max-teams",
        type=int,
        default=None,
        help=(
            "Numero massimo di squadre "
            "da scaricare. Utile per i test."
        ),
    )


    return parser.parse_args()


def main() -> None:
    """
    Esegue il download e salva il CSV grezzo.
    """

    arguments = parse_arguments()


    if (
        arguments.max_pages is not None
        and arguments.max_pages <= 0
    ):
        print(
            "--max-pages deve essere "
            "maggiore di zero."
        )

        return

    if (
        arguments.max_teams is not None
        and arguments.max_teams <= 0
    ):
        print(
            "--max-teams deve essere "
            "maggiore di zero."
        )

        return


    try:
        league_id = (
            arguments.league_id
            if arguments.league_id
            is not None
            else find_serie_a_league_id(
                arguments.season
            )
        )


        api_players = fetch_all_players(
            league_id=league_id,
            season=arguments.season,
            max_pages=arguments.max_pages,
            max_teams=arguments.max_teams,
        )


        players = convert_players(
            api_players=api_players,
            league_id=league_id,
            season=arguments.season,
        )


        is_partial = (
            arguments.max_pages is not None
            or arguments.max_teams is not None
        )

        output_filename = (
            f"api_football_players_"
            f"{arguments.season}"
            + (
                "_partial.csv"
                if is_partial
                else ".csv"
            )
        )

        output_path = (
            PROJECT_ROOT
            / "data"
            / "raw"
            / output_filename
        )


        output_path.parent.mkdir(
            parents=True,
            exist_ok=True,
        )


        players.to_csv(
            output_path,
            index=False,
            encoding="utf-8-sig",
        )


    except (
        RuntimeError,
        ValueError,
        OSError,
    ) as error:
        print(
            "Errore durante il download:\n"
            f"{error}"
        )

        return


    print(
        "\nDownload completato."
    )

    print(
        f"Giocatori salvati: "
        f"{len(players)}"
    )

    print(
        f"File creato: "
        f"{output_path}"
    )


    print(
        "\nGiocatori per ruolo:"
    )

    print(
        players[
            "role"
        ]
        .value_counts()
        .reindex(
            [
                "P",
                "D",
                "C",
                "A",
            ],
            fill_value=0,
        )
        .to_string()
    )


    if (
        arguments.max_pages is not None
        or arguments.max_teams is not None
    ):
        print(
            "\nATTENZIONE: download parziale. "
            "Non importare ancora questo file "
            "in data/players.csv."
        )


if __name__ == "__main__":
    main()