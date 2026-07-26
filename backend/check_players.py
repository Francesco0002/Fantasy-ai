# Importiamo Path per gestire i percorsi dei file
# in modo compatibile con Windows, macOS e Linux.
from pathlib import Path

# Pandas viene utilizzato per leggere e analizzare il file CSV.
import pandas as pd


# __file__ rappresenta il percorso del file check_players.py.
# parents[1] permette di risalire dalla cartella backend
# alla cartella principale del progetto fantasy-ai.
PROJECT_ROOT = Path(__file__).resolve().parents[1]

# Costruiamo il percorso completo del file players.csv:
# fantasy-ai/data/players.csv
CSV_PATH = PROJECT_ROOT / "data" / "players.csv"


# Elenco delle colonne considerate obbligatorie.
# Il programma controllerà che siano tutte presenti nel CSV.
REQUIRED_COLUMNS = [
    "player_id",
    "name",
    "team",
    "role",
    "age",
    "minutes_last_season",
    "goals_last_season",
    "assists_last_season",
    "average_rating_last_season",
    "fantasy_average_last_season",
    "injury_risk",
    "starting_probability",
    "growth_potential",
]


def load_players() -> pd.DataFrame:
    """
    Carica il file players.csv e controlla che i dati
    fondamentali siano presenti e validi.

    Restituisce:
        pd.DataFrame: tabella contenente i giocatori.

    Genera un errore quando:
        - il file CSV non esiste;
        - il file è vuoto;
        - mancano colonne obbligatorie;
        - sono presenti ruoli non validi;
        - sono presenti identificativi duplicati.
    """

    # Prima di leggere il CSV controlliamo che il file esista.
    if not CSV_PATH.exists():
        raise FileNotFoundError(
            f"File non trovato: {CSV_PATH}\n"
            "Controlla che players.csv sia nella cartella data."
        )

    # Leggiamo il file CSV e lo trasformiamo in un DataFrame.
    # utf-8-sig evita problemi con caratteri accentati
    # e con eventuali marcatori BOM del file.
    players = pd.read_csv(
        CSV_PATH,
        encoding="utf-8-sig",
    )

    # Controlliamo che il CSV contenga almeno una riga.
    if players.empty:
        raise ValueError(
            "Il file players.csv è vuoto."
        )

    # Creiamo una lista con tutte le colonne obbligatorie
    # che non risultano presenti nel file CSV.
    missing_columns = [
        column
        for column in REQUIRED_COLUMNS
        if column not in players.columns
    ]

    # Se manca almeno una colonna, interrompiamo il programma
    # mostrando l'elenco delle colonne mancanti.
    if missing_columns:
        raise ValueError(
            "Colonne mancanti: "
            + ", ".join(missing_columns)
        )

    # Definiamo i ruoli ammessi nel Fantacalcio Classic:
    # P = Portiere
    # D = Difensore
    # C = Centrocampista
    # A = Attaccante
    valid_roles = {"P", "D", "C", "A"}

    # Recuperiamo i ruoli presenti nel CSV e verifichiamo
    # se qualcuno non appartiene all'insieme dei ruoli validi.
    invalid_roles = (
        set(players["role"].dropna().unique())
        - valid_roles
    )

    # Se sono presenti ruoli non validi, mostriamo un errore.
    if invalid_roles:
        raise ValueError(
            f"Ruoli non validi trovati: {invalid_roles}"
        )

    # player_id deve identificare un solo giocatore.
    # Non possono quindi esistere due righe con lo stesso ID.
    if players["player_id"].duplicated().any():
        raise ValueError(
            "Sono presenti player_id duplicati."
        )

    # Se tutti i controlli sono superati,
    # restituiamo il DataFrame contenente i giocatori.
    return players


def main() -> None:
    """
    Funzione principale del programma.

    Carica il dataset e stampa alcune informazioni
    utili per verificare che tutto funzioni correttamente.
    """

    try:
        # Proviamo a caricare e validare il dataset.
        players = load_players()

    # Intercettiamo gli errori previsti e mostriamo
    # un messaggio comprensibile senza bloccare brutalmente il programma.
    except (
        FileNotFoundError,
        ValueError,
        pd.errors.ParserError,
    ) as error:
        print(f"Errore durante il caricamento:\n{error}")
        return

    # Se il programma arriva qui, il dataset è valido.
    print("Dataset caricato correttamente.")

    # Stampiamo il percorso esatto del CSV letto.
    print(f"Percorso: {CSV_PATH}")

    # len(players) restituisce il numero totale di righe,
    # quindi il numero di giocatori presenti.
    print(f"Numero giocatori: {len(players)}")

    # len(players.columns) restituisce il numero di colonne.
    print(f"Numero colonne: {len(players.columns)}")

    print("\nGiocatori per ruolo:")

    # value_counts conta quanti giocatori appartengono a ogni ruolo.
    # sort_index ordina i ruoli alfabeticamente.
    role_counts = (
        players["role"]
        .value_counts()
        .sort_index()
    )

    # to_string permette di stampare il risultato
    # senza l'intestazione aggiuntiva di Pandas.
    print(role_counts.to_string())

    # Selezioniamo soltanto alcune colonne utili
    # per mostrare un'anteprima leggibile del dataset.
    columns_to_show = [
        "name",
        "team",
        "role",
        "age",
        "fantasy_average_last_season",
        "starting_probability",
        "injury_risk",
    ]

    print("\nPrimi 10 giocatori:")

    # head(10) seleziona le prime dieci righe.
    # index=False evita di mostrare l'indice interno di Pandas.
    print(
        players[columns_to_show]
        .head(10)
        .to_string(index=False)
    )


# Questo controllo fa partire main() soltanto quando
# eseguiamo direttamente il file check_players.py.
#
# Se in futuro importeremo questo file da un altro modulo,
# main() non verrà eseguita automaticamente.
if __name__ == "__main__":
    main()