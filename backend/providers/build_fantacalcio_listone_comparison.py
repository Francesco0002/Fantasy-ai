from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd


# Root principale del progetto Fantasy AI.
PROJECT_ROOT = Path(__file__).resolve().parents[2]

DEFAULT_OLD_LISTONE = (
    PROJECT_ROOT
    / "data"
    / "raw"
    / "fantacalcio"
    / "listoni"
    / "fantacalcio_2025_26.xlsx"
)

DEFAULT_CURRENT_LISTONE = (
    PROJECT_ROOT
    / "data"
    / "raw"
    / "fantacalcio"
    / "listoni"
    / "fantacalcio_2026_27.xlsx"
)

DEFAULT_OUTPUT_DIRECTORY = (
    PROJECT_ROOT
    / "data"
    / "raw"
    / "fantacalcio"
    / "derived"
)

SHEET_NAME = "Tutti"

# Colonne originali presenti nei file Fantacalcio.
REQUIRED_SOURCE_COLUMNS = [
    "Id",
    "R",
    "RM",
    "Nome",
    "Squadra",
    "Qt.A",
    "Qt.I",
    "Diff.",
    "Qt.A M",
    "Qt.I M",
    "Diff.M",
    "FVM",
    "FVM M",
]

# Nomi interni più chiari e stabili.
COLUMN_MAPPING = {
    "Id": "fantacalcio_id",
    "R": "role",
    "RM": "mantra_role",
    "Nome": "name",
    "Squadra": "team",
    "Qt.A": "quotation_current",
    "Qt.I": "quotation_initial",
    "Diff.": "quotation_difference",
    "Qt.A M": "mantra_quotation_current",
    "Qt.I M": "mantra_quotation_initial",
    "Diff.M": "mantra_quotation_difference",
    "FVM": "fvm",
    "FVM M": "fvm_mantra",
}

TEXT_COLUMNS = [
    "role",
    "mantra_role",
    "name",
    "team",
]

NUMERIC_COLUMNS = [
    "quotation_current",
    "quotation_initial",
    "quotation_difference",
    "mantra_quotation_current",
    "mantra_quotation_initial",
    "mantra_quotation_difference",
    "fvm",
    "fvm_mantra",
]

ROLE_ORDER = {
    "P": 0,
    "D": 1,
    "C": 2,
    "A": 3,
}


def parse_arguments() -> argparse.Namespace:
    """
    Legge gli eventuali percorsi personalizzati dalla riga
    di comando. In assenza di argomenti usa i percorsi
    standard del progetto.
    """

    parser = argparse.ArgumentParser(
        description=(
            "Confronta i listoni Fantacalcio "
            "2025/26 e 2026/27 tramite l'ID ufficiale."
        )
    )

    parser.add_argument(
        "--old-listone",
        type=Path,
        default=DEFAULT_OLD_LISTONE,
        help="Percorso del listone Fantacalcio 2025/26.",
    )

    parser.add_argument(
        "--current-listone",
        type=Path,
        default=DEFAULT_CURRENT_LISTONE,
        help="Percorso del listone Fantacalcio 2026/27.",
    )

    parser.add_argument(
        "--output-directory",
        type=Path,
        default=DEFAULT_OUTPUT_DIRECTORY,
        help="Cartella nella quale salvare i risultati.",
    )

    return parser.parse_args()


def clean_header(value: object) -> str:
    """
    Normalizza un'intestazione Excel eliminando spazi
    iniziali, finali e caratteri non separabili.
    """

    if pd.isna(value):
        return ""

    return (
        str(value)
        .replace("\xa0", " ")
        .strip()
    )


def find_header_row(path: Path) -> int:
    """
    Cerca automaticamente la riga contenente le vere
    intestazioni del foglio.

    Nei listoni Fantacalcio la prima riga può contenere
    un titolo, quindi non assumiamo rigidamente che
    l'intestazione sia sempre nella stessa posizione.
    """

    preview = pd.read_excel(
        path,
        sheet_name=SHEET_NAME,
        header=None,
        nrows=15,
        engine="openpyxl",
    )

    required_markers = {
        "Id",
        "R",
        "Nome",
        "Squadra",
    }

    for row_index, row in preview.iterrows():
        row_values = {
            clean_header(value)
            for value in row.tolist()
            if not pd.isna(value)
        }

        if required_markers.issubset(row_values):
            return int(row_index)

    raise ValueError(
        "Impossibile trovare la riga delle intestazioni "
        f"nel file: {path}"
    )


def validate_input_file(path: Path) -> None:
    """
    Controlla che il file esista e che contenga
    il foglio Tutti.
    """

    if not path.exists():
        raise FileNotFoundError(
            f"File non trovato: {path}"
        )

    excel_file = pd.ExcelFile(
        path,
        engine="openpyxl",
    )

    if SHEET_NAME not in excel_file.sheet_names:
        raise ValueError(
            f"Il file {path.name} non contiene "
            f"il foglio '{SHEET_NAME}'."
        )


def read_listone(
    path: Path,
    season_suffix: str,
) -> pd.DataFrame:
    """
    Legge e normalizza un listone Fantacalcio.

    L'ID Fantacalcio viene conservato come chiave
    principale, mentre tutte le altre colonne ricevono
    il suffisso della stagione.
    """

    validate_input_file(path)

    header_row = find_header_row(path)

    dataframe = pd.read_excel(
        path,
        sheet_name=SHEET_NAME,
        header=header_row,
        dtype=object,
        engine="openpyxl",
    )

    dataframe.columns = [
        clean_header(column)
        for column in dataframe.columns
    ]

    missing_columns = [
        column
        for column in REQUIRED_SOURCE_COLUMNS
        if column not in dataframe.columns
    ]

    if missing_columns:
        raise ValueError(
            f"Nel file {path.name} mancano le colonne: "
            + ", ".join(missing_columns)
        )

    dataframe = dataframe[
        REQUIRED_SOURCE_COLUMNS
    ].copy()

    dataframe.rename(
        columns=COLUMN_MAPPING,
        inplace=True,
    )

    # Elimina eventuali righe completamente vuote
    # presenti alla fine del foglio Excel.
    dataframe = dataframe[
        dataframe["fantacalcio_id"].notna()
        & dataframe["name"].notna()
    ].copy()

    raw_ids = dataframe[
        "fantacalcio_id"
    ].copy()

    dataframe["fantacalcio_id"] = (
        pd.to_numeric(
            dataframe["fantacalcio_id"],
            errors="coerce",
        )
    )

    invalid_ids = dataframe[
        dataframe["fantacalcio_id"].isna()
    ]

    if not invalid_ids.empty:
        invalid_values = (
            raw_ids.loc[invalid_ids.index]
            .astype(str)
            .tolist()
        )

        raise ValueError(
            f"ID Fantacalcio non validi in {path.name}: "
            + ", ".join(invalid_values[:10])
        )

    dataframe["fantacalcio_id"] = (
        dataframe["fantacalcio_id"]
        .round()
        .astype("Int64")
    )

    # Normalizzazione dei campi testuali.
    for column in TEXT_COLUMNS:
        dataframe[column] = (
            dataframe[column]
            .fillna("")
            .astype(str)
            .str.replace("\xa0", " ", regex=False)
            .str.strip()
        )

    dataframe["role"] = (
        dataframe["role"]
        .str.upper()
    )

    dataframe["team"] = (
        dataframe["team"]
        .str.upper()
    )

    # Conversione delle quotazioni e degli FVM
    # in valori numerici utilizzabili dai calcoli.
    for column in NUMERIC_COLUMNS:
        dataframe[column] = pd.to_numeric(
            dataframe[column],
            errors="coerce",
        )

    duplicate_ids = dataframe[
        dataframe["fantacalcio_id"].duplicated(
            keep=False
        )
    ]

    if not duplicate_ids.empty:
        duplicated_values = sorted(
            duplicate_ids[
                "fantacalcio_id"
            ]
            .dropna()
            .astype(int)
            .unique()
            .tolist()
        )

        raise ValueError(
            f"ID duplicati in {path.name}: "
            + ", ".join(
                str(value)
                for value in duplicated_values[:20]
            )
        )

    # L'ID rimane senza suffisso perché rappresenta
    # la chiave utilizzata per unire le stagioni.
    rename_with_season = {
        column: f"{column}_{season_suffix}"
        for column in dataframe.columns
        if column != "fantacalcio_id"
    }

    dataframe.rename(
        columns=rename_with_season,
        inplace=True,
    )

    return dataframe


def values_are_different(
    dataframe: pd.DataFrame,
    current_column: str,
    previous_column: str,
    present_column: str,
) -> pd.Series:
    """
    Confronta due colonne soltanto per i giocatori
    presenti in entrambe le stagioni.
    """

    current_values = (
        dataframe[current_column]
        .fillna("")
        .astype(str)
        .str.strip()
    )

    previous_values = (
        dataframe[previous_column]
        .fillna("")
        .astype(str)
        .str.strip()
    )

    return (
        dataframe[present_column]
        & current_values.ne(previous_values)
    )


def build_comparison(
    old_dataframe: pd.DataFrame,
    current_dataframe: pd.DataFrame,
) -> pd.DataFrame:
    """
    Costruisce il confronto partendo dal listone
    corrente 2026/27.

    Ogni riga del risultato rappresenta quindi un
    giocatore che dovrà essere considerato dal sito.
    """

    comparison = current_dataframe.merge(
        old_dataframe,
        on="fantacalcio_id",
        how="left",
        validate="one_to_one",
        indicator=True,
    )

    comparison["present_2025_26"] = (
        comparison["_merge"].eq("both")
    )

    comparison["is_new_2026_27"] = (
        ~comparison["present_2025_26"]
    )

    comparison["name_changed"] = (
        values_are_different(
            comparison,
            "name_2026_27",
            "name_2025_26",
            "present_2025_26",
        )
    )

    comparison["team_changed"] = (
        values_are_different(
            comparison,
            "team_2026_27",
            "team_2025_26",
            "present_2025_26",
        )
    )

    comparison["role_changed"] = (
        values_are_different(
            comparison,
            "role_2026_27",
            "role_2025_26",
            "present_2025_26",
        )
    )

    comparison["mantra_role_changed"] = (
        values_are_different(
            comparison,
            "mantra_role_2026_27",
            "mantra_role_2025_26",
            "present_2025_26",
        )
    )

    comparison["match_status"] = (
        "MATCHED_BY_FANTACALCIO_ID"
    )

    comparison.loc[
        comparison["is_new_2026_27"],
        "match_status",
    ] = "NEW_IN_2026_27"

    comparison.drop(
        columns=["_merge"],
        inplace=True,
    )

    # Ordine finale delle colonne: prima il profilo
    # corrente, poi lo storico e infine i flag.
    ordered_columns = [
        "fantacalcio_id",
        "name_2026_27",
        "team_2026_27",
        "role_2026_27",
        "mantra_role_2026_27",
        "quotation_current_2026_27",
        "quotation_initial_2026_27",
        "quotation_difference_2026_27",
        "mantra_quotation_current_2026_27",
        "mantra_quotation_initial_2026_27",
        "mantra_quotation_difference_2026_27",
        "fvm_2026_27",
        "fvm_mantra_2026_27",
        "present_2025_26",
        "name_2025_26",
        "team_2025_26",
        "role_2025_26",
        "mantra_role_2025_26",
        "quotation_current_2025_26",
        "quotation_initial_2025_26",
        "quotation_difference_2025_26",
        "mantra_quotation_current_2025_26",
        "mantra_quotation_initial_2025_26",
        "mantra_quotation_difference_2025_26",
        "fvm_2025_26",
        "fvm_mantra_2025_26",
        "is_new_2026_27",
        "name_changed",
        "team_changed",
        "role_changed",
        "mantra_role_changed",
        "match_status",
    ]

    comparison = comparison[
        ordered_columns
    ].copy()

    comparison["_role_order"] = (
        comparison["role_2026_27"]
        .map(ROLE_ORDER)
        .fillna(99)
    )

    comparison.sort_values(
        by=[
            "_role_order",
            "name_2026_27",
            "fantacalcio_id",
        ],
        inplace=True,
        kind="stable",
    )

    comparison.drop(
        columns=["_role_order"],
        inplace=True,
    )

    comparison.reset_index(
        drop=True,
        inplace=True,
    )

    return comparison


def build_removed_players(
    old_dataframe: pd.DataFrame,
    current_dataframe: pd.DataFrame,
) -> pd.DataFrame:
    """
    Individua i giocatori presenti nel 2025/26
    ma assenti dal listone corrente 2026/27.
    """

    current_ids = set(
        current_dataframe[
            "fantacalcio_id"
        ]
        .dropna()
        .astype(int)
        .tolist()
    )

    removed_players = old_dataframe[
        ~old_dataframe[
            "fantacalcio_id"
        ].isin(current_ids)
    ].copy()

    removed_players["status"] = (
        "NOT_IN_2026_27"
    )

    removed_players["_role_order"] = (
        removed_players["role_2025_26"]
        .map(ROLE_ORDER)
        .fillna(99)
    )

    removed_players.sort_values(
        by=[
            "_role_order",
            "name_2025_26",
            "fantacalcio_id",
        ],
        inplace=True,
        kind="stable",
    )

    removed_players.drop(
        columns=["_role_order"],
        inplace=True,
    )

    removed_players.reset_index(
        drop=True,
        inplace=True,
    )

    return removed_players


def build_summary(
    comparison: pd.DataFrame,
    removed_players: pd.DataFrame,
    old_dataframe: pd.DataFrame,
    current_dataframe: pd.DataFrame,
    old_path: Path,
    current_path: Path,
) -> dict[str, object]:
    """
    Crea un report JSON sintetico utile per controllare
    rapidamente il risultato del confronto.
    """

    matched_count = int(
        comparison[
            "present_2025_26"
        ].sum()
    )

    new_count = int(
        comparison[
            "is_new_2026_27"
        ].sum()
    )

    return {
        "generated_at_utc": (
            datetime.now(timezone.utc)
            .isoformat()
        ),
        "source_files": {
            "2025_26": str(
                old_path.resolve()
            ),
            "2026_27": str(
                current_path.resolve()
            ),
        },
        "players_2025_26": int(
            len(old_dataframe)
        ),
        "players_2026_27": int(
            len(current_dataframe)
        ),
        "matched_by_fantacalcio_id": (
            matched_count
        ),
        "new_in_2026_27": new_count,
        "not_in_2026_27": int(
            len(removed_players)
        ),
        "name_changes": int(
            comparison[
                "name_changed"
            ].sum()
        ),
        "team_changes": int(
            comparison[
                "team_changed"
            ].sum()
        ),
        "classic_role_changes": int(
            comparison[
                "role_changed"
            ].sum()
        ),
        "mantra_role_changes": int(
            comparison[
                "mantra_role_changed"
            ].sum()
        ),
        "role_distribution_2025_26": {
            str(key): int(value)
            for key, value in (
                old_dataframe[
                    "role_2025_26"
                ]
                .value_counts()
                .sort_index()
                .items()
            )
        },
        "role_distribution_2026_27": {
            str(key): int(value)
            for key, value in (
                current_dataframe[
                    "role_2026_27"
                ]
                .value_counts()
                .sort_index()
                .items()
            )
        },
    }


def save_outputs(
    comparison: pd.DataFrame,
    removed_players: pd.DataFrame,
    summary: dict[str, object],
    output_directory: Path,
) -> tuple[Path, Path, Path]:
    """
    Salva i file derivati sotto data/raw, che è già
    esclusa dal repository Git.
    """

    output_directory.mkdir(
        parents=True,
        exist_ok=True,
    )

    comparison_path = (
        output_directory
        / (
            "fantacalcio_listone_"
            "comparison_2025_26_vs_2026_27.csv"
        )
    )

    removed_path = (
        output_directory
        / (
            "fantacalcio_players_"
            "not_in_2026_27.csv"
        )
    )

    summary_path = (
        output_directory
        / (
            "fantacalcio_listone_"
            "comparison_summary.json"
        )
    )

    comparison.to_csv(
        comparison_path,
        index=False,
        encoding="utf-8-sig",
    )

    removed_players.to_csv(
        removed_path,
        index=False,
        encoding="utf-8-sig",
    )

    summary_path.write_text(
        json.dumps(
            summary,
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    return (
        comparison_path,
        removed_path,
        summary_path,
    )


def main() -> int:
    arguments = parse_arguments()

    try:
        old_dataframe = read_listone(
            arguments.old_listone,
            "2025_26",
        )

        current_dataframe = read_listone(
            arguments.current_listone,
            "2026_27",
        )

        comparison = build_comparison(
            old_dataframe,
            current_dataframe,
        )

        removed_players = (
            build_removed_players(
                old_dataframe,
                current_dataframe,
            )
        )

        summary = build_summary(
            comparison,
            removed_players,
            old_dataframe,
            current_dataframe,
            arguments.old_listone,
            arguments.current_listone,
        )

        (
            comparison_path,
            removed_path,
            summary_path,
        ) = save_outputs(
            comparison,
            removed_players,
            summary,
            arguments.output_directory,
        )

    except (
        FileNotFoundError,
        ValueError,
        OSError,
    ) as error:
        print(
            f"[ERRORE] {error}",
            file=sys.stderr,
        )

        return 1

    print()
    print(
        "Confronto listoni completato."
    )
    print(
        f"Giocatori 2025/26: "
        f"{summary['players_2025_26']}"
    )
    print(
        f"Giocatori 2026/27: "
        f"{summary['players_2026_27']}"
    )
    print(
        f"Associati tramite ID: "
        f"{summary['matched_by_fantacalcio_id']}"
    )
    print(
        f"Nuovi nel 2026/27: "
        f"{summary['new_in_2026_27']}"
    )
    print(
        f"Assenti nel 2026/27: "
        f"{summary['not_in_2026_27']}"
    )
    print(
        f"Cambi di squadra: "
        f"{summary['team_changes']}"
    )
    print(
        f"Cambi di ruolo Classic: "
        f"{summary['classic_role_changes']}"
    )
    print(
        f"Cambi di ruolo Mantra: "
        f"{summary['mantra_role_changes']}"
    )
    print()
    print(
        f"Confronto: {comparison_path}"
    )
    print(
        f"Giocatori rimossi: {removed_path}"
    )
    print(
        f"Report: {summary_path}"
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())