# Importiamo json per convertire correttamente
# il DataFrame Pandas in una risposta JSON.
import json

# Path permette di costruire il percorso
# del file player_prices.csv.
from pathlib import Path

# Literal limita il parametro role
# ai quattro ruoli validi.
from typing import Literal

# Pandas viene utilizzato per leggere
# il CSV contenente prezzi e valutazioni.
import pandas as pd

# FastAPI crea l'applicazione web.
#
# HTTPException permette di restituire errori HTTP,
# ad esempio quando un giocatore non viene trovato.
#
# Query permette di controllare e documentare
# i parametri inseriti nell'indirizzo.
from fastapi import FastAPI, HTTPException, Query

# CORSMiddleware permette al frontend Next.js
# di effettuare richieste HTTP verso FastAPI.
from fastapi.middleware.cors import CORSMiddleware

# Risaliamo dalla cartella backend
# alla cartella principale fantasy-ai.
PROJECT_ROOT = Path(__file__).resolve().parents[1]

# Percorso completo del file contenente
# i prezzi calcolati da pricing.py.
PRICES_PATH = (
    PROJECT_ROOT
    / "data"
    / "player_prices.csv"
)


# Creiamo l'applicazione FastAPI.
#
# Queste informazioni verranno mostrate
# anche nella documentazione automatica.
app = FastAPI(
    title="Fantasy AI API",
    description=(
        "API per consultare giocatori, "
        "valutazioni proprietarie e prezzi d'asta."
    ),
    version="0.1.0",
)

# Elenco degli indirizzi autorizzati
# a comunicare con il backend durante lo sviluppo locale.
#
# Inseriamo sia localhost sia 127.0.0.1 perché,
# pur indicando lo stesso computer, per il browser
# rappresentano origini differenti.
allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]


# Aggiungiamo il middleware CORS all'applicazione.
app.add_middleware(
    CORSMiddleware,

    # Permettiamo le richieste solamente
    # dagli indirizzi definiti sopra.
    allow_origins=allowed_origins,

    # Per ora non utilizziamo cookie o autenticazione,
    # ma abilitiamo questa opzione in previsione futura.
    allow_credentials=True,

    # Permettiamo tutti i metodi HTTP,
    # come GET, POST, PUT e DELETE.
    allow_methods=["*"],

    # Permettiamo tutti gli header HTTP.
    allow_headers=["*"],
)


def load_player_prices() -> pd.DataFrame:
    """
    Legge e restituisce player_prices.csv.

    Il file viene letto a ogni richiesta.
    Per il nostro piccolo dataset iniziale è accettabile
    e permette di vedere eventuali aggiornamenti
    senza dover riavviare manualmente il server.
    """

    # Controlliamo che pricing.py abbia realmente
    # generato il file richiesto.
    if not PRICES_PATH.exists():
        raise FileNotFoundError(
            f"File non trovato: {PRICES_PATH}. "
            "Esegui prima pricing.py."
        )

    # Leggiamo il file CSV con codifica UTF-8.
    players = pd.read_csv(
        PRICES_PATH,
        encoding="utf-8-sig",
    )

    # Controlliamo che il file contenga giocatori.
    if players.empty:
        raise ValueError(
            "Il file player_prices.csv è vuoto."
        )

    return players


def dataframe_to_records(
    dataframe: pd.DataFrame,
) -> list[dict]:
    """
    Converte un DataFrame Pandas
    in una lista di oggetti JSON.

    La conversione tramite to_json evita problemi
    con tipi numerici specifici di NumPy.
    """

    json_text = dataframe.to_json(
        orient="records",
        force_ascii=False,
    )

    return json.loads(json_text)


@app.get("/")
def root() -> dict:
    """
    Endpoint principale dell'applicazione.

    Serve a verificare rapidamente
    che il server sia in esecuzione.
    """

    return {
        "application": "Fantasy AI API",
        "version": "0.1.0",
        "status": "running",
        "documentation": "/docs",
    }


@app.get("/health")
def health_check() -> dict:
    """
    Controlla che l'API e il file dei prezzi
    siano disponibili.
    """

    try:
        players = load_player_prices()

    except (FileNotFoundError, ValueError) as error:
        # Il codice HTTP 503 indica che il servizio
        # non è momentaneamente pronto.
        raise HTTPException(
            status_code=503,
            detail=str(error),
        ) from error

    return {
        "status": "ok",
        "players_available": len(players),
        "prices_file": PRICES_PATH.name,
    }


@app.get("/players")
def get_players(
    role: Literal["P", "D", "C", "A"] | None = Query(
        default=None,
        description=(
            "Filtra per ruolo: "
            "P, D, C oppure A."
        ),
    ),
    search: str | None = Query(
        default=None,
        min_length=1,
        description=(
            "Cerca un giocatore per nome "
            "o per squadra."
        ),
    ),
    limit: int = Query(
        default=20,
        ge=1,
        le=100,
        description=(
            "Numero massimo di giocatori restituiti."
        ),
    ),
) -> dict:
    """
    Restituisce l'elenco dei giocatori.

    È possibile:
    - filtrare per ruolo;
    - cercare per nome o squadra;
    - scegliere il numero massimo di risultati.
    """

    try:
        players = load_player_prices()

    except (FileNotFoundError, ValueError) as error:
        raise HTTPException(
            status_code=503,
            detail=str(error),
        ) from error

    # Se è stato specificato un ruolo,
    # manteniamo soltanto i giocatori di quel ruolo.
    if role is not None:
        players = players[
            players["role"] == role
        ]

    # Se è presente un termine di ricerca,
    # controlliamo sia il nome sia la squadra.
    if search is not None:
        search_text = search.strip()

        name_matches = (
            players["name"]
            .str.contains(
                search_text,
                case=False,
                na=False,
                regex=False,
            )
        )

        team_matches = (
            players["team"]
            .str.contains(
                search_text,
                case=False,
                na=False,
                regex=False,
            )
        )

        players = players[
            name_matches | team_matches
        ]

    # Ordiniamo i risultati partendo
    # dal giocatore con lo score più alto.
    players = players.sort_values(
        by="overall_score",
        ascending=False,
    )

    # Limitiamo il numero di risultati.
    players = players.head(limit)

    # Selezioniamo soltanto le colonne
    # necessarie alla prima versione del sito.
    columns_to_return = [
        "player_id",
        "name",
        "team",
        "role",
        "age",
        "overall_score",
        "role_rank",
        "starting_probability",
        "injury_risk",
        "recommended_min",
        "recommended_price",
        "recommended_max",
        "absolute_max",
        "market_coverage",
    ]

    records = dataframe_to_records(
        players[columns_to_return]
    )

    return {
        "count": len(records),
        "filters": {
            "role": role,
            "search": search,
            "limit": limit,
        },
        "players": records,
    }


@app.get("/players/{player_id}")
def get_player(player_id: int) -> dict:
    """
    Restituisce tutte le informazioni
    relative a un singolo giocatore.
    """

    try:
        players = load_player_prices()

    except (FileNotFoundError, ValueError) as error:
        raise HTTPException(
            status_code=503,
            detail=str(error),
        ) from error

    # Cerchiamo la riga con l'identificativo richiesto.
    selected_player = players[
        players["player_id"] == player_id
    ]

    # Se il DataFrame è vuoto,
    # l'identificativo non esiste.
    if selected_player.empty:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Nessun giocatore trovato "
                f"con player_id {player_id}."
            ),
        )

    # Convertiamo la singola riga in JSON.
    records = dataframe_to_records(
        selected_player
    )

    return records[0]