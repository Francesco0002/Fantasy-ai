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
 * Dati inviati al backend
 * per creare una nuova lega stagionale.
 *
 * Il proprietario e la modalità vengono
 * determinati esclusivamente dal backend.
 */
export type CreateSeasonLeagueInput = {
  leagueName: string;
  teamName: string;
  season: string;
};


/*
 * Risposta restituita dall'elenco
 * delle leghe dell'utente.
 */
export type SeasonLeaguesResponse = {
  count: number;
  leagues: SeasonLeague[];
};