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
 * Modalità con cui vengono chiamati
 * i giocatori durante l'asta.
 */
export type AuctionMode =
  | "ROLE_BY_ROLE"
  | "FULL_RANDOM";


export type AuctionPurchaseOwner =
  | "ME"
  | "OPPONENT";


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
  * Nomi opzionali delle squadre avversarie.
  *
  * Quando l'array è vuoto o assente,
  * il nome viene inserito manualmente
  * durante l'asta.
  *
  * Quando contiene dei nomi,
  * durante l'asta viene mostrato
  * un menu a tendina.
  */
  opponentTeamNames?: string[];

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

  /*
  * ROLE_BY_ROLE:
  * si completa un ruolo prima di passare al successivo.
  *
  * FULL_RANDOM:
  * i giocatori di tutti i ruoli possono uscire
  * in qualsiasi momento.
  */
  auctionMode: AuctionMode;
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
   * Prezzo realmente pagato.
   */
  purchasePrice: number;

  /*
   * Indica se il giocatore è stato
   * acquistato dall'utente oppure
   * da un altro partecipante.
   */
  ownerType: AuctionPurchaseOwner;

  /*
   * Nome opzionale della squadra
   * che ha acquistato il giocatore.
   */
  ownerName?: string;

  /*
   * Quotazione originale.
   */
  baseRecommendedPriceAtPurchase?: number;

  /*
   * Quotazione dinamica dell'asta.
   */
  dynamicRecommendedPriceAtPurchase?: number;

  purchasedAt: string;
};

/*
 * Stato completo di una sessione d'asta.
 */
export type AuctionSession = {
  /*
   * UUID assegnato dal backend.
   */
  id: string;

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