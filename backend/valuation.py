import math

# Pandas viene utilizzato per eseguire calcoli
# sulle colonne del dataset dei giocatori.
import pandas as pd

# Importiamo la funzione già creata in check_players.py.
# In questo modo non dobbiamo riscrivere la logica
# per caricare e validare il file CSV.
from backend.check_players import (
    PROJECT_ROOT,
    load_players,
)


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
# - il rendimento pesa il 35%;
# - la titolarità pesa il 25%;
# - bonus e malus pesano il 30%;
# - l'affidabilità fisica pesa il 10%.
SCORE_WEIGHTS = {
    "performance": 0.35,
    "starting": 0.25,
    "bonus": 0.30,
    "reliability": 0.10,
}


#
# Numero di partite utilizzato per correggere
# le medie voto ottenute su campioni ridotti.
#
# Con 20 partite la media registrata dal
# giocatore e la media del suo ruolo hanno
# lo stesso peso.
#
# In questo modo voti molto alti ottenuti in
# poche presenze non producono immediatamente
# un Rendimento da top di ruolo.
#
RATING_SHRINKAGE_MATCHES = 20


#
# Numero di minuti utilizzato per ridurre
# l'impatto di produzioni molto elevate
# ottenute su campioni ridotti.
#
# 900 minuti corrispondono a circa
# dieci partite complete.
#
BONUS_SHRINKAGE_MINUTES = 900


def calculate_standardized_score(
    z_scores: pd.Series,
) -> pd.Series:
    """
    Converte una distanza standardizzata dalla media
    del ruolo in un punteggio compreso tra 0 e 100.

    Il valore 50 rappresenta la media del ruolo.
    Valori superiori a 50 indicano prestazioni
    superiori alla media, mentre valori inferiori
    indicano prestazioni sotto la media.
    """

    return z_scores.apply(
        lambda value: (
            0.5
            * (
                1
                + math.erf(
                    value / math.sqrt(2)
                )
            )
            * 100
        )
    )


def calculate_percentile_score(
    series: pd.Series,
) -> pd.Series:
    """
    Converte i valori osservati in un percentile
    compreso tra 0 e 100.

    Il confronto viene eseguito separatamente
    per ciascun ruolo.

    I valori uguali ricevono la posizione media.
    """

    if len(series) <= 1:
        return pd.Series(
            50.0,
            index=series.index,
        )

    ranks = series.rank(
        method="average",
        ascending=True,
    )

    return (
        (ranks - 1)
        / (len(series) - 1)
        * 100
    )


def calculate_bonus_raw(
    player: pd.Series,
) -> float:
    """
    Calcola i fantapunti storici prodotti
    dagli eventi registrati nella stagione.

    Gol e assist generano bonus.

    Rigori sbagliati e provvedimenti
    disciplinari generano malus.

    Per i portieri vengono considerati anche
    clean sheet, rigori parati e gol subiti.
    """

    event_points = (
        player["goals_last_season"] * 3
        + player["assists_last_season"]
        - player[
            "penalties_missed_last_season"
        ] * 3
        - player[
            "yellow_cards_last_season"
        ] * 0.5
        - player[
            "red_cards_last_season"
        ]
    )

    #
    # I rigori segnati sono già inclusi
    # nel totale dei gol e non devono quindi
    # ricevere un secondo premio.
    #
    if player["role"] == "P":
        event_points += (
            player[
                "clean_sheets_last_season"
            ]
            + player[
                "penalties_saved_last_season"
            ] * 3
            - player[
                "goals_conceded_last_season"
            ]
        )

    return float(event_points)


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
    #
    # Il Rendimento misura la qualità media delle
    # prestazioni, separatamente dalla produzione
    # di bonus fantacalcistici.
    #
    # Utilizziamo quindi la media voto tradizionale
    # e non la fantamedia, evitando di conteggiare
    # gol e assist sia qui sia nella componente Bonus.
    #
    valid_rating_mask = (
        scored_players["rating_matches"] > 0
    )

    #
    # I giocatori senza alcun voto hanno valore 0
    # nel CSV, ma quello zero significa "dato assente"
    # e non una prestazione realmente insufficiente.
    #
    # Li escludiamo quindi dal calcolo delle medie.
    #
    valid_average_ratings = (
        scored_players[
            "average_rating_last_season"
        ].where(valid_rating_mask)
    )

    global_rating_average = (
        valid_average_ratings.mean()
    )

    global_rating_std = (
        valid_average_ratings.std()
    )

    role_rating_average = (
        valid_average_ratings
        .groupby(scored_players["role"])
        .transform("mean")
        .fillna(global_rating_average)
    )

    role_rating_std = (
        valid_average_ratings
        .groupby(scored_players["role"])
        .transform("std")
        .fillna(global_rating_std)
        .replace(0, global_rating_std)
    )

    #
    # La confidenza aumenta con il numero di partite
    # per cui possediamo un voto.
    #
    # Con 20 partite la media del giocatore e quella
    # del ruolo hanno lo stesso peso.
    #
    # Con molte partite prevale progressivamente
    # la media realmente registrata dal giocatore.
    #
    performance_confidence = (
        scored_players["rating_matches"]
        / (
            scored_players["rating_matches"]
            + RATING_SHRINKAGE_MATCHES
        )
    )

    #
    # Correggiamo la media voto verso la media
    # del ruolo quando il campione è ridotto.
    #
    scored_players["performance_raw"] = (
        role_rating_average
        + performance_confidence
        * (
            scored_players[
                "average_rating_last_season"
            ]
            - role_rating_average
        )
    )

    #
    # Chi non possiede alcun voto riceve come valore
    # corretto la media del proprio ruolo.
    #
    scored_players.loc[
        ~valid_rating_mask,
        "performance_raw",
    ] = role_rating_average[
        ~valid_rating_mask
    ]

    #
    # Misuriamo quanto il valore corretto del giocatore
    # si discosta dalla media del proprio ruolo.
    #
    # La distanza viene espressa utilizzando la
    # deviazione standard dei voti del ruolo.
    #
    performance_z_score = (
        (
            scored_players["performance_raw"]
            - role_rating_average
        )
        / role_rating_std
    )

    #
    # Convertiamo la distanza dalla media in un valore
    # compreso tra 0 e 100.
    #
    # Il valore 50 rappresenta la media del ruolo.
    # Valori superiori indicano un rendimento migliore,
    # mentre valori inferiori indicano un rendimento
    # peggiore rispetto alla media.
    #
    scored_players["performance_score"] = (
        calculate_standardized_score(
            performance_z_score
        )
        .clip(0, 100)
    )

    #
    # I giocatori senza alcun voto ricevono il valore
    # neutro 50.
    #
    scored_players.loc[
        ~valid_rating_mask,
        "performance_score",
    ] = 50.0

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
    #
    # Calcoliamo i fantapunti storici prodotti
    # da bonus e malus durante la stagione.
    #
    scored_players["bonus_raw"] = (
        scored_players.apply(
            calculate_bonus_raw,
            axis=1,
        )
    )

    bonus_minutes = (
        scored_players["minutes_last_season"]
    )

    valid_bonus_mask = (
        bonus_minutes > 0
    )

    #
    # Portiamo la produzione a 90 minuti
    # per confrontare giocatori che hanno avuto
    # un minutaggio differente.
    #
    scored_players["bonus_per_90"] = (
        scored_players["bonus_raw"]
        / bonus_minutes.replace(0, pd.NA)
        * 90
    )

    #
    # Calcoliamo la posizione percentuale
    # rispetto ai giocatori dello stesso ruolo.
    #
    scored_players["bonus_percentile"] = 50.0

    valid_bonus_players = scored_players.loc[
        valid_bonus_mask,
        [
            "role",
            "bonus_per_90",
        ],
    ]

    scored_players.loc[
        valid_bonus_mask,
        "bonus_percentile",
    ] = (
        valid_bonus_players
        .groupby("role")["bonus_per_90"]
        .transform(
            calculate_percentile_score
        )
    )

    #
    # La confidenza cresce con i minuti disputati.
    #
    # Con pochi minuti il punteggio viene avvicinato
    # al valore neutro 50, evitando che brevi exploit
    # producano immediatamente uno score da top.
    #
    bonus_confidence = (
        bonus_minutes
        / (
            bonus_minutes
            + BONUS_SHRINKAGE_MINUTES
        )
    )

    scored_players["bonus_score"] = (
        50
        + bonus_confidence
        * (
            scored_players["bonus_percentile"]
            - 50
        )
    ).clip(
        lower=0,
        upper=100,
    )

    #
    # Chi non ha disputato alcun minuto
    # riceve il valore neutro 50.
    #
    scored_players.loc[
        ~valid_bonus_mask,
        "bonus_score",
    ] = 50.0

    # --------------------------------------------------
    # 4. COMPONENTE AFFIDABILITÀ FISICA
    # --------------------------------------------------
    #
    # L'Affidabilità misura esclusivamente il profilo
    # fisico del giocatore e non la sua continuità
    # di impiego, già considerata nella Titolarità.
    #
    # In assenza di dati reali sugli infortuni
    # assegniamo il valore neutro 50.
    #
    scored_players["reliability_score"] = 50.0

    injury_risk_available = (
        scored_players["injury_risk_available"]
        .eq(True)
    )

    #
    # injury_risk è compreso tra 0 e 1:
    #
    # - 0 indica rischio minimo;
    # - 1 indica rischio massimo.
    #
    # Lo convertiamo in Affidabilità fisica:
    #
    # - 100 indica elevata affidabilità;
    # - 0 indica rischio molto elevato.
    #
    physical_reliability_score = (
        1
        - scored_players["injury_risk"]
        .clip(
            lower=0,
            upper=1,
        )
    ) * 100

    #
    # Utilizziamo il punteggio fisico soltanto
    # per i giocatori per cui il dato è realmente
    # disponibile.
    #
    scored_players.loc[
        injury_risk_available,
        "reliability_score",
    ] = physical_reliability_score[
        injury_risk_available
    ]


    # --------------------------------------------------
    # 5. SCORE FINALE
    # --------------------------------------------------

    # Combiniamo le quattro componenti utilizzando
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
    )

    # Arrotondiamo i punteggi per rendere
    # i risultati più leggibili.
    score_columns = [
        "performance_score",
        "starting_score",
        "bonus_score",
        "reliability_score",
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