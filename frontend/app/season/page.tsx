"use client";

import Link from "next/link";

import {
  useAuth,
} from "../../hooks/useAuth";

import {
  useSeasonLeagues,
} from "../../hooks/useSeasonLeagues";

import type {
  CreateSeasonLeagueInput,
  SeasonLeagueMode,
} from "../../types/season";

import {
  SeasonLeagueForm,
} from "../../components/SeasonLeagueForm";

/*
 * Converte la data ricevuta dal backend
 * in un formato italiano leggibile.
 */
function formatDate(
  value: string,
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Data non disponibile";
  }

  return new Intl.DateTimeFormat(
    "it-IT",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(date);
}


/*
 * Traduce la modalità tecnica
 * della lega in un'etichetta leggibile.
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
 * Pagina contenente le leghe stagionali
 * dell'utente autenticato.
 */
export default function SeasonPage() {
  const {
    user,
    isAuthReady,
  } = useAuth();


  /*
   * Il caricamento parte soltanto dopo
   * la verifica dell'autenticazione.
   */
  const {
    leagues,
    isLoading,
    isCreating,
    error,
    addSeasonLeague,
  } = useSeasonLeagues(
    isAuthReady && Boolean(user),
  );


  /*
  * Invia i dati del form all'hook
  * che crea e registra la nuova lega.
  */
  async function handleCreateLeague(
    input: CreateSeasonLeagueInput,
  ): Promise<void> {
    await addSeasonLeague(input);
  }


  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-6xl">

        <Link
          href="/"
          className="text-sm font-semibold text-emerald-700 transition hover:text-emerald-900"
        >
          ← Torna ai giocatori
        </Link>


        <header className="mt-5 mb-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">
            Modalità Stagione
          </p>

          <h1 className="mt-2 text-3xl font-bold md:text-4xl">
            Le mie leghe
          </h1>

          <p className="mt-3 max-w-2xl text-slate-600">
            Consulta le leghe stagionali associate
            al tuo account Fantasy AI.
          </p>
        </header>


        {/* Verifica iniziale dell'account */}
        {!isAuthReady && (
          <section className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <p className="font-semibold text-slate-700">
              Verifica dell&apos;account...
            </p>
          </section>
        )}


        {/* Utente non autenticato */}
        {isAuthReady && !user && (
          <section className="rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm">
            <h2 className="text-xl font-bold">
              Accesso richiesto
            </h2>

            <p className="mt-2 text-slate-600">
              Devi effettuare il login per visualizzare
              le tue leghe stagionali.
            </p>

            <Link
              href="/"
              className="mt-5 inline-flex rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800"
            >
              Torna alla pagina di accesso
            </Link>
          </section>
        )}


        {/* Creazione di una nuova lega */}
        {isAuthReady &&
          user &&
          !isLoading &&
          !error && (
            <SeasonLeagueForm
              isSubmitting={isCreating}
              onCreate={handleCreateLeague}
            />
          )}


        {/* Caricamento delle leghe */}
        {isAuthReady && user && isLoading && (
          <section className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <p className="font-semibold text-slate-700">
              Recupero delle leghe...
            </p>
          </section>
        )}


        {/* Errore restituito dal backend */}
        {isAuthReady &&
          user &&
          !isLoading &&
          error && (
            <section className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
              <p className="font-semibold">
                Operazione non completata
              </p>

              <p className="mt-2 text-sm">
                {error}
              </p>
            </section>
          )}


        {/* Account senza leghe stagionali */}
        {isAuthReady &&
          user &&
          !isLoading &&
          !error &&
          leagues.length === 0 && (
            <section className="mt-6 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/60 p-8 text-center shadow-sm">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-3xl font-bold text-emerald-700">
                +
              </div>

              <h2 className="mt-5 text-xl font-bold">
                Nessuna lega stagionale
              </h2>

              <p className="mt-2 text-sm text-slate-600">
                Non hai ancora creato una lega per
                la modalità Stagione.
              </p>
            </section>
          )}


        {/* Elenco delle leghe dell'utente */}
        {isAuthReady &&
          user &&
          !isLoading &&
          !error &&
          leagues.length > 0 && (
            <section className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {leagues.map((league) => (
                <article
                  key={league.id}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                        Lega stagionale
                      </p>

                      <h2 className="mt-2 truncate text-xl font-bold">
                        {league.leagueName}
                      </h2>
                    </div>

                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                      {getModeLabel(league.mode)}
                    </span>
                  </div>


                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-slate-100 p-3">
                      <p className="text-xs text-slate-500">
                        Squadra
                      </p>

                      <p className="mt-1 font-bold">
                        {league.teamName}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-100 p-3">
                      <p className="text-xs text-slate-500">
                        Stagione
                      </p>

                      <p className="mt-1 font-bold">
                        {league.season}
                      </p>
                    </div>
                  </div>


                  <p className="mt-4 text-xs text-slate-500">
                    Ultimo aggiornamento:{" "}
                    {formatDate(league.updatedAt)}
                  </p>
                </article>
              ))}
            </section>
          )}
      </div>
    </main>
  );
}