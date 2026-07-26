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
   * Dividiamo gli acquisti per ruolo.
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

    purchases.forEach((purchase) => {
      result[purchase.role].push(purchase);
    });

    return result;
  }, [purchases]);


  /*
   * Calcoliamo la spesa totale.
   */
  const totalSpent = useMemo(() => {
    return purchases.reduce(
      (total, purchase) =>
        total + purchase.purchasePrice,
      0,
    );
  }, [purchases]);


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
              {purchases.length}
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
      {purchases.length === 0 && (
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
      {purchases.length > 0 && (
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
    </section>
  );
}