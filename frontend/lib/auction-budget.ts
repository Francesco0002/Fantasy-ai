/*
 * Ruoli e funzioni condivise
 * della modalità asta.
 */
import {
  AUCTION_ROLES,
  calculateRoleBudget,
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
 * Valore numerico associato
 * a ciascun ruolo.
 */
type RoleValues = Record<
  AuctionRole,
  number
>;


/*
 * Crea un oggetto inizializzato
 * con tutti i ruoli a zero.
 */
function createEmptyRoleValues(): RoleValues {
  return {
    P: 0,
    D: 0,
    C: 0,
    A: 0,
  };
}


/*
 * Distribuisce un numero intero di crediti
 * tra alcuni ruoli in base a dei pesi.
 *
 * La somma finale sarà esattamente
 * uguale a totalCredits.
 */
function distributeCredits(
  totalCredits: number,
  roles: AuctionRole[],
  getWeight: (
    role: AuctionRole,
  ) => number,
): RoleValues {
  const result =
    createEmptyRoleValues();

  if (
    totalCredits <= 0 ||
    roles.length === 0
  ) {
    return result;
  }

  const weightedRoles = roles.map(
    (role) => ({
      role,
      weight: Math.max(
        getWeight(role),
        0,
      ),
    }),
  );

  const totalWeight =
    weightedRoles.reduce(
      (total, currentRole) =>
        total + currentRole.weight,
      0,
    );

  /*
   * Se tutti i pesi sono zero,
   * utilizziamo una distribuzione uniforme.
   */
  const normalizedRoles =
    weightedRoles.map(
      (currentRole) => ({
        role: currentRole.role,
        weight:
          totalWeight > 0
            ? currentRole.weight
            : 1,
      }),
    );

  const normalizedTotalWeight =
    normalizedRoles.reduce(
      (total, currentRole) =>
        total + currentRole.weight,
      0,
    );

  const shares =
    normalizedRoles.map(
      (currentRole) => {
        const exactShare =
          (
            totalCredits *
            currentRole.weight
          ) /
          normalizedTotalWeight;

        const integerShare =
          Math.floor(exactShare);

        result[currentRole.role] =
          integerShare;

        return {
          role: currentRole.role,
          decimalRemainder:
            exactShare -
            integerShare,
        };
      },
    );

  const assignedCredits =
    roles.reduce(
      (total, role) =>
        total + result[role],
      0,
    );

  let creditsStillAvailable =
    totalCredits -
    assignedCredits;

  /*
   * Assegniamo i crediti residui
   * alle quote con il resto maggiore.
   */
  shares.sort(
    (firstShare, secondShare) =>
      secondShare.decimalRemainder -
      firstShare.decimalRemainder,
  );

  let index = 0;

  while (
    creditsStillAvailable > 0
  ) {
    const selectedRole =
      shares[
        index % shares.length
      ].role;

    result[selectedRole] += 1;

    creditsStillAvailable -= 1;
    index += 1;
  }

  return result;
}


/*
 * Rimuove crediti dai ruoli incompleti
 * senza scendere sotto il minimo necessario.
 */
function deductCredits(
  roleBudgets: RoleValues,
  minimumBudgets: RoleValues,
  roles: AuctionRole[],
  creditsToRemove: number,
): void {
  let remainingDeduction =
    Math.max(
      Math.trunc(creditsToRemove),
      0,
    );

  /*
   * Un credito alla volta garantisce
   * che nessun ruolo scenda sotto il minimo.
   *
   * Con budget normalmente inferiori a 1000
   * il costo computazionale è trascurabile.
   */
  while (remainingDeduction > 0) {
    const eligibleRoles =
      roles.filter(
        (role) =>
          roleBudgets[role] >
          minimumBudgets[role],
      );

    if (eligibleRoles.length === 0) {
      break;
    }

    /*
     * Togliamo il credito dal ruolo
     * con la maggiore parte flessibile.
     */
    eligibleRoles.sort(
      (firstRole, secondRole) => {
        const firstFlexibleBudget =
          roleBudgets[firstRole] -
          minimumBudgets[firstRole];

        const secondFlexibleBudget =
          roleBudgets[secondRole] -
          minimumBudgets[secondRole];

        return (
          secondFlexibleBudget -
          firstFlexibleBudget
        );
      },
    );

    const selectedRole =
      eligibleRoles[0];

    roleBudgets[selectedRole] -= 1;
    remainingDeduction -= 1;
  }
}


/*
 * Calcola il budget disponibile
 * per ciascun ruolo.
 *
 * Regole:
 *
 * 1. Il budget diminuisce dopo ogni acquisto.
 *
 * 2. Una parte del risparmio rispetto alla
 *    quotazione viene liberata e redistribuita.
 *
 * 3. Quando un ruolo viene completato,
 *    tutto il suo budget residuo passa
 *    agli altri ruoli incompleti.
 *
 * 4. Se un ruolo ha speso troppo,
 *    gli altri vengono ridotti soltanto
 *    quando serve a garantire gli slot minimi.
 */
export function calculateDynamicRoleBudgets(
  config: AuctionConfig,
  remainingBudget: number,
  remainingSlots: RoleValues,
  spentByRole: RoleValues,
  purchases: AuctionPurchase[],
): RoleValues {
  const result =
    createEmptyRoleValues();

  const minimumBudgets =
    createEmptyRoleValues();

  const releasedSavingsByRole =
    createEmptyRoleValues();

  const safeRemainingBudget =
    Math.max(
      Math.trunc(remainingBudget),
      0,
    );

  const activeRoles =
    AUCTION_ROLES.filter(
      (role) =>
        remainingSlots[role] > 0,
    );

  /*
   * Rosa completata.
   */
  if (activeRoles.length === 0) {
    return result;
  }


  /*
   * Nello stato iniziale restituiamo
   * esattamente la configurazione impostata.
   *
   * Questo evita piccole variazioni dovute
   * agli arrotondamenti.
   */
  if (purchases.length === 0) {
    activeRoles.forEach((role) => {
      result[role] =
        calculateRoleBudget(
          config,
          role,
        );
    });

    return result;
  }


  activeRoles.forEach((role) => {
    const initialRoleBudget =
      calculateRoleBudget(
        config,
        role,
      );

    const minimumRequiredBudget =
      remainingSlots[role] *
      config.minimumBid;

    minimumBudgets[role] =
      minimumRequiredBudget;

    /*
     * Budget iniziale meno quanto
     * è già stato speso nel ruolo.
     */
    result[role] = Math.max(
      initialRoleBudget -
      spentByRole[role],
      minimumRequiredBudget,
      0,
    );


    /*
     * Acquisti effettuati nel ruolo.
     */
    const rolePurchases =
      purchases.filter(
        (purchase) =>
          purchase.role === role,
      );


    /*
     * Risparmio ottenuto acquistando
     * sotto la quotazione originale.
     */
    const totalRealizedSavings =
      rolePurchases.reduce(
        (total, purchase) => {
          const referencePrice =
            purchase
              .baseRecommendedPriceAtPurchase;

          if (
            referencePrice === undefined ||
            referencePrice <= 0
          ) {
            return total;
          }

          return (
            total +
            Math.max(
              referencePrice -
              purchase.purchasePrice,
              0,
            )
          );
        },
        0,
      );


    /*
     * Man mano che il ruolo si completa,
     * liberiamo una parte maggiore
     * dei risparmi ottenuti.
     *
     * Dal 25% iniziale fino al 75%.
     */
    const totalRoleSlots =
      Math.max(
        config.rosterSlots[role],
        1,
      );

    const purchasedRoleSlots =
      totalRoleSlots -
      remainingSlots[role];

    const roleCompletionRatio =
      Math.min(
        Math.max(
          purchasedRoleSlots /
          totalRoleSlots,
          0,
        ),
        1,
      );

    /*
    * Modalità ruolo per ruolo:
    * il budget viene mantenuto nel ruolo
    * fino al completamento degli slot.
    *
    * Modalità totalmente random:
    * una parte del risparmio viene liberata
    * dopo ogni acquisto, perché tutti i ruoli
    * possono essere chiamati in qualsiasi momento.
    */
    const releaseRate =
      config.auctionMode ===
        "FULL_RANDOM"
        ? 0.35 +
        roleCompletionRatio * 0.4
        : 0;


    const maximumReleasableBudget =
      Math.max(
        result[role] -
        minimumRequiredBudget,
        0,
      );

    const releasedSavings =
      Math.min(
        Math.floor(
          totalRealizedSavings *
          releaseRate,
        ),
        maximumReleasableBudget,
      );

    result[role] -=
      releasedSavings;

    releasedSavingsByRole[role] =
      releasedSavings;
  });


  /*
   * Budget complessivamente assegnato
   * dopo acquisti e risparmi liberati.
   */
  const assignedBudget =
    activeRoles.reduce(
      (total, role) =>
        total + result[role],
      0,
    );

  const budgetDifference =
    safeRemainingBudget -
    assignedBudget;


  /*
   * Crediti da redistribuire.
   *
   * Possono provenire da:
   * - risparmi sugli acquisti;
   * - completamento di un ruolo;
   * - arrotondamenti.
   */
  if (budgetDifference > 0) {
    /*
     * Quando possibile, il risparmio
     * viene assegnato agli altri ruoli.
     */
    const rolesWithoutReleasedSavings =
      activeRoles.filter(
        (role) =>
          releasedSavingsByRole[role] ===
          0,
      );

    const recipientRoles =
      rolesWithoutReleasedSavings.length >
        0
        ? rolesWithoutReleasedSavings
        : activeRoles;

    const additionalBudgets =
      distributeCredits(
        budgetDifference,
        recipientRoles,
        (role) =>
          config.budgetDistribution[
          role
          ] *
          Math.max(
            remainingSlots[role],
            1,
          ),
      );

    recipientRoles.forEach((role) => {
      result[role] +=
        additionalBudgets[role];
    });
  }


  /*
   * Crediti da recuperare quando
   * uno o più ruoli hanno speso troppo.
   */
  if (budgetDifference < 0) {
    deductCredits(
      result,
      minimumBudgets,
      activeRoles,
      Math.abs(budgetDifference),
    );
  }


  return result;
}