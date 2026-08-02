/*
 * Funzione utilizzata per calcolare
 * il budget previsto per un ruolo.
 */
import {
  calculateRoleBudget,
} from "./auction-config";

/*
 * Tipi relativi alla modalità asta.
 */
import type {
  AuctionConfig,
  AuctionPurchase,
  AuctionRole,
} from "../types/auction";

/*
 * Tipo completo del giocatore.
 */
import type {
  Player,
} from "../types/player";


/*
 * Possibili valutazioni assegnate
 * al prezzo inserito dall'utente.
 */
export type AuctionAdviceLabel =
  | "Affare"
  | "Buon prezzo"
  | "Prezzo corretto"
  | "Costoso"
  | "Da evitare"
  | "Non valido";


/*
 * Tonalità grafica associata
 * alla valutazione.
 */
export type AuctionAdviceTone =
  | "excellent"
  | "good"
  | "neutral"
  | "warning"
  | "danger"
  | "invalid";


/*
 * Risultato completo prodotto
 * dall'assistente strategico.
 */
export type AuctionAdvice = {
  label: AuctionAdviceLabel;
  tone: AuctionAdviceTone;
  description: string;

  /*
   * true indica che l'acquisto rispetta
   * tutti i vincoli tecnici della rosa.
   */
  isPurchaseValid: boolean;

  /*
   * Differenza rispetto
   * al prezzo consigliato.
   *
   * Valore negativo: stai pagando meno.
   * Valore positivo: stai pagando di più.
   */
  differenceFromRecommended: number;

  /*
   * Situazione generale dopo l'acquisto.
   */
  remainingBudgetAfterPurchase: number;
  remainingSlotsAfterPurchase: number;
  minimumCreditsToReserve: number;

  /*
   * Situazione del singolo ruolo.
   */
  plannedRoleBudget: number;
  spentInRoleBefore: number;
  spentInRoleAfter: number;
  roleBudgetDifference: number;

  /*
   * Prezzo massimo suggerito considerando:
   * - valutazione del giocatore;
   * - budget generale;
   * - strategia del ruolo.
   */
  strategicMaximumBid: number;

  /*
   * Eventuali avvisi aggiuntivi.
   */
  warnings: string[];
};


/*
 * Classi grafiche associate
 * alle diverse valutazioni.
 */
export const AUCTION_ADVICE_CLASSES: Record<
  AuctionAdviceTone,
  string
> = {
  excellent:
    "border-emerald-300 bg-emerald-50 text-emerald-950",

  good:
    "border-green-300 bg-green-50 text-green-950",

  neutral:
    "border-sky-300 bg-sky-50 text-sky-950",

  warning:
    "border-amber-300 bg-amber-50 text-amber-950",

  danger:
    "border-red-300 bg-red-50 text-red-950",

  invalid:
    "border-slate-300 bg-slate-100 text-slate-800",
};


/*
 * Argomenti necessari per calcolare
 * il consiglio strategico.
 */
type CreateAuctionAdviceArguments = {
  player: Player;
  bid: number;
  config: AuctionConfig;
  remainingBudget: number;

  remainingSlots: Record<
    AuctionRole,
    number
  >;

  purchases: AuctionPurchase[];
  maximumBid: number;
};


/*
 * Determina la valutazione economica
 * del prezzo inserito.
 */
function evaluateBid(
  player: Player,
  bid: number,
  minimumBid: number,
  isPurchaseValid: boolean,
): {
  label: AuctionAdviceLabel;
  tone: AuctionAdviceTone;
  description: string;
} {
  /*
   * Prima controlliamo i vincoli tecnici.
   */
  if (!isPurchaseValid) {
    return {
      label: "Non valido",
      tone: "invalid",
      description:
        "Il prezzo non rispetta uno o più vincoli della sessione d'asta.",
    };
  }

  /*
   * Prezzo almeno pari all'offerta minima
   * e non superiore alla soglia affare.
   */
  if (
    bid >= minimumBid &&
    bid <= player.recommended_min
  ) {
    return {
      label: "Affare",
      tone: "excellent",
      description:
        "Il prezzo è uguale o inferiore alla soglia considerata un affare.",
    };
  }

  /*
   * Prezzo inferiore o uguale
   * alla valutazione consigliata.
   */
  if (
    bid <= player.recommended_price
  ) {
    return {
      label: "Buon prezzo",
      tone: "good",
      description:
        "Stai acquistando il giocatore senza superare il prezzo consigliato.",
    };
  }

  /*
   * Prezzo leggermente superiore
   * alla valutazione consigliata.
   */
  if (
    bid <= player.recommended_max
  ) {
    return {
      label: "Prezzo corretto",
      tone: "neutral",
      description:
        "Il prezzo è superiore alla valutazione ideale, ma rimane accettabile.",
    };
  }

  /*
   * Prezzo elevato ma ancora
   * sotto il limite assoluto.
   */
  if (bid <= player.absolute_max) {
    return {
      label: "Costoso",
      tone: "warning",
      description:
        "Il giocatore può essere acquistato, ma stai pagando più del valore consigliato.",
    };
  }

  /*
   * Prezzo oltre il limite
   * massimo assegnato al giocatore.
   */
  return {
    label: "Da evitare",
    tone: "danger",
    description:
      "Il prezzo supera il limite massimo stimato da Fantasy AI.",
  };
}


/*
 * Crea il consiglio completo
 * per l'acquisto corrente.
 */
export function createAuctionAdvice({
  player,
  bid,
  config,
  remainingBudget,
  remainingSlots,
  purchases,
  maximumBid,
}: CreateAuctionAdviceArguments): AuctionAdvice {
  /*
   * Evitiamo che valori non numerici
   * compromettano i calcoli.
   */
  const safeBid =
    Number.isFinite(bid)
      ? bid
      : 0;

  const role = player.role;


  /*
   * Slot complessivi ancora liberi
   * prima dell'acquisto.
   */
  const totalRemainingSlots =
    remainingSlots.P +
    remainingSlots.D +
    remainingSlots.C +
    remainingSlots.A;

  /*
   * Slot complessivi dopo
   * l'eventuale acquisto.
   */
  const remainingSlotsAfterPurchase =
    Math.max(
      totalRemainingSlots - 1,
      0,
    );

  /*
   * Crediti minimi da conservare
   * per completare tutti gli altri slot.
   */
  const minimumCreditsToReserve =
    remainingSlotsAfterPurchase *
    config.minimumBid;


  /*
   * Crediti già spesi nel ruolo
   * del giocatore selezionato.
   */
  const spentInRoleBefore =
    purchases
      .filter(
        (purchase) =>
          purchase.role === role,
      )
      .reduce(
        (total, purchase) =>
          total +
          purchase.purchasePrice,
        0,
      );

  const spentInRoleAfter =
    spentInRoleBefore + safeBid;


  /*
  * Dopo questo acquisto potrebbero rimanere
  * altri slot da completare nello stesso ruolo.
  */
  const roleSlotsAfterPurchase =
    Math.max(
      remainingSlots[role] - 1,
      0,
    );

  /*
   * Crediti minimi da conservare per completare
   * gli slot ancora liberi dello stesso ruolo.
   */
  const minimumRoleCreditsToReserve =
    roleSlotsAfterPurchase *
    config.minimumBid;


  /*
   * Budget inizialmente previsto
   * per il ruolo.
   */
  const plannedRoleBudget =
    calculateRoleBudget(
      config,
      role,
    );

  /*
   * Valore positivo:
   * budget ancora disponibile nel piano.
   *
   * Valore negativo:
   * superamento del piano.
   */
  const roleBudgetDifference =
    plannedRoleBudget -
    spentInRoleAfter -
    minimumRoleCreditsToReserve;


  /*
   * Budget del ruolo ancora disponibile
   * prima del nuovo acquisto.
   */
  const remainingPlannedRoleBudget =
    Math.max(
      plannedRoleBudget -
      spentInRoleBefore -
      minimumRoleCreditsToReserve,
      0,
    );

  /*
   * Tetto strategico suggerito.
   *
   * Consideriamo:
   * - budget previsto per il ruolo;
   * - limite assoluto del giocatore;
   * - massimo tecnicamente spendibile.
   */
  const strategicMaximumBid =
    Math.max(
      0,
      Math.min(
        maximumBid,
        player.absolute_max,
        remainingPlannedRoleBudget,
      ),
    );


  /*
   * Controlli tecnici che determinano
   * se l'acquisto può essere registrato.
   */
  const hasValidPrice =
    Number.isInteger(bid) &&
    bid >= config.minimumBid;

  const hasAvailableRoleSlot =
    remainingSlots[role] > 0;

  const fitsRemainingBudget =
    bid <= remainingBudget;

  const fitsMaximumBid =
    bid <= maximumBid;

  const isPurchaseValid =
    hasValidPrice &&
    hasAvailableRoleSlot &&
    fitsRemainingBudget &&
    fitsMaximumBid;


  /*
   * Valutazione economica del prezzo.
   */
  const evaluation = evaluateBid(
    player,
    safeBid,
    config.minimumBid,
    isPurchaseValid,
  );


  /*
   * Costruiamo gli avvisi da mostrare
   * all'utente.
   */
  const warnings: string[] = [];

  if (!Number.isInteger(bid)) {
    warnings.push(
      "Il prezzo deve essere un numero intero.",
    );
  } else if (
    bid < config.minimumBid
  ) {
    warnings.push(
      `L'offerta minima è ${config.minimumBid} crediti.`,
    );
  }

  if (!hasAvailableRoleSlot) {
    warnings.push(
      "Non ci sono slot disponibili per questo ruolo.",
    );
  }

  if (!fitsRemainingBudget) {
    warnings.push(
      "Il prezzo supera il budget residuo.",
    );
  }

  if (!fitsMaximumBid) {
    warnings.push(
      `Devi conservare abbastanza crediti per gli altri slot. Il massimo consentito è ${maximumBid}.`,
    );
  }

  if (
    safeBid >
    player.recommended_max
  ) {
    warnings.push(
      "Il prezzo supera la fascia normalmente consigliata per questo giocatore.",
    );
  }

  if (
    safeBid >
    player.absolute_max
  ) {
    warnings.push(
      `Fantasy AI consiglia di non superare ${player.absolute_max} crediti.`,
    );
  }

  if (roleBudgetDifference < 0) {
    warnings.push(
      `Con questo acquisto supereresti di ${Math.abs(
        roleBudgetDifference,
      )} crediti il budget previsto per il ruolo ${role}.`,
    );
  }


  return {
    ...evaluation,
    isPurchaseValid,

    differenceFromRecommended:
      safeBid -
      player.recommended_price,

    remainingBudgetAfterPurchase:
      remainingBudget - safeBid,

    remainingSlotsAfterPurchase,
    minimumCreditsToReserve,

    plannedRoleBudget,
    spentInRoleBefore,
    spentInRoleAfter,
    roleBudgetDifference,

    strategicMaximumBid,
    warnings,
  };
}