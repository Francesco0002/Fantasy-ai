"use client";

import {
  AUCTION_MODE_NAMES,
  AUCTION_ROLES,
  AUCTION_ROLE_NAMES,
  getEffectiveBudgetDistribution,
  getLeagueRules,
} from "../../lib/auction-config";

import {
  ROLE_BADGE_CLASSES,
} from "../../lib/player-utils";

import type {
  AuctionConfig,
} from "../../types/auction";


type AuctionLeagueRulesPanelProps = {
  config: AuctionConfig;
  onClose: () => void;
};


/*
 * Bonus e malus diversi
 * dal bonus gol per ruolo.
 */
const SCORING_FIELDS = [
  {
    key: "assist",
    label: "Assist",
  },
  {
    key: "cleanSheet",
    label: "Porta inviolata",
  },
  {
    key: "goalConceded",
    label: "Gol subito",
  },
  {
    key: "penaltyScored",
    label: "Rigore segnato",
  },
  {
    key: "penaltyMissed",
    label: "Rigore sbagliato",
  },
  {
    key: "penaltySaved",
    label: "Rigore parato",
  },
  {
    key: "yellowCard",
    label: "Ammonizione",
  },
  {
    key: "redCard",
    label: "Espulsione",
  },
  {
    key: "ownGoal",
    label: "Autogol",
  },
] as const;


/*
 * Mostra il segno positivo
 * per i bonus.
 */
function formatRuleValue(
  value: number,
): string {
  const formattedValue =
    value.toLocaleString(
      "it-IT",
      {
        maximumFractionDigits: 2,
      },
    );

  if (value > 0) {
    return `+${formattedValue}`;
  }

  return formattedValue;
}


/*
 * Formatta una percentuale interna
 * da 0-1 nel formato 0-100%.
 */
function formatPercentage(
  value: number,
): string {
  return (
    value * 100
  ).toLocaleString(
    "it-IT",
    {
      maximumFractionDigits: 1,
    },
  );
}


export default function AuctionLeagueRulesPanel({
  config,
  onClose,
}: AuctionLeagueRulesPanelProps) {
  const leagueRules =
    getLeagueRules(config);

  const budgetDistribution =
    getEffectiveBudgetDistribution(
      config,
    );

  const budgetStrategyName =
    (
      config.budgetStrategy ??
      "MANUAL"
    ) === "AUTOMATIC"
      ? "Automatica"
      : "Manuale";

  return (
    <aside
      className="
        h-dvh max-h-dvh
        overflow-y-auto
        overscroll-contain
        bg-white p-4
        text-slate-900
        shadow-2xl
      "
    >
      {/* Intestazione */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">
            {config.leagueName}
          </p>

          <h2 className="mt-0.5 text-xl font-bold">
            Regole della lega
          </h2>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="
            shrink-0 rounded-lg
            bg-slate-100 px-2.5 py-1.5
            text-xs font-semibold
            text-slate-700 transition
            hover:bg-slate-200
          "
        >
          Chiudi
        </button>
      </div>


      {/* Configurazione generale */}
      <section className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <h3 className="text-sm font-bold">
          Configurazione
        </h3>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-white p-3">
            <p className="text-[11px] text-slate-500">
              Modalità asta
            </p>

            <p className="mt-1 text-sm font-semibold">
              {
                AUCTION_MODE_NAMES[
                  config.auctionMode
                ]
              }
            </p>
          </div>

          <div className="rounded-lg bg-white p-3">
            <p className="text-[11px] text-slate-500">
              Strategia budget
            </p>

            <p className="mt-1 text-sm font-semibold">
              {budgetStrategyName}
            </p>
          </div>

          <div className="rounded-lg bg-white p-3">
            <p className="text-[11px] text-slate-500">
              Budget iniziale
            </p>

            <p className="mt-1 text-sm font-semibold">
              {config.startingBudget} crediti
            </p>
          </div>

          <div className="rounded-lg bg-white p-3">
            <p className="text-[11px] text-slate-500">
              Offerta minima
            </p>

            <p className="mt-1 text-sm font-semibold">
              {config.minimumBid} crediti
            </p>
          </div>
        </div>
      </section>


      {/* Distribuzione budget */}
      <section className="mt-4 rounded-xl border border-slate-200 p-3">
        <h3 className="text-sm font-bold">
          Distribuzione del budget
        </h3>

        <div className="mt-3 grid grid-cols-4 gap-2">
          {AUCTION_ROLES.map(
            (role) => (
              <div
                key={role}
                className="rounded-lg bg-slate-50 p-2 text-center"
              >
                <span
                  className={`
                    inline-flex rounded-full
                    px-2 py-1
                    text-xs font-bold
                    ${ROLE_BADGE_CLASSES[role]}
                  `}
                >
                  {role}
                </span>

                <p className="mt-2 text-sm font-bold">
                  {formatPercentage(
                    budgetDistribution[role],
                  )}
                  %
                </p>
              </div>
            ),
          )}
        </div>
      </section>


      {/* Bonus gol */}
      <section className="mt-4 rounded-xl border border-slate-200 p-3">
        <h3 className="text-sm font-bold">
          Bonus gol per ruolo
        </h3>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {AUCTION_ROLES.map(
            (role) => (
              <div
                key={role}
                className="
                  flex items-center
                  justify-between gap-3
                  rounded-lg bg-slate-50
                  px-3 py-2.5
                "
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`
                      rounded-full px-2 py-1
                      text-xs font-bold
                      ${ROLE_BADGE_CLASSES[role]}
                    `}
                  >
                    {role}
                  </span>

                  <span className="text-xs font-semibold">
                    {AUCTION_ROLE_NAMES[role]}
                  </span>
                </div>

                <span className="font-bold text-emerald-700">
                  {formatRuleValue(
                    leagueRules
                      .scoring
                      .goalByRole[role],
                  )}
                </span>
              </div>
            ),
          )}
        </div>
      </section>


      {/* Altri bonus e malus */}
      <section className="mt-4 rounded-xl border border-slate-200 p-3">
        <h3 className="text-sm font-bold">
          Bonus e malus
        </h3>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {SCORING_FIELDS.map(
            ({
              key,
              label,
            }) => {
              const value =
                leagueRules
                  .scoring[key];

              return (
                <div
                  key={key}
                  className="
                    flex items-center
                    justify-between gap-2
                    rounded-lg bg-slate-50
                    px-3 py-2.5
                  "
                >
                  <span className="text-xs font-semibold text-slate-700">
                    {label}
                  </span>

                  <span
                    className={`
                      font-bold

                      ${value > 0
                        ? "text-emerald-700"
                        : value < 0
                          ? "text-red-700"
                          : "text-slate-700"
                      }
                    `}
                  >
                    {formatRuleValue(value)}
                  </span>
                </div>
              );
            },
          )}
        </div>
      </section>


      {/* Modificatore difesa */}
      <section className="mt-4 rounded-xl border border-slate-200 p-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold">
            Modificatore difesa
          </h3>

          <span
            className={`
              rounded-full px-2.5 py-1
              text-xs font-semibold

              ${leagueRules
                .defenseModifier
                .enabled
                ? "bg-emerald-100 text-emerald-800"
                : "bg-slate-100 text-slate-600"
              }
            `}
          >
            {leagueRules
              .defenseModifier
              .enabled
              ? "Attivo"
              : "Disattivato"}
          </span>
        </div>

        {leagueRules
          .defenseModifier
          .enabled && (
            <>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-slate-50 p-2 text-center">
                  <p className="text-[11px] text-slate-500">
                    Difensori minimi
                  </p>

                  <p className="mt-1 font-bold">
                    {
                      leagueRules
                        .defenseModifier
                        .minimumDefenders
                    }
                  </p>
                </div>

                <div className="rounded-lg bg-slate-50 p-2 text-center">
                  <p className="text-[11px] text-slate-500">
                    Voti considerati
                  </p>

                  <p className="mt-1 font-bold">
                    {
                      leagueRules
                        .defenseModifier
                        .consideredPlayers
                    }
                  </p>
                </div>

                <div className="rounded-lg bg-slate-50 p-2 text-center">
                  <p className="text-[11px] text-slate-500">
                    Portiere
                  </p>

                  <p className="mt-1 font-bold">
                    {leagueRules
                      .defenseModifier
                      .includeGoalkeeper
                      ? "Incluso"
                      : "Escluso"}
                  </p>
                </div>
              </div>

              <div className="mt-3">
                <p className="text-xs font-semibold text-slate-600">
                  Fasce
                </p>

                <div className="mt-2 space-y-1.5">
                  {leagueRules
                    .defenseModifier
                    .bands
                    .map(
                      (
                        band,
                        index,
                      ) => (
                        <div
                          key={`${band.minimumAverage}-${index}`}
                          className="
                            flex items-center
                            justify-between
                            rounded-lg bg-slate-50
                            px-3 py-2
                          "
                        >
                          <span className="text-xs text-slate-600">
                            Media da{" "}
                            {band.minimumAverage.toLocaleString(
                              "it-IT",
                            )}
                          </span>

                          <span className="text-sm font-bold text-emerald-700">
                            {formatRuleValue(
                              band.bonus,
                            )}
                          </span>
                        </div>
                      ),
                    )}
                </div>
              </div>
            </>
          )}
      </section>


      {/* Modificatore centrocampo */}
      <section className="mt-4 rounded-xl border border-slate-200 p-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold">
            Modificatore centrocampo
          </h3>

          <span
            className={`
              rounded-full px-2.5 py-1
              text-xs font-semibold

              ${leagueRules
                .midfieldModifier
                .enabled
                ? "bg-emerald-100 text-emerald-800"
                : "bg-slate-100 text-slate-600"
              }
            `}
          >
            {leagueRules
              .midfieldModifier
              .enabled
              ? "Attivo"
              : "Disattivato"}
          </span>
        </div>

        {leagueRules
          .midfieldModifier
          .enabled && (
            <>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-slate-50 p-2 text-center">
                  <p className="text-[11px] text-slate-500">
                    Centrocampisti minimi
                  </p>

                  <p className="mt-1 font-bold">
                    {
                      leagueRules
                        .midfieldModifier
                        .minimumMidfielders
                    }
                  </p>
                </div>

                <div className="rounded-lg bg-slate-50 p-2 text-center">
                  <p className="text-[11px] text-slate-500">
                    Voti considerati
                  </p>

                  <p className="mt-1 font-bold">
                    {
                      leagueRules
                        .midfieldModifier
                        .consideredPlayers
                    }
                  </p>
                </div>
              </div>

              <div className="mt-3">
                <p className="text-xs font-semibold text-slate-600">
                  Fasce
                </p>

                <div className="mt-2 space-y-1.5">
                  {leagueRules
                    .midfieldModifier
                    .bands
                    .map(
                      (
                        band,
                        index,
                      ) => (
                        <div
                          key={`${band.minimumAverage}-${index}`}
                          className="
                            flex items-center
                            justify-between
                            rounded-lg bg-slate-50
                            px-3 py-2
                          "
                        >
                          <span className="text-xs text-slate-600">
                            Media da{" "}
                            {band.minimumAverage.toLocaleString(
                              "it-IT",
                            )}
                          </span>

                          <span className="text-sm font-bold text-emerald-700">
                            {formatRuleValue(
                              band.bonus,
                            )}
                          </span>
                        </div>
                      ),
                    )}
                </div>
              </div>
            </>
          )}
      </section>

      <div className="h-4" />
    </aside>
  );
}