"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
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

import {
  createPortal,
} from "react-dom";


import AuctionLeagueRulesPanel from
  "./AuctionLeagueRulesPanel";

import ConfirmDialog from
  "../ui/ConfirmDialog";


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

  /*
   * Le aste completate restano consultabili,
   * ma gli acquisti non possono cambiare.
   */
  isReadOnly?: boolean;
};


/*
 * Pannello attualmente aperto.
 */
type OpenPanel =
  | "MY_ROSTER"
  | "OPPONENTS"
  | "LEAGUE_RULES"
  | null;


/*
 * Permette di renderizzare il portal
 * soltanto dopo l'idratazione nel browser.
 */
function subscribeToPortalMount() {
  return () => { };
}


function getPortalClientSnapshot() {
  return true;
}


function getPortalServerSnapshot() {
  return false;
}


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
  isReadOnly = false,
}: AuctionSidePanelsProps) {
  const [
    openPanel,
    setOpenPanel,
  ] = useState<OpenPanel>(null);

  const [
    pendingRemoval,
    setPendingRemoval,
  ] = useState<AuctionPurchase | null>(
    null,
  );

  /*
  * Indica se il componente è stato
  * montato nel browser.
  *
  * document.body non è disponibile
  * durante il rendering lato server.
  */
  const isPortalMounted =
    useSyncExternalStore(
      subscribeToPortalMount,
      getPortalClientSnapshot,
      getPortalServerSnapshot,
    );


  /*
   * Indica se almeno un pannello
   * laterale è aperto.
   */
  const isPanelOpen =
    openPanel !== null;


  /*
   * Apre direttamente il pannello richiesto.
   */
  const openSidePanel =
    useCallback(
      (
        panel: Exclude<
          OpenPanel,
          null
        >,
      ) => {
        setOpenPanel(panel);
      },
      [],
    );


  /*
   * Chiude qualsiasi pannello aperto.
   */
  const closeSidePanel =
    useCallback(() => {
      setOpenPanel(null);
    }, []);


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
  * Permette di chiudere il pannello
  * tramite il tasto Esc.
  *
  * Non modifichiamo overflow o padding
  * del body, evitando qualsiasi spostamento
  * della schermata sottostante.
  */
  useEffect(() => {
    if (!openPanel) {
      return;
    }

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (event.key === "Escape") {
        closeSidePanel();
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [
    openPanel,
    closeSidePanel,
  ]);


  /*
   * Conferma l'annullamento
   * di un acquisto.
   */
  function handleRemovePurchase(
    purchase: AuctionPurchase,
  ) {
    if (isReadOnly) {
      return;
    }

    setPendingRemoval(purchase);
  }


  function confirmRemovePurchase() {
    if (!pendingRemoval) {
      return;
    }

    onRemovePurchase(
      pendingRemoval.playerId,
    );

    setPendingRemoval(null);
  }


  return (
    <>
      <ConfirmDialog
        isOpen={pendingRemoval !== null}
        title="Annulla acquisto"
        description={
          pendingRemoval
            ? `Vuoi annullare l'acquisto di ${pendingRemoval.playerName} per ${pendingRemoval.purchasePrice} crediti?`
            : ""
        }
        confirmLabel="Annulla acquisto"
        tone="danger"
        onCancel={() => {
          setPendingRemoval(null);
        }}
        onConfirm={confirmRemovePurchase}
      />

      {/*
      * Pulsanti compatti per schermi
      * piccoli e finestre ridimensionate.
      */}
      <div className="grid grid-cols-3 gap-2 md:hidden">
        <button
          type="button"
          onClick={() => {
            openSidePanel(
              "MY_ROSTER",
            );
          }}
          className="
            min-w-0 rounded-xl
            bg-emerald-700 px-2 py-3
            text-xs font-semibold
            text-white sm:text-sm
          "
        >
          La mia rosa ({myPurchases.length})
        </button>

        <button
          type="button"
          onClick={() => {
            openSidePanel(
              "LEAGUE_RULES",
            );
          }}
          className="
            min-w-0 rounded-xl
            bg-slate-800 px-2 py-3
            text-xs font-semibold
            text-white sm:text-sm
          "
        >
          Regole
        </button>

        <button
          type="button"
          onClick={() => {
            openSidePanel(
              "OPPONENTS",
            );
          }}
          className="
            min-w-0 rounded-xl
            bg-amber-600 px-2 py-3
            text-xs font-semibold
            text-white sm:text-sm
          "
        >
          Avversari ({opponentPurchases.length})
        </button>
      </div>

      {isPortalMounted &&
        createPortal(
          <>

            {/*
            * Sfondo oscurato globale.
            *
            * Essendo renderizzato direttamente
            * nel body, copre anche il banner
            * inferiore della sessione.
            */}
            <button
              type="button"
              aria-label="Chiudi pannello laterale"
              tabIndex={
                isPanelOpen ? 0 : -1
              }
              onClick={closeSidePanel}
              className={`
                fixed inset-0 z-[1000]
                cursor-default
                border-0 p-0
                bg-slate-950/40
                

                transition-opacity
                duration-[400ms]
                ease-[cubic-bezier(0.22,1,0.36,1)]

                ${isPanelOpen
                  ? "pointer-events-auto opacity-100"
                  : "pointer-events-none opacity-0"
                }
              `}
            />

            {/*
            * Drawer sinistro.
            *
            * Il pannello e la linguetta fanno parte
            * dello stesso elemento animato.
            */}
            <div
              className={`
                fixed inset-y-0 left-0 z-[1010]
                h-dvh
                w-full max-w-md
                overflow-visible

                transform-gpu
                transition-transform
                duration-[400ms]
                ease-[cubic-bezier(0.22,1,0.36,1)]
                will-change-transform

                ${openPanel === "MY_ROSTER"
                  ? "translate-x-0"
                  : "-translate-x-full"
                }
              `}
            >
              {/* Contenuto completo della rosa personale */}
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
                {/* Intestazione compatta */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                      La mia squadra
                    </p>

                    <h2 className="mt-0.5 text-xl font-bold">
                      Rosa personale
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={closeSidePanel}
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


                {/* Riepilogo compatto della rosa */}
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  {/* Dati economici e rosa */}
                  <div className="grid grid-cols-3 divide-x divide-slate-200">
                    <div className="pr-3">
                      <p className="text-[11px] text-slate-500">
                        Rosa
                      </p>

                      <p className="mt-0.5 text-lg font-bold">
                        {totalPurchasedPlayers}/
                        {totalRosterSlots}
                      </p>
                    </div>

                    <div className="px-3">
                      <p className="text-[11px] text-slate-500">
                        Speso
                      </p>

                      <p className="mt-0.5 text-lg font-bold">
                        {myTotalSpent}
                      </p>
                    </div>

                    <div className="pl-3">
                      <p className="text-[11px] text-emerald-700">
                        Residuo
                      </p>

                      <p className="mt-0.5 text-lg font-bold text-emerald-800">
                        {remainingBudget}
                      </p>
                    </div>
                  </div>


                  {/* Completamento complessivo */}
                  <div className="mt-3 border-t border-slate-200 pt-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-slate-700">
                          Completamento rosa
                        </p>

                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {totalRemainingSlots > 0
                            ? `Mancano ${totalRemainingSlots} giocatori`
                            : "Rosa completata"}
                        </p>
                      </div>

                      <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
                        {rosterCompletion}%
                      </span>
                    </div>

                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="
                    h-full rounded-full
                    bg-emerald-600
                    transition-all
                  "
                        style={{
                          width: `${Math.min(
                            rosterCompletion,
                            100,
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>


                {/* Ruoli della rosa */}
                <div className="mt-4 space-y-2">
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
                     * Slot totali e slot liberi.
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
                     * Budget inizialmente previsto.
                     */
                    const initialRoleBudget =
                      calculateRoleBudget(
                        config,
                        role,
                      );

                    /*
                     * Budget ancora disponibile
                     * secondo la distribuzione dinamica.
                     */
                    const availableRoleBudget =
                      dynamicRoleBudgets[role];

                    return (
                      <details
                        key={role}
                        className="
                          overflow-hidden
                          rounded-xl border
                          border-slate-200
                          bg-white
                        "
                      >
                        {/* Intestazione compatta del ruolo */}
                        <summary
                          className="
                            cursor-pointer list-none
                            bg-slate-50 px-3 py-3
                          "
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              {/* Nome, badge e slot */}
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

                                <span className="truncate text-sm font-bold">
                                  {AUCTION_ROLE_NAMES[role]}
                                </span>

                                <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                  {purchasedRoleSlots}/
                                  {totalRoleSlots}
                                </span>
                              </div>


                              {/* Barra di completamento compatta */}
                              <div className="mt-2 flex items-center gap-2">
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
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

                                <span className="shrink-0 text-[11px] text-slate-500">
                                  {remainingRoleSlots > 0
                                    ? `-${remainingRoleSlots}`
                                    : "Completo"}
                                </span>
                              </div>
                            </div>


                            {/* Budget attualmente utilizzabile */}
                            <div className="shrink-0 rounded-lg bg-white px-3 py-2 text-right shadow-sm">
                              <p className="text-[11px] text-slate-500">
                                Disponibile
                              </p>

                              <p className="text-lg font-bold text-emerald-700">
                                {availableRoleBudget}
                              </p>
                            </div>
                          </div>
                        </summary>


                        {/* Contenuto del ruolo */}
                        <div className="border-t border-slate-200 p-3">
                          {/* Informazioni economiche compatte */}
                          <div className="grid grid-cols-3 gap-1.5 text-center">
                            <div className="rounded-lg bg-slate-100 px-2 py-2">
                              <p className="text-[11px] text-slate-500">
                                Iniziale
                              </p>

                              <p className="mt-0.5 font-bold">
                                {initialRoleBudget}
                              </p>
                            </div>

                            <div className="rounded-lg bg-slate-100 px-2 py-2">
                              <p className="text-[11px] text-slate-500">
                                Speso
                              </p>

                              <p className="mt-0.5 font-bold">
                                {roleSpent}
                              </p>
                            </div>

                            <div className="rounded-lg bg-emerald-50 px-2 py-2">
                              <p className="text-[11px] text-emerald-700">
                                Disponibile
                              </p>

                              <p className="mt-0.5 font-bold text-emerald-800">
                                {availableRoleBudget}
                              </p>
                            </div>
                          </div>


                          {/* Ruolo ancora vuoto */}
                          {rolePurchases.length === 0 && (
                            <div className="mt-3 rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-xs text-slate-500">
                              Nessun giocatore acquistato in questo ruolo.
                            </div>
                          )}


                          {/* Giocatori acquistati nel ruolo */}
                          {rolePurchases.length > 0 && (
                            <div className="mt-4">
                              <p className="text-sm font-bold">
                                Giocatori acquistati
                              </p>

                              <div className="mt-2 space-y-1.5">
                                {rolePurchases.map(
                                  (purchase) => (
                                    <article
                                      key={purchase.playerId}
                                      className="
                                        rounded-lg border
                                        border-slate-200
                                        bg-white px-3 py-2.5
                                      "
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        {/* Nome e squadra */}
                                        <div className="min-w-0">
                                          <p className="truncate font-semibold">
                                            {purchase.playerName}
                                          </p>

                                          <p className="mt-1 truncate text-xs text-slate-500">
                                            {purchase.team}
                                          </p>
                                        </div>

                                        {/* Prezzo pagato */}
                                        <div className="shrink-0 text-right">
                                          <p className="text-xs text-slate-500">
                                            Pagato
                                          </p>

                                          <p className="font-bold">
                                            {purchase.purchasePrice}
                                          </p>
                                        </div>
                                      </div>


                                      {/* Orario e annullamento */}
                                      <div className="mt-2 flex items-center justify-between gap-3 border-t border-slate-100 pt-2">
                                        <p className="text-xs text-slate-400">
                                          Registrato alle{" "}
                                          {formatPurchaseTime(
                                            purchase.purchasedAt,
                                          )}
                                        </p>

                                        {!isReadOnly && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              handleRemovePurchase(
                                                purchase,
                                              );
                                            }}
                                            className="
                                              shrink-0 text-xs
                                              font-semibold
                                              text-red-700
                                              hover:underline
                                            "
                                          >
                                            Annulla
                                          </button>
                                        )}
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
              </aside>


              {/* Linguetta collegata fisicamente al pannello */}
              <button
                type="button"
                onClick={() => {
                  if (
                    openPanel === "MY_ROSTER"
                  ) {
                    closeSidePanel();
                    return;
                  }

                  openSidePanel("MY_ROSTER");
                }}
                aria-expanded={
                  openPanel === "MY_ROSTER"
                }
                className="
                  absolute left-full top-1/2
                  hidden -translate-y-1/2
                  rotate-180 rounded-l-xl
                  bg-emerald-700 px-3 py-4
                  text-sm font-semibold
                  text-white shadow-lg

                  transition-colors
                  duration-200
                  hover:bg-emerald-800

                  md:block
                  [writing-mode:vertical-rl]
                "
              >
                La mia rosa ({myPurchases.length})
              </button>
            </div>

            {/*
            * Drawer destro.
            *
            * Pannello e linguetta costituiscono
            * un unico elemento animato.
            */}
            <div
              className={`
                fixed inset-y-0 right-0 z-[1010]
                h-dvh
                w-full max-w-md
                overflow-visible

                transform-gpu
                transition-transform
                duration-[400ms]
                ease-[cubic-bezier(0.22,1,0.36,1)]
                will-change-transform

                ${openPanel === "OPPONENTS"
                  ? "translate-x-0"
                  : "translate-x-full"
                }
              `}
            >
              {/* Contenuto completo degli acquisti avversari */}
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
                {/* Intestazione compatta */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                      Mercato della lega
                    </p>

                    <h2 className="mt-0.5 text-xl font-bold">
                      Acquisti avversari
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={closeSidePanel}
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


                {/* Riepilogo compatto del mercato */}
                <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-[11px] text-slate-500">
                        Squadre
                      </p>

                      <p className="text-lg font-bold">
                        {opponentTeams.length}
                      </p>
                    </div>

                    <div className="h-8 w-px bg-slate-200" />

                    <div>
                      <p className="text-[11px] text-slate-500">
                        Acquisti registrati
                      </p>

                      <p className="text-lg font-bold">
                        {opponentPurchases.length}
                      </p>
                    </div>
                  </div>

                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                    Mercato lega
                  </span>
                </div>


                {/* Nessun acquisto avversario */}
                {opponentPurchases.length === 0 && (
                  <div className="mt-5 rounded-xl bg-slate-100 p-6 text-center">
                    <p className="font-semibold text-slate-700">
                      Nessun acquisto avversario
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      Gli acquisti registrati appariranno qui.
                    </p>
                  </div>
                )}


                {/* Squadre avversarie */}
                <div className="mt-6 space-y-3">
                  {opponentTeams.map(
                    (opponentTeam) => {
                      /*
                       * Numero complessivo di giocatori
                       * ancora mancanti alla squadra.
                       */
                      const totalTeamRemainingSlots =
                        opponentTeam.remainingSlotsByRole.P +
                        opponentTeam.remainingSlotsByRole.D +
                        opponentTeam.remainingSlotsByRole.C +
                        opponentTeam.remainingSlotsByRole.A;

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
                          {/* Intestazione compatta della squadra */}
                          <summary
                            className="
                              cursor-pointer list-none
                              bg-amber-50 px-3 py-3
                            "
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                {/* Nome e avanzamento numerico */}
                                <div className="flex items-center gap-2">
                                  <p className="truncate font-bold text-amber-950">
                                    {opponentTeam.name}
                                  </p>

                                  <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                    {opponentTeam.purchases.length}/
                                    {totalRosterSlots}
                                  </span>
                                </div>

                                {/* Barra compatta */}
                                <div className="mt-2 flex items-center gap-2">
                                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-amber-100">
                                    <div
                                      className="h-full rounded-full bg-amber-500 transition-all"
                                      style={{
                                        width: `${Math.min(
                                          opponentTeam.completionPercentage,
                                          100,
                                        )}%`,
                                      }}
                                    />
                                  </div>

                                  <span className="shrink-0 text-[11px] font-semibold text-amber-800">
                                    {opponentTeam.completionPercentage}%
                                  </span>
                                </div>
                              </div>

                              {/* Budget residuo */}
                              <div className="shrink-0 rounded-lg bg-white px-3 py-2 text-right shadow-sm">
                                <p className="text-[11px] text-slate-500">
                                  Residuo
                                </p>

                                <p
                                  className={`
                                    text-lg font-bold

                                    ${opponentTeam.remainingBudget > 0
                                      ? "text-emerald-700"
                                      : "text-red-700"
                                    }
                                  `}
                                >
                                  {opponentTeam.remainingBudget}
                                </p>
                              </div>
                            </div>
                          </summary>


                          {/* Dettagli della squadra */}
                          <div className="border-t border-amber-200 p-3">
                            {/* Informazioni economiche */}
                            <div className="grid grid-cols-3 gap-1.5 text-center">
                              {/* Budget iniziale */}
                              <div className="rounded-lg bg-slate-100 px-2 py-2">
                                <p className="text-[11px] text-slate-500">
                                  Iniziale
                                </p>

                                <p className="mt-0.5 font-bold">
                                  {config.startingBudget}
                                </p>
                              </div>

                              {/* Crediti spesi */}
                              <div className="rounded-lg bg-slate-100 px-2 py-2">
                                <p className="text-[11px] text-slate-500">
                                  Speso
                                </p>

                                <p className="mt-0.5 font-bold">
                                  {opponentTeam.totalSpent}
                                </p>
                              </div>

                              {/* Budget residuo */}
                              <div className="rounded-lg bg-emerald-50 px-2 py-2">
                                <p className="text-[11px] text-slate-500">
                                  Residuo
                                </p>

                                <p className="mt-0.5 font-bold">
                                  {opponentTeam.remainingBudget}
                                </p>
                              </div>
                            </div>


                            {/* Eventuale superamento del budget */}
                            {opponentTeam.overspending > 0 && (
                              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                                Budget superato di{" "}
                                {opponentTeam.overspending} crediti.
                              </div>
                            )}


                            {/* Slot occupati per ruolo */}
                            <div className="mt-3 grid grid-cols-4 gap-1.5">
                              {AUCTION_ROLES.map(
                                (role) => (
                                  <div
                                    key={role}
                                    className="
                                rounded-lg border
                                border-slate-200
                                bg-slate-50 px-1.5 py-2
                                text-center
                              "
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

                                    <p className="mt-1 text-xs font-bold">
                                      {
                                        opponentTeam
                                          .purchasedByRole[role]
                                      }
                                      /
                                      {config.rosterSlots[role]}
                                    </p>
                                  </div>
                                ),
                              )}
                            </div>


                            <p className="mt-2 text-[11px] text-slate-500">
                              Mancano{" "}
                              {totalTeamRemainingSlots} giocatori
                              per completare la rosa.
                            </p>


                            {/* Giocatori divisi per ruolo */}
                            <div className="mt-4 space-y-3">
                              {AUCTION_ROLES.map(
                                (role) => {
                                  /*
                                   * Acquisti della squadra
                                   * relativi al ruolo corrente.
                                   */
                                  const rolePurchases =
                                    opponentTeam.purchases.filter(
                                      (purchase) =>
                                        purchase.role === role,
                                    );

                                  /*
                                   * Non mostriamo ruoli
                                   * ancora senza giocatori.
                                   */
                                  if (
                                    rolePurchases.length === 0
                                  ) {
                                    return null;
                                  }

                                  return (
                                    <section key={role}>
                                      {/* Titolo del ruolo */}
                                      <div className="flex items-center gap-2">
                                        <span
                                          className={`
                              rounded-full
                              px-2 py-1
                              text-xs font-bold
                              ${ROLE_BADGE_CLASSES[role]}
                            `}
                                        >
                                          {role}
                                        </span>

                                        <p className="text-sm font-bold">
                                          {AUCTION_ROLE_NAMES[role]}
                                        </p>
                                      </div>


                                      {/* Giocatori del ruolo */}
                                      <div className="mt-1.5 space-y-1.5">
                                        {rolePurchases
                                          .slice()
                                          .reverse()
                                          .map(
                                            (purchase) => {
                                              /*
                                               * Quotazione disponibile
                                               * al momento dell'acquisto.
                                               */
                                              const referencePrice =
                                                purchase
                                                  .dynamicRecommendedPriceAtPurchase ??
                                                purchase
                                                  .baseRecommendedPriceAtPurchase ??
                                                purchase
                                                  .purchasePrice;

                                              /*
                                               * Differenza tra prezzo pagato
                                               * e quotazione di riferimento.
                                               */
                                              const difference =
                                                purchase.purchasePrice -
                                                referencePrice;

                                              return (
                                                <article
                                                  key={
                                                    purchase.playerId
                                                  }
                                                  className="
                                              rounded-lg border
                                              border-slate-200
                                              bg-white px-3 py-2.5
                                            "
                                                >
                                                  <div className="flex items-start justify-between gap-3">
                                                    {/* Nome e squadra */}
                                                    <div className="min-w-0">
                                                      <p className="truncate text-sm font-semibold">
                                                        {purchase.playerName}
                                                      </p>

                                                      <p className="mt-1 truncate text-xs text-slate-500">
                                                        {purchase.team}
                                                      </p>
                                                    </div>

                                                    {/* Prezzo pagato */}
                                                    <div className="shrink-0 text-right">
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


                                                  {/* Quotazione e annullamento */}
                                                  <div className="mt-2 flex items-center justify-between gap-3 border-t border-slate-100 pt-2">
                                                    <div>
                                                      <p className="text-xs text-slate-500">
                                                        Quotazione:{" "}
                                                        {referencePrice}
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

                                                    {!isReadOnly && (
                                                      <button
                                                        type="button"
                                                        onClick={() => {
                                                          handleRemovePurchase(
                                                            purchase,
                                                          );
                                                        }}
                                                        className="
                                                          shrink-0 text-xs
                                                          font-semibold
                                                          text-red-700
                                                          hover:underline
                                                        "
                                                      >
                                                        Annulla
                                                      </button>
                                                    )}
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
              </aside>


              {/* Linguetta collegata al pannello destro */}
              <button
                type="button"
                onClick={() => {
                  if (
                    openPanel === "OPPONENTS"
                  ) {
                    closeSidePanel();
                    return;
                  }

                  openSidePanel("OPPONENTS");
                }}
                aria-expanded={
                  openPanel === "OPPONENTS"
                }
                className="
                  absolute right-full top-[62%]
                  hidden -translate-y-1/2
                  rounded-l-xl
                  bg-amber-600 px-3 py-4
                  text-sm font-semibold
                  text-white shadow-lg

                  transition-colors
                  duration-200
                  hover:bg-amber-700

                  md:block
                  [writing-mode:vertical-rl]
                "
              >
                Avversari ({opponentPurchases.length})
              </button>
            </div>
            {/*
            * Drawer destro dedicato
            * alle regole della lega.
            */}
            <div
              className={`
                fixed inset-y-0 right-0 z-[1020]
                h-dvh
                w-full max-w-md
                overflow-visible

                transform-gpu
                transition-transform
                duration-[400ms]
                ease-[cubic-bezier(0.22,1,0.36,1)]
                will-change-transform

                ${openPanel === "LEAGUE_RULES"
                  ? "translate-x-0"
                  : "translate-x-full"
                }
              `}
            >
              <AuctionLeagueRulesPanel
                config={config}
                onClose={closeSidePanel}
              />

              {/* Linguetta desktop */}
              <button
                type="button"
                onClick={() => {
                  if (
                    openPanel ===
                    "LEAGUE_RULES"
                  ) {
                    closeSidePanel();
                    return;
                  }

                  openSidePanel(
                    "LEAGUE_RULES",
                  );
                }}
                aria-expanded={
                  openPanel ===
                  "LEAGUE_RULES"
                }
                className={`
                  absolute right-full top-[35%]
                  hidden -translate-y-1/2
                  rounded-l-xl
                  bg-slate-800 px-3 py-4
                  text-sm font-semibold
                  text-white shadow-lg

                  transition-all
                  duration-200
                  hover:bg-slate-900

                  md:block
                  [writing-mode:vertical-rl]

                  ${openPanel === null ||
                    openPanel === "LEAGUE_RULES"
                    ? "pointer-events-auto opacity-100"
                    : "pointer-events-none opacity-0"
                  }
                `}
              >
                Regole della lega
              </button>
            </div>
          </>,
          document.body,
        )}
    </>

  );
}
