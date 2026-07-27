/*
 * Calcolo del budget iniziale
 * associato a un ruolo.
 */
import {
  calculateRoleBudget,
  calculateTotalRosterSlots,
} from "./auction-config";

/*
 * Tipi della modalità asta.
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


type RoleValues = Record<
  AuctionRole,
  number
>;


/*
 * Risultato della valutazione dinamica.
 */
export type DynamicPlayerValuation = {
  /*
   * Quotazioni aggiornate.
   */
  dynamicRecommendedMin: number;
  dynamicRecommendedPrice: number;
  dynamicRecommendedMax: number;
  dynamicAbsoluteMax: number;

  /*
   * Massimo che l'utente può realmente
   * spendere nella propria situazione.
   */
  personalMaximumBid: number;

  /*
   * Prezzo inizialmente proposto
   * nel campo dell'acquisto.
   */
  suggestedBid: number;

  /*
   * Fattori utilizzati nel calcolo.
   */
  marketFactor: number;
  budgetFactor: number;
  combinedFactor: number;

  /*
   * Descrizione dell'andamento.
   */
  marketTrend:
  | "In ribasso"
  | "Stabile"
  | "In rialzo";

  isAffordable: boolean;
};


type CalculateDynamicValuationArguments = {
  player: Player;
  config: AuctionConfig;
  purchases: AuctionPurchase[];
  remainingBudget: number;
  remainingSlots: RoleValues;
  dynamicRoleBudgets: RoleValues;
  maximumBid: number;
};


/*
 * Limita un valore tra minimo e massimo.
 */
function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(
    Math.max(value, minimum),
    maximum,
  );
}


/*
 * Trasforma una quotazione teorica
 * in un numero intero di crediti.
 *
 * Evitiamo che variazioni minime trasformino,
 * per esempio, una quotazione da 2 in 3.
 *
 * La quotazione cambia soltanto quando
 * la variazione teorica raggiunge almeno
 * mezzo credito.
 */
function calculateRoundedDynamicPrice(
  basePrice: number,
  factor: number,
  minimumPrice: number,
): number {
  const adjustedPrice =
    basePrice * factor;

  const difference =
    adjustedPrice - basePrice;

  /*
   * Rialzo sufficientemente significativo.
   */
  if (difference >= 0.5) {
    return Math.max(
      minimumPrice,
      Math.ceil(adjustedPrice),
    );
  }

  /*
   * Ribasso sufficientemente significativo.
   */
  if (difference <= -0.5) {
    return Math.max(
      minimumPrice,
      Math.floor(adjustedPrice),
    );
  }

  /*
   * Movimento troppo piccolo:
   * conserviamo la quotazione precedente.
   */
  return Math.max(
    minimumPrice,
    Math.round(basePrice),
  );
}


/*
 * Calcola una quotazione dinamica
 * per il giocatore.
 */
export function calculateDynamicPlayerValuation({
  player,
  config,
  purchases,
  remainingBudget,
  remainingSlots,
  dynamicRoleBudgets,
  maximumBid,
}: CalculateDynamicValuationArguments): DynamicPlayerValuation {
  const role = player.role;


  /*
  * Campione utilizzato per analizzare
  * i prezzi realmente pagati.
  */
  type MarketSample = {
    ratio: number;
    weight: number;
  };


  /*
   * In modalità ruolo per ruolo consideriamo
   * solamente gli acquisti dello stesso ruolo.
   *
   * In modalità totalmente random:
   * - stesso ruolo: peso 1;
   * - ruolo diverso: peso 0.35.
   *
   * In questo modo ogni acquisto aggiorna
   * tutte le quotazioni, ma senza rendere
   * portieri e attaccanti equivalenti.
   */
  const marketSamples = purchases
    .map<MarketSample | null>(
      (purchase) => {
        /*
         * Preferiamo la quotazione dinamica
         * presente al momento dell'acquisto.
         *
         * Per le vecchie sessioni usiamo
         * la quotazione originale.
         */
        const referencePrice =
          purchase
            .dynamicRecommendedPriceAtPurchase ??
          purchase
            .baseRecommendedPriceAtPurchase;

        if (
          referencePrice === undefined ||
          referencePrice <= 0
        ) {
          return null;
        }


        let weight = 0;

        if (
          config.auctionMode ===
          "ROLE_BY_ROLE"
        ) {
          /*
           * Gli altri ruoli non influenzano
           * la quotazione corrente.
           */
          weight =
            purchase.role === role
              ? 1
              : 0;
        } else {
          /*
           * Nella modalità totalmente random
           * ogni acquisto ha un effetto.
           */
          weight =
            purchase.role === role
              ? 1
              : 0.35;
        }

        if (weight <= 0) {
          return null;
        }


        /*
         * Limitiamo i singoli rapporti
         * per evitare che un acquisto anomalo
         * stravolga tutte le quotazioni.
         */
        const ratio = clamp(
          purchase.purchasePrice /
          referencePrice,
          0.5,
          1.5,
        );

        return {
          ratio,
          weight,
        };
      },
    )
    .filter(
      (
        sample,
      ): sample is MarketSample =>
        sample !== null,
    );


  /*
   * Peso complessivo del campione.
   */
  const totalSampleWeight =
    marketSamples.reduce(
      (total, sample) =>
        total + sample.weight,
      0,
    );


  /*
   * Rapporto medio ponderato tra:
   *
   * prezzo pagato / quotazione del momento.
   */
  const averageMarketRatio =
    totalSampleWeight > 0
      ? marketSamples.reduce(
        (total, sample) =>
          total +
          sample.ratio *
          sample.weight,
        0,
      ) / totalSampleWeight
      : 1;


  /*
  * La fiducia cresce gradualmente.
  *
  * Gli acquisti di ruoli differenti,
  * avendo peso 0.35, fanno crescere
  * più lentamente la fiducia.
  */
  const marketConfidence =
    Math.min(
      totalSampleWeight / 5,
      1,
    );


  const marketFactor =
    clamp(
      1 +
      (
        averageMarketRatio - 1
      ) *
      marketConfidence,
      0.85,
      1.2,
    );


  /*
   * Confrontiamo il budget medio disponibile
   * per slot con quello previsto inizialmente.
   */
  const totalRoleSlots =
    Math.max(
      config.rosterSlots[role],
      1,
    );

  const remainingRoleSlots =
    Math.max(
      remainingSlots[role],
      0,
    );

  const initialRoleBudget =
    calculateRoleBudget(
      config,
      role,
    );

  const initialBudgetPerSlot =
    initialRoleBudget /
    totalRoleSlots;

  const currentBudgetPerSlot =
    remainingRoleSlots > 0
      ? dynamicRoleBudgets[role] /
      remainingRoleSlots
      : 0;


  /*
   * Il fattore budget viene smorzato:
   * una variazione del budget non produce
   * una variazione identica della quotazione.
   */
  const rawBudgetRatio =
    initialBudgetPerSlot > 0
      ? currentBudgetPerSlot /
      initialBudgetPerSlot
      : 1;

  const budgetFactor =
    clamp(
      1 +
      (
        rawBudgetRatio - 1
      ) *
      0.35,
      0.8,
      1.15,
    );


  /*
  * Numero totale di giocatori
  * previsti nella rosa.
  */
  const totalRosterSlots =
    Math.max(
      calculateTotalRosterSlots(
        config,
      ),
      1,
    );

  /*
   * Numero totale di slot
   * ancora da completare.
   */
  const totalRemainingSlots =
    remainingSlots.P +
    remainingSlots.D +
    remainingSlots.C +
    remainingSlots.A;

  /*
   * Budget medio iniziale disponibile
   * per ciascun giocatore della rosa.
   */
  const initialGlobalBudgetPerSlot =
    config.startingBudget /
    totalRosterSlots;

  /*
   * Budget medio attualmente disponibile
   * per ciascuno slot ancora libero.
   */
  const currentGlobalBudgetPerSlot =
    totalRemainingSlots > 0
      ? remainingBudget /
      totalRemainingSlots
      : 0;

  /*
   * Rapporto tra disponibilità attuale
   * e disponibilità iniziale.
   *
   * Maggiore di 1:
   * abbiamo più crediti medi per slot.
   *
   * Minore di 1:
   * abbiamo meno crediti medi per slot.
   */
  const globalBudgetRatio =
    initialGlobalBudgetPerSlot > 0 &&
      totalRemainingSlots > 0
      ? currentGlobalBudgetPerSlot /
      initialGlobalBudgetPerSlot
      : 1;

  /*
   * Nella modalità totalmente random
   * la disponibilità economica generale
   * influenza tutti i ruoli.
   *
   * Nella modalità ruolo per ruolo
   * questo fattore rimane neutro.
   */
  const globalBudgetFactor =
    config.auctionMode ===
      "FULL_RANDOM"
      ? clamp(
        globalBudgetRatio,
        0.85,
        1.15,
      )
      : 1;


  /*
  * La quotazione dinamica rappresenta
  * il valore attribuito dal mercato.
  *
  * Non deve dipendere direttamente
  * dal budget personale rimasto.
  */
  const combinedFactor =
    clamp(
      marketFactor,
      0.85,
      1.2,
    );


  /*
   * Questo fattore modifica soltanto
   * il prezzo che conviene offrire
   * nella nostra situazione economica.
   *
   * Non modifica la quotazione di mercato.
   */
  const personalBudgetFactor =
    config.auctionMode ===
      "FULL_RANDOM"
      ? clamp(
        /*
         * In modalità totalmente random:
         *
         * - consideriamo parzialmente
         *   il budget del ruolo;
         *
         * - consideriamo anche il budget
         *   generale rimasto per slot.
         */
        (
          1 +
          (
            budgetFactor - 1
          ) *
          0.5
        ) *
        globalBudgetFactor,
        0.8,
        1.1,
      )
      : clamp(
        /*
         * Nella modalità ruolo per ruolo
         * consideriamo soltanto la situazione
         * economica del ruolo corrente.
         */
        budgetFactor,
        0.8,
        1.1,
      );


  /*
  * Quotazione minima aggiornata.
  */
  const dynamicRecommendedMin =
    calculateRoundedDynamicPrice(
      player.recommended_min,
      combinedFactor,
      config.minimumBid,
    );

  /*
   * Quotazione centrale aggiornata.
   */
  const dynamicRecommendedPrice =
    Math.max(
      dynamicRecommendedMin,

      calculateRoundedDynamicPrice(
        player.recommended_price,
        combinedFactor,
        config.minimumBid,
      ),
    );

  /*
   * Quotazione massima consigliata.
   */
  const dynamicRecommendedMax =
    Math.max(
      dynamicRecommendedPrice,

      calculateRoundedDynamicPrice(
        player.recommended_max,
        combinedFactor,
        config.minimumBid,
      ),
    );

  /*
   * Limite massimo assoluto.
   */
  const dynamicAbsoluteMax =
    Math.max(
      dynamicRecommendedMax,

      calculateRoundedDynamicPrice(
        player.absolute_max,
        combinedFactor,
        config.minimumBid,
      ),
    );


  /*
   * Conserviamo l'offerta minima necessaria
   * per gli altri slot dello stesso ruolo.
   */
  const roleSlotsAfterPurchase =
    Math.max(
      remainingRoleSlots - 1,
      0,
    );

  const roleCreditsToReserve =
    roleSlotsAfterPurchase *
    config.minimumBid;

  const roleMaximumBid =
    Math.max(
      dynamicRoleBudgets[role] -
      roleCreditsToReserve,
      0,
    );


  const personalMaximumBid =
    Math.max(
      0,
      Math.min(
        maximumBid,
        remainingBudget,
        roleMaximumBid,
      ),
    );


  /*
  * Prezzo consigliato personalmente.
  *
  * Partiamo dalla quotazione di mercato,
  * ma la adattiamo leggermente alla situazione
  * economica della nostra rosa.
  */
  const personalSuggestedPrice =
    Math.max(
      config.minimumBid,
      Math.round(
        dynamicRecommendedPrice *
        personalBudgetFactor,
      ),
    );

  const suggestedBid =
    Math.min(
      personalSuggestedPrice,
      personalMaximumBid,
    );


  const marketTrend =
    combinedFactor < 0.95
      ? "In ribasso"
      : combinedFactor > 1.05
        ? "In rialzo"
        : "Stabile";


  return {
    dynamicRecommendedMin,
    dynamicRecommendedPrice,
    dynamicRecommendedMax,
    dynamicAbsoluteMax,

    personalMaximumBid,
    suggestedBid,

    marketFactor,
    budgetFactor,
    combinedFactor,

    marketTrend,

    isAffordable:
      remainingRoleSlots > 0 &&
      personalMaximumBid >=
      config.minimumBid,
  };
}