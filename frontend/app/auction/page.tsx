"use client";

import {
  AUCTION_MODE_NAMES,
} from "../../lib/auction-config";


/*
 * Pannelli laterali compatti:
 * - rosa personale a sinistra;
 * - acquisti avversari a destra.
 */
import AuctionSidePanels from "../../components/auction/AuctionSidePanels";


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

import {
  useRouter,
} from "next/navigation";

import {
  useEffect,
  useState,
} from "react";


/*
 * Custom hook che gestisce
 * lo stato completo della sessione d'asta.
 */
import { useAuctionSession } from "../../hooks/useAuctionSession";


/*
 * Modulo di configurazione iniziale.
 */
import AuctionSetupForm from "../../components/auction/AuctionSetupForm";


import AuthPanel from "../../components/auth/AuthPanel";

import ConfirmDialog from
  "../../components/ui/ConfirmDialog";

import {
  useAuth,
} from "../../hooks/useAuth";


/*
 * Pagina iniziale della modalità asta.
 */
export default function AuctionPage() {
  const router = useRouter();


  /*
   * Su telefono la pagina dell'asta deve
   * essere mostrata sempre dall'inizio.
   *
   * Ripetiamo il riposizionamento dopo il primo
   * rendering per evitare il ripristino automatico
   * dello scroll effettuato dal browser.
   */
  useEffect(() => {
    const isMobile = window.matchMedia(
      "(max-width: 767px)",
    ).matches;

    if (!isMobile) {
      return;
    }

    const previousScrollRestoration =
      window.history.scrollRestoration;

    window.history.scrollRestoration =
      "manual";

    function scrollToPageStart() {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: "auto",
      });
    }

    scrollToPageStart();

    const animationFrame =
      window.requestAnimationFrame(
        scrollToPageStart,
      );

    const delayedReset =
      window.setTimeout(
        scrollToPageStart,
        150,
      );

    return () => {
      window.cancelAnimationFrame(
        animationFrame,
      );

      window.clearTimeout(
        delayedReset,
      );

      window.history.scrollRestoration =
        previousScrollRestoration;
    };
  }, []);


  const [
    isCompletionDialogOpen,
    setIsCompletionDialogOpen,
  ] = useState(false);

  const [
    isChangingStatus,
    setIsChangingStatus,
  ] = useState(false);

  const {
    user,
    isAuthReady,
  } = useAuth();


  /*
  * Stato e dati calcolati
  * della sessione d'asta.
  */
  const {
    session,
    contextualPrices,
    isStorageReady,
    actionError,
    myPurchases,
    opponentPurchases,
    remainingSlots,
    dynamicRoleBudgets,
    maximumBid,
    startAuction,
    setAuctionStatus,
    registerPurchase,
    removePurchase,
  } = useAuctionSession();

  /*
   * Manteniamo questo nome per rendere
   * più leggibile il JSX già presente.
   */
  const startedConfig =
    session?.config ?? null;

  const isActiveAuction =
    session?.status === "ACTIVE";

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
   * Conclude l'asta conservando tutti i dati.
   */
  async function handleCompleteAuction() {
    setIsChangingStatus(true);

    const wasCompleted =
      await setAuctionStatus(
        "COMPLETED",
      );

    setIsChangingStatus(false);

    if (!wasCompleted) {
      return;
    }

    setIsCompletionDialogOpen(false);
    router.push("/my-auctions");
  }


  /*
   * Permette di correggere o continuare
   * una sessione precedentemente conclusa.
   */
  async function handleReopenAuction() {
    setIsChangingStatus(true);

    await setAuctionStatus("ACTIVE");

    setIsChangingStatus(false);
  }


  return (
    <main className="auction-page-enter min-h-screen bg-slate-100 py-6 text-slate-900">
      <ConfirmDialog
        isOpen={isCompletionDialogOpen}
        title="Concludi asta"
        description="La sessione verrà segnata come completata. Configurazione, budget e acquisti resteranno salvati e potrai consultarli o riaprire l'asta in seguito."
        confirmLabel="Concludi asta"
        isConfirming={isChangingStatus}
        onCancel={() => {
          setIsCompletionDialogOpen(false);
        }}
        onConfirm={() => {
          void handleCompleteAuction();
        }}
      />

      <div
        className="
          mx-auto w-full
          max-w-[1600px]
          px-4
          md:px-16
          lg:px-20
          xl:px-24
        "
      >

        {/* Navigazione */}
        <Link
          href="/"
          className="text-sm font-semibold text-emerald-700 transition hover:text-emerald-900"
        >
          ← Torna ai giocatori
        </Link>


        {/* Intestazione */}
        <header className="mt-4 mb-5">
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


        {/* Controllo iniziale dell'account */}
        {!isAuthReady && (
          <section className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <p className="font-semibold text-slate-700">
              Verifica dell&apos;account...
            </p>
          </section>
        )}


        {/* Accesso richiesto */}
        {isAuthReady && !user && (
          <div className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
            <div className="text-center">
              <h2 className="text-2xl font-bold">
                Accedi per usare la modalità asta
              </h2>

              <p className="mx-auto mt-2 max-w-xl text-slate-600">
                Le sessioni vengono associate al tuo
                account per proteggerle e permetterti
                di riprenderle in seguito.
              </p>
            </div>

            <div className="mx-auto max-w-xl">
              <AuthPanel />
            </div>
          </div>
        )}

        {/*
        * Breve caricamento mentre controlliamo
        * se esiste una sessione salvata.
        */}
        {isAuthReady &&
          user &&
          !isStorageReady && (
            <section className="rounded-2xl bg-white p-10 text-center shadow-sm">
              <p className="font-semibold text-slate-700">
                Recupero della sessione d&apos;asta...
              </p>
            </section>
          )}

        {isAuthReady &&
          user &&
          actionError && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
              {actionError}
            </div>
          )}

        {/*
         * Prima dell'avvio mostriamo
         * il modulo di configurazione.
         */}
        {isAuthReady &&
          user &&
          isStorageReady &&
          !startedConfig && (
            <AuctionSetupForm
              onStart={startAuction}
            />
          )}


        {/*
         * Dopo la conferma mostriamo
         * un riepilogo della configurazione.
         */}
        {isAuthReady &&
          user &&
          isStorageReady &&
          startedConfig && (
            <div className="space-y-6">

              <AuctionSidePanels
                config={startedConfig}
                purchases={
                  session?.purchases ?? []
                }
                remainingBudget={
                  session?.remainingBudget ?? 0
                }
                remainingSlots={
                  remainingSlots
                }
                dynamicRoleBudgets={
                  dynamicRoleBudgets
                }
                onRemovePurchase={(playerId) => {
                  void removePurchase(playerId);
                }}
                isReadOnly={!isActiveAuction}
              />

              {/* Riepilogo compatto della sessione */}
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  {/* Informazioni sulla lega */}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                        {isActiveAuction
                          ? "Asta attiva"
                          : "Asta completata"}
                      </p>

                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                        {
                          AUCTION_MODE_NAMES[
                          startedConfig.auctionMode ??
                          "ROLE_BY_ROLE"
                          ]
                        }
                      </span>
                    </div>

                    <h2 className="mt-2 truncate text-xl font-bold">
                      {startedConfig.leagueName}
                    </h2>

                    <p className="mt-1 text-xs text-slate-500">
                      {startedConfig.participants} partecipanti ·{" "}
                      {startedConfig.startingBudget} crediti iniziali
                    </p>
                  </div>


                  {/* Dati principali */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[660px]">
                    <div className="rounded-xl bg-emerald-700 px-4 py-3 text-white">
                      <p className="text-xs text-emerald-100">
                        Budget residuo
                      </p>

                      <p className="mt-1 text-2xl font-bold">
                        {session?.remainingBudget ?? 0}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-100 px-4 py-3">
                      <p className="text-xs text-slate-500">
                        Crediti spesi
                      </p>

                      <p className="mt-1 text-2xl font-bold">
                        {totalSpent}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-100 px-4 py-3">
                      <p className="text-xs text-slate-500">
                        La mia rosa
                      </p>

                      <p className="mt-1 text-2xl font-bold">
                        {myPurchases.length}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {opponentPurchases.length} avversari
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-100 px-4 py-3">
                      <p className="text-xs text-slate-500">
                        Slot liberi
                      </p>

                      <p className="mt-1 text-2xl font-bold">
                        {totalRemainingSlots}
                      </p>
                    </div>
                  </div>
                </div>
              </section>


              {/* Ricerca e registrazione degli acquisti */}
              {isActiveAuction && (
                <AuctionMarket
                  config={startedConfig}
                  contextualPrices={contextualPrices}
                  remainingBudget={
                    session?.remainingBudget ?? 0
                  }
                  remainingSlots={remainingSlots}
                  dynamicRoleBudgets={
                    dynamicRoleBudgets
                  }

                  purchases={
                    session?.purchases ?? []
                  }

                  myPurchases={myPurchases}

                  maximumBid={maximumBid}
                  onRegisterPurchase={
                    registerPurchase
                  }
                />
              )}

              {!isActiveAuction && (
                <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
                  <h2 className="text-xl font-bold text-emerald-950">
                    Asta completata
                  </h2>

                  <p className="mt-2 text-sm text-emerald-900/80">
                    I dati sono in sola lettura. Puoi consultare rose, acquisti e regole oppure riaprire la sessione.
                  </p>
                </section>
              )}

              {/* Barra finale compatta */}
              <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-emerald-800">
                    {isActiveAuction
                      ? "Sessione salvata nel database"
                      : "Sessione completata e salvata"}
                  </p>

                  <p className="mt-0.5 text-xs text-slate-500">
                    Configurazione, squadre e acquisti sono conservati su PostgreSQL.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (isActiveAuction) {
                      setIsCompletionDialogOpen(true);
                      return;
                    }

                    void handleReopenAuction();
                  }}
                  disabled={isChangingStatus}
                  className="
                    shrink-0 rounded-xl border
                    border-slate-300 bg-white
                    px-4 py-2 text-sm
                    font-semibold transition
                    hover:bg-slate-100
                    disabled:cursor-not-allowed
                    disabled:opacity-60
                  "
                >
                  {isChangingStatus
                    ? "Aggiornamento..."
                    : isActiveAuction
                      ? "Concludi asta"
                      : "Riapri asta"}
                </button>
              </section>
            </div>
          )}
      </div>
    </main>
  );
}
