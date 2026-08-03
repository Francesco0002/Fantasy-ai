"""
Caricamento e validazione del dataset
sorgente dei giocatori.
"""

from pathlib import Path

import pandas as pd


# Cartella principale del progetto.
PROJECT_ROOT = (
    Path(__file__)
    .resolve()
    .parents[1]
)


# Dataset sorgente.
#
# Questo file contiene i dati grezzi
# utilizzati dall'algoritmo di valutazione.
CSV_PATH = (
    PROJECT_ROOT
    / "data"
    / "players.csv"
)


# Ruoli validi nel Fantacalcio Classic.
VALID_ROLES = {
    "P",
    "D",
    "C",
    "A",
}


# Colonne necessarie per eseguire:
#
# - valuation.py;
# - pricing.py;
# - gli endpoint dei giocatori.
REQUIRED_COLUMNS = [
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

    # Permette di sapere da quale
    # fonte proviene ogni riga.
    "data_source",
]


# Colonne che devono contenere
# esclusivamente numeri interi.
INTEGER_COLUMNS = [
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

    "growth_potential",
    "set_piece_level",
]


# Colonne numeriche che possono
# contenere valori decimali.
DECIMAL_COLUMNS = [
    "average_rating_last_season",
    "fantasy_average_last_season",
    "injury_risk",
    "starting_probability",
]


# Colonne statistiche che non possono
# assumere valori negativi.
NON_NEGATIVE_COLUMNS = [
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


# Colonne facoltative presenti
# nel dataset dimostrativo.
OPTIONAL_INTEGER_COLUMNS = [
    "yellow_cards_last_season",
    "red_cards_last_season",
]


def format_invalid_rows(
    invalid_mask: pd.Series,
) -> str:
    """
    Restituisce i numeri delle righe CSV
    che contengono valori non validi.

    Aggiungiamo 2 perché:
    - Pandas parte dall'indice 0;
    - la prima riga del CSV contiene le intestazioni.
    """

    invalid_indexes = (
        invalid_mask[
            invalid_mask
        ]
        .index
        .tolist()
    )

    row_numbers = [
        str(int(index) + 2)
        for index in invalid_indexes[:10]
    ]

    result = ", ".join(row_numbers)

    if len(invalid_indexes) > 10:
        result += ", ..."

    return result


def validate_range(
    players: pd.DataFrame,
    column: str,
    minimum: float,
    maximum: float,
) -> None:
    """
    Controlla che una colonna numerica
    sia compresa nell'intervallo indicato.
    """

    invalid_mask = (
        players[column] < minimum
    ) | (
        players[column] > maximum
    )

    if invalid_mask.any():
        raise ValueError(
            f"La colonna '{column}' deve essere "
            f"compresa tra {minimum} e {maximum}. "
            "Righe non valide: "
            f"{format_invalid_rows(invalid_mask)}."
        )


def validate_non_negative(
    players: pd.DataFrame,
    column: str,
) -> None:
    """
    Controlla che una colonna
    non contenga numeri negativi.
    """

    invalid_mask = (
        players[column] < 0
    )

    if invalid_mask.any():
        raise ValueError(
            f"La colonna '{column}' non può "
            "contenere valori negativi. "
            "Righe non valide: "
            f"{format_invalid_rows(invalid_mask)}."
        )


def convert_numeric_column(
    players: pd.DataFrame,
    column: str,
) -> None:
    """
    Converte una colonna in formato numerico.

    Un testo come 'non disponibile'
    genera un errore esplicito.
    """

    try:
        players[column] = pd.to_numeric(
            players[column],
            errors="raise",
        )

    except (
        ValueError,
        TypeError,
    ) as error:
        raise ValueError(
            f"La colonna '{column}' deve "
            "contenere solamente numeri."
        ) from error


def validate_integer_column(
    players: pd.DataFrame,
    column: str,
) -> None:
    """
    Controlla che tutti i valori
    siano numeri interi.
    """

    invalid_mask = (
        players[column] % 1 != 0
    )

    if invalid_mask.any():
        raise ValueError(
            f"La colonna '{column}' deve "
            "contenere numeri interi. "
            "Righe non valide: "
            f"{format_invalid_rows(invalid_mask)}."
        )

    players[column] = (
        players[column]
        .astype(int)
    )


def load_players() -> pd.DataFrame:
    """
    Carica e valida data/players.csv.

    Restituisce:
        pd.DataFrame: dataset pulito e pronto
        per valuation.py e pricing.py.
    """

    if not CSV_PATH.exists():
        raise FileNotFoundError(
            f"File non trovato: {CSV_PATH}\n"
            "Controlla che players.csv "
            "sia presente nella cartella data."
        )


    players = pd.read_csv(
        CSV_PATH,
        encoding="utf-8-sig",
    )


    if players.empty:
        raise ValueError(
            "Il file players.csv è vuoto."
        )


    # Rimuoviamo eventuali spazi
    # dai nomi delle colonne.
    players.columns = (
        players.columns
        .str.strip()
    )


    # Alcuni programmi aggiungono
    # automaticamente colonne come:
    #
    # Unnamed: 0
    unnamed_columns = [
        column
        for column in players.columns
        if column.startswith("Unnamed:")
    ]

    if unnamed_columns:
        players = players.drop(
            columns=unnamed_columns,
        )


    missing_columns = [
        column
        for column in REQUIRED_COLUMNS
        if column not in players.columns
    ]

    if missing_columns:
        raise ValueError(
            "Colonne mancanti: "
            + ", ".join(missing_columns)
        )


    # Nessuna colonna obbligatoria
    # può contenere valori nulli.
    columns_with_nulls = [
        column
        for column in REQUIRED_COLUMNS
        if players[column].isna().any()
    ]

    if columns_with_nulls:
        raise ValueError(
            "Valori mancanti nelle colonne: "
            + ", ".join(columns_with_nulls)
        )


    # Pulizia dei campi testuali.
    for column in [
        "name",
        "team",
        "data_source",
    ]:
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


    # Uniformiamo i ruoli.
    players["role"] = (
        players["role"]
        .astype(str)
        .str.strip()
        .str.upper()
    )


    # I campi testuali obbligatori
    # non possono essere vuoti.
    for column in [
        "name",
        "team",
        "role",
        "data_source",
    ]:
        invalid_mask = (
            players[column] == ""
        )

        if invalid_mask.any():
            raise ValueError(
                f"La colonna '{column}' contiene "
                "valori vuoti. "
                "Righe non valide: "
                f"{format_invalid_rows(invalid_mask)}."
            )


    numeric_columns = (
        INTEGER_COLUMNS
        + DECIMAL_COLUMNS
    )

    for column in numeric_columns:
        convert_numeric_column(
            players,
            column,
        )


    # Convertiamo e validiamo anche
    # le statistiche facoltative.
    for column in OPTIONAL_INTEGER_COLUMNS:
        if column not in players.columns:
            continue

        if players[column].isna().any():
            raise ValueError(
                f"La colonna facoltativa '{column}' "
                "contiene valori mancanti."
            )

        convert_numeric_column(
            players,
            column,
        )

        validate_integer_column(
            players,
            column,
        )

        validate_non_negative(
            players,
            column,
        )


    for column in INTEGER_COLUMNS:
        validate_integer_column(
            players,
            column,
        )


    # Identificativi positivi e univoci.
    invalid_player_ids = (
        players["player_id"] <= 0
    )

    if invalid_player_ids.any():
        raise ValueError(
            "I player_id devono essere "
            "numeri interi positivi. "
            "Righe non valide: "
            f"{format_invalid_rows(invalid_player_ids)}."
        )


    if players["player_id"].duplicated().any():
        duplicated_ids = (
            players.loc[
                players["player_id"].duplicated(
                    keep=False,
                ),
                "player_id",
            ]
            .astype(str)
            .unique()
            .tolist()
        )

        raise ValueError(
            "Sono presenti player_id duplicati: "
            + ", ".join(duplicated_ids)
        )


    # Validazione dei ruoli.
    invalid_roles = (
        set(
            players["role"].unique()
        )
        - VALID_ROLES
    )

    if invalid_roles:
        raise ValueError(
            "Ruoli non validi trovati: "
            + ", ".join(
                sorted(invalid_roles)
            )
        )


    missing_roles = (
        VALID_ROLES
        - set(
            players["role"].unique()
        )
    )

    if missing_roles:
        raise ValueError(
            "Il dataset non contiene giocatori "
            "per i ruoli: "
            + ", ".join(
                sorted(missing_roles)
            )
        )


    # Età plausibile per un calciatore.
    validate_range(
        players,
        "age",
        15,
        50,
    )


    for column in NON_NEGATIVE_COLUMNS:
        validate_non_negative(
            players,
            column,
        )


    # Le presenze da titolare non possono
    # superare le presenze complessive.
    invalid_starts = (
        players["starts_last_season"]
        >
        players["appearances_last_season"]
    )

    if invalid_starts.any():
        raise ValueError(
            "starts_last_season non può superare "
            "appearances_last_season. "
            "Righe non valide: "
            f"{format_invalid_rows(invalid_starts)}."
        )


    # Un giocatore senza presenze
    # non può avere minuti o partenze da titolare.
    invalid_zero_appearances = (
        players["appearances_last_season"]
        == 0
    ) & (
        (
            players["starts_last_season"]
            > 0
        )
        |
        (
            players["minutes_last_season"]
            > 0
        )
    )

    if invalid_zero_appearances.any():
        raise ValueError(
            "Un giocatore con zero presenze "
            "non può avere minuti o partenze "
            "da titolare. Righe non valide: "
            f"{format_invalid_rows(invalid_zero_appearances)}."
        )


    # I clean sheet non possono superare
    # le presenze complessive.
    invalid_clean_sheets = (
        players["clean_sheets_last_season"]
        >
        players["appearances_last_season"]
    )

    if invalid_clean_sheets.any():
        raise ValueError(
            "clean_sheets_last_season non può "
            "superare appearances_last_season. "
            "Righe non valide: "
            f"{format_invalid_rows(invalid_clean_sheets)}."
        )


    # I rigori segnati sono già compresi
    # nel totale dei gol.
    invalid_penalties = (
        players[
            "penalties_scored_last_season"
        ]
        >
        players["goals_last_season"]
    )

    if invalid_penalties.any():
        raise ValueError(
            "penalties_scored_last_season "
            "non può superare goals_last_season. "
            "Righe non valide: "
            f"{format_invalid_rows(invalid_penalties)}."
        )


    # Intervalli delle valutazioni.
    validate_range(
        players,
        "average_rating_last_season",
        0,
        10,
    )

    validate_range(
        players,
        "fantasy_average_last_season",
        0,
        15,
    )


    # Probabilità e rischio:
    # 0 = minimo, 1 = massimo.
    validate_range(
        players,
        "injury_risk",
        0,
        1,
    )

    # La disponibilità del rischio infortuni
    # deve essere rappresentata esclusivamente
    # con un valore booleano True oppure False.
    if not pd.api.types.is_bool_dtype(
        players["injury_risk_available"]
    ):
        raise ValueError(
            "injury_risk_available deve contenere "
            "esclusivamente valori booleani "
            "True oppure False."
        )

    validate_range(
        players,
        "starting_probability",
        0,
        1,
    )


    # Punteggi proprietari.
    validate_range(
        players,
        "growth_potential",
        0,
        100,
    )

    validate_range(
        players,
        "set_piece_level",
        0,
        3,
    )


    # Campi testuali facoltativi.
    if "notes" in players.columns:
        players["notes"] = (
            players["notes"]
            .fillna("")
            .astype(str)
            .str.strip()
        )


    return players


def main() -> None:
    """
    Esegue il controllo del dataset
    e mostra un riepilogo.
    """

    try:
        players = load_players()

    except (
        FileNotFoundError,
        ValueError,
        pd.errors.ParserError,
    ) as error:
        print(
            "Errore durante il caricamento:\n"
            f"{error}"
        )

        return


    print(
        "Dataset caricato e validato "
        "correttamente."
    )

    print(f"Percorso: {CSV_PATH}")
    print(f"Numero giocatori: {len(players)}")
    print(f"Numero colonne: {len(players.columns)}")


    print("\nGiocatori per ruolo:")

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


    print("\nFonti dati:")

    source_counts = (
        players["data_source"]
        .value_counts()
    )

    print(
        source_counts.to_string()
    )


    columns_to_show = [
        "player_id",
        "name",
        "team",
        "role",
        "age",
        "fantasy_average_last_season",
        "starting_probability",
        "injury_risk",
        "injury_risk_available",
        "data_source",
    ]


    print("\nPrimi 10 giocatori:")

    print(
        players[columns_to_show]
        .head(10)
        .to_string(
            index=False,
        )
    )


if __name__ == "__main__":
    main()