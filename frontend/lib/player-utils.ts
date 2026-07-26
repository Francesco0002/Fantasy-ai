/*
 * Tipi condivisi utilizzati dalle funzioni
 * e dalle costanti relative ai giocatori.
 */
import type {
  Player,
  PlayerTier,
} from "../types/player";


/*
 * Frasi grammaticalmente corrette utilizzate
 * per mostrare la posizione del giocatore
 * nella classifica del proprio ruolo.
 */
export const ROLE_RANK_LABELS: Record<
  Player["role"],
  string
> = {
  P: "tra i portieri",
  D: "tra i difensori",
  C: "tra i centrocampisti",
  A: "tra gli attaccanti",
};


/*
 * Classi Tailwind utilizzate per distinguere
 * graficamente i ruoli dei giocatori.
 */
export const ROLE_BADGE_CLASSES: Record<
  Player["role"],
  string
> = {
  P: "bg-yellow-400 text-yellow-950",
  D: "bg-green-600 text-white",
  C: "bg-blue-600 text-white",
  A: "bg-red-600 text-white",
};


/*
 * Trasforma il rischio numerico di infortunio
 * in un'etichetta facilmente comprensibile.
 */
export function getInjuryRiskLabel(
  risk: number,
): string {
  if (risk < 0.15) {
    return "Basso";
  }

  if (risk < 0.30) {
    return "Medio";
  }

  return "Alto";
}


/*
 * Assegna una fascia qualitativa al giocatore
 * utilizzando il Punteggio Fantasy AI.
 */
export function getPlayerTier(
  score: number,
): PlayerTier {
  if (score >= 85) {
    return "Top";
  }

  if (score >= 75) {
    return "Ottimo";
  }

  if (score >= 65) {
    return "Buono";
  }

  if (score >= 50) {
    return "Scommessa";
  }

  return "Bassa priorità";
}


/*
 * Colori utilizzati per rappresentare
 * le diverse fasce qualitative.
 */
export const PLAYER_TIER_CLASSES: Record<
  PlayerTier,
  string
> = {
  Top: "bg-amber-100 text-amber-800",
  Ottimo: "bg-emerald-100 text-emerald-800",
  Buono: "bg-blue-100 text-blue-800",
  Scommessa: "bg-violet-100 text-violet-800",
  "Bassa priorità": "bg-slate-200 text-slate-700",
};