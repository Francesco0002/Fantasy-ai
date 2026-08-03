"use client";

import Link from "next/link";

import {
  useParams,
} from "next/navigation";

import {
  useAuth,
} from "../../../hooks/useAuth";

import {
  useSeasonLeague,
} from "../../../hooks/useSeasonLeague";

import type {
  SeasonLeagueMode,
} from "../../../types/season";


/*
 * Traduce la modalità tecnica della lega
 * in un'etichetta leggibile.
 */
function getModeLabel(
  mode: SeasonLeagueMode,
): string {
  switch (mode) {
    case "CLASSIC":
      return "Classica";

    default:
      return mode;
  }
}


/*
 * Pagina dedicata alla gestione
 * di una singola lega stagionale.
 */
export default function SeasonLeaguePage() {
  const params = useParams<{
    leagueId: string;
  }>();

  const leagueId =
    params.leagueId ?? null;

  const {
    user,
    isAuthReady,
  } = useAuth();


  /*
   * La lega viene richiesta soltanto quando
   * l'autenticazione è stata verificata.
   */
  const {
    league,
    isLoading,
    error,
  } = useSeasonLeague(
    leagueId,
    isAuthReady && Boolean(user),
  );


  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/season"
          className="text-sm font-semibold text-emerald-700 transition hover:text-emerald-900"
        >
          ← Torna alle mie leghe
        </Link>


        {/* Verifica iniziale dell'account */}
        {!isAuthReady && (
          <section className="mt-6 rounded-2xl bg-white p-8 text-center shadow-sm">
            <p className="font-semibold text-slate-700">
              Verifica dell&apos;account...
            </p>
          </section>
        )}


        {/* Utente non autenticato */}
        {isAuthReady && !user && (
          <section className="mt-6 rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm">
            <h1 className="text-2xl font-bold">
              Accesso richiesto
            </h1>

            <p className="mt-2 text-slate-600">
              Devi effettuare il login per gestire
              questa lega stagionale.
            </p>

            <Link
              href="/"
              className="mt-5 inline-flex rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800"
            >
              Torna alla pagina di accesso
            </Link>
          </section>
        )}


        {/* Caricamento della lega */}
        {isAuthReady &&
          user &&
          isLoading && (
            <section className="mt-6 rounded-2xl bg-white p-8 text-center shadow-sm">
              <p className="font-semibold text-slate-700">
                Recupero della lega...
              </p>
            </section>
          )}


        {/* Lega inesistente o non appartenente all'account */}
        {isAuthReady &&
          user &&
          !isLoading &&
          error && (
            <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-800">
              <h1 className="text-2xl font-bold">
                Lega non disponibile
              </h1>

              <p className="mt-2">
                {error}
              </p>

              <Link
                href="/season"
                className="mt-5 inline-flex rounded-xl bg-red-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-800"
              >
                Torna alle mie leghe
              </Link>
            </section>
          )}


        {/* Contenuto della lega */}
        {isAuthReady &&
          user &&
          !isLoading &&
          !error &&
          league && (
            <>
              <header className="mt-6 rounded-2xl bg-white p-6 shadow-sm md:p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">
                      Gestione lega
                    </p>

                    <h1 className="mt-2 text-3xl font-bold md:text-4xl">
                      {league.leagueName}
                    </h1>

                    <p className="mt-2 text-slate-600">
                      Gestisci la tua stagione
                      fantacalcistica.
                    </p>
                  </div>

                  <span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-800">
                    {getModeLabel(league.mode)}
                  </span>
                </div>


                <div className="mt-7 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl bg-slate-100 p-4">
                    <p className="text-sm text-slate-500">
                      Nome della squadra
                    </p>

                    <p className="mt-1 text-lg font-bold">
                      {league.teamName}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-100 p-4">
                    <p className="text-sm text-slate-500">
                      Stagione
                    </p>

                    <p className="mt-1 text-lg font-bold">
                      {league.season}
                    </p>
                  </div>
                </div>
              </header>


              {/* Sezioni che svilupperemo nei prossimi blocchi */}
              <section className="mt-6 grid gap-5 md:grid-cols-3">
                <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">
                    Rosa
                  </p>

                  <h2 className="mt-2 text-xl font-bold">
                    La mia squadra
                  </h2>

                  <p className="mt-2 text-sm text-slate-600">
                    Qui potrai inserire e consultare
                    i giocatori della tua rosa.
                  </p>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">
                    Regole
                  </p>

                  <h2 className="mt-2 text-xl font-bold">
                    Impostazioni della lega
                  </h2>

                  <p className="mt-2 text-sm text-slate-600">
                    Qui configurerai partecipanti,
                    rosa, crediti e modificatori.
                  </p>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">
                    Stagione
                  </p>

                  <h2 className="mt-2 text-xl font-bold">
                    Gestione giornate
                  </h2>

                  <p className="mt-2 text-sm text-slate-600">
                    Qui troverai formazione,
                    calendario e risultati.
                  </p>
                </article>
              </section>
            </>
          )}
      </div>
    </main>
  );
}