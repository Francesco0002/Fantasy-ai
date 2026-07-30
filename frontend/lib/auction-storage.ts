/*
 * Nel browser salviamo solamente
 * l'UUID della sessione d'asta attiva.
 */
export const AUCTION_SESSION_ID_KEY =
  "fantasy-ai-auction-session-id-v1";


/*
 * Vecchia chiave che conteneva
 * l'intera sessione nel localStorage.
 *
 * Viene mantenuta soltanto
 * per ripulire i vecchi salvataggi.
 */
export const LEGACY_AUCTION_STORAGE_KEY =
  "fantasy-ai-auction-session-v1";