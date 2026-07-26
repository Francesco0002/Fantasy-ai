# Pandas viene utilizzato per eseguire calcoli
# sulle colonne del dataset dei giocatori.
import pandas as pd

# Importiamo la funzione già creata in check_players.py.
# In questo modo non dobbiamo riscrivere la logica
# per caricare e validare il file CSV.
from check_players import load_players, PROJECT_ROOT


# Percorso del nuovo file che conterrà
# le valutazioni calcolate dal nostro algoritmo.
OUTPUT_PATH = (
    PROJECT_ROOT
    / "data"
    / "player_valuations.csv"
)


# Pesi utilizzati per calcolare lo score finale.
#
# La somma deve essere uguale a 1.
# In questa prima versione:
# - il rendimento pesa il 30%;
# - la titolarità pesa il 25%;
# - i bonus pesano il 20%;
# - l'affidabilità pesa il 15%;
# - il potenziale pesa il 10%.
SCORE_WEIGHTS = {
    "performance": 0.30,
    "starting": 0.25,
    "bonus": 0.20,
    "reliability": 0.15,
    "potential": 0.10,
}


def normalize_series(series: pd.Series) -> pd.Series:
    """
    Normalizza una serie numerica in un intervallo da 0 a 100.

    Il valore minimo della serie riceve punteggio 0.
    Il valore massimo riceve punteggio 100.
    Tutti gli altri valori vengono distribuiti
    proporzionalmente tra 0 e 100.
    """

    minimum = series.min()
    maximum = series.max()

    # Se tutti i valori sono uguali, non è possibile
    # distinguerli con la normalizzazione.
    # In questo caso assegniamo a tutti un valore neutro di 50.
    if maximum == minimum:
        return pd.Series(
            50.0,
            index=series.index,
        )

    normalized = (
        (series - minimum)
        / (maximum - minimum)
        * 100
    )

    return normalized


def normalize_by_role(
    players: pd.DataFrame,
    column: str,
) -> pd.Series:
    """
    Normalizza una colonna separatamente per ogni ruolo.

    Questo è importante perché portieri, difensori,
    centrocampisti e attaccanti hanno statistiche diverse.

    Per esempio, non avrebbe senso confrontare direttamente
    i gol di un portiere con quelli di un attaccante.
    """

    return (
        players
        .groupby("role")[column]
        .transform(normalize_series)
    )


def calculate_bonus_raw(player: pd.Series) -> float:
    """
    Calcola un valore grezzo relativo al potenziale bonus.

    La formula cambia in base al ruolo del giocatore.

    I coefficienti sono provvisori e serviranno
    per costruire il primo prototipo del modello.
    """

    role = player["role"]

    goals = player["goals_last_season"]
    assists = player["assists_last_season"]
    penalties = player["penalties_scored_last_season"]
    clean_sheets = player["clean_sheets_last_season"]
    goals_conceded = player["goals_conceded_last_season"]
    saves = player["saves_last_season"]
    set_piece_level = player["set_piece_level"]

    # Per i portieri consideriamo soprattutto:
    # clean sheet, parate e gol subiti.
    if role == "P":
        return (
            clean_sheets * 3
            + saves * 0.05
            - goals_conceded * 0.15
        )

    # Per i difensori consideriamo:
    # gol, assist, clean sheet e capacità sui piazzati.
    if role == "D":
        return (
            goals * 3
            + assists * 1.5
            + clean_sheets * 0.4
            + set_piece_level * 1.5
        )

    # Per centrocampisti e attaccanti consideriamo:
    # gol, assist, rigori e partecipazione ai calci piazzati.
    return (
        goals * 3
        + assists * 1.5
        + penalties * 1.5
        + set_piece_level * 2
    )


def calculate_player_scores(
    players: pd.DataFrame,
) -> pd.DataFrame:
    """
    Calcola tutte le componenti dello score proprietario
    e restituisce una nuova tabella con i risultati.
    """

    # Creiamo una copia del DataFrame.
    # In questo modo non modifichiamo direttamente
    # i dati originali caricati dal CSV.
    scored_players = players.copy()

    # --------------------------------------------------
    # 1. COMPONENTE RENDIMENTO
    # --------------------------------------------------

    # Il rendimento grezzo combina:
    # - media voto tradizionale;
    # - fantamedia, che tiene conto di gol, assist
    #   e altri bonus o malus.
    #
    # La fantamedia riceve un peso maggiore
    # perché è più importante nel Fantacalcio.
    scored_players["performance_raw"] = (
        scored_players["average_rating_last_season"] * 0.35
        + scored_players["fantasy_average_last_season"] * 0.65
    )

    # Normalizziamo il rendimento separatamente per ruolo.
    scored_players["performance_score"] = normalize_by_role(
        scored_players,
        "performance_raw",
    )

    # --------------------------------------------------
    # 2. COMPONENTE TITOLARITÀ
    # --------------------------------------------------

    # starting_probability è già compresa tra 0 e 1.
    # Moltiplicandola per 100 otteniamo un punteggio
    # compreso tra 0 e 100.
    scored_players["starting_score"] = (
        scored_players["starting_probability"]
        .clip(lower=0, upper=1)
        * 100
    )

    # --------------------------------------------------
    # 3. COMPONENTE BONUS
    # --------------------------------------------------

    # apply esegue calculate_bonus_raw su ogni giocatore.
    scored_players["bonus_raw"] = scored_players.apply(
        calculate_bonus_raw,
        axis=1,
    )

    # Anche i bonus vengono confrontati
    # soltanto tra giocatori dello stesso ruolo.
    scored_players["bonus_score"] = normalize_by_role(
        scored_players,
        "bonus_raw",
    )

    # --------------------------------------------------
    # 4. COMPONENTE AFFIDABILITÀ
    # --------------------------------------------------

    # Calcoliamo la percentuale di minuti disputati
    # rispetto al massimo teorico di 3420 minuti:
    # 38 partite per 90 minuti.
    minutes_score = (
        scored_players["minutes_last_season"]
        / 3420
        * 100
    ).clip(lower=0, upper=100)

    # Calcoliamo il rapporto tra partite iniziate
    # da titolare e presenze complessive.
    #
    # replace evita eventuali divisioni per zero.
    appearances = (
        scored_players["appearances_last_season"]
        .replace(0, pd.NA)
    )

    starts_score = (
        scored_players["starts_last_season"]
        / appearances
        * 100
    ).fillna(0).clip(lower=0, upper=100)

    # Un injury_risk pari a 0 indica rischio minimo.
    # Un valore pari a 1 indicherebbe rischio massimo.
    #
    # Convertiamo quindi il rischio in affidabilità.
    health_score = (
        1
        - scored_players["injury_risk"]
        .clip(lower=0, upper=1)
    ) * 100

    # L'affidabilità finale combina:
    # - minuti disputati;
    # - frequenza da titolare;
    # - rischio fisico.
    scored_players["reliability_score"] = (
        minutes_score * 0.45
        + starts_score * 0.25
        + health_score * 0.30
    )

    # --------------------------------------------------
    # 5. COMPONENTE POTENZIALE
    # --------------------------------------------------

    # growth_potential è già espresso da 0 a 100.
    # clip garantisce che eventuali valori errati
    # non superino i limiti previsti.
    scored_players["potential_score"] = (
        scored_players["growth_potential"]
        .clip(lower=0, upper=100)
    )

    # --------------------------------------------------
    # 6. SCORE FINALE
    # --------------------------------------------------

    # Combiniamo le cinque componenti utilizzando
    # i pesi definiti all'inizio del file.
    scored_players["overall_score"] = (
        scored_players["performance_score"]
        * SCORE_WEIGHTS["performance"]
        + scored_players["starting_score"]
        * SCORE_WEIGHTS["starting"]
        + scored_players["bonus_score"]
        * SCORE_WEIGHTS["bonus"]
        + scored_players["reliability_score"]
        * SCORE_WEIGHTS["reliability"]
        + scored_players["potential_score"]
        * SCORE_WEIGHTS["potential"]
    )

    # Arrotondiamo i punteggi per rendere
    # i risultati più leggibili.
    score_columns = [
        "performance_score",
        "starting_score",
        "bonus_score",
        "reliability_score",
        "potential_score",
        "overall_score",
    ]

    scored_players[score_columns] = (
        scored_players[score_columns]
        .round(2)
    )

    # Calcoliamo la posizione del giocatore
    # nella classifica generale.
    #
    # ascending=False significa che il valore
    # più alto occupa la prima posizione.
    scored_players["overall_rank"] = (
        scored_players["overall_score"]
        .rank(
            method="min",
            ascending=False,
        )
        .astype(int)
    )

    # Calcoliamo anche la posizione interna al ruolo.
    scored_players["role_rank"] = (
        scored_players
        .groupby("role")["overall_score"]
        .rank(
            method="min",
            ascending=False,
        )
        .astype(int)
    )

    return scored_players


def print_top_players(
    scored_players: pd.DataFrame,
) -> None:
    """
    Stampa i cinque giocatori migliori
    per ciascun ruolo.
    """

    role_names = {
        "P": "PORTIERI",
        "D": "DIFENSORI",
        "C": "CENTROCAMPISTI",
        "A": "ATTACCANTI",
    }

    # Ordine in cui vogliamo mostrare i ruoli.
    roles = ["P", "D", "C", "A"]

    # Colonne da mostrare nel terminale.
    columns_to_show = [
        "role_rank",
        "name",
        "team",
        "overall_score",
        "performance_score",
        "starting_score",
        "bonus_score",
        "reliability_score",
        "potential_score",
    ]

    for role in roles:
        print(f"\nTOP 5 {role_names[role]}")

        # Selezioniamo i giocatori appartenenti al ruolo,
        # li ordiniamo per score e prendiamo i primi cinque.
        top_players = (
            scored_players[
                scored_players["role"] == role
            ]
            .sort_values(
                by="overall_score",
                ascending=False,
            )
            .head(5)
        )

        print(
            top_players[columns_to_show]
            .to_string(index=False)
        )


def main() -> None:
    """
    Funzione principale del programma di valutazione.
    """

    try:
        # Carichiamo e validiamo i giocatori
        # attraverso la funzione già testata.
        players = load_players()

        # Calcoliamo gli score proprietari.
        scored_players = calculate_player_scores(
            players
        )

        # Salviamo il nuovo dataset nella cartella data.
        #
        # index=False impedisce a Pandas di aggiungere
        # una colonna numerica non necessaria.
        scored_players.to_csv(
            OUTPUT_PATH,
            index=False,
            encoding="utf-8-sig",
        )

    except (
        FileNotFoundError,
        ValueError,
        KeyError,
        pd.errors.ParserError,
    ) as error:
        print(
            "Errore durante il calcolo "
            f"delle valutazioni:\n{error}"
        )
        return

    print("Valutazioni calcolate correttamente.")
    print(f"Giocatori valutati: {len(scored_players)}")
    print(f"File creato: {OUTPUT_PATH}")

    # Mostriamo nel terminale i giocatori
    # con lo score più alto per ciascun ruolo.
    print_top_players(scored_players)


# Avvia il programma soltanto quando
# valuation.py viene eseguito direttamente.
if __name__ == "__main__":
    main()