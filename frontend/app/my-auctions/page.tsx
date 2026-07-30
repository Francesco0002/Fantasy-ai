"use client";

import Link from "next/link";

import {
  useRouter,
} from "next/navigation";

import {
  useEffect,
  useState,
} from "react";

import {
  useAuth,
} from "../../hooks/useAuth";

import {
  ApiRequestError,
  fetchAuctionSessions,
} from "../../lib/api";

import type {
  AuctionSessionSummaryApiResponse,
} from "../../lib/api";

import {
  AUCTION_SESSION_ID_KEY,
} from "../../lib/auction-storage";


/*
 * Converte la data del backend
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
 * Traduce lo stato tecnico
 * della sessione.
 */
function getStatusLabel(
  status: string,
): string {
  switch (status) {
    case "ACTIVE":
      return "Attiva";

    case "COMPLETED":
      return "Completata";

    case "CANCELLED":
      return "Annullata";

    default:
      return status;
  }
}


/*
 * Pagina contenente tutte le aste
 * dell'utente autenticato.
 */
export default function MyAuctionsPage() {
  const router = useRouter();

  const {
    user,
    isAuthReady,
  } = useAuth();

  const [
    sessions,
    setSessions,
  ] = useState<
    AuctionSessionSummaryApiResponse[]
  >([]);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  );


  /*
   * Recupera le aste soltanto dopo
   * aver verificato l'account.
   */
  useEffect(() => {
    if (!isAuthReady) {
      return;
    }

    if (!user) {
      setSessions([]);
      setIsLoading(false);
      setError(null);

      return;
    }

    let isEffectActive = true;

    const controller =
      new AbortController();

    async function loadSessions() {
      setIsLoading(true);
      setError(null);

      try {
        const response =
          await fetchAuctionSessions(
            controller.signal,
          );

        if (!isEffectActive) {
          return;
        }

        setSessions(
          response.sessions,
        );
      } catch (caughtError) {
        if (!isEffectActive) {
          return;
        }

        if (
          caughtError instanceof DOMException
          && caughtError.name === "AbortError"
        ) {
          return;
        }

        if (
          caughtError instanceof ApiRequestError
          && caughtError.status === 401
        ) {
          setError(
            "La sessione è scaduta. "
            + "Accedi nuovamente.",
          );

          return;
        }

        if (caughtError instanceof Error) {
          setError(
            caughtError.message,
          );

          return;
        }

        setError(
          "Impossibile recuperare "
          + "le sessioni d'asta.",
        );
      } finally {
        if (isEffectActive) {
          setIsLoading(false);
        }
      }
    }

    void loadSessions();

    return () => {
      isEffectActive = false;
      controller.abort();
    };
  }, [
    isAuthReady,
    user,
  ]);


  /*
   * Salva l'UUID della sessione scelta.
   *
   * La pagina /auction lo leggerà
   * e recupererà tutti i dati dal backend.
   */
  function handleResumeAuction(
    sessionId: string,
  ) {
    window.localStorage.setItem(
      AUCTION_SESSION_ID_KEY,
      sessionId,
    );

    router.push("/auction");
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
            Fantasy AI
          </p>

          <h1 className="mt-2 text-3xl font-bold md:text-4xl">
            Le mie aste
          </h1>

          <p className="mt-3 max-w-2xl text-slate-600">
            Riprendi una sessione salvata oppure
            torna alla home per iniziare una nuova asta.
          </p>
        </header>


        {!isAuthReady && (
          <section className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <p className="font-semibold text-slate-700">
              Verifica dell&apos;account...
            </p>
          </section>
        )}


        {isAuthReady && !user && (
          <section className="rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm">
            <h2 className="text-xl font-bold">
              Accesso richiesto
            </h2>

            <p className="mt-2 text-slate-600">
              Devi effettuare il login per vedere
              le tue sessioni d&apos;asta.
            </p>

            <Link
              href="/"
              className="mt-5 inline-flex rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800"
            >
              Torna alla pagina di accesso
            </Link>
          </section>
        )}


        {isAuthReady && user && isLoading && (
          <section className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <p className="font-semibold text-slate-700">
              Recupero delle sessioni...
            </p>
          </section>
        )}


        {isAuthReady &&
          user &&
          !isLoading &&
          error && (
            <section className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
              <p className="font-semibold">
                Impossibile caricare le aste
              </p>

              <p className="mt-2 text-sm">
                {error}
              </p>
            </section>
          )}


        {isAuthReady &&
          user &&
          !isLoading &&
          !error &&
          sessions.length === 0 && (
            <section className="rounded-2xl bg-white p-8 text-center shadow-sm">
              <h2 className="text-xl font-bold">
                Nessuna asta salvata
              </h2>

              <p className="mt-2 text-slate-600">
                Non hai ancora creato una sessione
                associata a questo account.
              </p>

              <Link
                href="/auction"
                className="mt-5 inline-flex rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800"
              >
                Crea una nuova asta
              </Link>
            </section>
          )}


        {isAuthReady &&
          user &&
          !isLoading &&
          !error &&
          sessions.length > 0 && (
            <section className="grid gap-5 md:grid-cols-2">
              {sessions.map(
                (auctionSession) => (
                  <article
                    key={auctionSession.id}
                    className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                          Sessione d&apos;asta
                        </p>

                        <h2 className="mt-2 truncate text-xl font-bold">
                          {auctionSession.leagueName}
                        </h2>
                      </div>

                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                        {getStatusLabel(
                          auctionSession.status,
                        )}
                      </span>
                    </div>


                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-slate-100 p-3">
                        <p className="text-xs text-slate-500">
                          Partecipanti
                        </p>

                        <p className="mt-1 text-lg font-bold">
                          {auctionSession.participants}
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-100 p-3">
                        <p className="text-xs text-slate-500">
                          Budget iniziale
                        </p>

                        <p className="mt-1 text-lg font-bold">
                          {auctionSession.startingBudget}
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-100 p-3">
                        <p className="text-xs text-slate-500">
                          Squadre
                        </p>

                        <p className="mt-1 text-lg font-bold">
                          {auctionSession.teamsCount}
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-100 p-3">
                        <p className="text-xs text-slate-500">
                          Acquisti
                        </p>

                        <p className="mt-1 text-lg font-bold">
                          {auctionSession.purchasesCount}
                        </p>
                      </div>
                    </div>


                    <p className="mt-4 text-xs text-slate-500">
                      Ultima modifica:{" "}
                      {formatDate(
                        auctionSession.updatedAt,
                      )}
                    </p>


                    <button
                      type="button"
                      onClick={() => {
                        handleResumeAuction(
                          auctionSession.id,
                        );
                      }}
                      className="mt-5 w-full rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800"
                    >
                      Riprendi asta
                    </button>
                  </article>
                ),
              )}
            </section>
          )}
      </div>
    </main>
  );
}