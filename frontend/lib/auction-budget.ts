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
  AuctionRole,
} from "../types/auction";


/*
 * Budget associato a ciascun ruolo.
 */
type RoleBudgets = Record<
  AuctionRole,
  number
>;


/*
 * Crea un oggetto vuoto
 * contenente tutti i ruoli.
 */
function createEmptyRoleBudgets(): RoleBudgets {
  return {
    P: 0,
    D: 0,
    C: 0,
    A: 0,
  };
}


/*
 * Distribuisce un numero intero di crediti
 * tra alcuni ruoli utilizzando dei pesi.
 *
 * La somma dei valori restituiti
 * è sempre uguale a totalCredits.
 */
function distributeCredits(
  totalCredits: number,
  roles: AuctionRole[],
  getWeight: (
    role: AuctionRole,
  ) => number,
): RoleBudgets {
  const result =
    createEmptyRoleBudgets();

  if (
    totalCredits <= 0 ||
    roles.length === 0
  ) {
    return result;
  }


  /*
   * Recuperiamo i pesi validi.
   */
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
   * Quando tutti i pesi sono zero,
   * distribuiamo i crediti in parti uguali.
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


  /*
   * Prima assegniamo la parte intera
   * di ogni quota.
   */
  const shares = normalizedRoles.map(
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
   * Gli eventuali crediti rimasti
   * vengono assegnati alle quote
   * con il resto decimale maggiore.
   */
  shares.sort(
    (firstShare, secondShare) =>
      secondShare.decimalRemainder -
      firstShare.decimalRemainder,
  );


  let shareIndex = 0;

  while (
    creditsStillAvailable > 0
  ) {
    const selectedRole =
      shares[
        shareIndex % shares.length
      ].role;

    result[selectedRole] += 1;

    creditsStillAvailable -= 1;
    shareIndex += 1;
  }


  return result;
}


/*
 * Calcola il budget ancora disponibile
 * per ciascun ruolo.
 *
 * Principi utilizzati:
 *
 * 1. Un ruolo incompleto conserva il proprio
 *    budget iniziale non ancora speso.
 *
 * 2. Il risparmio viene redistribuito solamente
 *    quando un ruolo viene completato.
 *
 * 3. Un eventuale superamento del budget viene
 *    sottratto dai ruoli ancora incompleti.
 *
 * 4. Ogni ruolo conserva almeno i crediti minimi
 *    necessari per completare i propri slot.
 */
export function calculateDynamicRoleBudgets(
  config: AuctionConfig,
  remainingBudget: number,

  remainingSlots: RoleBudgets,
  spentByRole: RoleBudgets,
): RoleBudgets {
  const result =
    createEmptyRoleBudgets();


  const safeRemainingBudget =
    Math.max(
      Math.trunc(remainingBudget),
      0,
    );


  /*
   * Consideriamo soltanto i ruoli
   * che hanno ancora slot disponibili.
   */
  const activeRoles =
    AUCTION_ROLES.filter(
      (role) =>
        remainingSlots[role] > 0,
    );


  /*
   * Quando la rosa è completa,
   * non esistono più budget da assegnare.
   */
  if (activeRoles.length === 0) {
    return result;
  }


  /*
   * Crediti minimi necessari
   * per completare ciascun ruolo.
   */
  const minimumBudgetByRole =
    createEmptyRoleBudgets();


  /*
   * Costruiamo il budget di base.
   *
   * Per ogni ruolo ancora incompleto:
   *
   * budget iniziale
   * - crediti già spesi
   *
   * Esempio:
   * 40 iniziali - 36 spesi = 4 disponibili.
   */
  activeRoles.forEach((role) => {
    const initialRoleBudget =
      calculateRoleBudget(
        config,
        role,
      );

    const plannedRemainingBudget =
      initialRoleBudget -
      spentByRole[role];

    const minimumRequiredBudget =
      remainingSlots[role] *
      config.minimumBid;

    minimumBudgetByRole[role] =
      minimumRequiredBudget;


    /*
     * Garantiamo almeno l'offerta minima
     * necessaria per gli slot mancanti.
     */
    result[role] = Math.max(
      plannedRemainingBudget,
      minimumRequiredBudget,
      0,
    );
  });


  /*
   * Totale attualmente assegnato
   * ai ruoli incompleti.
   */
  const currentlyAssignedBudget =
    activeRoles.reduce(
      (total, role) =>
        total + result[role],
      0,
    );


  /*
   * Differenza tra:
   * - budget realmente rimasto;
   * - budget attualmente assegnato.
   *
   * Differenza positiva:
   * ci sono risparmi da redistribuire.
   *
   * Differenza negativa:
   * qualche ruolo ha speso oltre il piano.
   */
  const budgetDifference =
    safeRemainingBudget -
    currentlyAssignedBudget;


  /*
   * Redistribuzione dei risparmi.
   *
   * Succede, ad esempio, quando un ruolo
   * viene completato spendendo meno
   * del budget inizialmente previsto.
   */
  if (budgetDifference > 0) {
    const additionalBudgets =
      distributeCredits(
        budgetDifference,
        activeRoles,
        (role) =>
          config.budgetDistribution[
            role
          ],
      );

    activeRoles.forEach((role) => {
      result[role] +=
        additionalBudgets[role];
    });
  }


  /*
   * Riduzione dovuta a un superamento
   * del budget previsto.
   */
  if (budgetDifference < 0) {
    const creditsToRemove =
      Math.abs(budgetDifference);


    /*
     * Possiamo togliere crediti soltanto
     * dalla parte superiore al minimo necessario.
     */
    const rolesWithFlexibleBudget =
      activeRoles.filter(
        (role) =>
          result[role] >
          minimumBudgetByRole[role],
      );


    const deductions =
      distributeCredits(
        creditsToRemove,
        rolesWithFlexibleBudget,
        (role) =>
          result[role] -
          minimumBudgetByRole[role],
      );


    rolesWithFlexibleBudget.forEach(
      (role) => {
        const maximumDeduction =
          result[role] -
          minimumBudgetByRole[role];

        const actualDeduction =
          Math.min(
            deductions[role],
            maximumDeduction,
          );

        result[role] -=
          actualDeduction;
      },
    );
  }


  return result;
}