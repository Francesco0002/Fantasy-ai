"use client";

/*
 * Calcola la quotazione aggiornata
 * dei giocatori durante l'asta.
 */
import {
  calculateDynamicPlayerValuation,
} from "../../lib/auction-valuation";


/*
 * Pannello con i migliori giocatori
 * compatibili con il budget corrente.
 */
import AuctionSuggestions from "./AuctionSuggestions";


/*
 * Hook React utilizzati per gestire:
 * - ruolo selezionato;
 * - ricerca;
 * - giocatore scelto;
 * - prezzo d'acquisto;
 * - messaggi di conferma o errore.
 */
import {
  useMemo,
  useState,
} from "react";

/*
 * Recupera i giocatori dal backend.
 */
import { usePlayers } from "../../hooks/usePlayers";

/*
 * Costanti condivise della modalità asta.
 */
import {
  AUCTION_ROLES,
  AUCTION_ROLE_NAMES,
} from "../../lib/auction-config";

/*
 * Configurazioni grafiche associate ai ruoli.
 */
import {
  ROLE_BADGE_CLASSES,
} from "../../lib/player-utils";

/*
 * Tipi della modalità asta.
 */
import type {
  AuctionConfig,
  AuctionPurchase,
  AuctionRole,
} from "../../types/auction";

/*
 * Tipo completo di un giocatore.
 */
import type {
  Player,
} from "../../types/player";


/*
 * Logica dell'assistente strategico
 * per valutare il prezzo inserito.
 */
import {
  AUCTION_ADVICE_CLASSES,
  createAuctionAdvice,
} from "../../lib/auction-advisor";


/*
 * Proprietà ricevute dal pannello.
 */
type AuctionMarketProps = {
  /*
  * Budget aggiornato disponibile
  * per ogni ruolo.
  */
  dynamicRoleBudgets: Record<
    AuctionRole,
    number
  >;

  config: AuctionConfig;

  remainingBudget: number;

  remainingSlots: Record<
    AuctionRole,
    number
  >;

  purchases: AuctionPurchase[];

  maximumBid: number;

  /*
   * Registra l'acquisto.
   *
   * Restituisce null quando è valido
   * oppure un messaggio di errore.
   */
  onRegisterPurchase: (
    purchase: AuctionPurchase,
  ) => string | null;
};


/*
 * Messaggio mostrato dopo
 * un tentativo di acquisto.
 */
type Feedback = {
  type: "success" | "error";
  message: string;
};


/*
 * Trasforma una probabilità da 0-1
 * in una percentuale.
 */
function formatPercentage(
  value: number,
): string {
  const percentage = Math.min(
    Math.max(value * 100, 0),
    100,
  );

  return `${Math.round(percentage)}%`;
}


/*
 * Pannello utilizzato per cercare
 * e acquistare giocatori.
 */
export default function AuctionMarket({
  config,
  remainingBudget,
  remainingSlots,
  dynamicRoleBudgets,
  purchases,
  maximumBid,
  onRegisterPurchase,
}: AuctionMarketProps) {
  /*
   * Ruolo attualmente visualizzato.
   */
  const [activeRole, setActiveRole] =
    useState<AuctionRole>("P");

  /*
   * Testo di ricerca.
   */
  const [search, setSearch] =
    useState("");

  /*
   * Giocatore selezionato dalla lista.
   */
  const [
    selectedPlayer,
    setSelectedPlayer,
  ] = useState<Player | null>(null);

  /*
   * Prezzo inserito dall'utente.
   *
   * Usiamo una stringa per permettere
   * anche un campo temporaneamente vuoto.
   */
  const [purchasePrice, setPurchasePrice] =
    useState("");

  /*
   * Messaggio di conferma o errore.
   */
  const [feedback, setFeedback] =
    useState<Feedback | null>(null);


  /*
   * Recuperiamo i giocatori appartenenti
   * al ruolo attualmente selezionato.
   */
  const {
    players,
    isLoading,
    error,
  } = usePlayers(
    activeRole,
    search,
  );


  /*
   * Identificativi dei giocatori
   * già acquistati.
   */
  const purchasedPlayerIds =
    useMemo(() => {
      return new Set(
        purchases.map(
          (purchase) =>
            purchase.playerId,
        ),
      );
    }, [purchases]);


  /*
   * Escludiamo i giocatori acquistati
   * e ordiniamo gli altri per punteggio.
   */
  const availablePlayers =
    useMemo(() => {
      return [...players]
        .filter(
          (player) =>
            !purchasedPlayerIds.has(
              player.player_id,
            ),
        )
        .sort(
          (
            firstPlayer,
            secondPlayer,
          ) =>
            secondPlayer.overall_score -
            firstPlayer.overall_score,
        );
    }, [players, purchasedPlayerIds]);


  /*
  * Quotazione dinamica del giocatore
  * attualmente selezionato.
  *
  * Viene aggiornata dopo ogni acquisto,
  * annullamento e ridistribuzione del budget.
  */
  const selectedValuation = useMemo(() => {
    if (!selectedPlayer) {
      return null;
    }

    return calculateDynamicPlayerValuation({
      player: selectedPlayer,
      config,
      purchases,
      remainingBudget,
      remainingSlots,
      dynamicRoleBudgets,
      maximumBid,
    });
  }, [
    selectedPlayer,
    config,
    purchases,
    remainingBudget,
    remainingSlots,
    dynamicRoleBudgets,
    maximumBid,
  ]);



  /*
  * Consiglio strategico calcolato
  * utilizzando le quotazioni dinamiche.
  */
  const auctionAdvice = useMemo(() => {
    if (
      !selectedPlayer ||
      !selectedValuation ||
      purchasePrice.trim() === ""
    ) {
      return null;
    }

    /*
     * Creiamo una copia del giocatore
     * sostituendo le quotazioni originali
     * con quelle aggiornate.
     */
    const dynamicallyValuedPlayer: Player = {
      ...selectedPlayer,

      recommended_min:
        selectedValuation
          .dynamicRecommendedMin,

      recommended_price:
        selectedValuation
          .dynamicRecommendedPrice,

      recommended_max:
        selectedValuation
          .dynamicRecommendedMax,

      absolute_max:
        selectedValuation
          .dynamicAbsoluteMax,
    };

    return createAuctionAdvice({
      player: dynamicallyValuedPlayer,
      bid: Number(purchasePrice),
      config,
      remainingBudget,
      remainingSlots,
      purchases,

      /*
       * Il vincolo tecnico complessivo
       * rimane maximumBid.
       *
       * Questo permette di superare il piano
       * di un ruolo, ridistribuendo poi
       * il budget degli altri ruoli.
       */
      maximumBid,
    });
  }, [
    selectedPlayer,
    selectedValuation,
    purchasePrice,
    config,
    remainingBudget,
    remainingSlots,
    purchases,
    maximumBid,
  ]);


  /*
   * Seleziona un giocatore e propone
   * automaticamente un prezzo iniziale.
   */
  function selectPlayer(
    player: Player,
  ) {
    setSelectedPlayer(player);
    setFeedback(null);

    /*
     * Calcoliamo la quotazione aggiornata
     * nel momento in cui il giocatore
     * viene selezionato.
     */
    const valuation =
      calculateDynamicPlayerValuation({
        player,
        config,
        purchases,
        remainingBudget,
        remainingSlots,
        dynamicRoleBudgets,
        maximumBid,
      });

    /*
     * Inseriamo automaticamente
     * il prezzo dinamico suggerito.
     */
    setPurchasePrice(
      String(
        Math.max(
          valuation.suggestedBid,
          config.minimumBid,
        ),
      ),
    );
  }


  /*
   * Cambia il ruolo visualizzato.
   */
  function changeRole(
    role: AuctionRole,
  ) {
    setActiveRole(role);
    setSearch("");
    setSelectedPlayer(null);
    setPurchasePrice("");
    setFeedback(null);
  }


  /*
   * Registra l'acquisto del giocatore.
   */
  function handlePurchase(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!selectedPlayer) {
      setFeedback({
        type: "error",
        message:
          "Seleziona prima un giocatore.",
      });

      return;
    }

    const parsedPrice =
      Number(purchasePrice);

    /*
    * Per un acquisto classificato come
    * "Da evitare" chiediamo una conferma aggiuntiva.
    */
    if (
      auctionAdvice?.label ===
      "Da evitare"
    ) {
      const confirmed = window.confirm(
        `Fantasy AI considera eccessivo il prezzo di ${parsedPrice} crediti per ${selectedPlayer.name}. Vuoi registrare comunque l'acquisto?`,
      );

      if (!confirmed) {
        return;
      }
    }

    /*
     * Prepariamo l'acquisto da passare
     * allo stato della sessione.
     */
    const purchase: AuctionPurchase = {
      playerId:
        selectedPlayer.player_id,

      playerName:
        selectedPlayer.name,

      team:
        selectedPlayer.team,

      role:
        selectedPlayer.role,

      purchasePrice:
        parsedPrice,

      /*
       * Quotazione originale del dataset.
       */
      baseRecommendedPriceAtPurchase:
        selectedPlayer.recommended_price,

      /*
       * Quotazione aggiornata nel momento
       * esatto in cui viene registrato l'acquisto.
       */
      dynamicRecommendedPriceAtPurchase:
        selectedValuation
          ?.dynamicRecommendedPrice ??
        selectedPlayer.recommended_price,

      purchasedAt:
        new Date().toISOString(),
    };

    const purchaseError =
      onRegisterPurchase(purchase);

    if (purchaseError) {
      setFeedback({
        type: "error",
        message: purchaseError,
      });

      return;
    }

    /*
     * Salviamo il nome prima di eliminare
     * il giocatore selezionato.
     */
    const purchasedPlayerName =
      selectedPlayer.name;

    setFeedback({
      type: "success",
      message: `${purchasedPlayerName} acquistato per ${parsedPrice} crediti.`,
    });

    setSelectedPlayer(null);
    setPurchasePrice("");
  }


  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      {/* Intestazione */}
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">
          Mercato
        </p>

        <h2 className="mt-1 text-2xl font-bold">
          Registra un acquisto
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          Cerca il giocatore, selezionalo e inserisci il prezzo finale dell&apos;asta.
        </p>
      </div>


      {/* Selezione del ruolo */}
      <div className="mt-6 grid grid-cols-4 gap-2">
        {AUCTION_ROLES.map((role) => {
          const hasAvailableSlots =
            remainingSlots[role] > 0;

          return (
            <button
              key={role}
              type="button"
              disabled={
                !hasAvailableSlots
              }
              onClick={() => {
                changeRole(role);
              }}
              className={`
                rounded-xl px-3 py-3
                text-sm font-semibold
                transition

                ${activeRole === role
                  ? "bg-slate-900 text-white"
                  : hasAvailableSlots
                    ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    : "cursor-not-allowed bg-slate-100 text-slate-400"
                }
              `}
            >
              {role}

              <span className="ml-1 text-xs">
                ({remainingSlots[role]})
              </span>
            </button>
          );
        })}
      </div>

      {/* Suggerimenti strategici per il ruolo selezionato */}
      <AuctionSuggestions
        players={availablePlayers}
        role={activeRole}
        config={config}
        purchases={purchases}
        maximumBid={maximumBid}
        remainingBudget={
          remainingBudget
        }
        remainingSlots={
          remainingSlots
        }
        dynamicRoleBudgets={
          dynamicRoleBudgets
        }
        onSelectPlayer={
          selectPlayer
        }
      />

      {/*
       * Layout:
       * - lista giocatori a sinistra;
       * - riepilogo acquisto a destra.
       */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">

        {/* Ricerca e lista */}
        <div>
          <label
            htmlFor="auction-player-search"
            className="mb-2 block text-sm font-semibold"
          >
            Cerca tra i{" "}
            {AUCTION_ROLE_NAMES[
              activeRole
            ].toLowerCase()}
          </label>

          <input
            id="auction-player-search"
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(
                event.target.value,
              );
            }}
            placeholder="Cerca per nome o squadra..."
            className="
              w-full rounded-xl border
              border-slate-300 px-4 py-3
              outline-none transition
              focus:border-emerald-600
              focus:ring-2
              focus:ring-emerald-100
            "
          />


          {/* Caricamento */}
          {isLoading && (
            <div className="mt-4 rounded-xl bg-slate-100 p-6 text-center text-sm text-slate-600">
              Caricamento dei giocatori...
            </div>
          )}


          {/* Errore backend */}
          {!isLoading && error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
              {error}
            </div>
          )}


          {/* Nessun risultato */}
          {!isLoading &&
            !error &&
            availablePlayers.length ===
            0 && (
              <div className="mt-4 rounded-xl bg-slate-100 p-6 text-center text-sm text-slate-600">
                Nessun giocatore disponibile.
              </div>
            )}


          {/* Lista dei giocatori */}
          {!isLoading &&
            !error &&
            availablePlayers.length >
            0 && (
              <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-1">
                {availablePlayers.map(
                  (player) => {
                    const playerValuation =
                      calculateDynamicPlayerValuation({
                        player,
                        config,
                        purchases,
                        remainingBudget,
                        remainingSlots,
                        dynamicRoleBudgets,
                        maximumBid,
                      });

                    const isSelected =
                      selectedPlayer?.player_id ===
                      player.player_id;

                    return (
                      <button
                        key={
                          player.player_id
                        }
                        type="button"
                        onClick={() => {
                          selectPlayer(
                            player,
                          );
                        }}
                        className={`
                          flex w-full
                          items-center
                          justify-between
                          gap-4 rounded-xl
                          border p-4
                          text-left transition

                          ${isSelected
                            ? "border-emerald-500 bg-emerald-50"
                            : "border-slate-200 hover:border-emerald-300 hover:bg-slate-50"
                          }
                        `}
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-bold">
                              {player.name}
                            </p>

                            <span
                              className={`
                                rounded-full
                                px-2 py-0.5
                                text-xs font-bold
                                ${ROLE_BADGE_CLASSES[
                                player.role
                                ]
                                }
                              `}
                            >
                              {player.role}
                            </span>
                          </div>

                          <p className="mt-1 text-sm text-slate-500">
                            {player.team}
                          </p>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="font-bold">
                            {player.overall_score.toFixed(
                              2,
                            )}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            Quotazione{" "}
                            <strong className="text-slate-700">
                              {
                                playerValuation
                                  .dynamicRecommendedPrice
                              }
                            </strong>

                            {playerValuation
                              .dynamicRecommendedPrice !==
                              player.recommended_price && (
                                <span className="ml-1 text-slate-400">
                                  ({player.recommended_price} iniziale)
                                </span>
                              )}
                          </p>
                        </div>
                      </button>
                    );
                  },
                )}
              </div>
            )}
        </div>


        {/* Pannello acquisto */}
        <aside className="h-fit rounded-2xl bg-slate-100 p-5 lg:sticky lg:top-5">
          <h3 className="text-lg font-bold">
            Riepilogo acquisto
          </h3>

          {!selectedPlayer && (
            <div className="mt-4 rounded-xl bg-white p-5 text-sm text-slate-500">
              Seleziona un giocatore dalla lista.
            </div>
          )}


          {selectedPlayer && (
            <form
              onSubmit={handlePurchase}
              className="mt-4"
            >
              {/* Giocatore selezionato */}
              <div className="rounded-xl bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">
                      {selectedPlayer.name}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {
                        selectedPlayer.team
                      }
                    </p>
                  </div>

                  <span
                    className={`
                      rounded-full
                      px-2 py-1
                      text-xs font-bold
                      ${ROLE_BADGE_CLASSES[
                      selectedPlayer.role
                      ]
                      }
                    `}
                  >
                    {selectedPlayer.role}
                  </span>
                </div>

                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">
                      Punteggio AI
                    </dt>

                    <dd className="font-semibold">
                      {selectedPlayer.overall_score.toFixed(
                        2,
                      )}
                    </dd>
                  </div>

                  {/* Quotazione originale */}
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">
                      Quotazione iniziale
                    </dt>

                    <dd className="font-semibold text-slate-500">
                      {selectedPlayer.recommended_price}
                    </dd>
                  </div>


                  {/* Quotazione aggiornata */}
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">
                      Quotazione dinamica
                    </dt>

                    <dd className="font-bold text-emerald-700">
                      {selectedValuation
                        ?.dynamicRecommendedPrice ??
                        selectedPlayer.recommended_price}
                    </dd>
                  </div>


                  {/* Andamento della quotazione */}
                  {selectedValuation && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">
                        Andamento
                      </dt>

                      <dd
                        className={`
                          font-semibold

                          ${selectedValuation.marketTrend ===
                            "In rialzo"
                            ? "text-red-700"
                            : selectedValuation.marketTrend ===
                              "In ribasso"
                              ? "text-emerald-700"
                              : "text-slate-700"
                          }
                        `}
                      >
                        {selectedValuation.marketTrend}
                      </dd>
                    </div>
                  )}


                  {/* Tetto prudente */}
                  {selectedValuation && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">
                        Tetto prudente
                      </dt>

                      <dd className="font-semibold">
                        {selectedValuation.personalMaximumBid}
                      </dd>
                    </div>
                  )}

                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">
                      Titolarità
                    </dt>

                    <dd className="font-semibold">
                      {formatPercentage(
                        selectedPlayer.starting_probability,
                      )}
                    </dd>
                  </div>
                </dl>
              </div>


              {/* Prezzo pagato */}
              <div className="mt-4">
                <label
                  htmlFor="purchase-price"
                  className="mb-2 block text-sm font-semibold"
                >
                  Prezzo pagato
                </label>

                <input
                  id="purchase-price"
                  type="number"
                  min={
                    config.minimumBid
                  }
                  max={maximumBid}
                  step="1"
                  value={purchasePrice}
                  onChange={(event) => {
                    setPurchasePrice(
                      event.target.value,
                    );
                  }}
                  className="
                    w-full rounded-xl
                    border border-slate-300
                    bg-white px-4 py-3
                    text-xl font-bold
                    outline-none transition
                    focus:border-emerald-600
                    focus:ring-2
                    focus:ring-emerald-100
                  "
                />
              </div>

              {/* Assistente strategico */}
              {auctionAdvice && (
                <section
                  className={`
      mt-4 rounded-xl border p-4
      ${AUCTION_ADVICE_CLASSES[
                    auctionAdvice.tone
                    ]
                    }
    `}
                >
                  {/* Valutazione principale */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider opacity-70">
                        Valutazione Fantasy AI
                      </p>

                      <p className="mt-1 text-xl font-bold">
                        {auctionAdvice.label}
                      </p>

                      <p className="mt-1 text-sm opacity-80">
                        {auctionAdvice.description}
                      </p>
                    </div>

                    <span className="w-fit rounded-full bg-white/70 px-3 py-1 text-sm font-bold">
                      {auctionAdvice.differenceFromRecommended ===
                        0
                        ? "Prezzo consigliato"
                        : auctionAdvice.differenceFromRecommended <
                          0
                          ? `${Math.abs(
                            auctionAdvice.differenceFromRecommended,
                          )} crediti sotto`
                          : `${auctionAdvice.differenceFromRecommended} crediti sopra`}
                    </span>
                  </div>


                  {/* Dati principali del consiglio */}
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-white/70 p-3">
                      <p className="text-xs opacity-70">
                        Quotazione dinamica
                      </p>

                      <p className="mt-1 font-bold">
                        {selectedValuation
                          ?.dynamicRecommendedPrice ??
                          selectedPlayer.recommended_price}
                      </p>
                    </div>

                    <div className="rounded-lg bg-white/70 p-3">
                      <p className="text-xs opacity-70">
                        Tetto strategico
                      </p>

                      <p className="mt-1 font-bold">
                        {
                          auctionAdvice.strategicMaximumBid
                        }
                      </p>
                    </div>

                    <div className="rounded-lg bg-white/70 p-3">
                      <p className="text-xs opacity-70">
                        Budget dopo l&apos;acquisto
                      </p>

                      <p className="mt-1 font-bold">
                        {
                          auctionAdvice.remainingBudgetAfterPurchase
                        }
                      </p>
                    </div>

                    <div className="rounded-lg bg-white/70 p-3">
                      <p className="text-xs opacity-70">
                        Crediti da conservare
                      </p>

                      <p className="mt-1 font-bold">
                        {
                          auctionAdvice.minimumCreditsToReserve
                        }
                      </p>
                    </div>
                  </div>


                  {/* Situazione del budget per il ruolo */}
                  <div className="mt-3 rounded-lg bg-white/70 p-3 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="opacity-70">
                        Budget previsto ruolo
                      </span>

                      <strong>
                        {auctionAdvice.plannedRoleBudget}
                      </strong>
                    </div>

                    <div className="mt-2 flex justify-between gap-3">
                      <span className="opacity-70">
                        Spesa dopo l&apos;acquisto
                      </span>

                      <strong>
                        {auctionAdvice.spentInRoleAfter}
                      </strong>
                    </div>

                    <div className="mt-2 flex justify-between gap-3">
                      <span className="opacity-70">
                        Situazione del piano
                      </span>

                      <strong>
                        {auctionAdvice.roleBudgetDifference >=
                          0
                          ? `${auctionAdvice.roleBudgetDifference} crediti disponibili`
                          : `${Math.abs(
                            auctionAdvice.roleBudgetDifference,
                          )} crediti oltre il piano`}
                      </strong>
                    </div>
                  </div>


                  {/* Avvisi */}
                  {auctionAdvice.warnings.length >
                    0 && (
                      <div className="mt-3 rounded-lg bg-white/70 p-3 text-sm">
                        <p className="font-semibold">
                          Attenzione
                        </p>

                        <div className="mt-2 space-y-1">
                          {auctionAdvice.warnings.map(
                            (warning) => (
                              <p key={warning}>
                                • {warning}
                              </p>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                </section>
              )}

              {/* Informazioni sul budget */}
              <div className="mt-4 rounded-xl bg-white p-4 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">
                    Budget residuo
                  </span>

                  <strong>
                    {remainingBudget}
                  </strong>
                </div>

                <div className="mt-2 flex justify-between gap-3">
                  <span className="text-slate-500">
                    Offerta massima
                  </span>

                  <strong>
                    {maximumBid}
                  </strong>
                </div>

                <div className="mt-2 flex justify-between gap-3">
                  <span className="text-slate-500">
                    Slot ruolo
                  </span>

                  <strong>
                    {
                      remainingSlots[
                      selectedPlayer.role
                      ]
                    }
                  </strong>
                </div>
              </div>


              {/* Conferma acquisto */}
              <button
                type="submit"
                disabled={
                  !auctionAdvice?.isPurchaseValid
                }
                className={`
                  mt-4 w-full rounded-xl
                  px-5 py-3 text-sm
                  font-semibold transition

                  ${auctionAdvice?.isPurchaseValid
                    ? "bg-emerald-700 text-white hover:bg-emerald-800"
                    : "cursor-not-allowed bg-slate-300 text-slate-500"
                  }
                `}
              >
                {auctionAdvice?.label ===
                  "Da evitare"
                  ? "Registra comunque"
                  : "Registra acquisto"}
              </button>
            </form>
          )}


          {/* Messaggio finale */}
          {feedback && (
            <div
              className={`
                mt-4 rounded-xl
                border p-4 text-sm
                font-semibold

                ${feedback.type ===
                  "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-red-200 bg-red-50 text-red-800"
                }
              `}
            >
              {feedback.message}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}