import type {
  AuctionConfig,
  AuctionLeagueRules,
  AuctionMode,
  AuctionRole,
  BudgetDistribution,
} from "../types/auction";


/*
 * Regole classiche predefinite.
 *
 * Saranno modificabili dall'utente
 * prima di iniziare l'asta.
 */
export const DEFAULT_LEAGUE_RULES:
  AuctionLeagueRules = {
  scoring: {
    goalByRole: {
      P: 3,
      D: 3,
      C: 3,
      A: 3,
    },

    assist: 1,
    cleanSheet: 1,
    goalConceded: -1,

    penaltyScored: 3,
    penaltyMissed: -3,
    penaltySaved: 3,

    yellowCard: -0.5,
    redCard: -1,
    ownGoal: -2,
  },

  /*
   * Il modificatore difesa è disattivato
   * nella configurazione iniziale.
   */
  defenseModifier: {
    enabled: false,
    minimumDefenders: 4,
    includeGoalkeeper: true,
    consideredPlayers: 4,

    bands: [
      {
        minimumAverage: 6,
        bonus: 1,
      },
      {
        minimumAverage: 6.25,
        bonus: 2,
      },
      {
        minimumAverage: 6.5,
        bonus: 3,
      },
      {
        minimumAverage: 7,
        bonus: 6,
      },
    ],
  },

  /*
   * Il modificatore centrocampo è disattivato
   * nella configurazione iniziale.
   */
  midfieldModifier: {
    enabled: false,
    minimumMidfielders: 4,
    consideredPlayers: 4,

    bands: [
      {
        minimumAverage: 6,
        bonus: 1,
      },
      {
        minimumAverage: 6.25,
        bonus: 2,
      },
      {
        minimumAverage: 6.5,
        bonus: 3,
      },
      {
        minimumAverage: 7,
        bonus: 6,
      },
    ],
  },
};


/*
 * Distribuzione di partenza utilizzata
 * dalla strategia automatica.
 *
 * Le regole della lega modificano
 * queste percentuali.
 */
export const BASE_BUDGET_DISTRIBUTION:
  BudgetDistribution = {
  P: 0.08,
  D: 0.16,
  C: 0.26,
  A: 0.50,
};


/*
 * Configurazione predefinita per una lega
 * di Fantacalcio Classic con 8 partecipanti.
 */
export const DEFAULT_AUCTION_CONFIG:
  AuctionConfig = {
  leagueName: "Lega di prova",
  participants: 8,
  startingBudget: 500,
  minimumBid: 1,

  auctionMode: "ROLE_BY_ROLE",

  /*
   * In modalità automatica le percentuali
   * verranno adattate alle regole della lega.
   */
  budgetStrategy: "AUTOMATIC",

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
   * Distribuzione iniziale di base.
   *
   * La somma deve essere uguale a 1.
   */
  budgetDistribution: {
    ...BASE_BUDGET_DISTRIBUTION,
  },

  leagueRules: DEFAULT_LEAGUE_RULES,
};


/*
 * Crea una copia completa delle regole.
 *
 * È importante perché i modificatori
 * contengono array e oggetti annidati.
 */
export function cloneLeagueRules(
  rules: AuctionLeagueRules,
): AuctionLeagueRules {
  return {
    scoring: {
      ...rules.scoring,

      goalByRole: {
        ...rules.scoring.goalByRole,
      },
    },

    defenseModifier: {
      ...rules.defenseModifier,

      bands:
        rules.defenseModifier.bands.map(
          (band) => ({
            ...band,
          }),
        ),
    },

    midfieldModifier: {
      ...rules.midfieldModifier,

      bands:
        rules.midfieldModifier.bands.map(
          (band) => ({
            ...band,
          }),
        ),
    },
  };
}


/*
 * Restituisce le regole della configurazione.
 *
 * Le vecchie sessioni che non possiedono
 * leagueRules ricevono automaticamente
 * le regole classiche predefinite.
 */
export function getLeagueRules(
  config: AuctionConfig,
): AuctionLeagueRules {
  return cloneLeagueRules(
    config.leagueRules ??
    DEFAULT_LEAGUE_RULES,
  );
}


/*
 * Crea una nuova configurazione indipendente.
 *
 * Evita che due aste condividano per errore
 * lo stesso oggetto di configurazione.
 */
export function createDefaultAuctionConfig():
  AuctionConfig {
  return {
    ...DEFAULT_AUCTION_CONFIG,

    rosterSlots: {
      ...DEFAULT_AUCTION_CONFIG.rosterSlots,
    },

    budgetDistribution: {
      ...DEFAULT_AUCTION_CONFIG
        .budgetDistribution,
    },

    leagueRules: cloneLeagueRules(
      DEFAULT_LEAGUE_RULES,
    ),
  };
}


/*
 * Limita un valore tra un minimo
 * e un massimo.
 */
function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(
    maximum,
    Math.max(
      minimum,
      value,
    ),
  );
}


/*
 * Arrotonda una percentuale
 * a quattro cifre decimali.
 */
function roundPercentage(
  value: number,
): number {
  return Math.round(
    value * 10000,
  ) / 10000;
}


/*
 * Normalizza una distribuzione affinché
 * la somma finale sia esattamente 1.
 */
export function normalizeBudgetDistribution(
  distribution: BudgetDistribution,
): BudgetDistribution {
  const safeDistribution = {
    P: Math.max(
      0.01,
      distribution.P,
    ),

    D: Math.max(
      0.01,
      distribution.D,
    ),

    C: Math.max(
      0.01,
      distribution.C,
    ),

    A: Math.max(
      0.01,
      distribution.A,
    ),
  };

  const total =
    safeDistribution.P +
    safeDistribution.D +
    safeDistribution.C +
    safeDistribution.A;

  const normalized: BudgetDistribution = {
    P: roundPercentage(
      safeDistribution.P / total,
    ),

    D: roundPercentage(
      safeDistribution.D / total,
    ),

    C: roundPercentage(
      safeDistribution.C / total,
    ),

    A: roundPercentage(
      safeDistribution.A / total,
    ),
  };

  /*
   * Corregge gli eventuali millesimi
   * persi durante l'arrotondamento.
   */
  const normalizedTotal =
    normalized.P +
    normalized.D +
    normalized.C +
    normalized.A;

  normalized.A = roundPercentage(
    normalized.A +
    (1 - normalizedTotal),
  );

  return normalized;
}


/*
 * Calcola la distribuzione automatica
 * del budget in base alle regole.
 *
 * Questo è il primo modello euristico.
 * In futuro i pesi potranno essere
 * allenati sui dati reali delle aste.
 */
export function calculateAutomaticBudgetDistribution(
  config: AuctionConfig,
): BudgetDistribution {
  const rules = getLeagueRules(
    config,
  );

  const distribution: BudgetDistribution = {
    ...BASE_BUDGET_DISTRIBUTION,
  };


  /*
   * Modificatore difesa.
   *
   * Aumenta il valore dei difensori
   * affidabili e, quando incluso,
   * anche quello dei portieri.
   */
  if (
    rules.defenseModifier.enabled
  ) {
    distribution.D += 0.06;
    distribution.C -= 0.01;
    distribution.A -= 0.05;

    if (
      rules.defenseModifier
        .includeGoalkeeper
    ) {
      distribution.P += 0.01;
      distribution.A -= 0.01;
    }
  }


  /*
   * Modificatore centrocampo.
   *
   * Aumenta il valore dei centrocampisti
   * titolari e dalla buona media voto.
   */
  if (
    rules.midfieldModifier.enabled
  ) {
    distribution.P -= 0.005;
    distribution.D -= 0.015;
    distribution.C += 0.08;
    distribution.A -= 0.06;
  }


  /*
   * Impatto del bonus porta inviolata.
   *
   * Il valore classico di riferimento
   * è +1.
   */
  const cleanSheetDifference = clamp(
    rules.scoring.cleanSheet - 1,
    -2,
    3,
  );

  distribution.P +=
    cleanSheetDifference * 0.006;

  distribution.D +=
    cleanSheetDifference * 0.012;

  distribution.C -=
    cleanSheetDifference * 0.006;

  distribution.A -=
    cleanSheetDifference * 0.012;


  /*
   * Impatto del malus per gol subito.
   *
   * Un malus più pesante riduce
   * leggermente il budget dei portieri.
   */
  const goalConcededSeverity = clamp(
    -rules.scoring.goalConceded - 1,
    -1,
    2,
  );

  distribution.P -=
    goalConcededSeverity * 0.008;

  distribution.A +=
    goalConcededSeverity * 0.008;


  /*
   * Impatto del bonus rigore parato.
   */
  const penaltySavedDifference = clamp(
    rules.scoring.penaltySaved - 3,
    -3,
    4,
  );

  distribution.P +=
    penaltySavedDifference * 0.003;

  distribution.A -=
    penaltySavedDifference * 0.003;


  /*
   * Confronto tra il bonus gol
   * degli altri ruoli e quello
   * degli attaccanti.
   */
  const goalkeeperGoalDifference = clamp(
    rules.scoring.goalByRole.P -
    rules.scoring.goalByRole.A,
    -2,
    4,
  );

  const defenderGoalDifference = clamp(
    rules.scoring.goalByRole.D -
    rules.scoring.goalByRole.A,
    -2,
    4,
  );

  const midfielderGoalDifference = clamp(
    rules.scoring.goalByRole.C -
    rules.scoring.goalByRole.A,
    -2,
    4,
  );

  const goalkeeperGoalShift =
    goalkeeperGoalDifference * 0.001;

  const defenderGoalShift =
    defenderGoalDifference * 0.01;

  const midfielderGoalShift =
    midfielderGoalDifference * 0.008;

  distribution.P +=
    goalkeeperGoalShift;

  distribution.D +=
    defenderGoalShift;

  distribution.C +=
    midfielderGoalShift;

  distribution.A -=
    goalkeeperGoalShift +
    defenderGoalShift +
    midfielderGoalShift;


  /*
   * Un bonus assist più alto aumenta
   * soprattutto il peso di centrocampisti
   * e giocatori offensivi.
   */
  const assistDifference = clamp(
    rules.scoring.assist - 1,
    -1,
    2,
  );

  distribution.P -=
    assistDifference * 0.002;

  distribution.D +=
    assistDifference * 0.004;

  distribution.C +=
    assistDifference * 0.01;

  distribution.A +=
    assistDifference * 0.006;


  return normalizeBudgetDistribution(
    distribution,
  );
}


/*
 * Restituisce la distribuzione da usare.
 *
 * Le vecchie sessioni senza budgetStrategy
 * mantengono la distribuzione salvata.
 */
export function getEffectiveBudgetDistribution(
  config: AuctionConfig,
): BudgetDistribution {
  const strategy =
    config.budgetStrategy ??
    "MANUAL";

  if (
    strategy === "AUTOMATIC"
  ) {
    return (
      calculateAutomaticBudgetDistribution(
        config,
      )
    );
  }

  return {
    ...config.budgetDistribution,
  };
}


/*
 * Restituisce una nuova configurazione
 * con il budget automatico già applicato.
 */
export function applyAutomaticBudgetDistribution(
  config: AuctionConfig,
): AuctionConfig {
  const budgetDistribution =
    calculateAutomaticBudgetDistribution(
      config,
    );

  return {
    ...config,

    budgetStrategy: "AUTOMATIC",

    budgetDistribution,
  };
}


/*
 * Nomi mostrati nell'interfaccia.
 */
export const AUCTION_MODE_NAMES: Record<
  AuctionMode,
  string
> = {
  ROLE_BY_ROLE:
    "Random ruolo per ruolo",

  FULL_RANDOM:
    "Totalmente random",
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
 */
export const AUCTION_ROLES: AuctionRole[] = [
  "P",
  "D",
  "C",
  "A",
];


/*
 * Divide il budget iniziale tra i ruoli
 * garantendo che la somma finale sia
 * esattamente uguale al budget disponibile.
 *
 * Utilizziamo il metodo dei resti maggiori:
 *
 * 1. calcoliamo il budget decimale;
 * 2. assegniamo inizialmente la parte intera;
 * 3. distribuiamo i crediti rimasti ai ruoli
 *    con la parte decimale più alta.
 */
export function calculateRoleBudgets(
  config: AuctionConfig,
): Record<AuctionRole, number> {
  const distribution =
    getEffectiveBudgetDistribution(
      config,
    );

  const startingBudget =
    Math.max(
      Math.trunc(
        config.startingBudget,
      ),
      0,
    );

  const allocations =
    AUCTION_ROLES.map(
      (role, roleOrder) => {
        const rawBudget =
          startingBudget *
          distribution[role];

        const baseBudget =
          Math.floor(rawBudget);

        return {
          role,
          roleOrder,
          baseBudget,

          decimalRemainder:
            rawBudget -
            baseBudget,
        };
      },
    );

  const roleBudgets:
    Record<AuctionRole, number> = {
    P: 0,
    D: 0,
    C: 0,
    A: 0,
  };

  let assignedBudget = 0;

  for (
    const allocation
    of allocations
  ) {
    roleBudgets[
      allocation.role
    ] = allocation.baseBudget;

    assignedBudget +=
      allocation.baseBudget;
  }

  /*
   * Crediti che non sono ancora stati
   * assegnati dopo l'arrotondamento
   * verso il basso.
   */
  const remainingCredits =
    Math.max(
      startingBudget -
      assignedBudget,
      0,
    );

  /*
   * I crediti rimanenti vengono assegnati
   * partendo dai ruoli con il resto
   * decimale più alto.
   *
   * roleOrder rende stabile il risultato
   * quando due resti sono identici.
   */
  const orderedAllocations = [
    ...allocations,
  ].sort(
    (
      firstAllocation,
      secondAllocation,
    ) => {
      const remainderDifference =
        secondAllocation
          .decimalRemainder -
        firstAllocation
          .decimalRemainder;

      if (remainderDifference !== 0) {
        return remainderDifference;
      }

      return (
        firstAllocation.roleOrder -
        secondAllocation.roleOrder
      );
    },
  );

  for (
    let index = 0;
    index < remainingCredits;
    index += 1
  ) {
    const allocation =
      orderedAllocations[
      index %
      orderedAllocations.length
      ];

    roleBudgets[
      allocation.role
    ] += 1;
  }

  return roleBudgets;
}


/*
 * Restituisce il budget intero
 * assegnato a uno specifico ruolo.
 */
export function calculateRoleBudget(
  config: AuctionConfig,
  role: AuctionRole,
): number {
  return calculateRoleBudgets(
    config,
  )[role];
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