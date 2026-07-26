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
 * Struttura completa di un giocatore
 * restituito dal backend FastAPI.
 *
 * Comprende:
 * - informazioni anagrafiche;
 * - statistiche della stagione;
 * - valutazioni Fantasy AI;
 * - prezzi consigliati per l'asta.
 */
export type Player = {
  /*
   * Informazioni generali.
   */
  player_id: number;
  name: string;
  team: string;
  role: PlayerRole;
  age: number;

  /*
   * Presenze e utilizzo nella stagione precedente.
   */
  appearances_last_season: number;
  starts_last_season: number;
  minutes_last_season: number;

  /*
   * Bonus prodotti.
   */
  goals_last_season: number;
  assists_last_season: number;
  penalties_scored_last_season: number;

  /*
   * Statistiche particolarmente utili
   * per portieri e difensori.
   */
  clean_sheets_last_season: number;
  goals_conceded_last_season: number;
  saves_last_season: number;

  /*
   * Malus disciplinari.
   */
  yellow_cards_last_season: number;
  red_cards_last_season: number;

  /*
   * Medie della stagione precedente.
   */
  average_rating_last_season: number;
  fantasy_average_last_season: number;

  /*
   * Affidabilità e potenziale.
   *
   * injury_risk e starting_probability
   * sono espressi tramite valori tra 0 e 1.
   */
  injury_risk: number;
  starting_probability: number;
  growth_potential: number;
  set_piece_level: number;

  /*
   * Descrizione e provenienza del dato.
   */
  notes: string;
  data_source: string;

  /*
   * Componenti del Punteggio Fantasy AI.
   */
  performance_score: number;
  starting_score: number;
  bonus_score: number;
  reliability_score: number;
  potential_score: number;

  /*
   * Punteggio finale e classifiche.
   */
  overall_score: number;
  overall_rank: number;
  role_rank: number;

  /*
   * Valutazione economica.
   */
  base_price: number;
  recommended_min: number;
  recommended_price: number;
  recommended_max: number;
  absolute_max: number;

  /*
   * Informazioni relative al mercato.
   */
  market_coverage: number;
  price_rank: number;
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