"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AUCTION_ROLES,
  AUCTION_ROLE_NAMES,
  calculateRoleBudget,
} from "../../lib/auction-config";

import {
  ROLE_BADGE_CLASSES,
} from "../../lib/player-utils";

import type {
  AuctionConfig,
  AuctionPurchase,
  AuctionRole,
} from "../../types/auction";


/*
 * Proprietà ricevute dal componente.
 */
type AuctionSidePanelsProps = {
  config: AuctionConfig;

  /*
   * Tutti gli acquisti:
   * - utente;
   * - avversari.
   */
  purchases: AuctionPurchase[];

  /*
   * Budget personale ancora disponibile.
   */
  remainingBudget: number;

  /*
   * Slot personali ancora disponibili.
   */
  remainingSlots: Record<
    AuctionRole,
    number
  >;

  /*
   * Budget personale aggiornato
   * per ciascun ruolo.
   */
  dynamicRoleBudgets: Record<
    AuctionRole,
    number
  >;

  /*
   * Annulla un acquisto registrato.
   */
  onRemovePurchase: (
    playerId: number,
  ) => void;
};


/*
 * Pannello attualmente aperto.
 */
type OpenPanel =
  | "MY_ROSTER"
  | "OPPONENTS"
  | null;


/*
 * Riepilogo completo di una squadra avversaria.
 */
type OpponentTeamSummary = {
  /*
   * Identificatore normalizzato usato
   * per evitare duplicati dovuti
   * a maiuscole e minuscole.
   */
  key: string;

  /*
   * Nome mostrato nell'interfaccia.
   */
  name: string;

  /*
   * Acquisti registrati per la squadra.
   */
  purchases: AuctionPurchase[];

  /*
   * Spesa totale registrata.
   */
  totalSpent: number;

  /*
   * Budget ancora disponibile.
   */
  remainingBudget: number;

  /*
   * Eventuale superamento del budget.
   */
  overspending: number;

  /*
   * Giocatori acquistati per ruolo.
   */
  purchasedByRole: Record<
    AuctionRole,
    number
  >;

  /*
   * Slot ancora liberi per ruolo.
   */
  remainingSlotsByRole: Record<
    AuctionRole,
    number
  >;

  /*
   * Percentuale di completamento.
   */
  completionPercentage: number;
};


/*
 * Colore della barra di avanzamento
 * associato a ciascun ruolo.
 */
const ROLE_PROGRESS_CLASSES: Record<
  AuctionRole,
  string
> = {
  P: "bg-amber-500",
  D: "bg-emerald-500",
  C: "bg-blue-600",
  A: "bg-red-600",
};


/*
 * Formatta l'orario di registrazione.
 */
function formatPurchaseTime(
  purchasedAt: string,
): string {
  const date =
    new Date(purchasedAt);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Orario non disponibile";
  }

  return date.toLocaleTimeString(
    "it-IT",
    {
      hour: "2-digit",
      minute: "2-digit",
    },
  );
}


/*
 * Pannelli laterali compatti
 * della modalità asta.
 */
export default function AuctionSidePanels({
  config,
  purchases,
  remainingBudget,
  remainingSlots,
  dynamicRoleBudgets,
  onRemovePurchase,
}: AuctionSidePanelsProps) {
  const [
    openPanel,
    setOpenPanel,
  ] = useState<OpenPanel>(null);


  /*
  * Acquisti appartenenti alla nostra rosa.
  */
  const myPurchases =
    useMemo(() => {
      return purchases.filter(
        (purchase) =>
          purchase.ownerType === "ME",
      );
    }, [purchases]);


  /*
   * Acquisti effettuati dagli avversari.
   */
  const opponentPurchases =
    useMemo(() => {
      return purchases.filter(
        (purchase) =>
          purchase.ownerType ===
          "OPPONENT",
      );
    }, [purchases]);


  /*
   * Spesa complessiva della nostra rosa.
   */
  const myTotalSpent =
    useMemo(() => {
      return myPurchases.reduce(
        (total, purchase) =>
          total +
          purchase.purchasePrice,
        0,
      );
    }, [myPurchases]);


  /*
   * Crediti complessivamente spesi
   * dagli avversari registrati.
   */
  const opponentTotalSpent =
    useMemo(() => {
      return opponentPurchases.reduce(
        (total, purchase) =>
          total +
          purchase.purchasePrice,
        0,
      );
    }, [opponentPurchases]);


  /*
   * Numero totale di slot previsti.
   */
  const totalRosterSlots =
    config.rosterSlots.P +
    config.rosterSlots.D +
    config.rosterSlots.C +
    config.rosterSlots.A;


  /*
   * Numero complessivo di slot liberi.
   */
  const totalRemainingSlots =
    remainingSlots.P +
    remainingSlots.D +
    remainingSlots.C +
    remainingSlots.A;


  /*
  * Raggruppa gli acquisti avversari
  * in base al nome della squadra.
  */
  const opponentTeams =
    useMemo<OpponentTeamSummary[]>(
      () => {
        const teamsMap = new Map<
          string,
          {
            name: string;
            purchases: AuctionPurchase[];
          }
        >();


        opponentPurchases.forEach(
          (purchase) => {
            const teamName =
              purchase.ownerName
                ?.trim() ||
              "Squadra non specificata";

            /*
             * Normalizziamo il nome:
             *
             * "Team Marco"
             * e
             * "team marco"
             *
             * vengono considerati la stessa squadra.
             */
            const normalizedKey =
              teamName.toLocaleLowerCase(
                "it-IT",
              );

            const existingTeam =
              teamsMap.get(
                normalizedKey,
              );

            if (existingTeam) {
              existingTeam.purchases.push(
                purchase,
              );

              return;
            }

            teamsMap.set(
              normalizedKey,
              {
                name: teamName,
                purchases: [
                  purchase,
                ],
              },
            );
          },
        );


        return Array.from(
          teamsMap.entries(),
        )
          .map(
            ([
              normalizedKey,
              team,
            ]) => {
              const totalSpent =
                team.purchases.reduce(
                  (
                    total,
                    purchase,
                  ) =>
                    total +
                    purchase.purchasePrice,
                  0,
                );


              const purchasedByRole: Record<
                AuctionRole,
                number
              > = {
                P: 0,
                D: 0,
                C: 0,
                A: 0,
              };


              team.purchases.forEach(
                (purchase) => {
                  purchasedByRole[
                    purchase.role
                  ] += 1;
                },
              );


              const remainingSlotsByRole: Record<
                AuctionRole,
                number
              > = {
                P: Math.max(
                  config.rosterSlots.P -
                  purchasedByRole.P,
                  0,
                ),

                D: Math.max(
                  config.rosterSlots.D -
                  purchasedByRole.D,
                  0,
                ),

                C: Math.max(
                  config.rosterSlots.C -
                  purchasedByRole.C,
                  0,
                ),

                A: Math.max(
                  config.rosterSlots.A -
                  purchasedByRole.A,
                  0,
                ),
              };


              const rawRemainingBudget =
                config.startingBudget -
                totalSpent;


              const completionPercentage =
                totalRosterSlots > 0
                  ? Math.round(
                    (
                      team.purchases
                        .length /
                      totalRosterSlots
                    ) *
                    100,
                  )
                  : 0;


              return {
                key: normalizedKey,
                name: team.name,
                purchases:
                  team.purchases,

                totalSpent,

                remainingBudget:
                  Math.max(
                    rawRemainingBudget,
                    0,
                  ),

                overspending:
                  Math.max(
                    -rawRemainingBudget,
                    0,
                  ),

                purchasedByRole,
                remainingSlotsByRole,
                completionPercentage,
              };
            },
          )
          .sort(
            (
              firstTeam,
              secondTeam,
            ) =>
              firstTeam.name.localeCompare(
                secondTeam.name,
                "it-IT",
              ),
          );
      },
      [
        opponentPurchases,
        config,
        totalRosterSlots,
      ],
    );




  /*
  * Numero di giocatori già acquistati
  * per la nostra rosa.
  */
  const totalPurchasedPlayers =
    Math.max(
      totalRosterSlots -
      totalRemainingSlots,
      0,
    );


  /*
   * Percentuale complessiva
   * di completamento della rosa.
   */
  const rosterCompletion =
    totalRosterSlots > 0
      ? Math.round(
        (
          totalPurchasedPlayers /
          totalRosterSlots
        ) * 100,
      )
      : 0;


  /*
   * Quando un pannello è aperto:
   * - chiudiamo con Esc;
   * - blocchiamo lo scorrimento
   *   della pagina sottostante.
   */
  useEffect(() => {
    if (!openPanel) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (event.key === "Escape") {
        setOpenPanel(null);
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [openPanel]);


  /*
   * Conferma l'annullamento
   * di un acquisto.
   */
  function handleRemovePurchase(
    purchase: AuctionPurchase,
  ) {
    const ownerDescription =
      purchase.ownerType === "OPPONENT"
        ? `assegnato a ${purchase.ownerName ??
        "un avversario"
        }`
        : "presente nella tua rosa";

    const confirmed =
      window.confirm(
        `Vuoi annullare l'acquisto di ${purchase.playerName}, ${ownerDescription}, per ${purchase.purchasePrice} crediti?`,
      );

    if (!confirmed) {
      return;
    }

    onRemovePurchase(
      purchase.playerId,
    );
  }


  return (
    <>
      {/*
       * Pulsanti compatti per smartphone.
       */}
      <div className="grid grid-cols-2 gap-3 md:hidden">
        <button
          type="button"
          onClick={() => {
            setOpenPanel(
              "MY_ROSTER",
            );
          }}
          className="
            rounded-xl bg-emerald-700
            px-4 py-3 text-sm
            font-semibold text-white
          "
        >
          La mia rosa ({myPurchases.length})
        </button>

        <button
          type="button"
          onClick={() => {
            setOpenPanel(
              "OPPONENTS",
            );
          }}
          className="
            rounded-xl bg-amber-600
            px-4 py-3 text-sm
            font-semibold text-white
          "
        >
          Avversari ({opponentPurchases.length})
        </button>
      </div>


      {/*
       * Linguetta sinistra per desktop.
       */}
      <button
        type="button"
        onClick={() => {
          setOpenPanel(
            "MY_ROSTER",
          );
        }}
        aria-expanded={
          openPanel === "MY_ROSTER"
        }
        className="
          fixed left-0 top-1/2 z-40
          hidden -translate-y-1/2
          rotate-180 rounded-l-xl
          bg-emerald-700 px-3 py-4
          text-sm font-semibold
          text-white shadow-lg
          transition hover:bg-emerald-800
          md:block
          [writing-mode:vertical-rl]
        "
      >
        La mia rosa ({myPurchases.length})
      </button>


      {/*
       * Linguetta destra per desktop.
       */}
      <button
        type="button"
        onClick={() => {
          setOpenPanel(
            "OPPONENTS",
          );
        }}
        aria-expanded={
          openPanel === "OPPONENTS"
        }
        className="
          fixed right-0 top-1/2 z-40
          hidden -translate-y-1/2
          rounded-l-xl bg-amber-600
          px-3 py-4 text-sm
          font-semibold text-white
          shadow-lg transition
          hover:bg-amber-700 md:block
          [writing-mode:vertical-rl]
        "
      >
        Avversari ({opponentPurchases.length})
      </button>


      {/*
       * Sfondo e pannello aperto.
       */}
      {openPanel && (
        <div className="fixed inset-0 z-50">
          {/*
           * Sfondo cliccabile.
           */}
          <button
            type="button"
            aria-label="Chiudi pannello"
            onClick={() => {
              setOpenPanel(null);
            }}
            className="
              absolute inset-0
              cursor-default
              bg-slate-950/40
            "
          />


          {/*
           * Pannello laterale.
           */}
          <aside
            className={`
              absolute inset-y-0
              w-full max-w-md
              overflow-y-auto
              bg-white p-5 shadow-2xl

              ${openPanel ===
                "MY_ROSTER"
                ? "left-0"
                : "right-0"
              }
            `}
          >
            {/*
             * Pannello della nostra rosa.
             */}
            {openPanel ===
              "MY_ROSTER" && (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">
                        La mia squadra
                      </p>

                      <h2 className="mt-1 text-2xl font-bold">
                        Rosa personale
                      </h2>

                      <p className="mt-1 text-sm text-slate-500">
                        Acquisti, spese e budget
                        ancora disponibili.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setOpenPanel(null);
                      }}
                      className="
                      rounded-lg bg-slate-100
                      px-3 py-2 text-sm
                      font-semibold
                      text-slate-700
                      hover:bg-slate-200
                    "
                    >
                      Chiudi
                    </button>
                  </div>


                  {/*
                 * Informazioni principali.
                 */}
                  <div className="mt-5 grid grid-cols-3 gap-3">
                    <div className="rounded-xl bg-slate-100 p-3">
                      <p className="text-xs text-slate-500">
                        Giocatori
                      </p>

                      <p className="mt-1 text-xl font-bold">
                        {myPurchases.length}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-100 p-3">
                      <p className="text-xs text-slate-500">
                        Speso
                      </p>

                      <p className="mt-1 text-xl font-bold">
                        {myTotalSpent}
                      </p>
                    </div>

                    <div className="rounded-xl bg-emerald-100 p-3 text-emerald-900">
                      <p className="text-xs text-emerald-700">
                        Residuo
                      </p>

                      <p className="mt-1 text-xl font-bold">
                        {remainingBudget}
                      </p>
                    </div>
                  </div>


                  {/* Avanzamento generale della rosa */}
                  <div className="mt-5 rounded-xl border border-sky-200 bg-sky-50 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-bold text-sky-950">
                          {totalRemainingSlots > 0
                            ? `Mancano ${totalRemainingSlots} giocatori`
                            : "Rosa completata"}
                        </p>

                        <p className="mt-1 text-sm text-sky-800">
                          Hai acquistato{" "}
                          {totalPurchasedPlayers} giocatori
                          su {totalRosterSlots}.
                        </p>
                      </div>

                      <div className="shrink-0 rounded-xl bg-white px-3 py-2 text-center">
                        <p className="text-xs text-slate-500">
                          Completamento
                        </p>

                        <p className="mt-1 text-xl font-bold">
                          {rosterCompletion}%
                        </p>
                      </div>
                    </div>
                  </div>


                  {/* Barra di avanzamento complessiva */}
                  <div className="mt-5">
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="font-semibold">
                        Progresso complessivo
                      </span>

                      <span className="font-semibold">
                        {totalPurchasedPlayers}/
                        {totalRosterSlots}
                      </span>
                    </div>

                    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-emerald-600 transition-all"
                        style={{
                          width: `${Math.min(
                            rosterCompletion,
                            100,
                          )}%`,
                        }}
                      />
                    </div>
                  </div>


                  {/* Avanzamento e giocatori per ruolo */}
                  <div className="mt-6 space-y-3">
                    {AUCTION_ROLES.map((role) => {
                      /*
                       * Giocatori acquistati
                       * nel ruolo corrente.
                       */
                      const rolePurchases =
                        myPurchases.filter(
                          (purchase) =>
                            purchase.role === role,
                        );

                      /*
                       * Numero di slot del ruolo.
                       */
                      const totalRoleSlots =
                        config.rosterSlots[role];

                      const remainingRoleSlots =
                        remainingSlots[role];

                      const purchasedRoleSlots =
                        Math.max(
                          totalRoleSlots -
                          remainingRoleSlots,
                          0,
                        );

                      /*
                       * Percentuale di completamento
                       * del ruolo.
                       */
                      const roleProgress =
                        totalRoleSlots > 0
                          ? Math.round(
                            (
                              purchasedRoleSlots /
                              totalRoleSlots
                            ) * 100,
                          )
                          : 100;

                      /*
                       * Crediti già spesi nel ruolo.
                       */
                      const roleSpent =
                        rolePurchases.reduce(
                          (total, purchase) =>
                            total +
                            purchase.purchasePrice,
                          0,
                        );

                      /*
                       * Budget iniziale del ruolo.
                       */
                      const initialRoleBudget =
                        calculateRoleBudget(
                          config,
                          role,
                        );

                      /*
                       * Budget ancora disponibile
                       * dopo la ridistribuzione.
                       */
                      const availableRoleBudget =
                        dynamicRoleBudgets[role];

                      /*
                       * Budget totale aggiornato:
                       * speso + ancora disponibile.
                       */
                      const updatedRoleBudget =
                        roleSpent +
                        availableRoleBudget;

                      return (
                        <details
                          key={role}
                          className="
                            overflow-hidden rounded-xl
                            border border-slate-200
                            bg-white
                          "
                        >
                          {/* Intestazione apribile del ruolo */}
                          <summary
                            className="
                              cursor-pointer list-none
                              bg-slate-50 px-4 py-4
                            "
                          >
                            <div className="flex items-center justify-between gap-3">
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

                                <span className="font-bold">
                                  {AUCTION_ROLE_NAMES[role]}
                                </span>
                              </div>

                              <span className="text-sm font-semibold text-slate-500">
                                {purchasedRoleSlots}/
                                {totalRoleSlots}
                              </span>
                            </div>

                            {/* Barra del singolo ruolo */}
                            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                              <div
                                className={`
                h-full rounded-full
                transition-all
                ${ROLE_PROGRESS_CLASSES[role]}
              `}
                                style={{
                                  width: `${Math.min(
                                    roleProgress,
                                    100,
                                  )}%`,
                                }}
                              />
                            </div>

                            <p className="mt-2 text-xs text-slate-500">
                              {remainingRoleSlots > 0
                                ? `Mancano ${remainingRoleSlots}`
                                : "Ruolo completato"}
                            </p>
                          </summary>


                          {/* Contenuto del ruolo */}
                          <div className="border-t border-slate-200 p-4">
                            {/* Informazioni economiche */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div className="rounded-lg bg-slate-100 p-3">
                                <p className="text-xs text-slate-500">
                                  Budget iniziale
                                </p>

                                <p className="mt-1 font-bold">
                                  {initialRoleBudget}
                                </p>
                              </div>

                              <div className="rounded-lg bg-slate-100 p-3">
                                <p className="text-xs text-slate-500">
                                  Budget aggiornato
                                </p>

                                <p className="mt-1 font-bold">
                                  {updatedRoleBudget}
                                </p>
                              </div>

                              <div className="rounded-lg bg-slate-100 p-3">
                                <p className="text-xs text-slate-500">
                                  Già speso
                                </p>

                                <p className="mt-1 font-bold">
                                  {roleSpent}
                                </p>
                              </div>

                              <div className="rounded-lg bg-emerald-50 p-3">
                                <p className="text-xs text-emerald-700">
                                  Disponibile ora
                                </p>

                                <p className="mt-1 font-bold text-emerald-800">
                                  {availableRoleBudget}
                                </p>
                              </div>
                            </div>


                            {/* Nessun giocatore nel ruolo */}
                            {rolePurchases.length === 0 && (
                              <div className="mt-4 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                                Nessun giocatore acquistato in questo ruolo.
                              </div>
                            )}


                            {/* Giocatori realmente acquistati */}
                            {rolePurchases.length > 0 && (
                              <div className="mt-5">
                                <p className="text-sm font-bold">
                                  Giocatori acquistati
                                </p>

                                <div className="mt-3 space-y-2">
                                  {rolePurchases.map(
                                    (purchase) => (
                                      <article
                                        key={
                                          purchase.playerId
                                        }
                                        className="
                        rounded-lg border
                        border-slate-200
                        bg-white p-3
                      "
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <div>
                                            <p className="font-semibold">
                                              {
                                                purchase.playerName
                                              }
                                            </p>

                                            <p className="mt-1 text-xs text-slate-500">
                                              {purchase.team}
                                            </p>
                                          </div>

                                          <div className="text-right">
                                            <p className="text-xs text-slate-500">
                                              Pagato
                                            </p>

                                            <p className="font-bold">
                                              {
                                                purchase.purchasePrice
                                              }
                                            </p>
                                          </div>
                                        </div>

                                        <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                                          <p className="text-xs text-slate-400">
                                            Registrato alle{" "}
                                            {formatPurchaseTime(
                                              purchase.purchasedAt,
                                            )}
                                          </p>

                                          <button
                                            type="button"
                                            onClick={() => {
                                              handleRemovePurchase(
                                                purchase,
                                              );
                                            }}
                                            className="
                            text-xs font-semibold
                            text-red-700
                            hover:underline
                          "
                                          >
                                            Annulla
                                          </button>
                                        </div>
                                      </article>
                                    ),
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </details>
                      );
                    })}
                  </div>
                </>
              )}


            {/*
             * Pannello degli avversari.
             */}
            {openPanel ===
              "OPPONENTS" && (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-wider text-amber-700">
                        Mercato della lega
                      </p>

                      <h2 className="mt-1 text-2xl font-bold">
                        Acquisti avversari
                      </h2>

                      <p className="mt-1 text-sm text-slate-500">
                        Prezzi registrati e
                        andamento del mercato.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setOpenPanel(null);
                      }}
                      className="
                      rounded-lg bg-slate-100
                      px-3 py-2 text-sm
                      font-semibold
                      text-slate-700
                      hover:bg-slate-200
                    "
                    >
                      Chiudi
                    </button>
                  </div>


                  {/* Riepilogo generale degli avversari */}
                  <div className="mt-5 grid grid-cols-3 gap-3">
                    <div className="rounded-xl bg-slate-100 p-3">
                      <p className="text-xs text-slate-500">
                        Squadre
                      </p>

                      <p className="mt-1 text-xl font-bold">
                        {opponentTeams.length}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-100 p-3">
                      <p className="text-xs text-slate-500">
                        Acquisti
                      </p>

                      <p className="mt-1 text-xl font-bold">
                        {opponentPurchases.length}
                      </p>
                    </div>

                    <div className="rounded-xl bg-amber-100 p-3 text-amber-900">
                      <p className="text-xs text-amber-700">
                        Crediti spesi
                      </p>

                      <p className="mt-1 text-xl font-bold">
                        {opponentTotalSpent}
                      </p>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-slate-500">
                    I budget sono calcolati sugli acquisti
                    avversari che hai registrato.
                  </p>


                  {opponentPurchases.length ===
                    0 && (
                      <div className="mt-5 rounded-xl bg-slate-100 p-6 text-center">
                        <p className="font-semibold text-slate-700">
                          Nessun acquisto avversario
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          Gli acquisti registrati
                          appariranno qui.
                        </p>
                      </div>
                    )}


                  {/* Rose delle squadre avversarie */}
                  <div className="mt-6 space-y-3">
                    {opponentTeams.map(
                      (opponentTeam) => {
                        const totalTeamRemainingSlots =
                          opponentTeam
                            .remainingSlotsByRole.P +
                          opponentTeam
                            .remainingSlotsByRole.D +
                          opponentTeam
                            .remainingSlotsByRole.C +
                          opponentTeam
                            .remainingSlotsByRole.A;


                        return (
                          <details
                            key={opponentTeam.key}
                            className="
            overflow-hidden
            rounded-xl border
            border-amber-200
            bg-white
          "
                          >
                            {/* Intestazione della squadra */}
                            <summary
                              className="
              cursor-pointer list-none
              bg-amber-50 px-4 py-4
            "
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <p className="font-bold text-amber-950">
                                    {opponentTeam.name}
                                  </p>

                                  <p className="mt-1 text-xs text-amber-800">
                                    {
                                      opponentTeam
                                        .purchases.length
                                    }{" "}
                                    giocatori acquistati
                                  </p>
                                </div>

                                <div className="text-right">
                                  <p className="text-xs text-slate-500">
                                    Budget residuo
                                  </p>

                                  <p
                                    className={`
                    mt-1 text-xl font-bold

                    ${opponentTeam
                                        .remainingBudget >
                                        0
                                        ? "text-emerald-700"
                                        : "text-red-700"
                                      }
                  `}
                                  >
                                    {
                                      opponentTeam
                                        .remainingBudget
                                    }
                                  </p>
                                </div>
                              </div>


                              {/* Avanzamento della squadra */}
                              <div className="mt-4">
                                <div className="flex justify-between gap-3 text-xs text-slate-600">
                                  <span>
                                    Rosa{" "}
                                    {
                                      opponentTeam
                                        .purchases.length
                                    }
                                    /{totalRosterSlots}
                                  </span>

                                  <span>
                                    {
                                      opponentTeam
                                        .completionPercentage
                                    }
                                    %
                                  </span>
                                </div>

                                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-amber-100">
                                  <div
                                    className="h-full rounded-full bg-amber-500 transition-all"
                                    style={{
                                      width:
                                        `${Math.min(
                                          opponentTeam
                                            .completionPercentage,
                                          100,
                                        )}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            </summary>


                            {/* Dettagli della squadra */}
                            <div className="border-t border-amber-200 p-4">
                              {/* Informazioni economiche */}
                              <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="rounded-lg bg-slate-100 p-3">
                                  <p className="text-xs text-slate-500">
                                    Iniziale
                                  </p>

                                  <p className="mt-1 font-bold">
                                    {config.startingBudget}
                                  </p>
                                </div>

                                <div className="rounded-lg bg-slate-100 p-3">
                                  <p className="text-xs text-slate-500">
                                    Speso
                                  </p>

                                  <p className="mt-1 font-bold">
                                    {
                                      opponentTeam
                                        .totalSpent
                                    }
                                  </p>
                                </div>

                                <div className="rounded-lg bg-emerald-50 p-3">
                                  <p className="text-xs text-emerald-700">
                                    Residuo
                                  </p>

                                  <p className="mt-1 font-bold text-emerald-800">
                                    {
                                      opponentTeam
                                        .remainingBudget
                                    }
                                  </p>
                                </div>
                              </div>


                              {/* Eventuale superamento */}
                              {opponentTeam.overspending >
                                0 && (
                                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                                    Budget superato di{" "}
                                    {
                                      opponentTeam
                                        .overspending
                                    }{" "}
                                    crediti.
                                  </div>
                                )}


                              {/* Slot per ruolo */}
                              <div className="mt-4 grid grid-cols-4 gap-2">
                                {AUCTION_ROLES.map(
                                  (role) => (
                                    <div
                                      key={role}
                                      className="rounded-lg bg-slate-100 p-2 text-center"
                                    >
                                      <span
                                        className={`
                        inline-flex rounded-full
                        px-2 py-1 text-xs
                        font-bold
                        ${ROLE_BADGE_CLASSES[
                                          role
                                          ]}
                      `}
                                      >
                                        {role}
                                      </span>

                                      <p className="mt-2 text-sm font-bold">
                                        {
                                          opponentTeam
                                            .purchasedByRole[
                                          role
                                          ]
                                        }
                                        /
                                        {
                                          config.rosterSlots[
                                          role
                                          ]
                                        }
                                      </p>
                                    </div>
                                  ),
                                )}
                              </div>

                              <p className="mt-3 text-xs text-slate-500">
                                Mancano{" "}
                                {totalTeamRemainingSlots} giocatori
                                per completare la rosa.
                              </p>


                              {/* Giocatori divisi per ruolo */}
                              <div className="mt-5 space-y-4">
                                {AUCTION_ROLES.map(
                                  (role) => {
                                    const rolePurchases =
                                      opponentTeam
                                        .purchases.filter(
                                          (purchase) =>
                                            purchase.role ===
                                            role,
                                        );

                                    if (
                                      rolePurchases.length ===
                                      0
                                    ) {
                                      return null;
                                    }

                                    return (
                                      <section key={role}>
                                        <div className="flex items-center gap-2">
                                          <span
                                            className={`
                            rounded-full
                            px-2 py-1 text-xs
                            font-bold
                            ${ROLE_BADGE_CLASSES[
                                              role
                                              ]}
                          `}
                                          >
                                            {role}
                                          </span>

                                          <p className="text-sm font-bold">
                                            {
                                              AUCTION_ROLE_NAMES[
                                              role
                                              ]
                                            }
                                          </p>
                                        </div>


                                        <div className="mt-2 space-y-2">
                                          {rolePurchases
                                            .slice()
                                            .reverse()
                                            .map(
                                              (purchase) => {
                                                const referencePrice =
                                                  purchase
                                                    .dynamicRecommendedPriceAtPurchase ??
                                                  purchase
                                                    .baseRecommendedPriceAtPurchase ??
                                                  purchase
                                                    .purchasePrice;

                                                const difference =
                                                  purchase
                                                    .purchasePrice -
                                                  referencePrice;


                                                return (
                                                  <article
                                                    key={
                                                      purchase
                                                        .playerId
                                                    }
                                                    className="
                                    rounded-lg border
                                    border-slate-200
                                    p-3
                                  "
                                                  >
                                                    <div className="flex items-start justify-between gap-3">
                                                      <div>
                                                        <p className="text-sm font-semibold">
                                                          {
                                                            purchase
                                                              .playerName
                                                          }
                                                        </p>

                                                        <p className="mt-1 text-xs text-slate-500">
                                                          {
                                                            purchase
                                                              .team
                                                          }
                                                        </p>
                                                      </div>

                                                      <div className="text-right">
                                                        <p className="text-xs text-slate-500">
                                                          Pagato
                                                        </p>

                                                        <p className="font-bold">
                                                          {
                                                            purchase
                                                              .purchasePrice
                                                          }
                                                        </p>
                                                      </div>
                                                    </div>


                                                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                                                      <div>
                                                        <p className="text-xs text-slate-500">
                                                          Quotazione:{" "}
                                                          {
                                                            referencePrice
                                                          }
                                                        </p>

                                                        <p
                                                          className={`
                                          mt-1 text-xs
                                          font-semibold

                                          ${difference > 0
                                                              ? "text-red-700"
                                                              : difference < 0
                                                                ? "text-emerald-700"
                                                                : "text-slate-600"
                                                            }
                                        `}
                                                        >
                                                          {difference > 0
                                                            ? `+${difference} sopra quotazione`
                                                            : difference < 0
                                                              ? `${Math.abs(
                                                                difference,
                                                              )} sotto quotazione`
                                                              : "Prezzo corretto"}
                                                        </p>
                                                      </div>

                                                      <button
                                                        type="button"
                                                        onClick={() => {
                                                          handleRemovePurchase(
                                                            purchase,
                                                          );
                                                        }}
                                                        className="
                                        text-xs font-semibold
                                        text-red-700
                                        hover:underline
                                      "
                                                      >
                                                        Annulla
                                                      </button>
                                                    </div>
                                                  </article>
                                                );
                                              },
                                            )}
                                        </div>
                                      </section>
                                    );
                                  },
                                )}
                              </div>
                            </div>
                          </details>
                        );
                      },
                    )}
                  </div>
                </>
              )}
          </aside>
        </div>
      )}
    </>
  );
}