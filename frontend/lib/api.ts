/*
 * Tipi utilizzati per descrivere
 * i dati ricevuti dal backend.
 */
import type {
  Player,
  PlayersResponse,
  Role,
} from "../types/player";


/*
 * Indirizzo del backend FastAPI.
 *
 * In produzione viene letto dalla variabile
 * NEXT_PUBLIC_API_URL configurata su Vercel.
 *
 * In locale utilizziamo l'indirizzo predefinito.
 */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8000";


/*
 * Parametri accettati dalla funzione
 * che recupera i giocatori.
 */
type FetchPlayersOptions = {
  role: Role;
  search: string;
  limit?: number;
  signal?: AbortSignal;
};


/*
 * Recupera l'elenco dei giocatori dal backend.
 *
 * La funzione si occupa di:
 * - costruire i parametri dell'URL;
 * - eseguire la richiesta HTTP;
 * - controllare eventuali errori;
 * - convertire la risposta JSON.
 */
export async function fetchPlayers({
  role,
  search,
  limit = 100,
  signal,
}: FetchPlayersOptions): Promise<PlayersResponse> {
  const params = new URLSearchParams();

  /*
   * Numero massimo di giocatori richiesti.
   */
  params.set("limit", limit.toString());

  /*
   * Aggiungiamo il ruolo solamente
   * quando è stato selezionato.
   */
  if (role !== "") {
    params.set("role", role);
  }

  /*
   * Eliminiamo gli spazi inutili
   * dal testo di ricerca.
   */
  const cleanedSearch = search.trim();

  if (cleanedSearch !== "") {
    params.set("search", cleanedSearch);
  }

  /*
   * Richiesta verso l'endpoint GET /players.
   */
  const response = await fetch(
    `${API_URL}/players?${params.toString()}`,
    {
      signal,
    },
  );

  /*
   * fetch non genera automaticamente un errore
   * per risposte HTTP come 404 o 500.
   */
  if (!response.ok) {
    throw new Error(
      `Il backend ha restituito l'errore ${response.status}.`,
    );
  }

  /*
   * Conversione della risposta JSON
   * nel tipo PlayersResponse.
   */
  const data: PlayersResponse =
    await response.json();

  return data;
}


/*
 * Recupera un singolo giocatore
 * utilizzando il suo identificativo.
 *
 * Esempio di richiesta:
 * GET /players/41
 */
export async function fetchPlayerById(
  playerId: number,
  signal?: AbortSignal,
): Promise<Player> {
  /*
   * Effettuiamo la richiesta verso
   * l'endpoint FastAPI dedicato.
   */
  const response = await fetch(
    `${API_URL}/players/${playerId}`,
    {
      signal,
    },
  );

  /*
   * Forniamo un messaggio specifico
   * quando l'identificativo non esiste.
   */
  if (response.status === 404) {
    throw new Error("Giocatore non trovato.");
  }

  /*
   * Gestiamo eventuali altri errori HTTP.
   */
  if (!response.ok) {
    throw new Error(
      `Il backend ha restituito l'errore ${response.status}.`,
    );
  }

  /*
   * Convertiamo la risposta JSON
   * nel tipo Player.
   */
  const player: Player =
    await response.json();

  return player;
}