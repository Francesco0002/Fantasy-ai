# ceil e floor servono per arrotondare rispettivamente
# verso l'alto e verso il basso le fasce di prezzo.
from math import ceil, floor

# Pandas viene utilizzato per gestire le tabelle
# e calcolare i prezzi dei giocatori.
import pandas as pd

# Importiamo la funzione che legge e controlla players.csv.
from check_players import load_players, PROJECT_ROOT

# Importiamo la configurazione della lega.
from check_league_config import load_league_config

# Importiamo il motore che calcola lo score
# proprietario di ogni giocatore.
from valuation import calculate_player_scores


# Percorso del file che conterrà i prezzi d'asta.
OUTPUT_PATH = (
    PROJECT_ROOT
    / "data"
    / "player_prices.csv"
)


# Ordine dei ruoli utilizzato nella visualizzazione.
ROLES = ["P", "D", "C", "A"]


# Nome completo associato a ogni ruolo.
ROLE_NAMES = {
    "P": "PORTIERI",
    "D": "DIFENSORI",
    "C": "CENTROCAMPISTI",
    "A": "ATTACCANTI",
}


def calculate_auction_prices(
    players: pd.DataFrame,
    config: dict,
) -> pd.DataFrame:
    """
    Trasforma lo score proprietario dei giocatori
    in prezzi d'asta espressi in crediti.

    Il prezzo dipende da:

    - score complessivo del giocatore;
    - ruolo;
    - budget della lega;
    - numero di partecipanti;
    - distribuzione del budget per reparto;
    - numero di giocatori richiesti per ruolo;
    - esponente configurato per valorizzare i top player.

    Restituisce:
        pd.DataFrame: tabella con score e prezzi.
    """

    # Calcoliamo innanzitutto gli score dei giocatori.
    priced_players = calculate_player_scores(
        players
    ).copy()

    # Creiamo in anticipo le nuove colonne.
    # Verranno compilate separatamente per ogni ruolo.
    priced_players["base_price"] = 0.0
    priced_players["recommended_min"] = 0
    priced_players["recommended_price"] = 0
    priced_players["recommended_max"] = 0
    priced_players["absolute_max"] = 0
    priced_players["market_coverage"] = 0.0

    # Recuperiamo i principali parametri della lega.
    participants = config["participants"]
    budget_per_team = config["budget_per_team"]
    minimum_bid = config["minimum_bid"]
    score_exponent = config["score_exponent"]

    # Calcoliamo il budget complessivamente disponibile
    # durante l'asta.
    total_league_budget = (
        participants
        * budget_per_team
    )

    # Recuperiamo i moltiplicatori usati
    # per costruire la fascia di prezzo.
    minimum_multiplier = (
        config["price_range"]["minimum_multiplier"]
    )

    maximum_multiplier = (
        config["price_range"]["maximum_multiplier"]
    )

    absolute_max_multiplier = (
        config["price_range"]["absolute_max_multiplier"]
    )

    # Elaboriamo un ruolo alla volta.
    for role in ROLES:

        # Creiamo una maschera booleana che identifica
        # tutti i giocatori appartenenti al ruolo corrente.
        role_mask = (
            priced_players["role"] == role
        )

        # Selezioniamo i giocatori del ruolo.
        role_players = priced_players.loc[
            role_mask
        ].copy()

        # Numero di giocatori disponibili nel dataset.
        available_players = len(role_players)

        # Numero di giocatori che dovrebbero essere acquistati
        # complessivamente nella lega per questo ruolo.
        required_players = (
            participants
            * config["roster_slots"][role]
        )

        # Se non abbiamo giocatori per il ruolo,
        # passiamo direttamente al ruolo successivo.
        if available_players == 0:
            continue

        # Percentuale di copertura del listone.
        #
        # Esempio:
        # se servono 24 portieri ma ne abbiamo 12,
        # la copertura sarà pari al 50%.
        coverage_ratio = min(
            available_players / required_players,
            1.0,
        )

        # Budget complessivo teoricamente destinato
        # a questo reparto.
        role_budget = (
            total_league_budget
            * config["budget_distribution"][role]
        )

        # Una parte del budget deve essere sempre riservata
        # all'offerta minima per ogni posto disponibile.
        minimum_reserved_budget = (
            required_players
            * minimum_bid
        )

        # Il budget premium è la parte da distribuire
        # in base alla qualità dei giocatori.
        premium_budget = max(
            role_budget - minimum_reserved_budget,
            0,
        )

        # Poiché il dataset dimostrativo non contiene ancora
        # tutti i giocatori necessari, riduciamo il budget
        # distribuito in proporzione alla copertura del listone.
        effective_premium_budget = (
            premium_budget
            * coverage_ratio
        )

        # Convertiamo lo score in un peso.
        #
        # Elevando lo score a un esponente maggiore di 1,
        # i top player ricevono un peso molto maggiore
        # rispetto ai giocatori medi.
        score_weights = (
            role_players["overall_score"]
            .clip(lower=1)
            .div(100)
            .pow(score_exponent)
        )

        # Somma di tutti i pesi del ruolo.
        total_weight = score_weights.sum()

        # Se per qualche motivo tutti i pesi fossero nulli,
        # assegniamo lo stesso peso a ogni giocatore.
        if total_weight <= 0:
            score_weights = pd.Series(
                1.0,
                index=role_players.index,
            )

            total_weight = score_weights.sum()

        # Distribuiamo il budget premium proporzionalmente
        # al peso di ogni giocatore.
        player_premium = (
            effective_premium_budget
            * score_weights
            / total_weight
        )

        # Il prezzo base è formato da:
        #
        # offerta minima + quota premium.
        base_prices = (
            minimum_bid
            + player_premium
        )

        # Calcoliamo il tetto massimo previsto
        # per un singolo giocatore di questo ruolo.
        role_price_cap = (
            budget_per_team
            * config["role_price_caps"][role]
        )

        # Il prezzo consigliato viene arrotondato
        # e limitato dal tetto massimo del ruolo.
        recommended_prices = (
            base_prices
            .round()
            .clip(
                lower=minimum_bid,
                upper=role_price_cap,
            )
            .astype(int)
        )

        # Salviamo i valori nel DataFrame principale.
        priced_players.loc[
            role_mask,
            "base_price",
        ] = base_prices.round(2)

        priced_players.loc[
            role_mask,
            "recommended_price",
        ] = recommended_prices

        # Il prezzo minimo rappresenta un buon affare.
        priced_players.loc[
            role_mask,
            "recommended_min",
        ] = recommended_prices.apply(
            lambda price: max(
                minimum_bid,
                floor(price * minimum_multiplier),
            )
        )

        # Il prezzo massimo rappresenta il limite
        # superiore della fascia consigliata.
        priced_players.loc[
            role_mask,
            "recommended_max",
        ] = recommended_prices.apply(
            lambda price: min(
                ceil(price * maximum_multiplier),
                ceil(role_price_cap),
            )
        )

        # L'absolute_max è il prezzo oltre il quale
        # normalmente non conviene continuare a rilanciare.
        priced_players.loc[
            role_mask,
            "absolute_max",
        ] = recommended_prices.apply(
            lambda price: min(
                ceil(price * absolute_max_multiplier),
                ceil(role_price_cap),
            )
        )

        # Salviamo anche la percentuale di completezza
        # del listone per rendere trasparente la stima.
        priced_players.loc[
            role_mask,
            "market_coverage",
        ] = round(
            coverage_ratio * 100,
            2,
        )

    # Convertiamo le colonne dei prezzi in numeri interi.
    integer_price_columns = [
        "recommended_min",
        "recommended_price",
        "recommended_max",
        "absolute_max",
    ]

    priced_players[integer_price_columns] = (
        priced_players[integer_price_columns]
        .astype(int)
    )

    # Creiamo una classifica dei prezzi
    # separata per ogni ruolo.
    priced_players["price_rank"] = (
        priced_players
        .groupby("role")["recommended_price"]
        .rank(
            method="min",
            ascending=False,
        )
        .astype(int)
    )

    return priced_players


def print_market_coverage(
    players: pd.DataFrame,
    config: dict,
) -> None:
    """
    Mostra quanti giocatori sono presenti nel dataset
    rispetto a quelli richiesti dalla configurazione.
    """

    print("\nCOPERTURA DEL LISTONE")

    for role in ROLES:

        # Numero di giocatori presenti nel CSV.
        available = len(
            players[
                players["role"] == role
            ]
        )

        # Numero di giocatori necessari
        # per completare tutte le rose.
        required = (
            config["participants"]
            * config["roster_slots"][role]
        )

        coverage = (
            available / required * 100
        )

        print(
            f"{role}: {available} disponibili, "
            f"{required} necessari "
            f"({coverage:.1f}%)"
        )

        # Mostriamo un avviso quando il listone
        # non contiene abbastanza giocatori.
        if available < required:
            print(
                f"   Attenzione: mancano "
                f"{required - available} giocatori."
            )


def print_top_prices(
    priced_players: pd.DataFrame,
) -> None:
    """
    Mostra i cinque giocatori con il prezzo
    più alto per ciascun ruolo.
    """

    columns_to_show = [
        "price_rank",
        "name",
        "team",
        "overall_score",
        "recommended_min",
        "recommended_price",
        "recommended_max",
        "absolute_max",
    ]

    for role in ROLES:

        print(
            f"\nTOP 5 PREZZI {ROLE_NAMES[role]}"
        )

        # Selezioniamo i cinque giocatori
        # più costosi del ruolo.
        top_players = (
            priced_players[
                priced_players["role"] == role
            ]
            .sort_values(
                by=[
                    "recommended_price",
                    "overall_score",
                ],
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
    Funzione principale del programma.

    Carica:
    - giocatori;
    - configurazione della lega.

    Successivamente calcola e salva
    i prezzi consigliati.
    """

    try:
        # Carichiamo il dataset dei giocatori.
        players = load_players()

        # Carichiamo la configurazione della lega.
        config = load_league_config()

        # Calcoliamo i prezzi d'asta.
        priced_players = calculate_auction_prices(
            players,
            config,
        )

        # Salviamo i risultati nel nuovo file CSV.
        priced_players.to_csv(
            OUTPUT_PATH,
            index=False,
            encoding="utf-8-sig",
        )

    except (
        FileNotFoundError,
        ValueError,
        KeyError,
        TypeError,
        pd.errors.ParserError,
    ) as error:
        print(
            "Errore durante il calcolo dei prezzi:\n"
            f"{error}"
        )
        return

    print("Prezzi calcolati correttamente.")
    print(
        f"Giocatori elaborati: "
        f"{len(priced_players)}"
    )
    print(f"File creato: {OUTPUT_PATH}")

    # Mostriamo quanto è completo il dataset.
    print_market_coverage(
        players,
        config,
    )

    # Mostriamo i prezzi più alti
    # per ciascun ruolo.
    print_top_prices(
        priced_players
    )


# Il programma parte solamente quando
# pricing.py viene eseguito direttamente.
if __name__ == "__main__":
    main()