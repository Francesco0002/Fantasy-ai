"use client";

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
 * Proprietà ricevute dal pannello.
 */
type AuctionMarketProps = {
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
   * Seleziona un giocatore e propone
   * automaticamente un prezzo iniziale.
   */
  function selectPlayer(
    player: Player,
  ) {
    setSelectedPlayer(player);
    setFeedback(null);

    /*
     * Il prezzo proposto:
     * - non scende sotto l'offerta minima;
     * - non supera l'offerta massima possibile.
     */
    const suggestedPrice = Math.min(
      Math.max(
        player.recommended_price,
        config.minimumBid,
      ),
      maximumBid,
    );

    setPurchasePrice(
      String(suggestedPrice),
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

                ${
                  activeRole === role
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

                          ${
                            isSelected
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
                                ${
                                  ROLE_BADGE_CLASSES[
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
                            Prezzo{" "}
                            {
                              player.recommended_price
                            }
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
                      ${
                        ROLE_BADGE_CLASSES[
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

                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">
                      Prezzo consigliato
                    </dt>

                    <dd className="font-semibold">
                      {
                        selectedPlayer.recommended_price
                      }
                    </dd>
                  </div>

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
                className="
                  mt-4 w-full
                  rounded-xl
                  bg-emerald-700
                  px-5 py-3
                  text-sm font-semibold
                  text-white transition
                  hover:bg-emerald-800
                "
              >
                Registra acquisto
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

                ${
                  feedback.type ===
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