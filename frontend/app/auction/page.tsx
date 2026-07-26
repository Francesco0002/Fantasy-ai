"use client";


/*
 * Componente che mostra
 * la rosa acquistata.
 */
import AuctionRoster from "../../components/auction/AuctionRoster";


/*
 * Pannello utilizzato per cercare
 * e acquistare i giocatori.
 */
import AuctionMarket from "../../components/auction/AuctionMarket";


/*
 * Link permette di tornare alla home
 * senza ricaricare completamente la pagina.
 */
import Link from "next/link";


/*
 * Custom hook che gestisce
 * lo stato completo della sessione d'asta.
 */
import { useAuctionSession } from "../../hooks/useAuctionSession";


/*
 * Modulo di configurazione iniziale.
 */
import AuctionSetupForm from "../../components/auction/AuctionSetupForm";

/*
 * Funzioni e costanti della modalità asta.
 */
import {
  AUCTION_ROLES,
  AUCTION_ROLE_NAMES,
  calculateRoleBudget,
} from "../../lib/auction-config";


/*
 * Pagina iniziale della modalità asta.
 */
export default function AuctionPage() {
  /*
  * Stato e dati calcolati
  * della sessione d'asta.
  */
  const {
    session,
    isStorageReady,
    spentByRole,
    remainingSlots,
    maximumBid,
    startAuction,
    resetAuction,
    registerPurchase,
    removePurchase,
  } = useAuctionSession();

  /*
   * Manteniamo questo nome per rendere
   * più leggibile il JSX già presente.
   */
  const startedConfig =
    session?.config ?? null;

  /*
   * Numero complessivo di slot
   * ancora disponibili nella rosa.
   */
  const totalRemainingSlots =
    remainingSlots.P +
    remainingSlots.D +
    remainingSlots.C +
    remainingSlots.A;

  /*
   * Crediti complessivamente spesi.
   */
  const totalSpent = session
    ? session.config.startingBudget -
    session.remainingBudget
    : 0;

  /*
  * Chiede conferma prima di cancellare
  * definitivamente la sessione salvata.
  */
  function handleResetAuction() {
    const confirmed = window.confirm(
      "Vuoi terminare l'asta? Configurazione, budget e acquisti verranno eliminati.",
    );

    if (!confirmed) {
      return;
    }

    resetAuction();
  }


  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-6xl">

        {/* Navigazione */}
        <Link
          href="/"
          className="text-sm font-semibold text-emerald-700 transition hover:text-emerald-900"
        >
          ← Torna ai giocatori
        </Link>


        {/* Intestazione */}
        <header className="mt-6 mb-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">
            Fantasy AI
          </p>

          <h1 className="mt-2 text-3xl font-bold md:text-4xl">
            Modalità asta
          </h1>

          <p className="mt-3 max-w-2xl text-slate-600">
            Configura la tua lega, il budget e la composizione della rosa.
          </p>
        </header>

        {/*
        * Breve caricamento mentre controlliamo
        * se esiste una sessione salvata.
        */}
        {!isStorageReady && (
          <section className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <p className="font-semibold text-slate-700">
              Recupero della sessione d&apos;asta...
            </p>
          </section>
        )}

        {/*
         * Prima dell'avvio mostriamo
         * il modulo di configurazione.
         */}
        {isStorageReady &&
          !startedConfig && (
            <AuctionSetupForm
              onStart={startAuction}
            />
          )}


        {/*
         * Dopo la conferma mostriamo
         * un riepilogo della configurazione.
         */}
        {isStorageReady &&
          startedConfig && (
            <div className="space-y-6">

              {/* Conferma */}
              <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
                <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">
                  Configurazione completata
                </p>

                <h2 className="mt-2 text-2xl font-bold text-emerald-950">
                  {startedConfig.leagueName}
                </h2>

                <p className="mt-2 text-emerald-800">
                  La sessione è pronta per essere avviata.
                </p>
              </section>


              {/* Stato generale della sessione */}
              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Budget ancora disponibile */}
                <div className="rounded-2xl bg-emerald-700 p-5 text-white shadow-sm">
                  <p className="text-sm text-emerald-100">
                    Budget residuo
                  </p>

                  <p className="mt-1 text-3xl font-bold">
                    {session?.remainingBudget ?? 0}
                  </p>

                  <p className="mt-2 text-xs text-emerald-100">
                    su {startedConfig.startingBudget} iniziali
                  </p>
                </div>

                {/* Crediti già spesi */}
                <div className="rounded-2xl bg-white p-5 shadow-sm">
                  <p className="text-sm text-slate-500">
                    Crediti spesi
                  </p>

                  <p className="mt-1 text-3xl font-bold">
                    {totalSpent}
                  </p>
                </div>

                {/* Giocatori acquistati */}
                <div className="rounded-2xl bg-white p-5 shadow-sm">
                  <p className="text-sm text-slate-500">
                    Giocatori acquistati
                  </p>

                  <p className="mt-1 text-3xl font-bold">
                    {session?.purchases.length ?? 0}
                  </p>
                </div>

                {/* Slot ancora da completare */}
                <div className="rounded-2xl bg-white p-5 shadow-sm">
                  <p className="text-sm text-slate-500">
                    Slot ancora liberi
                  </p>

                  <p className="mt-1 text-3xl font-bold">
                    {totalRemainingSlots}
                  </p>
                </div>
              </section>

              {/* Ricerca e registrazione degli acquisti */}
              <AuctionMarket
                config={startedConfig}
                remainingBudget={
                  session?.remainingBudget ?? 0
                }
                remainingSlots={remainingSlots}
                purchases={
                  session?.purchases ?? []
                }
                maximumBid={maximumBid}
                onRegisterPurchase={
                  registerPurchase
                }
              />

              {/* Rosa acquistata */}
              <AuctionRoster
                purchases={
                  session?.purchases ?? []
                }
                onRemovePurchase={
                  removePurchase
                }
              />

              {/* Distribuzione per ruolo */}
              <section className="rounded-2xl bg-white p-6 shadow-sm">
                <h2 className="text-xl font-bold">
                  Strategia iniziale
                </h2>

                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {AUCTION_ROLES.map(
                    (role) => (
                      <div
                        key={role}
                        className="rounded-xl bg-slate-100 p-4"
                      >
                        <p className="font-semibold">
                          {
                            AUCTION_ROLE_NAMES[
                            role
                            ]
                          }
                        </p>

                        <dl className="mt-3 space-y-2 text-sm">
                          {/* Slot ancora disponibili */}
                          <div className="flex justify-between gap-3">
                            <dt className="text-slate-500">
                              Slot liberi
                            </dt>

                            <dd className="font-semibold">
                              {remainingSlots[role]} /{" "}
                              {startedConfig.rosterSlots[role]}
                            </dd>
                          </div>

                          {/* Budget inizialmente consigliato */}
                          <div className="flex justify-between gap-3">
                            <dt className="text-slate-500">
                              Budget previsto
                            </dt>

                            <dd className="font-semibold">
                              {calculateRoleBudget(
                                startedConfig,
                                role,
                              )}
                            </dd>
                          </div>

                          {/* Crediti già spesi nel ruolo */}
                          <div className="flex justify-between gap-3">
                            <dt className="text-slate-500">
                              Speso
                            </dt>

                            <dd className="font-semibold">
                              {spentByRole[role]}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    ),
                  )}
                </div>
              </section>


              {/* Informazioni sul salvataggio */}
              <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
                <p className="font-semibold">
                  Sessione salvata automaticamente
                </p>

                <p className="mt-1 text-sm">
                  Configurazione, budget e acquisti vengono conservati in questo browser. Potrai aggiornare la pagina e continuare l&apos;asta senza perdere i dati.
                </p>

                <p className="mt-2 text-xs text-emerald-700">
                  Il salvataggio non è ancora sincronizzato tra dispositivi diversi.
                </p>
              </section>


              {/* Modifica configurazione */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleResetAuction}
                  className="
                  rounded-xl border
                  border-slate-300 bg-white
                  px-5 py-3 text-sm
                  font-semibold transition
                  hover:bg-slate-100
                "
                >
                  Termina e riconfigura
                </button>
              </div>
            </div>
          )}
      </div>
    </main>
  );
}