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
  AUCTION_MODE_NAMES,
  AUCTION_ROLES,
  AUCTION_ROLE_NAMES,
  calculateRoleBudget,
  calculateTotalRosterSlots,
  DEFAULT_AUCTION_CONFIG,
  isBudgetDistributionValid,
} from "../../lib/auction-config";

/*
 * Tipi della configurazione d'asta.
 */
import type {
  AuctionConfig,
  AuctionRole,
} from "../../types/auction";


/*
 * Proprietà ricevute dal componente.
 *
 * onStart viene eseguita quando
 * la configurazione è valida e l'utente
 * preme "Inizia asta".
 */
type AuctionSetupFormProps = {
  onStart: (config: AuctionConfig) => void;
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
 * Crea una copia indipendente della configurazione.
 *
 * Copiamo anche gli oggetti interni per evitare
 * di modificare accidentalmente la configurazione
 * predefinita condivisa.
 */
function createDefaultConfig(): AuctionConfig {
  return {
    ...DEFAULT_AUCTION_CONFIG,

    rosterSlots: {
      ...DEFAULT_AUCTION_CONFIG.rosterSlots,
    },

    budgetDistribution: {
      ...DEFAULT_AUCTION_CONFIG.budgetDistribution,
    },

    opponentTeamNames: [
      ...(
        DEFAULT_AUCTION_CONFIG
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

  if (!isBudgetDistributionValid(config)) {
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
  * Indica se l'utente desidera
  * configurare in anticipo i nomi
  * delle squadre avversarie.
  */
  const [
    usePredefinedOpponentNames,
    setUsePredefinedOpponentNames,
  ] = useState(false);

  /*
   * Calcoliamo la percentuale complessiva
   * assegnata ai quattro ruoli.
   */
  const budgetPercentageTotal =
    Math.round(
      (
        config.budgetDistribution.P +
        config.budgetDistribution.D +
        config.budgetDistribution.C +
        config.budgetDistribution.A
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

      budgetDistribution: {
        ...currentConfig.budgetDistribution,
        [role]: normalizedPercentage,
      },
    }));
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
  function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (configError !== null) {
      return;
    }

    /*
     * Passiamo una copia completa
     * della configurazione alla pagina.
     */
    onStart({
      ...config,

      leagueName:
        config.leagueName.trim(),

      rosterSlots: {
        ...config.rosterSlots,
      },

      budgetDistribution: {
        ...config.budgetDistribution,
      },

      opponentTeamNames:
        usePredefinedOpponentNames
          ? (
            config.opponentTeamNames ??
            []
          ).map(
            (teamName) =>
              teamName.trim(),
          )
          : [],
    });
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

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {AUCTION_ROLES.map((role) => {
            const percentage =
              Math.round(
                config.budgetDistribution[
                role
                ] * 100,
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
                    step="1"
                    value={percentage}
                    onChange={(event) => {
                      updateBudgetDistribution(
                        role,
                        event.target.value,
                      );
                    }}
                    className="
                      min-w-0 flex-1 rounded-xl
                      border border-slate-300
                      px-3 py-3 outline-none
                      transition
                      focus:border-emerald-600
                      focus:ring-2
                      focus:ring-emerald-100
                    "
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
          disabled={configError !== null}
          className={`
            rounded-xl px-5 py-3
            text-sm font-semibold transition

            ${configError === null
              ? "bg-emerald-700 text-white hover:bg-emerald-800"
              : "cursor-not-allowed bg-slate-300 text-slate-500"
            }
          `}
        >
          Inizia asta
        </button>
      </div>
    </form>
  );
}