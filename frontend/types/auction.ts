/*
 * Ruoli utilizzati nella modalità asta.
 *
 * Non includiamo la stringa vuota perché
 * ogni slot della rosa deve avere un ruolo valido.
 */
export type AuctionRole =
  | "P"
  | "D"
  | "C"
  | "A";


/*
 * Numero massimo di giocatori acquistabili
 * per ciascun ruolo.
 */
export type RosterSlots = {
  P: number;
  D: number;
  C: number;
  A: number;
};


/*
 * Percentuale del budget iniziale
 * consigliata per ciascun ruolo.
 *
 * Esempio:
 * 0.50 significa il 50% del budget.
 */
export type BudgetDistribution = {
  P: number;
  D: number;
  C: number;
  A: number;
};


/*
 * Configurazione generale dell'asta.
 */
export type AuctionConfig = {
  /*
   * Nome utilizzato per identificare
   * la lega o la sessione d'asta.
   */
  leagueName: string;

  /*
   * Numero di partecipanti alla lega.
   */
  participants: number;

  /*
   * Crediti iniziali disponibili
   * per ogni squadra.
   */
  startingBudget: number;

  /*
   * Offerta minima consentita.
   */
  minimumBid: number;

  /*
   * Numero di slot disponibili
   * per ciascun ruolo.
   */
  rosterSlots: RosterSlots;

  /*
   * Ripartizione consigliata del budget.
   */
  budgetDistribution: BudgetDistribution;
};


/*
 * Acquisto registrato durante l'asta.
 *
 * In futuro questa struttura sarà usata
 * per aggiornare budget e rosa.
 */
export type AuctionPurchase = {
  playerId: number;
  playerName: string;
  team: string;
  role: AuctionRole;

  /*
   * Prezzo pagato per il giocatore.
   */
  purchasePrice: number;

  /*
   * Data e ora in cui è stato
   * registrato l'acquisto.
   */
  purchasedAt: string;
};


/*
 * Stato completo di una sessione d'asta.
 */
export type AuctionSession = {
  /*
   * Configurazione scelta prima dell'asta.
   */
  config: AuctionConfig;

  /*
   * Crediti ancora disponibili.
   */
  remainingBudget: number;

  /*
   * Elenco dei giocatori acquistati.
   */
  purchases: AuctionPurchase[];

  /*
   * Indica se la configurazione iniziale
   * è stata completata e l'asta è iniziata.
   */
  isStarted: boolean;
};