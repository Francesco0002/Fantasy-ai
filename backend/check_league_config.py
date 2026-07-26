# Importiamo json per leggere il file league_config.json.
import json

# Path permette di costruire percorsi compatibili
# con Windows, macOS e Linux.
from pathlib import Path

# isclose viene utilizzata per verificare che la somma
# delle percentuali sia sufficientemente vicina a 1.
from math import isclose


# Individuiamo la cartella principale fantasy-ai.
PROJECT_ROOT = Path(__file__).resolve().parents[1]

# Costruiamo il percorso completo del file di configurazione.
CONFIG_PATH = (
    PROJECT_ROOT
    / "config"
    / "league_config.json"
)

# Ruoli ammessi nella modalità Classic.
VALID_ROLES = {"P", "D", "C", "A"}


def load_league_config() -> dict:
    """
    Carica e valida la configurazione della lega.

    Restituisce:
        dict: configurazione della lega.

    Genera un errore quando:
        - il file non esiste;
        - il JSON non è valido;
        - mancano campi obbligatori;
        - sono presenti valori non accettabili.
    """

    # Verifichiamo che il file esista.
    if not CONFIG_PATH.exists():
        raise FileNotFoundError(
            f"Configurazione non trovata: {CONFIG_PATH}"
        )

    # Apriamo il file in modalità lettura.
    # L'encoding UTF-8 permette di usare anche caratteri accentati.
    with CONFIG_PATH.open(
        mode="r",
        encoding="utf-8",
    ) as config_file:
        config = json.load(config_file)

    # Elenco dei campi principali obbligatori.
    required_fields = {
        "league_name",
        "participants",
        "budget_per_team",
        "minimum_bid",
        "mode",
        "roster_slots",
        "budget_distribution",
        "role_price_caps",
        "score_exponent",
        "price_range",
    }

    # Individuiamo eventuali campi mancanti.
    missing_fields = (
        required_fields
        - set(config.keys())
    )

    if missing_fields:
        raise ValueError(
            "Campi mancanti nella configurazione: "
            + ", ".join(sorted(missing_fields))
        )

    # Il numero di partecipanti deve essere almeno 2.
    if config["participants"] < 2:
        raise ValueError(
            "La lega deve avere almeno 2 partecipanti."
        )

    # Il budget deve essere un numero positivo.
    if config["budget_per_team"] <= 0:
        raise ValueError(
            "Il budget per squadra deve essere positivo."
        )

    # L'offerta minima deve essere almeno pari a 1.
    if config["minimum_bid"] < 1:
        raise ValueError(
            "L'offerta minima deve essere almeno 1."
        )

    # In questa fase supportiamo solamente
    # la modalità Fantacalcio Classic.
    if config["mode"] != "classic":
        raise ValueError(
            "Per ora è supportata soltanto "
            "la modalità 'classic'."
        )

    # Verifichiamo che roster_slots contenga
    # esattamente i quattro ruoli previsti.
    roster_roles = set(
        config["roster_slots"].keys()
    )

    if roster_roles != VALID_ROLES:
        raise ValueError(
            "roster_slots deve contenere "
            "esattamente i ruoli P, D, C e A."
        )

    # Ogni squadra deve acquistare almeno
    # un giocatore per ciascun ruolo.
    for role, slots in config["roster_slots"].items():
        if not isinstance(slots, int) or slots <= 0:
            raise ValueError(
                f"Numero di posti non valido per il ruolo {role}."
            )

    # Controlliamo che la distribuzione del budget
    # contenga tutti i ruoli.
    budget_roles = set(
        config["budget_distribution"].keys()
    )

    if budget_roles != VALID_ROLES:
        raise ValueError(
            "budget_distribution deve contenere "
            "esattamente i ruoli P, D, C e A."
        )

    # Recuperiamo tutte le percentuali di budget.
    budget_percentages = list(
        config["budget_distribution"].values()
    )

    # Ogni percentuale deve essere compresa tra 0 e 1.
    for percentage in budget_percentages:
        if not 0 <= percentage <= 1:
            raise ValueError(
                "Le percentuali di budget devono "
                "essere comprese tra 0 e 1."
            )

    # La somma delle percentuali deve essere pari a 1,
    # cioè al 100% del budget.
    if not isclose(
        sum(budget_percentages),
        1.0,
        abs_tol=0.0001,
    ):
        raise ValueError(
            "La somma di budget_distribution "
            "deve essere uguale a 1."
        )

    # Controlliamo i limiti massimi di prezzo per ruolo.
    price_cap_roles = set(
        config["role_price_caps"].keys()
    )

    if price_cap_roles != VALID_ROLES:
        raise ValueError(
            "role_price_caps deve contenere "
            "esattamente i ruoli P, D, C e A."
        )

    for role, percentage in (
        config["role_price_caps"].items()
    ):
        if not 0 < percentage <= 1:
            raise ValueError(
                f"Limite di prezzo non valido "
                f"per il ruolo {role}."
            )

    # L'esponente deve essere maggiore di 1.
    # Un valore superiore a 1 aumenta la distanza
    # tra i giocatori migliori e quelli medi.
    if config["score_exponent"] <= 1:
        raise ValueError(
            "score_exponent deve essere maggiore di 1."
        )

    # Recuperiamo i moltiplicatori usati
    # per generare la fascia di prezzo.
    price_range = config["price_range"]

    required_price_fields = {
        "minimum_multiplier",
        "maximum_multiplier",
        "absolute_max_multiplier",
    }

    missing_price_fields = (
        required_price_fields
        - set(price_range.keys())
    )

    if missing_price_fields:
        raise ValueError(
            "Campi mancanti in price_range: "
            + ", ".join(sorted(missing_price_fields))
        )

    minimum_multiplier = (
        price_range["minimum_multiplier"]
    )

    maximum_multiplier = (
        price_range["maximum_multiplier"]
    )

    absolute_max_multiplier = (
        price_range["absolute_max_multiplier"]
    )

    # Verifichiamo che i tre moltiplicatori
    # siano ordinati correttamente.
    if not (
        0 < minimum_multiplier
        <= 1
        <= maximum_multiplier
        <= absolute_max_multiplier
    ):
        raise ValueError(
            "I moltiplicatori di price_range "
            "non sono ordinati correttamente."
        )

    # Se tutti i controlli sono superati,
    # restituiamo la configurazione.
    return config


def main() -> None:
    """
    Carica la configurazione e mostra
    un riepilogo nel terminale.
    """

    try:
        config = load_league_config()

    except (
        FileNotFoundError,
        ValueError,
        json.JSONDecodeError,
    ) as error:
        print(
            "Errore nella configurazione:\n"
            f"{error}"
        )
        return

    # Calcoliamo il budget totale presente nella lega.
    total_market_budget = (
        config["participants"]
        * config["budget_per_team"]
    )

    # Calcoliamo il numero di giocatori
    # che ogni squadra dovrà acquistare.
    players_per_team = sum(
        config["roster_slots"].values()
    )

    # Calcoliamo il numero complessivo di acquisti
    # che dovrebbero avvenire durante l'asta.
    total_players_needed = (
        players_per_team
        * config["participants"]
    )

    print("Configurazione valida.")
    print(f"Lega: {config['league_name']}")
    print(f"Modalità: {config['mode']}")
    print(
        f"Partecipanti: {config['participants']}"
    )
    print(
        "Budget per squadra: "
        f"{config['budget_per_team']} crediti"
    )
    print(
        "Budget complessivo della lega: "
        f"{total_market_budget} crediti"
    )
    print(
        "Giocatori per squadra: "
        f"{players_per_team}"
    )
    print(
        "Giocatori totali necessari: "
        f"{total_players_needed}"
    )

    print("\nDistribuzione consigliata del budget:")

    for role, percentage in (
        config["budget_distribution"].items()
    ):
        role_budget = round(
            config["budget_per_team"]
            * percentage
        )

        print(
            f"{role}: {percentage * 100:.0f}% "
            f"({role_budget} crediti)"
        )


# Avviamo il programma solamente quando
# il file viene eseguito direttamente.
if __name__ == "__main__":
    main()