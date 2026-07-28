"use client";


import CustomSelect from
  "../ui/CustomSelect";

/*
 * Hook React utilizzato per conservare
 * la configurazione inserita dall'utente.
 */
import { useState } from "react";

/*
 * Configurazione iniziale e funzioni
 * condivise della modalità asta.
 */
import {
  applyAutomaticBudgetDistribution,
  AUCTION_MODE_NAMES,
  AUCTION_ROLES,
  AUCTION_ROLE_NAMES,
  calculateRoleBudget,
  calculateTotalRosterSlots,
  createDefaultAuctionConfig,
  getEffectiveBudgetDistribution,
  getLeagueRules,
  isBudgetDistributionValid,
} from "../../lib/auction-config";

/*
 * Tipi della configurazione d'asta.
 */
import type {
  AuctionConfig,
  AuctionLeagueRules,
  AuctionRole,
  AuctionScoringRules,
} from "../../types/auction";


/*
 * Proprietà ricevute dal componente.
 *
 * onStart viene eseguita quando
 * la configurazione è valida e l'utente
 * preme "Inizia asta".
 */
type AuctionSetupFormProps = {
  onStart: (
    config: AuctionConfig,
  ) => Promise<void>;
};


/*
 * Opzioni disponibili per la modalità
 * con cui vengono chiamati i giocatori.
 */
const AUCTION_MODE_OPTIONS: readonly {
  value: AuctionConfig["auctionMode"];
  label: string;
}[] = [
    {
      value: "ROLE_BY_ROLE",
      label:
        AUCTION_MODE_NAMES
          .ROLE_BY_ROLE,
    },

    {
      value: "FULL_RANDOM",
      label:
        AUCTION_MODE_NAMES
          .FULL_RANDOM,
    },
  ];


/*
 * Modalità disponibili per la gestione
 * della distribuzione del budget.
 */
const BUDGET_STRATEGY_OPTIONS: readonly {
  value: NonNullable<
    AuctionConfig["budgetStrategy"]
  >;

  label: string;
}[] = [
    {
      value: "AUTOMATIC",
      label: "Automatica",
    },
    {
      value: "MANUAL",
      label: "Manuale",
    },
  ];


type EditableScoringField = Exclude<
  keyof AuctionScoringRules,
  "goalByRole"
>;


/*
 * Bonus e malus modificabili
 * dalla configurazione della lega.
 */
const SCORING_RULE_FIELDS: readonly {
  key: EditableScoringField;
  label: string;
  description: string;
}[] = [
    {
      key: "assist",
      label: "Assist",
      description:
        "Bonus assegnato per ogni assist.",
    },
    {
      key: "cleanSheet",
      label: "Porta inviolata",
      description:
        "Bonus per il portiere senza gol subiti.",
    },
    {
      key: "goalConceded",
      label: "Gol subito",
      description:
        "Malus applicato al portiere.",
    },
    {
      key: "penaltyScored",
      label: "Rigore segnato",
      description:
        "Bonus per un rigore realizzato.",
    },
    {
      key: "penaltyMissed",
      label: "Rigore sbagliato",
      description:
        "Malus per un rigore fallito.",
    },
    {
      key: "penaltySaved",
      label: "Rigore parato",
      description:
        "Bonus assegnato al portiere.",
    },
    {
      key: "yellowCard",
      label: "Ammonizione",
      description:
        "Malus per un cartellino giallo.",
    },
    {
      key: "redCard",
      label: "Espulsione",
      description:
        "Malus per un cartellino rosso.",
    },
    {
      key: "ownGoal",
      label: "Autogol",
      description:
        "Malus per un autogol.",
    },
  ];


/*
 * Crea una copia indipendente della configurazione.
 *
 * Copiamo anche gli oggetti interni per evitare
 * di modificare accidentalmente la configurazione
 * predefinita condivisa.
 */
function createDefaultConfig(): AuctionConfig {
  const defaultConfig =
    createDefaultAuctionConfig();

  return {
    ...defaultConfig,

    opponentTeamNames: [
      ...(
        defaultConfig
          .opponentTeamNames ?? []
      ),
    ],
  };
}

/*
 * Converte il valore di un input numerico
 * in un numero utilizzabile.
 */
function parseNumericInput(
  value: string,
): number {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    return 0;
  }

  return parsedValue;
}


/*
 * Crea l'elenco dei nomi avversari
 * in base al numero dei partecipanti.
 *
 * Il numero degli avversari è:
 * partecipanti totali - la nostra squadra.
 */
function resizeOpponentTeamNames(
  participants: number,
  currentNames: string[] = [],
): string[] {
  const opponentsCount =
    Math.max(
      participants - 1,
      0,
    );

  return Array.from(
    {
      length: opponentsCount,
    },
    (_, index) =>
      currentNames[index] ?? "",
  );
}


/*
 * Applica le nuove regole alla configurazione.
 *
 * Quando la strategia è automatica,
 * ricalcola immediatamente anche
 * la distribuzione del budget.
 */
function applyLeagueRulesUpdate(
  config: AuctionConfig,
  leagueRules: AuctionLeagueRules,
): AuctionConfig {
  const updatedConfig: AuctionConfig = {
    ...config,
    leagueRules,
  };

  if (
    (
      config.budgetStrategy ??
      "MANUAL"
    ) === "AUTOMATIC"
  ) {
    return applyAutomaticBudgetDistribution(
      updatedConfig,
    );
  }

  return updatedConfig;
}


/*
 * Controlla la configurazione e restituisce
 * il primo errore trovato.
 *
 * null significa che la configurazione è valida.
 */
function getConfigError(
  config: AuctionConfig,
): string | null {
  if (config.leagueName.trim() === "") {
    return "Inserisci il nome della lega.";
  }

  if (
    !Number.isInteger(config.participants) ||
    config.participants < 2
  ) {
    return "Il numero di partecipanti deve essere almeno 2.";
  }

  /*
  * Controlliamo i nomi soltanto
  * quando l'opzione è stata attivata.
  */
  const opponentTeamNames =
    config.opponentTeamNames ?? [];

  if (opponentTeamNames.length > 0) {
    const expectedOpponentCount =
      config.participants - 1;

    if (
      opponentTeamNames.length !==
      expectedOpponentCount
    ) {
      return `Inserisci esattamente ${expectedOpponentCount} squadre avversarie.`;
    }

    const trimmedNames =
      opponentTeamNames.map(
        (teamName) =>
          teamName.trim(),
      );

    if (
      trimmedNames.some(
        (teamName) =>
          teamName === "",
      )
    ) {
      return "Inserisci il nome di tutte le squadre avversarie.";
    }

    /*
     * Normalizziamo i nomi per impedire
     * duplicati come:
     *
     * Team Marco
     * team marco
     */
    const normalizedNames =
      trimmedNames.map(
        (teamName) =>
          teamName.toLocaleLowerCase(
            "it-IT",
          ),
      );

    if (
      new Set(normalizedNames).size !==
      normalizedNames.length
    ) {
      return "I nomi delle squadre avversarie non possono essere duplicati.";
    }
  }

  if (
    !Number.isInteger(config.startingBudget) ||
    config.startingBudget <= 0
  ) {
    return "Il budget iniziale deve essere un numero intero positivo.";
  }

  if (
    !Number.isInteger(config.minimumBid) ||
    config.minimumBid <= 0
  ) {
    return "L'offerta minima deve essere un numero intero positivo.";
  }

  if (
    config.minimumBid >
    config.startingBudget
  ) {
    return "L'offerta minima non può superare il budget iniziale.";
  }

  /*
   * Ogni numero di slot deve essere
   * un intero maggiore o uguale a zero.
   */
  const hasInvalidSlots =
    AUCTION_ROLES.some((role) => {
      const slots =
        config.rosterSlots[role];

      return (
        !Number.isInteger(slots) ||
        slots < 0
      );
    });

  if (hasInvalidSlots) {
    return "Gli slot della rosa devono essere numeri interi non negativi.";
  }

  /*
 * Numero complessivo di giocatori
 * che devono essere acquistati.
 */
  const totalRosterSlots =
    calculateTotalRosterSlots(config);

  if (totalRosterSlots === 0) {
    return "La rosa deve contenere almeno un giocatore.";
  }


  /*
   * Il budget deve permettere almeno
   * un'offerta minima per ogni slot.
   *
   * Esempio:
   * 25 giocatori × 1 credito = almeno 25 crediti.
   */
  const minimumRequiredBudget =
    totalRosterSlots * config.minimumBid;

  if (
    config.startingBudget <
    minimumRequiredBudget
  ) {
    return `Servono almeno ${minimumRequiredBudget} crediti per completare tutti gli slot.`;
  }

  /*
 * Controlli relativi ai modificatori.
 */
  const leagueRules =
    getLeagueRules(config);

  if (
    leagueRules
      .defenseModifier
      .enabled
  ) {
    const minimumDefenders =
      leagueRules
        .defenseModifier
        .minimumDefenders;

    if (
      !Number.isInteger(
        minimumDefenders,
      ) ||
      minimumDefenders < 1
    ) {
      return "Il numero minimo di difensori deve essere un intero positivo.";
    }

    if (
      minimumDefenders >
      config.rosterSlots.D
    ) {
      return "Il numero minimo di difensori del modificatore supera gli slot disponibili.";
    }

    if (
      !Number.isInteger(
        leagueRules
          .defenseModifier
          .consideredPlayers,
      ) ||
      leagueRules
        .defenseModifier
        .consideredPlayers < 1
    ) {
      return "Il numero di voti del modificatore difesa deve essere un intero positivo.";
    }
  }

  /*
 * Tutti i bonus e malus devono
 * essere numeri compresi tra -20 e 20.
 */
  const scoringValues = [
    ...Object.values(
      leagueRules
        .scoring
        .goalByRole,
    ),

    leagueRules.scoring.assist,
    leagueRules.scoring.cleanSheet,
    leagueRules.scoring.goalConceded,
    leagueRules.scoring.penaltyScored,
    leagueRules.scoring.penaltyMissed,
    leagueRules.scoring.penaltySaved,
    leagueRules.scoring.yellowCard,
    leagueRules.scoring.redCard,
    leagueRules.scoring.ownGoal,
  ];

  const hasInvalidScoringValue =
    scoringValues.some(
      (value) =>
        !Number.isFinite(value) ||
        value < -20 ||
        value > 20,
    );

  if (hasInvalidScoringValue) {
    return "I bonus e i malus devono essere compresi tra -20 e 20.";
  }

  if (
    leagueRules
      .midfieldModifier
      .enabled
  ) {
    const minimumMidfielders =
      leagueRules
        .midfieldModifier
        .minimumMidfielders;

    if (
      !Number.isInteger(
        minimumMidfielders,
      ) ||
      minimumMidfielders < 1
    ) {
      return "Il numero minimo di centrocampisti deve essere un intero positivo.";
    }

    if (
      minimumMidfielders >
      config.rosterSlots.C
    ) {
      return "Il numero minimo di centrocampisti del modificatore supera gli slot disponibili.";
    }

    if (
      !Number.isInteger(
        leagueRules
          .midfieldModifier
          .consideredPlayers,
      ) ||
      leagueRules
        .midfieldModifier
        .consideredPlayers < 1
    ) {
      return "Il numero di voti del modificatore centrocampo deve essere un intero positivo.";
    }
  }


  /*
   * In modalità automatica controlliamo
   * la distribuzione calcolata dal sistema.
   */
  const effectiveBudgetDistribution =
    getEffectiveBudgetDistribution(
      config,
    );

  const configWithEffectiveBudget:
    AuctionConfig = {
    ...config,

    budgetDistribution:
      effectiveBudgetDistribution,
  };

  if (
    !isBudgetDistributionValid(
      configWithEffectiveBudget,
    )
  ) {
    return "La distribuzione del budget deve essere pari al 100%.";
  }

  return null;
}


/*
 * Modulo iniziale della modalità asta.
 */
export default function AuctionSetupForm({
  onStart,
}: AuctionSetupFormProps) {
  /*
   * Configurazione attualmente inserita.
   */
  const [config, setConfig] =
    useState<AuctionConfig>(
      createDefaultConfig,
    );


  /*
   * Indica se la configurazione
   * viene salvata nel database.
   */
  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);


  /*
  * Indica se l'utente desidera
  * configurare in anticipo i nomi
  * delle squadre avversarie.
  */
  const [
    usePredefinedOpponentNames,
    setUsePredefinedOpponentNames,
  ] = useState(false);


  /*
  * Regole effettivamente applicate.
  *
  * Per le configurazioni vecchie vengono
  * utilizzati i valori predefiniti.
  */
  const leagueRules =
    getLeagueRules(config);


  /*
   * Distribuzione realmente mostrata.
   *
   * In modalità automatica viene calcolata
   * dalle regole della lega.
   */
  const effectiveBudgetDistribution =
    getEffectiveBudgetDistribution(
      config,
    );


  /*
   * Calcoliamo la percentuale complessiva
   * assegnata ai quattro ruoli.
   */
  const budgetPercentageTotal =
    Math.round(
      (
        effectiveBudgetDistribution.P +
        effectiveBudgetDistribution.D +
        effectiveBudgetDistribution.C +
        effectiveBudgetDistribution.A
      ) * 100,
    );

  /*
   * Eventuale errore della configurazione.
   */
  const configError =
    getConfigError(config);


  /*
   * Aggiorna il numero di slot
   * di uno specifico ruolo.
   */
  function updateRosterSlots(
    role: AuctionRole,
    value: string,
  ) {
    const parsedValue =
      parseNumericInput(value);

    setConfig((currentConfig) => ({
      ...currentConfig,

      rosterSlots: {
        ...currentConfig.rosterSlots,

        /*
         * Accettiamo solamente interi
         * maggiori o uguali a zero.
         */
        [role]: Math.max(
          0,
          Math.trunc(parsedValue),
        ),
      },
    }));
  }


  /*
   * Aggiorna la percentuale di budget
   * assegnata a uno specifico ruolo.
   *
   * Nell'interfaccia usiamo valori da 0 a 100,
   * mentre internamente salviamo valori da 0 a 1.
   */
  function updateBudgetDistribution(
    role: AuctionRole,
    value: string,
  ) {
    const parsedPercentage =
      parseNumericInput(value);

    const normalizedPercentage =
      Math.min(
        Math.max(parsedPercentage, 0),
        100,
      ) / 100;

    setConfig((currentConfig) => ({
      ...currentConfig,

      budgetStrategy: "MANUAL",

      budgetDistribution: {
        ...currentConfig
          .budgetDistribution,

        [role]: normalizedPercentage,
      },
    }));
  }


  /*
 * Cambia la strategia di gestione
 * del budget.
 */
  function updateBudgetStrategy(
    strategy: NonNullable<
      AuctionConfig["budgetStrategy"]
    >,
  ) {
    setConfig((currentConfig) => {
      /*
       * Passando alla modalità manuale,
       * conserviamo le percentuali attualmente
       * calcolate dal sistema.
       */
      if (strategy === "MANUAL") {
        return {
          ...currentConfig,

          budgetStrategy: "MANUAL",

          budgetDistribution: {
            ...getEffectiveBudgetDistribution(
              currentConfig,
            ),
          },
        };
      }

      return applyAutomaticBudgetDistribution({
        ...currentConfig,
        budgetStrategy: "AUTOMATIC",
      });
    });
  }


  /*
 * Aggiorna il bonus gol
 * di uno specifico ruolo.
 */
  function updateGoalBonusByRole(
    role: AuctionRole,
    value: string,
  ) {
    const parsedValue = Math.min(
      Math.max(
        parseNumericInput(value),
        -20,
      ),
      20,
    );

    setConfig((currentConfig) => {
      const currentRules =
        getLeagueRules(
          currentConfig,
        );

      const updatedScoring:
        AuctionScoringRules = {
        ...currentRules.scoring,

        goalByRole: {
          ...currentRules
            .scoring
            .goalByRole,

          [role]: parsedValue,
        },
      };

      return applyLeagueRulesUpdate(
        currentConfig,
        {
          ...currentRules,
          scoring: updatedScoring,
        },
      );
    });
  }


  /*
   * Aggiorna uno degli altri
   * bonus o malus della lega.
   */
  function updateScoringRule(
    field: EditableScoringField,
    value: string,
  ) {
    const parsedValue = Math.min(
      Math.max(
        parseNumericInput(value),
        -20,
      ),
      20,
    );

    setConfig((currentConfig) => {
      const currentRules =
        getLeagueRules(
          currentConfig,
        );

      const updatedScoring:
        AuctionScoringRules = {
        ...currentRules.scoring,
        [field]: parsedValue,
      };

      return applyLeagueRulesUpdate(
        currentConfig,
        {
          ...currentRules,
          scoring: updatedScoring,
        },
      );
    });
  }


  /*
   * Attiva o disattiva il modificatore difesa.
   */
  function toggleDefenseModifier(
    enabled: boolean,
  ) {
    setConfig((currentConfig) => {
      const currentRules =
        getLeagueRules(
          currentConfig,
        );

      return applyLeagueRulesUpdate(
        currentConfig,
        {
          ...currentRules,

          defenseModifier: {
            ...currentRules
              .defenseModifier,

            enabled,
          },
        },
      );
    });
  }


  /*
   * Aggiorna un valore numerico
   * del modificatore difesa.
   */
  function updateDefenseModifierNumber(
    field:
      | "minimumDefenders"
      | "consideredPlayers",
    value: string,
  ) {
    const parsedValue = Math.max(
      1,
      Math.trunc(
        parseNumericInput(value),
      ),
    );

    setConfig((currentConfig) => {
      const currentRules =
        getLeagueRules(
          currentConfig,
        );

      return applyLeagueRulesUpdate(
        currentConfig,
        {
          ...currentRules,

          defenseModifier: {
            ...currentRules
              .defenseModifier,

            [field]: parsedValue,
          },
        },
      );
    });
  }


  /*
   * Include o esclude il portiere
   * dal modificatore difesa.
   */
  function toggleDefenseGoalkeeper(
    includeGoalkeeper: boolean,
  ) {
    setConfig((currentConfig) => {
      const currentRules =
        getLeagueRules(
          currentConfig,
        );

      return applyLeagueRulesUpdate(
        currentConfig,
        {
          ...currentRules,

          defenseModifier: {
            ...currentRules
              .defenseModifier,

            includeGoalkeeper,
          },
        },
      );
    });
  }


  /*
   * Attiva o disattiva
   * il modificatore centrocampo.
   */
  function toggleMidfieldModifier(
    enabled: boolean,
  ) {
    setConfig((currentConfig) => {
      const currentRules =
        getLeagueRules(
          currentConfig,
        );

      return applyLeagueRulesUpdate(
        currentConfig,
        {
          ...currentRules,

          midfieldModifier: {
            ...currentRules
              .midfieldModifier,

            enabled,
          },
        },
      );
    });
  }


  /*
   * Aggiorna un valore numerico
   * del modificatore centrocampo.
   */
  function updateMidfieldModifierNumber(
    field:
      | "minimumMidfielders"
      | "consideredPlayers",
    value: string,
  ) {
    const parsedValue = Math.max(
      1,
      Math.trunc(
        parseNumericInput(value),
      ),
    );

    setConfig((currentConfig) => {
      const currentRules =
        getLeagueRules(
          currentConfig,
        );

      return applyLeagueRulesUpdate(
        currentConfig,
        {
          ...currentRules,

          midfieldModifier: {
            ...currentRules
              .midfieldModifier,

            [field]: parsedValue,
          },
        },
      );
    });
  }


  /*
  * Attiva o disattiva la configurazione
  * preventiva delle squadre avversarie.
  */
  function toggleOpponentTeamNames(
    enabled: boolean,
  ) {
    setUsePredefinedOpponentNames(
      enabled,
    );

    setConfig((currentConfig) => ({
      ...currentConfig,

      opponentTeamNames: enabled
        ? resizeOpponentTeamNames(
          currentConfig.participants,
          currentConfig.opponentTeamNames,
        )
        : [],
    }));
  }


  /*
   * Aggiorna il nome di una specifica
   * squadra avversaria.
   */
  function updateOpponentTeamName(
    index: number,
    value: string,
  ) {
    setConfig((currentConfig) => {
      const updatedNames = [
        ...(
          currentConfig
            .opponentTeamNames ?? []
        ),
      ];

      updatedNames[index] = value;

      return {
        ...currentConfig,
        opponentTeamNames:
          updatedNames,
      };
    });
  }


  /*
   * Avvia la sessione soltanto
   * quando la configurazione è valida.
   */
  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (configError !== null) {
      return;
    }

    const configToSubmit =
      (
        config.budgetStrategy ??
        "MANUAL"
      ) === "AUTOMATIC"
        ? applyAutomaticBudgetDistribution(
          config,
        )
        : config;

    const rulesToSubmit =
      getLeagueRules(
        configToSubmit,
      );

    const distributionToSubmit =
      getEffectiveBudgetDistribution(
        configToSubmit,
      );

    /*
     * Passiamo una copia completa
     * della configurazione alla pagina.
     */
    setIsSubmitting(true);

    try {
      await onStart({
        ...configToSubmit,

        leagueName:
          configToSubmit
            .leagueName
            .trim(),

        rosterSlots: {
          ...configToSubmit.rosterSlots,
        },

        budgetDistribution: {
          ...distributionToSubmit,
        },

        leagueRules:
          rulesToSubmit,

        opponentTeamNames:
          usePredefinedOpponentNames
            ? (
              configToSubmit
                .opponentTeamNames ??
              []
            ).map(
              (teamName) =>
                teamName.trim(),
            )
            : [],
      });
    } finally {
      setIsSubmitting(false);
    }
  }


  /*
   * Ripristina tutti i valori iniziali.
   */
  function handleReset() {
    setConfig(createDefaultConfig());

    setUsePredefinedOpponentNames(
      false,
    );
  }


  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      {/* Informazioni generali */}
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold">
          Configurazione generale
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Inserisci le regole principali della tua lega.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {/* Nome della lega */}
          <div>
            <label
              htmlFor="league-name"
              className="mb-2 block text-sm font-semibold"
            >
              Nome della lega
            </label>

            <input
              id="league-name"
              type="text"
              value={config.leagueName}
              onChange={(event) => {
                setConfig(
                  (currentConfig) => ({
                    ...currentConfig,
                    leagueName:
                      event.target.value,
                  }),
                );
              }}
              placeholder="Esempio: Lega degli amici"
              className="
                w-full rounded-xl border
                border-slate-300 px-4 py-3
                outline-none transition
                focus:border-emerald-600
                focus:ring-2
                focus:ring-emerald-100
              "
            />
          </div>


          {/* Numero di partecipanti */}
          <div>
            <label
              htmlFor="participants"
              className="mb-2 block text-sm font-semibold"
            >
              Partecipanti
            </label>

            <input
              id="participants"
              type="number"
              min="2"
              max="30"
              step="1"
              value={config.participants}
              onChange={(event) => {
                const participants =
                  Math.max(
                    0,
                    Math.trunc(
                      parseNumericInput(
                        event.target.value,
                      ),
                    ),
                  );

                setConfig(
                  (currentConfig) => ({
                    ...currentConfig,

                    participants,

                    opponentTeamNames:
                      usePredefinedOpponentNames
                        ? resizeOpponentTeamNames(
                          participants,
                          currentConfig
                            .opponentTeamNames,
                        )
                        : [],
                  }),
                );
              }}
              className="
                w-full rounded-xl border
                border-slate-300 px-4 py-3
                outline-none transition
                focus:border-emerald-600
                focus:ring-2
                focus:ring-emerald-100
              "
            />
          </div>


          {/* Budget iniziale */}
          <div>
            <label
              htmlFor="starting-budget"
              className="mb-2 block text-sm font-semibold"
            >
              Budget iniziale
            </label>

            <input
              id="starting-budget"
              type="number"
              min="1"
              step="1"
              value={config.startingBudget}
              onChange={(event) => {
                setConfig(
                  (currentConfig) => ({
                    ...currentConfig,

                    startingBudget: Math.max(
                      0,
                      Math.trunc(
                        parseNumericInput(
                          event.target.value,
                        ),
                      ),
                    ),
                  }),
                );
              }}
              className="
                w-full rounded-xl border
                border-slate-300 px-4 py-3
                outline-none transition
                focus:border-emerald-600
                focus:ring-2
                focus:ring-emerald-100
              "
            />

            <p className="mt-1 text-xs text-slate-500">
              Crediti disponibili per ogni squadra.
            </p>
          </div>


          {/* Offerta minima */}
          <div>
            <label
              htmlFor="minimum-bid"
              className="mb-2 block text-sm font-semibold"
            >
              Offerta minima
            </label>

            <input
              id="minimum-bid"
              type="number"
              min="1"
              step="1"
              value={config.minimumBid}
              onChange={(event) => {
                setConfig(
                  (currentConfig) => ({
                    ...currentConfig,

                    minimumBid: Math.max(
                      0,
                      Math.trunc(
                        parseNumericInput(
                          event.target.value,
                        ),
                      ),
                    ),
                  }),
                );
              }}
              className="
                w-full rounded-xl border
                border-slate-300 px-4 py-3
                outline-none transition
                focus:border-emerald-600
                focus:ring-2
                focus:ring-emerald-100
              "
            />
          </div>

          {/* Modalità dell'asta */}
          <div className="md:col-span-2">
            <label
              htmlFor="auction-mode"
              className="mb-2 block text-sm font-semibold"
            >
              Modalità dell&apos;asta
            </label>

            <CustomSelect
              id="auction-mode"
              value={config.auctionMode}
              options={AUCTION_MODE_OPTIONS}
              tone="emerald"
              placeholder="Seleziona la modalità"
              onChange={(auctionMode) => {
                setConfig(
                  (currentConfig) => ({
                    ...currentConfig,
                    auctionMode,
                  }),
                );
              }}
            />

            <p className="mt-2 text-xs text-slate-500">
              {config.auctionMode ===
                "ROLE_BY_ROLE"
                ? "Le quotazioni reagiscono soprattutto agli acquisti dello stesso ruolo. Il budget residuo viene trasferito quando il ruolo è completato."
                : "Ogni acquisto influenza gradualmente le quotazioni e i budget di tutti i ruoli ancora incompleti."}
            </p>
          </div>
          {/* Configurazione opzionale delle squadre avversarie */}
          <div className="md:col-span-2">
            <div
              className="
                rounded-xl border
                border-slate-200
                bg-slate-50 p-4
              "
            >
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={
                    usePredefinedOpponentNames
                  }
                  onChange={(event) => {
                    toggleOpponentTeamNames(
                      event.target.checked,
                    );
                  }}
                  className="
          mt-1 h-4 w-4
          rounded border-slate-300
          accent-emerald-700
        "
                />

                <span>
                  <span className="block text-sm font-semibold text-slate-900">
                    Inserisci i nomi delle squadre avversarie
                  </span>

                  <span className="mt-1 block text-xs text-slate-500">
                    Durante l&apos;asta potrai scegliere
                    la squadra da un menu, senza riscriverne
                    ogni volta il nome.
                  </span>
                </span>
              </label>


              {usePredefinedOpponentNames && (
                <div className="mt-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">
                      Squadre avversarie
                    </p>

                    <span
                      className="
              rounded-full bg-white
              px-2.5 py-1
              text-xs font-semibold
              text-slate-600
            "
                    >
                      {Math.max(
                        config.participants - 1,
                        0,
                      )} squadre
                    </span>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {Array.from({
                      length: Math.max(
                        config.participants - 1,
                        0,
                      ),
                    }).map((_, index) => (
                      <div key={index}>
                        <label
                          htmlFor={`opponent-team-${index}`}
                          className="mb-1.5 block text-xs font-semibold text-slate-600"
                        >
                          Squadra avversaria{" "}
                          {index + 1}
                        </label>

                        <input
                          id={`opponent-team-${index}`}
                          type="text"
                          value={
                            config
                              .opponentTeamNames?.[
                            index
                            ] ?? ""
                          }
                          onChange={(event) => {
                            updateOpponentTeamName(
                              index,
                              event.target.value,
                            );
                          }}
                          placeholder={`Nome squadra ${index + 1}`}
                          className="
                  w-full rounded-xl
                  border border-slate-300
                  bg-white px-4 py-2.5
                  outline-none transition
                  focus:border-emerald-600
                  focus:ring-2
                  focus:ring-emerald-100
                "
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>


      {/* Composizione della rosa */}
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold">
          Composizione della rosa
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Indica quanti giocatori acquistare per ogni ruolo.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {AUCTION_ROLES.map((role) => (
            <div
              key={role}
              className="rounded-xl bg-slate-100 p-4"
            >
              <label
                htmlFor={`slots-${role}`}
                className="block text-sm font-semibold"
              >
                {AUCTION_ROLE_NAMES[role]}
              </label>

              <input
                id={`slots-${role}`}
                type="number"
                min="0"
                max="20"
                step="1"
                value={
                  config.rosterSlots[role]
                }
                onChange={(event) => {
                  updateRosterSlots(
                    role,
                    event.target.value,
                  );
                }}
                className="
                  mt-3 w-full rounded-xl
                  border border-slate-300
                  bg-white px-4 py-3
                  outline-none transition
                  focus:border-emerald-600
                  focus:ring-2
                  focus:ring-emerald-100
                "
              />
            </div>
          ))}
        </div>

        <p className="mt-4 text-sm font-semibold text-slate-700">
          Totale rosa:{" "}
          {calculateTotalRosterSlots(config)}{" "}
          giocatori
        </p>
      </section>


      {/* Regole e modificatori */}
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold">
          Regole della lega
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Attiva i modificatori utilizzati
          nella tua lega.
        </p>

        {/* Bonus e malus */}
        <div className="mt-5 rounded-2xl border border-slate-200 p-5">
          <h3 className="font-semibold">
            Bonus e malus
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Inserisci i valori previsti dal regolamento.
            Per i malus usa un numero negativo.
          </p>


          {/* Bonus gol differenziato per ruolo */}
          <div className="mt-5">
            <p className="text-sm font-semibold">
              Bonus gol per ruolo
            </p>

            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {AUCTION_ROLES.map((role) => (
                <div
                  key={role}
                  className="rounded-xl bg-slate-50 p-4"
                >
                  <label
                    htmlFor={`goal-bonus-${role}`}
                    className="block text-sm font-semibold"
                  >
                    {AUCTION_ROLE_NAMES[role]}
                  </label>

                  <input
                    id={`goal-bonus-${role}`}
                    type="number"
                    min="-20"
                    max="20"
                    step="0.5"
                    value={
                      leagueRules
                        .scoring
                        .goalByRole[role]
                    }
                    onChange={(event) => {
                      updateGoalBonusByRole(
                        role,
                        event.target.value,
                      );
                    }}
                    className="
                      mt-3 w-full rounded-xl
                      border border-slate-300
                      bg-white px-4 py-3
                      outline-none transition
                      focus:border-emerald-600
                      focus:ring-2
                      focus:ring-emerald-100
                    "
                  />
                </div>
              ))}
            </div>
          </div>


          {/* Altri bonus e malus */}
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SCORING_RULE_FIELDS.map(
              ({
                key,
                label,
                description,
              }) => (
                <div
                  key={key}
                  className="rounded-xl bg-slate-50 p-4"
                >
                  <label
                    htmlFor={`scoring-${key}`}
                    className="block text-sm font-semibold"
                  >
                    {label}
                  </label>

                  <input
                    id={`scoring-${key}`}
                    type="number"
                    min="-20"
                    max="20"
                    step="0.5"
                    value={
                      leagueRules
                        .scoring[key]
                    }
                    onChange={(event) => {
                      updateScoringRule(
                        key,
                        event.target.value,
                      );
                    }}
                    className="
                      mt-3 w-full rounded-xl
                      border border-slate-300
                      bg-white px-4 py-3
                      outline-none transition
                      focus:border-emerald-600
                      focus:ring-2
                      focus:ring-emerald-100
                    "
                  />

                  <p className="mt-2 text-xs text-slate-500">
                    {description}
                  </p>
                </div>
              ),
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {/* Modificatore difesa */}
          <div className="rounded-2xl border border-slate-200 p-5">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={
                  leagueRules
                    .defenseModifier
                    .enabled
                }
                onChange={(event) => {
                  toggleDefenseModifier(
                    event.target.checked,
                  );
                }}
                className="
                  mt-1 h-4 w-4
                  rounded border-slate-300
                  accent-emerald-700
                "
              />

              <span>
                <span className="block font-semibold">
                  Modificatore difesa
                </span>

                <span className="mt-1 block text-xs text-slate-500">
                  Aumenta il valore strategico
                  dei difensori affidabili.
                </span>
              </span>
            </label>

            {leagueRules
              .defenseModifier
              .enabled && (
                <div className="mt-5 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="minimum-defenders"
                        className="mb-2 block text-sm font-semibold"
                      >
                        Difensori minimi
                      </label>

                      <input
                        id="minimum-defenders"
                        type="number"
                        min="1"
                        max={
                          config.rosterSlots.D
                        }
                        step="1"
                        value={
                          leagueRules
                            .defenseModifier
                            .minimumDefenders
                        }
                        onChange={(event) => {
                          updateDefenseModifierNumber(
                            "minimumDefenders",
                            event.target.value,
                          );
                        }}
                        className="
                          w-full rounded-xl
                          border border-slate-300
                          px-4 py-3
                          outline-none transition
                          focus:border-emerald-600
                          focus:ring-2
                          focus:ring-emerald-100
                        "
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="defense-considered-players"
                        className="mb-2 block text-sm font-semibold"
                      >
                        Voti considerati
                      </label>

                      <input
                        id="defense-considered-players"
                        type="number"
                        min="1"
                        step="1"
                        value={
                          leagueRules
                            .defenseModifier
                            .consideredPlayers
                        }
                        onChange={(event) => {
                          updateDefenseModifierNumber(
                            "consideredPlayers",
                            event.target.value,
                          );
                        }}
                        className="
                          w-full rounded-xl
                          border border-slate-300
                          px-4 py-3
                          outline-none transition
                          focus:border-emerald-600
                          focus:ring-2
                          focus:ring-emerald-100
                        "
                      />
                    </div>
                  </div>

                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={
                        leagueRules
                          .defenseModifier
                          .includeGoalkeeper
                      }
                      onChange={(event) => {
                        toggleDefenseGoalkeeper(
                          event.target.checked,
                        );
                      }}
                      className="
                        h-4 w-4 rounded
                        border-slate-300
                        accent-emerald-700
                      "
                    />

                    <span className="text-sm font-semibold">
                      Includi il portiere nel calcolo
                    </span>
                  </label>
                </div>
              )}
          </div>


          {/* Modificatore centrocampo */}
          <div className="rounded-2xl border border-slate-200 p-5">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={
                  leagueRules
                    .midfieldModifier
                    .enabled
                }
                onChange={(event) => {
                  toggleMidfieldModifier(
                    event.target.checked,
                  );
                }}
                className="
                  mt-1 h-4 w-4
                  rounded border-slate-300
                  accent-emerald-700
                "
              />

              <span>
                <span className="block font-semibold">
                  Modificatore centrocampo
                </span>

                <span className="mt-1 block text-xs text-slate-500">
                  Aumenta il valore dei
                  centrocampisti dalla media alta.
                </span>
              </span>
            </label>

            {leagueRules
              .midfieldModifier
              .enabled && (
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="minimum-midfielders"
                      className="mb-2 block text-sm font-semibold"
                    >
                      Centrocampisti minimi
                    </label>

                    <input
                      id="minimum-midfielders"
                      type="number"
                      min="1"
                      max={
                        config.rosterSlots.C
                      }
                      step="1"
                      value={
                        leagueRules
                          .midfieldModifier
                          .minimumMidfielders
                      }
                      onChange={(event) => {
                        updateMidfieldModifierNumber(
                          "minimumMidfielders",
                          event.target.value,
                        );
                      }}
                      className="
                        w-full rounded-xl
                        border border-slate-300
                        px-4 py-3
                        outline-none transition
                        focus:border-emerald-600
                        focus:ring-2
                        focus:ring-emerald-100
                      "
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="midfield-considered-players"
                      className="mb-2 block text-sm font-semibold"
                    >
                      Voti considerati
                    </label>

                    <input
                      id="midfield-considered-players"
                      type="number"
                      min="1"
                      step="1"
                      value={
                        leagueRules
                          .midfieldModifier
                          .consideredPlayers
                      }
                      onChange={(event) => {
                        updateMidfieldModifierNumber(
                          "consideredPlayers",
                          event.target.value,
                        );
                      }}
                      className="
                        w-full rounded-xl
                        border border-slate-300
                        px-4 py-3
                        outline-none transition
                        focus:border-emerald-600
                        focus:ring-2
                        focus:ring-emerald-100
                      "
                    />
                  </div>
                </div>
              )}
          </div>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Con la strategia automatica,
          l’attivazione dei modificatori cambia
          immediatamente il budget consigliato.
        </p>
      </section>


      {/* Distribuzione del budget */}
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">
              Distribuzione del budget
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Scegli la percentuale da destinare a ogni ruolo.
            </p>
          </div>

          <span
            className={`
              w-fit rounded-full px-3 py-1
              text-sm font-semibold

              ${budgetPercentageTotal === 100
                ? "bg-emerald-100 text-emerald-800"
                : "bg-red-100 text-red-700"
              }
            `}
          >
            Totale: {budgetPercentageTotal}%
          </span>
        </div>

        <div className="mt-5 max-w-md">
          <label
            htmlFor="budget-strategy"
            className="mb-2 block text-sm font-semibold"
          >
            Strategia del budget
          </label>

          <CustomSelect
            id="budget-strategy"
            value={
              config.budgetStrategy ??
              "MANUAL"
            }
            options={
              BUDGET_STRATEGY_OPTIONS
            }
            tone="emerald"
            placeholder="Seleziona la strategia"
            onChange={
              updateBudgetStrategy
            }
          />

          <p className="mt-2 text-xs text-slate-500">
            {(
              config.budgetStrategy ??
              "MANUAL"
            ) === "AUTOMATIC"
              ? "Fantasy AI adatta automaticamente le percentuali alle regole della lega."
              : "Puoi modificare manualmente le percentuali assegnate ai ruoli."}
          </p>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {AUCTION_ROLES.map((role) => {
            const percentage =
              Number(
                (
                  effectiveBudgetDistribution[
                  role
                  ] * 100
                ).toFixed(1),
              );

            const suggestedBudget =
              calculateRoleBudget(
                config,
                role,
              );

            return (
              <div
                key={role}
                className="rounded-xl border border-slate-200 p-4"
              >
                <label
                  htmlFor={`budget-${role}`}
                  className="block text-sm font-semibold"
                >
                  {AUCTION_ROLE_NAMES[role]}
                </label>

                <div className="mt-3 flex items-center gap-2">
                  <input
                    id={`budget-${role}`}
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={percentage}
                    disabled={
                      (
                        config.budgetStrategy ??
                        "MANUAL"
                      ) === "AUTOMATIC"
                    }
                    onChange={(event) => {
                      updateBudgetDistribution(
                        role,
                        event.target.value,
                      );
                    }}
                    className={`
                      min-w-0 flex-1 rounded-xl
                      border border-slate-300
                      px-3 py-3 outline-none
                      transition
                      focus:border-emerald-600
                      focus:ring-2
                      focus:ring-emerald-100

                      ${(
                        config.budgetStrategy ??
                        "MANUAL"
                      ) === "AUTOMATIC"
                        ? "cursor-not-allowed bg-slate-100 text-slate-600"
                        : "bg-white"
                      }
                    `}
                  />

                  <span className="font-semibold">
                    %
                  </span>
                </div>

                <p className="mt-3 text-sm text-slate-500">
                  Budget consigliato
                </p>

                <p className="mt-1 text-xl font-bold">
                  {suggestedBudget}
                </p>
              </div>
            );
          })}
        </div>
      </section>


      {/* Eventuale errore */}
      {configError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
          {configError}
        </div>
      )}


      {/* Pulsanti */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={handleReset}
          className="
            rounded-xl border border-slate-300
            bg-white px-5 py-3 text-sm
            font-semibold transition
            hover:bg-slate-100
          "
        >
          Ripristina valori
        </button>

        <button
          type="submit"
          disabled={
            configError !== null ||
            isSubmitting
          }
          className={`
            rounded-xl px-5 py-3
            text-sm font-semibold transition

            ${configError === null &&
              !isSubmitting
              ? "bg-emerald-700 text-white hover:bg-emerald-800"
              : "cursor-not-allowed bg-slate-300 text-slate-500"
            }
          `}
        >
          {isSubmitting
            ? "Creazione asta..."
            : "Inizia asta"}
        </button>
      </div>
    </form>
  );
}