"""
Abbina le statistiche API-Football al listone ufficiale Fantacalcio.

Lo script:

1. legge i due file sorgente senza modificarli;
2. abbina i giocatori con criteri controllati;
3. usa il ruolo Classic del listone ufficiale;
4. separa i 16 giovani non presenti nel listone;
5. genera due nuovi CSV dentro data/processed.
"""

from __future__ import annotations

import re
import unicodedata
from collections import Counter
from difflib import SequenceMatcher
from pathlib import Path

import pandas as pd


# Root del progetto:
# fantasy-ai/backend/providers/match_fantacalcio_roles.py
PROJECT_ROOT = Path(__file__).resolve().parents[2]

STATS_PATH = (
    PROJECT_ROOT
    / "data"
    / "raw"
    / "api_football"
    / "season_2024"
    / "player_season_stats_with_ages_complete.csv"
)

LIST_PATH = (
    PROJECT_ROOT
    / "data"
    / "raw"
    / "fantacalcio"
    / "season_2024"
    / "Quotazioni_Fantacalcio_Stagione_2024_25.xlsx"
)

PROCESSED_PATH = PROJECT_ROOT / "data" / "processed"

MATCHED_OUTPUT_PATH = (
    PROCESSED_PATH
    / "player_season_stats_with_classic_roles.csv"
)

EXCLUDED_OUTPUT_PATH = (
    PROCESSED_PATH
    / "player_season_stats_excluded_from_fantacalcio.csv"
)


# Numeri già verificati durante i controlli precedenti.
EXPECTED_API_ROWS = 599
EXPECTED_LIST_ROWS = 679
EXPECTED_MATCHED_ROWS = 583
EXPECTED_EXCLUDED_ROWS = 16


# Questi giocatori sono presenti nei dati API-Football,
# ma non nel listone ufficiale utilizzato per l'asta.
EXCLUDED_PLAYER_NAMES = {
    "Ismael Konate",
    "Thomas Campaniello",
    "Maat Daniel Caprini",
    "Junior Ajayi",
    "Diego Pugno",
    "Bob Murphy Omoregbe",
    "Lorenzo Anghelè",
    "Tommaso Gabellini",
    "Jacopo Bacci",
    "Tommaso Rubino",
    "Federico Accornero",
    "Luka Topalović",
    "Aaron Ciammaglichella",
    "Matteo Palma",
    "Nicola Pintus",
    "Lorenzo Tosto",
}


# Alias verificati manualmente.
# La chiave è l'ID API-Football e il valore è il nome nel listone.
MANUAL_ALIASES = {
    31692: "Djuric",
    2738: "Gytkjaer",
    339883: "Yildiz",
    323369: "Lovik",
    3406: "Zambo Anguissa",
}


SPECIAL_CHARACTERS = str.maketrans(
    {
        "æ": "ae",
        "ø": "o",
        "đ": "d",
        "ð": "d",
        "þ": "th",
        "ł": "l",
        "ı": "i",
        "ß": "ss",
        "œ": "oe",
    }
)


def normalize_text(value: object) -> str:
    """Uniforma accenti, apostrofi, lettere speciali e punteggiatura."""

    text = str(value).strip().lower()
    text = text.translate(SPECIAL_CHARACTERS)

    # N'Dicka diventa Ndicka.
    text = re.sub(r"[’'`]", "", text)

    text = unicodedata.normalize("NFKD", text)

    text = "".join(
        character
        for character in text
        if not unicodedata.combining(character)
    )

    text = re.sub(r"[^a-z0-9]+", " ", text)

    return re.sub(r"\s+", " ", text).strip()


def normalize_team(value: object) -> str:
    """Uniforma le differenze note nei nomi delle squadre."""

    team = normalize_text(value)

    aliases = {
        "ac milan": "milan",
        "as roma": "roma",
        "hellas verona": "verona",
        "internazionale": "inter",
        "fc internazionale milano": "inter",
    }

    return aliases.get(team, team)


def read_fantacalcio_sheet(sheet_name: str) -> pd.DataFrame:
    """Legge un foglio individuando automaticamente l'intestazione."""

    preview = pd.read_excel(
        LIST_PATH,
        sheet_name=sheet_name,
        header=None,
    )

    header_row = None

    for index, row in preview.iterrows():
        values = {
            str(value).strip()
            for value in row.dropna()
        }

        if "Nome" in values and "R" in values:
            header_row = index
            break

    if header_row is None:
        raise ValueError(
            f"Intestazione non trovata nel foglio {sheet_name}"
        )

    dataframe = pd.read_excel(
        LIST_PATH,
        sheet_name=sheet_name,
        header=header_row,
    )

    dataframe.columns = [
        str(column).strip()
        for column in dataframe.columns
    ]

    required_columns = {"Nome", "Squadra", "R"}
    missing_columns = required_columns - set(dataframe.columns)

    if missing_columns:
        raise ValueError(
            f"Colonne mancanti nel foglio {sheet_name}: "
            f"{sorted(missing_columns)}"
        )

    dataframe = dataframe[
        ["Nome", "Squadra", "R"]
    ].copy()

    dataframe["list_sheet"] = sheet_name

    return dataframe


def directional_name_match(
    short_name: str,
    long_name: str,
) -> bool:
    """
    Verifica se un nome abbreviato è contenuto nel nome completo.

    Esempi:
    - Pulisic -> Christian Pulisic
    - Hernandez T -> Theo Hernandez
    - Loftus Cheek -> Ruben Loftus-Cheek
    """

    short_tokens = short_name.split()
    long_tokens = long_name.split()

    if not short_tokens or not long_tokens:
        return False

    long_words = set(long_tokens)

    complete_tokens = [
        token
        for token in short_tokens
        if len(token) > 1
    ]

    initials = [
        token
        for token in short_tokens
        if len(token) == 1
    ]

    if not complete_tokens:
        return False

    if not all(
        token in long_words
        for token in complete_tokens
    ):
        return False

    if not any(
        len(token) >= 3
        for token in complete_tokens
    ):
        return False

    for initial in initials:
        if not any(
            token.startswith(initial)
            for token in long_tokens
        ):
            return False

    return True


def names_compatible(
    api_name: str,
    list_name: str,
) -> bool:
    """Confronta nomi completi, abbreviati e in ordine diverso."""

    api_tokens = api_name.split()
    list_tokens = list_name.split()

    if api_name == list_name:
        return True

    if sorted(api_tokens) == sorted(list_tokens):
        return True

    return (
        directional_name_match(list_name, api_name)
        or directional_name_match(api_name, list_name)
    )


def name_forms(name: object) -> set[str]:
    """Crea forme semplici e unite del nome."""

    tokens = normalize_text(name).split()
    forms = set(tokens)

    # Gestisce cognomi come Del Prato e Loftus Cheek.
    for size in (2, 3):
        for index in range(len(tokens) - size + 1):
            forms.add(
                "".join(tokens[index:index + size])
            )

    return forms


def abbreviation_coverage(
    abbreviated_name: object,
    complete_name: object,
) -> float:
    """Misura quanto un nome abbreviato copre il nome completo."""

    abbreviated_tokens = normalize_text(
        abbreviated_name
    ).split()

    complete_tokens = normalize_text(
        complete_name
    ).split()

    complete_forms = name_forms(complete_name)

    if not abbreviated_tokens:
        return 0.0

    matched_tokens = 0

    for token in abbreviated_tokens:
        if token in complete_forms:
            matched_tokens += 1
            continue

        # Gestisce abbreviazioni come Lo., Lu., Jo. e Alb.
        if any(
            complete_token.startswith(token)
            for complete_token in complete_tokens
        ):
            matched_tokens += 1

    return matched_tokens / len(abbreviated_tokens)


def candidate_score(
    api_name: object,
    list_name: object,
    same_team: bool,
) -> float:
    """Calcola l'affidabilità di un possibile abbinamento."""

    api_key = normalize_text(api_name)
    list_key = normalize_text(list_name)

    direct_similarity = SequenceMatcher(
        None,
        api_key,
        list_key,
    ).ratio()

    ordered_similarity = SequenceMatcher(
        None,
        " ".join(sorted(api_key.split())),
        " ".join(sorted(list_key.split())),
    ).ratio()

    similarity = max(
        direct_similarity,
        ordered_similarity,
    )

    shared_forms = {
        form
        for form in name_forms(api_name) & name_forms(list_name)
        if len(form) >= 4
    }

    significant_match = 1.0 if shared_forms else 0.0

    coverage = max(
        abbreviation_coverage(list_name, api_name),
        abbreviation_coverage(api_name, list_name),
    )

    score = (
        0.30 * similarity
        + 0.45 * coverage
        + 0.25 * significant_match
    )

    if api_key == list_key:
        score = 1.0

    # La squadra uguale è un piccolo elemento di conferma.
    if same_team:
        score += 0.02

    return round(min(score, 1.0), 3)


def validate_source_files() -> None:
    """Controlla che entrambi i file sorgente esistano."""

    if not STATS_PATH.exists():
        raise FileNotFoundError(
            f"CSV API-Football non trovato: {STATS_PATH}"
        )

    if not LIST_PATH.exists():
        raise FileNotFoundError(
            f"Listone Fantacalcio non trovato: {LIST_PATH}"
        )


def main() -> None:
    """Esegue l'abbinamento e genera i due file elaborati."""

    validate_source_files()

    # ------------------------------------------------------------------
    # 1. Caricamento dei file sorgente
    # ------------------------------------------------------------------

    api_players = pd.read_csv(STATS_PATH)
    original_api_columns = list(api_players.columns)

    api_players.insert(
        0,
        "api_row",
        range(len(api_players)),
    )

    fantacalcio_players = pd.concat(
        [
            read_fantacalcio_sheet("Tutti"),
            read_fantacalcio_sheet("Ceduti"),
        ],
        ignore_index=True,
    )

    fantacalcio_players = (
        fantacalcio_players
        .dropna(subset=["Nome", "Squadra", "R"])
        .reset_index(drop=True)
    )

    fantacalcio_players.insert(
        0,
        "list_row",
        range(len(fantacalcio_players)),
    )

    # ------------------------------------------------------------------
    # 2. Controlli iniziali
    # ------------------------------------------------------------------

    if len(api_players) != EXPECTED_API_ROWS:
        raise ValueError(
            "Numero inatteso di giocatori API-Football: "
            f"{len(api_players)} invece di {EXPECTED_API_ROWS}"
        )

    if len(fantacalcio_players) != EXPECTED_LIST_ROWS:
        raise ValueError(
            "Numero inatteso di righe nel listone: "
            f"{len(fantacalcio_players)} invece di "
            f"{EXPECTED_LIST_ROWS}"
        )

    if api_players["player_id"].duplicated().any():
        raise ValueError(
            "Il dataset API contiene player_id duplicati"
        )

    api_players["name_key"] = (
        api_players["name"].map(normalize_text)
    )

    api_players["team_key"] = (
        api_players["team"].map(normalize_team)
    )

    fantacalcio_players["name_key"] = (
        fantacalcio_players["Nome"].map(normalize_text)
    )

    fantacalcio_players["team_key"] = (
        fantacalcio_players["Squadra"].map(normalize_team)
    )

    duplicated_list_names = fantacalcio_players[
        fantacalcio_players["name_key"].duplicated(
            keep=False
        )
    ]

    if not duplicated_list_names.empty:
        raise ValueError(
            "Il listone contiene nomi normalizzati duplicati:\n"
            + duplicated_list_names[
                ["Nome", "Squadra", "R"]
            ].to_string(index=False)
        )

    excluded_name_keys = {
        normalize_text(name)
        for name in EXCLUDED_PLAYER_NAMES
    }

    api_players["is_excluded"] = (
        api_players["name_key"].isin(
            excluded_name_keys
        )
    )

    # ------------------------------------------------------------------
    # 3. Registrazione controllata degli abbinamenti
    # ------------------------------------------------------------------

    matches: list[dict[str, object]] = []
    used_api_rows: set[int] = set()
    used_list_rows: set[int] = set()

    def register_match(
        api_row: int,
        list_row: int,
        method: str,
        score: float,
    ) -> None:
        """Registra una corrispondenza uno-a-uno."""

        if api_row in used_api_rows:
            raise ValueError(
                f"Riga API già utilizzata: {api_row}"
            )

        if list_row in used_list_rows:
            raise ValueError(
                f"Riga del listone già utilizzata: {list_row}"
            )

        matches.append(
            {
                "api_row": api_row,
                "list_row": list_row,
                "role_match_method": method,
                "role_match_score": score,
            }
        )

        used_api_rows.add(api_row)
        used_list_rows.add(list_row)

    # ------------------------------------------------------------------
    # 4. Alias manuali verificati
    # ------------------------------------------------------------------

    for player_id, list_name in MANUAL_ALIASES.items():
        api_candidate = api_players[
            api_players["player_id"].eq(player_id)
        ]

        if len(api_candidate) != 1:
            raise ValueError(
                f"ID API non trovato o duplicato: {player_id}"
            )

        list_key = normalize_text(list_name)

        list_candidate = fantacalcio_players[
            fantacalcio_players["name_key"].eq(list_key)
        ]

        if len(list_candidate) != 1:
            raise ValueError(
                "Alias Fantacalcio non trovato o duplicato: "
                f"{list_name}"
            )

        register_match(
            api_row=int(api_candidate.iloc[0]["api_row"]),
            list_row=int(list_candidate.iloc[0]["list_row"]),
            method="manual_alias",
            score=1.0,
        )

    # ------------------------------------------------------------------
    # 5. Funzione per gli abbinamenti univoci
    # ------------------------------------------------------------------

    def run_mutual_unique_pass(
        method: str,
        require_same_team: bool,
        exact_name_only: bool,
    ) -> None:
        """
        Accetta un abbinamento soltanto quando è univoco
        sia per il giocatore API sia per il listone.
        """

        candidate_pairs: list[tuple[int, int]] = []

        available_api = api_players[
            ~api_players["api_row"].isin(used_api_rows)
            & ~api_players["is_excluded"]
        ]

        available_list = fantacalcio_players[
            ~fantacalcio_players["list_row"].isin(
                used_list_rows
            )
        ]

        for api_player in available_api.itertuples(
            index=False
        ):
            for list_player in available_list.itertuples(
                index=False
            ):
                if (
                    require_same_team
                    and api_player.team_key
                    != list_player.team_key
                ):
                    continue

                if exact_name_only:
                    compatible = (
                        api_player.name_key
                        == list_player.name_key
                    )
                else:
                    compatible = names_compatible(
                        api_player.name_key,
                        list_player.name_key,
                    )

                if compatible:
                    candidate_pairs.append(
                        (
                            int(api_player.api_row),
                            int(list_player.list_row),
                        )
                    )

        api_counts = Counter(
            api_row
            for api_row, _ in candidate_pairs
        )

        list_counts = Counter(
            list_row
            for _, list_row in candidate_pairs
        )

        accepted_pairs = [
            (api_row, list_row)
            for api_row, list_row in candidate_pairs
            if (
                api_counts[api_row] == 1
                and list_counts[list_row] == 1
            )
        ]

        for api_row, list_row in accepted_pairs:
            register_match(
                api_row=api_row,
                list_row=list_row,
                method=method,
                score=1.0,
            )

    # Nome normalizzato identico.
    run_mutual_unique_pass(
        method="exact_name",
        require_same_team=False,
        exact_name_only=True,
    )

    # Nome compatibile e stessa squadra.
    run_mutual_unique_pass(
        method="name_parts_and_team",
        require_same_team=True,
        exact_name_only=False,
    )

    # ------------------------------------------------------------------
    # 6. Ultimi casi già verificati nel controllo precedente
    # ------------------------------------------------------------------

    remaining_api = api_players[
        ~api_players["api_row"].isin(used_api_rows)
        & ~api_players["is_excluded"]
    ]

    remaining_list = fantacalcio_players[
        ~fantacalcio_players["list_row"].isin(
            used_list_rows
        )
    ]

    proposals: list[dict[str, object]] = []
    rejected_candidates: list[str] = []

    for api_player in remaining_api.itertuples(index=False):
        ranked_candidates: list[
            tuple[float, int, str]
        ] = []

        for list_player in remaining_list.itertuples(
            index=False
        ):
            same_team = (
                api_player.team_key
                == list_player.team_key
            )

            score = candidate_score(
                api_player.name,
                list_player.Nome,
                same_team,
            )

            ranked_candidates.append(
                (
                    score,
                    int(list_player.list_row),
                    str(list_player.Nome),
                )
            )

        ranked_candidates.sort(
            key=lambda item: item[0],
            reverse=True,
        )

        best_score, best_list_row, best_name = (
            ranked_candidates[0]
        )

        second_score = (
            ranked_candidates[1][0]
            if len(ranked_candidates) > 1
            else 0.0
        )

        score_margin = best_score - second_score

        # Le soglie impediscono di salvare abbinamenti deboli.
        if best_score < 0.80 or score_margin < 0.05:
            rejected_candidates.append(
                f"{api_player.player_id} - "
                f"{api_player.name}: "
                f"migliore={best_name} "
                f"({best_score:.3f}), "
                f"margine={score_margin:.3f}"
            )

            continue

        proposals.append(
            {
                "api_row": int(api_player.api_row),
                "list_row": best_list_row,
                "score": best_score,
            }
        )

    proposed_list_rows = [
        int(proposal["list_row"])
        for proposal in proposals
    ]

    duplicated_proposals = {
        list_row
        for list_row, count
        in Counter(proposed_list_rows).items()
        if count > 1
    }

    if duplicated_proposals:
        raise ValueError(
            "Più giocatori API puntano alla stessa riga "
            f"del listone: {sorted(duplicated_proposals)}"
        )

    if rejected_candidates:
        raise ValueError(
            "Sono rimasti abbinamenti non sufficientemente "
            "sicuri:\n"
            + "\n".join(rejected_candidates)
        )

    for proposal in proposals:
        register_match(
            api_row=int(proposal["api_row"]),
            list_row=int(proposal["list_row"]),
            method="validated_best_candidate",
            score=float(proposal["score"]),
        )

    # ------------------------------------------------------------------
    # 7. Verifica finale prima di scrivere qualsiasi file
    # ------------------------------------------------------------------

    unresolved = api_players[
        ~api_players["api_row"].isin(used_api_rows)
    ].copy()

    actual_excluded_keys = set(unresolved["name_key"])

    if actual_excluded_keys != excluded_name_keys:
        unexpected_names = sorted(
            actual_excluded_keys - excluded_name_keys
        )

        missing_names = sorted(
            excluded_name_keys - actual_excluded_keys
        )

        raise ValueError(
            "L'elenco finale degli esclusi non coincide "
            "con quello verificato.\n"
            f"Inattesi: {unexpected_names}\n"
            f"Mancanti: {missing_names}"
        )

    if len(matches) != EXPECTED_MATCHED_ROWS:
        raise ValueError(
            "Numero inatteso di giocatori abbinati: "
            f"{len(matches)} invece di "
            f"{EXPECTED_MATCHED_ROWS}"
        )

    if len(unresolved) != EXPECTED_EXCLUDED_ROWS:
        raise ValueError(
            "Numero inatteso di esclusi: "
            f"{len(unresolved)} invece di "
            f"{EXPECTED_EXCLUDED_ROWS}"
        )

    # ------------------------------------------------------------------
    # 8. Costruzione del dataset finale
    # ------------------------------------------------------------------

    matches_dataframe = pd.DataFrame(matches)

    api_export = api_players[
        ["api_row", *original_api_columns]
    ].copy()

    list_export = fantacalcio_players[
        [
            "list_row",
            "Nome",
            "Squadra",
            "R",
            "list_sheet",
        ]
    ].copy()

    processed = (
        matches_dataframe
        .merge(
            api_export,
            on="api_row",
            how="left",
            validate="one_to_one",
        )
        .merge(
            list_export,
            on="list_row",
            how="left",
            validate="one_to_one",
        )
        .sort_values("api_row")
    )

    processed = processed.rename(
        columns={
            "role": "role_api",
            "R": "role_classic",
            "Nome": "fantacalcio_name",
            "Squadra": "fantacalcio_team",
            "list_sheet": "fantacalcio_sheet",
        }
    )

    # La colonna role diventa il ruolo ufficiale usato dall'app.
    processed["role"] = (
        processed["role_classic"]
        .astype(str)
        .str.upper()
    )

    valid_roles = {"P", "D", "C", "A"}

    invalid_roles = set(processed["role"]) - valid_roles

    if invalid_roles:
        raise ValueError(
            f"Ruoli Classic non validi: {invalid_roles}"
        )

    output_columns: list[str] = []

    for column in original_api_columns:
        if column == "role":
            output_columns.extend(
                [
                    "role",
                    "role_api",
                    "role_classic",
                ]
            )
        else:
            output_columns.append(column)

    output_columns.extend(
        [
            "fantacalcio_name",
            "fantacalcio_team",
            "fantacalcio_sheet",
            "role_match_method",
            "role_match_score",
        ]
    )

    processed = processed[output_columns]

    excluded = (
        unresolved
        .sort_values(["team", "name"])
        [original_api_columns]
        .copy()
    )

    excluded["exclusion_reason"] = (
        "not_in_official_fantacalcio_list"
    )

    # ------------------------------------------------------------------
    # 9. Scrittura dei soli file elaborati
    # ------------------------------------------------------------------

    PROCESSED_PATH.mkdir(
        parents=True,
        exist_ok=True,
    )

    processed.to_csv(
        MATCHED_OUTPUT_PATH,
        index=False,
        encoding="utf-8-sig",
    )

    excluded.to_csv(
        EXCLUDED_OUTPUT_PATH,
        index=False,
        encoding="utf-8-sig",
    )

    role_differences = processed[
        processed["role_api"].astype(str).str.upper()
        != processed["role_classic"]
    ]

    method_counts = (
        processed["role_match_method"]
        .value_counts()
        .sort_index()
    )

    print("\nGENERAZIONE COMPLETATA")
    print(f"Giocatori API: {len(api_players)}")
    print(
        f"Righe nel listone: "
        f"{len(fantacalcio_players)}"
    )
    print(f"Giocatori abbinati: {len(processed)}")
    print(f"Giocatori esclusi: {len(excluded)}")
    print(
        "Ruoli modificati usando il Classic: "
        f"{len(role_differences)}"
    )

    print("\nMETODI DI ABBINAMENTO")
    print(method_counts.to_string())

    print("\nGIOCATORI ESCLUSI")
    print(
        excluded[
            ["player_id", "name", "team", "role"]
        ].to_string(index=False)
    )

    print("\nFILE GENERATI")
    print(MATCHED_OUTPUT_PATH.relative_to(PROJECT_ROOT))
    print(EXCLUDED_OUTPUT_PATH.relative_to(PROJECT_ROOT))


if __name__ == "__main__":
    main()