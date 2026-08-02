/*
 * Ruoli utilizzati nella modalità asta.
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


/*
 * Modalità con cui viene gestita
 * la distribuzione del budget.
 */
export type AuctionBudgetStrategy =
  | "AUTOMATIC"
  | "MANUAL";


/*
 * Stato persistente della sessione.
 */
export type AuctionSessionStatus =
  | "ACTIVE"
  | "COMPLETED";


export type AuctionPurchaseOwner =
  | "ME"
  | "OPPONENT";


/*
 * Bonus assegnato a un gol
 * in base al ruolo del giocatore.
 */
export type GoalBonusByRole = Record<
  AuctionRole,
  number
>;


/*
 * Regole relative a bonus e malus.
 */
export type AuctionScoringRules = {
  /*
   * Bonus gol distinto per ruolo.
   */
  goalByRole: GoalBonusByRole;

  /*
   * Bonus assist.
   */
  assist: number;

  /*
   * Bonus porta inviolata.
   */
  cleanSheet: number;

  /*
   * Malus per ogni gol subito.
   */
  goalConceded: number;

  /*
   * Bonus rigore segnato.
   */
  penaltyScored: number;

  /*
   * Malus rigore sbagliato.
   */
  penaltyMissed: number;

  /*
   * Bonus rigore parato.
   */
  penaltySaved: number;

  /*
   * Malus ammonizione.
   */
  yellowCard: number;

  /*
   * Malus espulsione.
   */
  redCard: number;

  /*
   * Malus autogol.
   */
  ownGoal: number;
};


/*
 * Fascia utilizzata da un modificatore.
 *
 * Esempio:
 * media minima 6.50 -> bonus +3.
 */
export type ModifierBand = {
  minimumAverage: number;
  bonus: number;
};


/*
 * Configurazione del modificatore difesa.
 */
export type DefenseModifierRules = {
  enabled: boolean;

  /*
   * Numero minimo di difensori richiesti
   * per attivare il modificatore.
   */
  minimumDefenders: number;

  /*
   * Indica se il voto del portiere
   * deve essere incluso nel calcolo.
   */
  includeGoalkeeper: boolean;

  /*
   * Numero di voti utilizzati
   * per calcolare la media.
   */
  consideredPlayers: number;

  /*
   * Fasce media-bonus.
   */
  bands: ModifierBand[];
};


/*
 * Configurazione del modificatore centrocampo.
 */
export type MidfieldModifierRules = {
  enabled: boolean;

  /*
   * Numero minimo di centrocampisti richiesti
   * per attivare il modificatore.
   */
  minimumMidfielders: number;

  /*
   * Numero di voti utilizzati
   * per calcolare la media.
   */
  consideredPlayers: number;

  /*
   * Fasce media-bonus.
   */
  bands: ModifierBand[];
};


/*
 * Regole complete della lega.
 */
export type AuctionLeagueRules = {
  scoring: AuctionScoringRules;

  defenseModifier: DefenseModifierRules;

  midfieldModifier: MidfieldModifierRules;
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
   * Nomi opzionali delle squadre avversarie.
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
   * si completa un ruolo prima di passare
   * al successivo.
   *
   * FULL_RANDOM:
   * i giocatori di tutti i ruoli possono
   * uscire in qualsiasi momento.
   */
  auctionMode: AuctionMode;

  /*
   * AUTOMATIC:
   * Fantasy AI calcola le percentuali
   * in base alle regole della lega.
   *
   * MANUAL:
   * l'utente inserisce le percentuali.
   *
   * È temporaneamente opzionale per
   * mantenere compatibili le vecchie aste.
   */
  budgetStrategy?: AuctionBudgetStrategy;

  /*
   * Bonus, malus e modificatori della lega.
   *
   * È temporaneamente opzionale perché
   * le vecchie sessioni nel database
   * non contengono ancora queste regole.
   */
  leagueRules?: AuctionLeagueRules;
};


/*
 * Acquisto registrato durante l'asta.
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
   * ACTIVE permette di registrare acquisti.
   * COMPLETED rende l'asta consultabile
   * senza modificare i dati salvati.
   */
  status: AuctionSessionStatus;

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
