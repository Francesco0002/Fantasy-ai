/*
 * Tipo della configurazione d'asta.
 */
import type {
  AuctionConfig,
  AuctionRole,
} from "../types/auction";


/*
 * Configurazione predefinita per una lega
 * di Fantacalcio Classic con 8 partecipanti.
 *
 * L'utente potrà modificare questi valori
 * prima di iniziare l'asta.
 */
export const DEFAULT_AUCTION_CONFIG: AuctionConfig = {
  leagueName: "Lega di prova",
  participants: 8,
  startingBudget: 500,
  minimumBid: 1,

  /*
   * Composizione classica della rosa:
   * 3 portieri, 8 difensori,
   * 8 centrocampisti e 6 attaccanti.
   */
  rosterSlots: {
    P: 3,
    D: 8,
    C: 8,
    A: 6,
  },

  /*
   * Distribuzione iniziale consigliata
   * del budget tra i quattro ruoli.
   *
   * La somma deve essere uguale a 1.
   */
  budgetDistribution: {
    P: 0.08,
    D: 0.16,
    C: 0.26,
    A: 0.50,
  },
};


/*
 * Nome completo utilizzato
 * nell'interfaccia per ogni ruolo.
 */
export const AUCTION_ROLE_NAMES: Record<
  AuctionRole,
  string
> = {
  P: "Portieri",
  D: "Difensori",
  C: "Centrocampisti",
  A: "Attaccanti",
};


/*
 * Elenco ordinato dei ruoli.
 *
 * Ci permette di mostrare sempre
 * P, D, C e A nello stesso ordine.
 */
export const AUCTION_ROLES: AuctionRole[] = [
  "P",
  "D",
  "C",
  "A",
];


/*
 * Calcola il budget consigliato
 * per un determinato ruolo.
 *
 * Esempio:
 * budget 500 e percentuale 0.50
 * producono 250 crediti.
 */
export function calculateRoleBudget(
  config: AuctionConfig,
  role: AuctionRole,
): number {
  const percentage =
    config.budgetDistribution[role];

  return Math.round(
    config.startingBudget * percentage,
  );
}


/*
 * Calcola il numero totale di giocatori
 * che compongono la rosa.
 */
export function calculateTotalRosterSlots(
  config: AuctionConfig,
): number {
  return (
    config.rosterSlots.P +
    config.rosterSlots.D +
    config.rosterSlots.C +
    config.rosterSlots.A
  );
}


/*
 * Controlla che la distribuzione del budget
 * sia complessivamente pari al 100%.
 *
 * Utilizziamo una piccola tolleranza
 * per evitare problemi con i numeri decimali.
 */
export function isBudgetDistributionValid(
  config: AuctionConfig,
): boolean {
  const total =
    config.budgetDistribution.P +
    config.budgetDistribution.D +
    config.budgetDistribution.C +
    config.budgetDistribution.A;

  return Math.abs(total - 1) < 0.001;
}