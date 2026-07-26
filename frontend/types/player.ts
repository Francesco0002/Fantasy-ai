/*
 * Ruoli selezionabili nel filtro.
 *
 * La stringa vuota rappresenta
 * l'opzione "Tutti i ruoli".
 */
export type Role = "" | "P" | "D" | "C" | "A";


/*
 * Ruolo effettivo di un giocatore.
 *
 * Qui non utilizziamo la stringa vuota,
 * perché ogni giocatore deve avere un ruolo.
 */
export type PlayerRole = "P" | "D" | "C" | "A";


/*
 * Criteri disponibili per ordinare
 * l'elenco dei giocatori.
 */
export type SortOption =
  | "score_desc"
  | "price_desc"
  | "starting_desc"
  | "injury_asc"
  | "name_asc";


/*
 * Struttura di un giocatore restituito
 * dal backend FastAPI.
 */
export type Player = {
  player_id: number;
  name: string;
  team: string;
  role: PlayerRole;
  age: number;

  /*
   * Valutazione calcolata dall'algoritmo.
   */
  overall_score: number;
  role_rank: number;

  /*
   * Disponibilità e affidabilità.
   */
  starting_probability: number;
  injury_risk: number;

  /*
   * Prezzi consigliati per l'asta.
   */
  recommended_min: number;
  recommended_price: number;
  recommended_max: number;
  absolute_max: number;

  /*
   * Copertura del mercato disponibile.
   */
  market_coverage: number;
};


/*
 * Struttura completa della risposta
 * restituita dall'endpoint GET /players.
 */
export type PlayersResponse = {
  count: number;

  filters: {
    role: Role | null;
    search: string | null;
    limit: number;
  };

  players: Player[];
};


/*
 * Fasce qualitative assegnate
 * in base al Punteggio Fantasy AI.
 */
export type PlayerTier =
  | "Top"
  | "Ottimo"
  | "Buono"
  | "Scommessa"
  | "Bassa priorità";