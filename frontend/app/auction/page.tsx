"use client";

/*
 * Link permette di tornare alla home
 * senza ricaricare completamente la pagina.
 */
import Link from "next/link";

/*
 * useState conserva la configurazione
 * dopo l'invio del modulo.
 */
import { useState } from "react";

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
  calculateTotalRosterSlots,
} from "../../lib/auction-config";

/*
 * Tipo della configurazione d'asta.
 */
import type {
  AuctionConfig,
} from "../../types/auction";


/*
 * Pagina iniziale della modalità asta.
 */
export default function AuctionPage() {
  /*
   * Configurazione confermata dall'utente.
   *
   * null significa che l'asta
   * non è ancora stata configurata.
   */
  const [
    startedConfig,
    setStartedConfig,
  ] = useState<AuctionConfig | null>(
    null,
  );


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
         * Prima dell'avvio mostriamo
         * il modulo di configurazione.
         */}
        {!startedConfig && (
          <AuctionSetupForm
            onStart={(config) => {
              setStartedConfig(config);
            }}
          />
        )}


        {/*
         * Dopo la conferma mostriamo
         * un riepilogo della configurazione.
         */}
        {startedConfig && (
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


            {/* Dati generali */}
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">
                  Partecipanti
                </p>

                <p className="mt-1 text-3xl font-bold">
                  {startedConfig.participants}
                </p>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">
                  Budget iniziale
                </p>

                <p className="mt-1 text-3xl font-bold">
                  {startedConfig.startingBudget}
                </p>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">
                  Offerta minima
                </p>

                <p className="mt-1 text-3xl font-bold">
                  {startedConfig.minimumBid}
                </p>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">
                  Giocatori in rosa
                </p>

                <p className="mt-1 text-3xl font-bold">
                  {calculateTotalRosterSlots(
                    startedConfig,
                  )}
                </p>
              </div>
            </section>


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
                        <div className="flex justify-between gap-3">
                          <dt className="text-slate-500">
                            Slot
                          </dt>

                          <dd className="font-semibold">
                            {
                              startedConfig
                                .rosterSlots[
                                role
                              ]
                            }
                          </dd>
                        </div>

                        <div className="flex justify-between gap-3">
                          <dt className="text-slate-500">
                            Budget
                          </dt>

                          <dd className="font-semibold">
                            {calculateRoleBudget(
                              startedConfig,
                              role,
                            )}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  ),
                )}
              </div>
            </section>


            {/* Avviso temporaneo */}
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
              <p className="font-semibold">
                Configurazione temporanea
              </p>

              <p className="mt-1 text-sm">
                In questa versione i dati vengono conservati solamente finché la pagina rimane aperta. Il salvataggio permanente verrà aggiunto successivamente.
              </p>
            </section>


            {/* Modifica configurazione */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setStartedConfig(null);
                }}
                className="
                  rounded-xl border
                  border-slate-300 bg-white
                  px-5 py-3 text-sm
                  font-semibold transition
                  hover:bg-slate-100
                "
              >
                Modifica configurazione
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}