/*
 * Modalità di fantacalcio attualmente
 * supportate dalla sezione Stagione.
 */
export type SeasonLeagueMode =
  "CLASSIC";


/*
 * Lega stagionale appartenente
 * all'utente autenticato.
 */
export type SeasonLeague = {
  id: string;
  leagueName: string;
  teamName: string;
  season: string;
  mode: SeasonLeagueMode;
  createdAt: string;
  updatedAt: string;
};


/*
 * Risposta restituita dall'elenco
 * delle leghe dell'utente.
 */
export type SeasonLeaguesResponse = {
  count: number;
  leagues: SeasonLeague[];
};