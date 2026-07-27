"use client";

/*
 * useMemo evita di ricalcolare inutilmente
 * la suddivisione degli acquisti per ruolo.
 */
import { useMemo } from "react";

/*
 * Costanti condivise della modalità asta.
 */
import {
  AUCTION_ROLES,
  AUCTION_ROLE_NAMES,
} from "../../lib/auction-config";

/*
 * Colori associati ai ruoli.
 */
import {
  ROLE_BADGE_CLASSES,
} from "../../lib/player-utils";

/*
 * Tipi della modalità asta.
 */
import type {
  AuctionPurchase,
  AuctionRole,
} from "../../types/auction";


/*
 * Proprietà ricevute dal componente.
 */
type AuctionRosterProps = {
  purchases: AuctionPurchase[];

  /*
   * Funzione che rimuove un acquisto
   * e restituisce i crediti al budget.
   */
  onRemovePurchase: (
    playerId: number,
  ) => void;
};


/*
 * Formatta l'orario dell'acquisto.
 */
function formatPurchaseTime(
  purchasedAt: string,
): string {
  const date = new Date(purchasedAt);

  if (Number.isNaN(date.getTime())) {
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
 * Mostra la rosa acquistata durante l'asta.
 */
export default function AuctionRoster({
  purchases,
  onRemovePurchase,
}: AuctionRosterProps) {
  /*
  * Dividiamo la rosa personale
  * dagli acquisti degli avversari.
  */
  const myPurchases = useMemo(() => {
    return purchases.filter(
      (purchase) =>
        /*
         * Le vecchie sessioni senza ownerType
         * vengono considerate acquisti personali.
         */
        purchase.ownerType === "ME" ||
        purchase.ownerType === undefined,
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
   * Dividiamo gli acquisti personali
   * per ruolo.
   */
  const purchasesByRole = useMemo(() => {
    const result: Record<
      AuctionRole,
      AuctionPurchase[]
    > = {
      P: [],
      D: [],
      C: [],
      A: [],
    };

    myPurchases.forEach((purchase) => {
      result[purchase.role].push(
        purchase,
      );
    });

    return result;
  }, [myPurchases]);


  /*
   * Calcoliamo la spesa totale.
   */
  const totalSpent = useMemo(() => {
    return myPurchases.reduce(
      (total, purchase) =>
        total + purchase.purchasePrice,
      0,
    );
  }, [myPurchases]);


  /*
   * Richiede conferma prima di eliminare
   * un acquisto dalla rosa.
   */
  function handleRemovePurchase(
    purchase: AuctionPurchase,
  ) {
    const confirmed = window.confirm(
      `Vuoi annullare l'acquisto di ${purchase.playerName} per ${purchase.purchasePrice} crediti?`,
    );

    if (!confirmed) {
      return;
    }

    onRemovePurchase(purchase.playerId);
  }


  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      {/* Intestazione */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">
            Rosa
          </p>

          <h2 className="mt-1 text-2xl font-bold">
            Giocatori acquistati
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Controlla gli acquisti registrati durante l&apos;asta.
          </p>
        </div>

        <div className="flex gap-3">
          <div className="rounded-xl bg-slate-100 px-4 py-3 text-center">
            <p className="text-xs text-slate-500">
              Giocatori
            </p>

            <p className="mt-1 font-bold">
              {myPurchases.length}
            </p>
          </div>

          <div className="rounded-xl bg-emerald-100 px-4 py-3 text-center text-emerald-900">
            <p className="text-xs text-emerald-700">
              Spesa totale
            </p>

            <p className="mt-1 font-bold">
              {totalSpent}
            </p>
          </div>
        </div>
      </div>


      {/* Rosa ancora vuota */}
      {myPurchases.length === 0 && (
        <div className="mt-6 rounded-xl bg-slate-100 p-8 text-center">
          <p className="font-semibold text-slate-700">
            Nessun giocatore acquistato
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Gli acquisti registrati compariranno qui.
          </p>
        </div>
      )}


      {/* Acquisti suddivisi per ruolo */}
      {myPurchases.length > 0 && (
        <div className="mt-6 space-y-6">
          {AUCTION_ROLES.map((role) => {
            const rolePurchases =
              purchasesByRole[role];

            return (
              <section key={role}>
                {/* Titolo del ruolo */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`
                        rounded-full px-3 py-1
                        text-xs font-bold
                        ${ROLE_BADGE_CLASSES[role]}
                      `}
                    >
                      {role}
                    </span>

                    <h3 className="font-bold">
                      {AUCTION_ROLE_NAMES[role]}
                    </h3>
                  </div>

                  <span className="text-sm text-slate-500">
                    {rolePurchases.length}
                  </span>
                </div>


                {/* Nessun acquisto nel ruolo */}
                {rolePurchases.length === 0 && (
                  <div className="mt-3 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                    Nessun giocatore acquistato in questo ruolo.
                  </div>
                )}


                {/* Lista acquisti */}
                {rolePurchases.length > 0 && (
                  <div className="mt-3 space-y-3">
                    {rolePurchases.map(
                      (purchase) => (
                        <article
                          key={purchase.playerId}
                          className="
                            flex flex-col gap-4
                            rounded-xl border
                            border-slate-200 p-4
                            sm:flex-row sm:items-center
                            sm:justify-between
                          "
                        >
                          <div>
                            <p className="font-bold">
                              {purchase.playerName}
                            </p>

                            <p className="mt-1 text-sm text-slate-500">
                              {purchase.team}
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              Registrato alle{" "}
                              {formatPurchaseTime(
                                purchase.purchasedAt,
                              )}
                            </p>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-xs text-slate-500">
                                Prezzo pagato
                              </p>

                              <p className="text-xl font-bold">
                                {purchase.purchasePrice}
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
                                rounded-xl border
                                border-red-200
                                bg-red-50 px-4 py-2
                                text-sm font-semibold
                                text-red-700 transition
                                hover:bg-red-100
                              "
                            >
                              Annulla
                            </button>
                          </div>
                        </article>
                      ),
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
      {/* Acquisti degli avversari */}
      <div className="mt-8 border-t border-slate-200 pt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-amber-700">
              Mercato della lega
            </p>

            <h3 className="mt-1 text-xl font-bold">
              Acquisti degli avversari
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Questi giocatori non appartengono alla tua rosa,
              ma influenzano le quotazioni dinamiche.
            </p>
          </div>

          <div className="rounded-xl bg-amber-100 px-4 py-3 text-center text-amber-900">
            <p className="text-xs text-amber-700">
              Registrati
            </p>

            <p className="mt-1 font-bold">
              {opponentPurchases.length}
            </p>
          </div>
        </div>


        {opponentPurchases.length === 0 && (
          <div className="mt-4 rounded-xl bg-slate-100 p-6 text-center text-sm text-slate-500">
            Nessun acquisto avversario registrato.
          </div>
        )}


        {opponentPurchases.length > 0 && (
          <div className="mt-4 space-y-3">
            {opponentPurchases
              .slice()
              .reverse()
              .map((purchase) => (
                <article
                  key={purchase.playerId}
                  className="
              flex flex-col gap-4
              rounded-xl border
              border-amber-200 bg-amber-50
              p-4 sm:flex-row
              sm:items-center
              sm:justify-between
            "
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold">
                        {purchase.playerName}
                      </p>

                      <span
                        className={`
                    rounded-full px-2 py-1
                    text-xs font-bold
                    ${ROLE_BADGE_CLASSES[
                          purchase.role
                          ]}
                  `}
                      >
                        {purchase.role}
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-slate-500">
                      {purchase.team}
                    </p>

                    <p className="mt-1 text-xs text-amber-700">
                      Acquistato da{" "}
                      {purchase.ownerName ??
                        "Avversario"}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-slate-500">
                        Prezzo pagato
                      </p>

                      <p className="text-xl font-bold">
                        {purchase.purchasePrice}
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
                  rounded-xl border
                  border-red-200 bg-white
                  px-4 py-2 text-sm
                  font-semibold text-red-700
                  transition hover:bg-red-50
                "
                    >
                      Annulla
                    </button>
                  </div>
                </article>
              ))}
          </div>
        )}
      </div>
    </section>
  );
}