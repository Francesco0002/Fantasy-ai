"""
Importazione e normalizzazione dei dati
provenienti da una fonte esterna.

Il file sorgente viene trasformato in:

data/players.csv

Successivamente il dataset viene validato
tramite backend/check_players.py.
"""

import argparse
import shutil

from datetime import (
    datetime,
    timezone,
)

from pathlib import Path

import pandas as pd

from backend.check_players import (
    CSV_PATH,
    PROJECT_ROOT,
    load_players,
)


# File sorgente predefinito.
DEFAULT_SOURCE_PATH = (
    PROJECT_ROOT
    / "data"
    / "raw"
    / "players_source.csv"
)


# Cartella in cui conserviamo una copia
# del precedente players.csv.
BACKUP_DIRECTORY = (
    PROJECT_ROOT
    / "data"
    / "backups"
)


# Colonne oggettive che devono arrivare
# direttamente dal provider o dal file sorgente.
SOURCE_REQUIRED_COLUMNS = [
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
]


# Colonne numeriche utilizzate
# durante la normalizzazione.
NUMERIC_SOURCE_COLUMNS = [
    "player_id",
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
]


# Alias comuni utilizzati da dataset
# e provider differenti.
COLUMN_ALIASES = {
    "id": "player_id",
    "playerid": "player_id",
    "player_id": "player_id",

    "player": "name",
    "player_name": "name",
    "fullname": "name",
    "full_name": "name",
    "name": "name",

    "club": "team",
    "club_name": "team",
    "squadra": "team",
    "team_name": "team",
    "team": "team",

    "position": "role",
    "pos": "role",
    "ruolo": "role",
    "role": "role",

    "eta": "age",
    "age": "age",

    "appearances": "appearances_last_season",
    "apps": "appearances_last_season",

    "starts": "starts_last_season",
    "starting_appearances": "starts_last_season",

    "minutes": "minutes_last_season",
    "mins": "minutes_last_season",

    "goals": "goals_last_season",
    "goal": "goals_last_season",

    "assists": "assists_last_season",
    "assist": "assists_last_season",

    "clean_sheets": "clean_sheets_last_season",
    "clean_sheet": "clean_sheets_last_season",

    "goals_conceded":
        "goals_conceded_last_season",

    "saves": "saves_last_season",

    "penalties_scored":
        "penalties_scored_last_season",

    "average_rating":
        "average_rating_last_season",

    "rating":
        "average_rating_last_season",

    "fantasy_average":
        "fantasy_average_last_season",

    "fantasy_rating":
        "fantasy_average_last_season",
}


# Alias dei ruoli provenienti
# da fonti italiane e internazionali.
ROLE_ALIASES = {
    "P": "P",
    "POR": "P",
    "PORTIERE": "P",
    "GK": "P",
    "G": "P",

    "D": "D",
    "DIF": "D",
    "DIFENSORE": "D",
    "DEF": "D",
    "DF": "D",

    "C": "C",
    "CEN": "C",
    "CENTROCAMPISTA": "C",
    "MID": "C",
    "MF": "C",
    "M": "C",

    "A": "A",
    "ATT": "A",
    "ATTACCANTE": "A",
    "FWD": "A",
    "FW": "A",
    "ST": "A",
}


def normalize_column_name(
    column_name: str,
) -> str:
    """
    Converte il nome di una colonna
    in un formato uniforme.
    """

    normalized = (
        str(column_name)
        .strip()
        .lower()
        .replace(" ", "_")
        .replace("-", "_")
        .replace(".", "_")
    )

    while "__" in normalized:
        normalized = normalized.replace(
            "__",
            "_",
        )

    return normalized


def apply_column_aliases(
    players: pd.DataFrame,
) -> pd.DataFrame:
    """
    Normalizza i nomi delle colonne
    e applica gli alias conosciuti.
    """

    renamed_columns: dict[str, str] = {}

    for original_column in players.columns:
        normalized_column = (
            normalize_column_name(
                original_column
            )
        )

        target_column = (
            COLUMN_ALIASES.get(
                normalized_column,
                normalized_column,
            )
        )

        renamed_columns[
            original_column
        ] = target_column

    normalized_players = players.rename(
        columns=renamed_columns
    )

    duplicated_columns = (
        normalized_players.columns[
            normalized_players
            .columns
            .duplicated()
        ]
        .tolist()
    )

    if duplicated_columns:
        raise ValueError(
            "Dopo la normalizzazione risultano "
            "colonne duplicate: "
            + ", ".join(
                sorted(
                    set(
                        duplicated_columns
                    )
                )
            )
        )

    return normalized_players


def normalize_text_column(
    players: pd.DataFrame,
    column: str,
) -> None:
    """
    Elimina spazi inutili dai campi testuali.
    """

    players[column] = (
        players[column]
        .astype(str)
        .str.strip()
        .str.replace(
            r"\s+",
            " ",
            regex=True,
        )
    )


def convert_numeric_column(
    players: pd.DataFrame,
    column: str,
) -> None:
    """
    Converte una colonna in numeri.

    Vengono supportati anche valori
    decimali scritti con la virgola.
    """

    cleaned_values = (
        players[column]
        .astype(str)
        .str.strip()
        .str.replace(
            ",",
            ".",
            regex=False,
        )
    )

    try:
        players[column] = pd.to_numeric(
            cleaned_values,
            errors="raise",
        )

    except (
        TypeError,
        ValueError,
    ) as error:
        raise ValueError(
            f"La colonna '{column}' contiene "
            "valori che non possono essere "
            "convertiti in numeri."
        ) from error


def normalize_roles(
    players: pd.DataFrame,
) -> None:
    """
    Converte i ruoli della fonte
    nei ruoli P, D, C e A.
    """

    original_roles = (
        players["role"]
        .astype(str)
        .str.strip()
        .str.upper()
    )

    normalized_roles = (
        original_roles.map(
            ROLE_ALIASES
        )
    )

    invalid_mask = (
        normalized_roles.isna()
    )

    if invalid_mask.any():
        invalid_roles = (
            original_roles[
                invalid_mask
            ]
            .unique()
            .tolist()
        )

        raise ValueError(
            "Ruoli sorgente non riconosciuti: "
            + ", ".join(
                sorted(invalid_roles)
            )
        )

    players["role"] = normalized_roles


def calculate_starting_probability(
    player: pd.Series,
) -> float:
    """
    Stima la probabilità di titolarità.

    Utilizziamo:
    - percentuale di presenze da titolare;
    - minuti medi disputati per presenza.
    """

    appearances = float(
        player[
            "appearances_last_season"
        ]
    )

    starts = float(
        player["starts_last_season"]
    )

    minutes = float(
        player["minutes_last_season"]
    )

    if appearances <= 0:
        return 0.0

    # Limitiamo separatamente i rapporti tra 0 e 1.
    # In questo modo eventuali piccoli minuti extra
    # della fonte non aumentano artificialmente
    # la probabilità di titolarità.
    starts_ratio = min(
        max(
            starts / appearances,
            0.0,
        ),
        1.0,
    )

    minutes_ratio = min(
        max(
            minutes
            / (
                appearances * 90
            ),
            0.0,
        ),
        1.0,
    )

    estimated_probability = (
        starts_ratio * 0.70
        + minutes_ratio * 0.30
    )

    return round(
        min(
            max(
                estimated_probability,
                0.0,
            ),
            1.0,
        ),
        3,
    )


def calculate_growth_potential(
    age: int,
) -> int:
    """
    Stima il margine di crescita
    principalmente in base all'età.

    È una prima euristica e potrà essere
    sostituita da un modello più avanzato.
    """

    if age <= 20:
        return 95

    if age <= 22:
        return 88

    if age <= 24:
        return 78

    if age <= 26:
        return 68

    if age <= 28:
        return 58

    if age <= 30:
        return 48

    if age <= 32:
        return 38

    if age <= 34:
        return 28

    return 18


def calculate_set_piece_level(
    penalties_attempted: int,
) -> int:
    """
    Stima il coinvolgimento del giocatore
    sui rigori usando i tentativi complessivi,
    cioè rigori segnati più rigori sbagliati.

    Livelli:
    0 = nessuna evidenza;
    1 = coinvolgimento limitato;
    2 = possibile rigorista;
    3 = rigorista principale.
    """

    if penalties_attempted >= 4:
        return 3

    if penalties_attempted >= 2:
        return 2

    if penalties_attempted == 1:
        return 1

    return 0


def has_injury_risk_data(
    player: pd.Series,
) -> bool:
    """
    Indica se il rischio infortuni deriva
    da un dato realmente disponibile.

    Il controllo deve essere eseguito prima
    di assegnare il fallback neutro.
    """

    existing_risk = player.get(
        "injury_risk"
    )

    missed_games = player.get(
        "missed_games_injury"
    )

    return bool(
        pd.notna(existing_risk)
        or pd.notna(missed_games)
    )


def calculate_injury_risk(
    player: pd.Series,
) -> float:
    """
    Recupera il rischio infortuni quando
    presente nella fonte.

    Quando è disponibile missed_games_injury,
    utilizziamo la quota di partite saltate.

    In assenza di entrambe le informazioni,
    assegniamo un valore prudente e neutro.
    """

    existing_risk = player.get(
        "injury_risk"
    )

    if pd.notna(existing_risk):
        risk = float(existing_risk)

        return round(
            min(
                max(risk, 0.0),
                1.0,
            ),
            3,
        )

    missed_games = player.get(
        "missed_games_injury"
    )

    if pd.notna(missed_games):
        risk = (
            float(missed_games)
            / 38
        )

        return round(
            min(
                max(risk, 0.0),
                1.0,
            ),
            3,
        )

    return 0.20


def prepare_players(
    raw_players: pd.DataFrame,
    source_name: str,
) -> pd.DataFrame:
    """
    Converte il dataset sorgente
    nel formato interno di Fantasy AI.
    """

    players = apply_column_aliases(
        raw_players
    ).copy()


    missing_columns = [
        column
        for column in SOURCE_REQUIRED_COLUMNS
        if column not in players.columns
    ]

    if missing_columns:
        raise ValueError(
            "Il file sorgente non contiene "
            "le colonne necessarie: "
            + ", ".join(
                missing_columns
            )
        )


    for column in [
        "name",
        "team",
        "role",
    ]:
        normalize_text_column(
            players,
            column,
        )


    normalize_roles(players)


    for column in NUMERIC_SOURCE_COLUMNS:
        convert_numeric_column(
            players,
            column,
        )


    # Convertiamo gli identificativi
    # e le statistiche discrete in interi.
    integer_columns = [
        "player_id",
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
    ]

    for column in integer_columns:
        players[column] = (
            players[column]
            .round()
            .astype(int)
        )


    # Manteniamo i valori proprietari
    # quando la fonte li contiene.
    if (
        "starting_probability"
        not in players.columns
    ):
        players["starting_probability"] = (
            players.apply(
                calculate_starting_probability,
                axis=1,
            )
        )
    else:
        convert_numeric_column(
            players,
            "starting_probability",
        )


    if (
        "growth_potential"
        not in players.columns
    ):
        players["growth_potential"] = (
            players["age"].apply(
                calculate_growth_potential
            )
        )
    else:
        convert_numeric_column(
            players,
            "growth_potential",
        )

        players["growth_potential"] = (
            players[
                "growth_potential"
            ]
            .round()
            .astype(int)
        )


    if (
        "set_piece_level"
        not in players.columns
    ):
        # Consideriamo anche i rigori sbagliati:
        # un errore dal dischetto dimostra comunque
        # che il giocatore è stato scelto per tirarlo.
        penalties_attempted = (
            players[
                "penalties_scored_last_season"
            ]
            + players[
                "penalties_missed_last_season"
            ]
        )

        players["set_piece_level"] = (
            penalties_attempted.apply(
                calculate_set_piece_level
            )
        )
    else:
        convert_numeric_column(
            players,
            "set_piece_level",
        )

        players["set_piece_level"] = (
            players["set_piece_level"]
            .round()
            .astype(int)
        )


    if "injury_risk" in players.columns:
        convert_numeric_column(
            players,
            "injury_risk",
        )

    if (
        "missed_games_injury"
        in players.columns
    ):
        convert_numeric_column(
            players,
            "missed_games_injury",
        )


    # Registriamo prima la disponibilità del dato.
    # Questo controllo deve precedere il fallback,
    # altrimenti il valore tecnico 0.20 sembrerebbe
    # un rischio realmente misurato.
    players["injury_risk_available"] = (
        players.apply(
            has_injury_risk_data,
            axis=1,
        )
        .astype(bool)
    )

    players["injury_risk"] = (
        players.apply(
            calculate_injury_risk,
            axis=1,
        )
    )


    # Origine del dato.
    if "data_source" not in players.columns:
        players["data_source"] = (
            source_name
        )
    else:
        players["data_source"] = (
            players["data_source"]
            .fillna(source_name)
            .astype(str)
            .str.strip()
        )

        empty_source_mask = (
            players["data_source"] == ""
        )

        players.loc[
            empty_source_mask,
            "data_source",
        ] = source_name


    if "notes" not in players.columns:
        players["notes"] = ""


    output_columns = [
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

        "injury_risk",
        "injury_risk_available",
        "starting_probability",
        "growth_potential",
        "set_piece_level",

        "data_source",
        "notes",
    ]


    # Conserviamo anche cartellini
    # quando forniti dalla fonte.
    for optional_column in [
        "yellow_cards_last_season",
        "red_cards_last_season",
    ]:
        if optional_column in players.columns:
            output_columns.append(
                optional_column
            )


    return players[
        output_columns
    ].copy()


def create_backup() -> Path | None:
    """
    Crea una copia del players.csv attuale.
    """

    if not CSV_PATH.exists():
        return None

    BACKUP_DIRECTORY.mkdir(
        parents=True,
        exist_ok=True,
    )

    timestamp = datetime.now(
        timezone.utc
    ).strftime(
        "%Y%m%d_%H%M%S"
    )

    backup_path = (
        BACKUP_DIRECTORY
        / f"players_{timestamp}.csv"
    )

    shutil.copy2(
        CSV_PATH,
        backup_path,
    )

    return backup_path


def restore_backup(
    backup_path: Path | None,
) -> None:
    """
    Ripristina il dataset precedente
    quando la validazione fallisce.
    """

    if (
        backup_path is not None
        and backup_path.exists()
    ):
        shutil.copy2(
            backup_path,
            CSV_PATH,
        )

        return

    if CSV_PATH.exists():
        CSV_PATH.unlink()


def import_players(
    source_path: Path,
    source_name: str,
) -> pd.DataFrame:
    """
    Importa, normalizza e valida
    il file sorgente indicato.
    """

    if not source_path.exists():
        raise FileNotFoundError(
            f"File sorgente non trovato: "
            f"{source_path}"
        )


    # sep=None prova automaticamente
    # a riconoscere virgola o punto e virgola.
    raw_players = pd.read_csv(
        source_path,
        encoding="utf-8-sig",
        sep=None,
        engine="python",
    )


    if raw_players.empty:
        raise ValueError(
            "Il file sorgente è vuoto."
        )


    prepared_players = prepare_players(
        raw_players,
        source_name,
    )


    backup_path = create_backup()


    try:
        prepared_players.to_csv(
            CSV_PATH,
            index=False,
            encoding="utf-8-sig",
        )

        validated_players = load_players()

    except Exception:
        restore_backup(
            backup_path
        )

        raise


    return validated_players


def parse_arguments() -> argparse.Namespace:
    """
    Legge gli argomenti passati
    dal terminale.
    """

    parser = argparse.ArgumentParser(
        description=(
            "Importa un dataset esterno "
            "nel formato Fantasy AI."
        )
    )

    parser.add_argument(
        "source_path",
        nargs="?",
        default=str(
            DEFAULT_SOURCE_PATH
        ),
        help=(
            "Percorso del CSV sorgente. "
            "Predefinito: "
            "data/raw/players_source.csv"
        ),
    )

    parser.add_argument(
        "--source-name",
        default="manual_import",
        help=(
            "Nome della fonte salvato "
            "nella colonna data_source."
        ),
    )

    return parser.parse_args()


def main() -> None:
    """
    Esegue l'importazione completa.
    """

    arguments = parse_arguments()

    source_path = Path(
        arguments.source_path
    )

    if not source_path.is_absolute():
        source_path = (
            PROJECT_ROOT
            / source_path
        ).resolve()


    try:
        players = import_players(
            source_path=source_path,
            source_name=(
                arguments.source_name
            ),
        )

    except (
        FileNotFoundError,
        ValueError,
        TypeError,
        KeyError,
        pd.errors.ParserError,
    ) as error:
        print(
            "Errore durante "
            "l'importazione:\n"
            f"{error}"
        )

        return


    print(
        "Importazione completata "
        "correttamente."
    )

    print(
        f"File sorgente: "
        f"{source_path}"
    )

    print(
        f"File generato: "
        f"{CSV_PATH}"
    )

    print(
        f"Giocatori importati: "
        f"{len(players)}"
    )

    print(
        "\nGiocatori per ruolo:"
    )

    role_counts = (
        players["role"]
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
    )

    print(
        role_counts.to_string()
    )


if __name__ == "__main__":
    main()