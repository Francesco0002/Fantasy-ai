"use client";


import CustomSelect from
  "../ui/CustomSelect";


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
  AuctionPurchaseOwner,
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

  /*
  * Solamente gli acquisti dell'utente.
  *
  * Sono usati per i consigli personali
  * e per il calcolo della spesa.
  */
  myPurchases: AuctionPurchase[];

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
 * Colori dei pulsanti utilizzati
 * per selezionare il ruolo.
 *
 * Ogni ruolo mantiene i colori
 * già utilizzati nel resto dell'applicazione.
 */
const AUCTION_ROLE_BUTTON_CLASSES: Record<
  AuctionRole,
  {
    active: string;
    inactive: string;
  }
> = {
  /*
   * Portieri: giallo/ambra.
   */
  P: {
    active:
      "border-amber-500 bg-amber-500 text-slate-950 ring-2 ring-amber-200",

    inactive:
      "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
  },

  /*
   * Difensori: verde.
   */
  D: {
    active:
      "border-emerald-600 bg-emerald-600 text-white ring-2 ring-emerald-200",

    inactive:
      "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
  },

  /*
   * Centrocampisti: blu.
   */
  C: {
    active:
      "border-blue-600 bg-blue-600 text-white ring-2 ring-blue-200",

    inactive:
      "border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100",
  },

  /*
   * Attaccanti: rosso.
   */
  A: {
    active:
      "border-red-600 bg-red-600 text-white ring-2 ring-red-200",

    inactive:
      "border-red-200 bg-red-50 text-red-800 hover:bg-red-100",
  },
};


/*
 * Testi grammaticalmente corretti
 * mostrati sopra la ricerca.
 */
const AUCTION_ROLE_SEARCH_LABELS: Record<
  AuctionRole,
  string
> = {
  P: "i portieri",
  D: "i difensori",
  C: "i centrocampisti",
  A: "gli attaccanti",
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
  myPurchases,
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
  * Indica chi ha acquistato
  * il giocatore selezionato.
  */
  const [
    purchaseOwner,
    setPurchaseOwner,
  ] = useState<AuctionPurchaseOwner>(
    "ME",
  );


  /*
   * Nome della squadra avversaria.
   */
  const [
    opponentName,
    setOpponentName,
  ] = useState("");


  /*
   * Messaggio di conferma o errore.
   */
  const [feedback, setFeedback] =
    useState<Feedback | null>(null);


  /*
  * Nomi delle squadre configurati
  * prima dell'inizio dell'asta.
  */
  const configuredOpponentTeamNames =
    useMemo(() => {
      return (
        config.opponentTeamNames ??
        []
      )
        .map(
          (teamName) =>
            teamName.trim(),
        )
        .filter(
          (teamName) =>
            teamName !== "",
        );
    }, [
      config.opponentTeamNames,
    ]);


  /*
   * Indica se durante l'asta deve
   * essere mostrato il menu a tendina.
   */
  const hasConfiguredOpponentTeams =
    configuredOpponentTeamNames.length >
    0;


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
      purchaseOwner !== "ME" ||
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
      /*
      * Il consiglio personale deve considerare
      * soltanto la nostra spesa.
      */
      purchases: myPurchases,

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
    purchaseOwner,
    selectedPlayer,
    selectedValuation,
    purchasePrice,
    config,
    remainingBudget,
    remainingSlots,
    myPurchases,
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
     * Calcoliamo la valutazione del giocatore
     * nel momento in cui viene selezionato.
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
     * Per un acquisto personale proponiamo
     * il prezzo suggerito in base al budget.
     *
     * Per un acquisto avversario proponiamo
     * la quotazione dinamica di mercato.
     */
    const proposedPrice =
      purchaseOwner === "ME"
        ? valuation.suggestedBid
        : valuation.dynamicRecommendedPrice;

    setPurchasePrice(
      String(
        Math.max(
          proposedPrice,
          config.minimumBid,
        ),
      ),
    );
  }


  /*
 * Cambia il destinatario dell'acquisto.
 */
  function changePurchaseOwner(
    owner: AuctionPurchaseOwner,
  ) {
    setPurchaseOwner(owner);
    setFeedback(null);

    /*
     * Se esiste già un giocatore selezionato,
     * aggiorniamo anche il prezzo proposto.
     */
    if (!selectedValuation) {
      return;
    }

    const proposedPrice =
      owner === "ME"
        ? selectedValuation.suggestedBid
        : selectedValuation
          .dynamicRecommendedPrice;

    setPurchasePrice(
      String(
        Math.max(
          proposedPrice,
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
      purchaseOwner === "ME" &&
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

      ownerType:
        purchaseOwner,

      ownerName:
        purchaseOwner === "OPPONENT"
          ? opponentName.trim()
          : undefined,

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

    /*
     * Prepariamo un messaggio diverso
     * in base a chi ha acquistato il giocatore.
     */
    const destination =
      purchaseOwner === "ME"
        ? "nella tua rosa"
        : `da ${opponentName.trim() ||
        "un avversario"
        }`;

    setFeedback({
      type: "success",

      message:
        `${purchasedPlayerName} acquistato ${destination} per ${parsedPrice} crediti.`,
    });

    setSelectedPlayer(null);
    setPurchasePrice("");
  }


  /*
  * Validazione acquisto avversario.
  */
  const numericPurchasePrice =
    Number(purchasePrice);

  /*
  * Un acquisto avversario è valido quando:
  * - è stato selezionato un giocatore;
  * - è stato indicato il nome della squadra;
  * - il prezzo è un intero valido;
  * - il prezzo rispetta l'offerta minima.
  */
  const isOpponentPurchaseValid =
    purchaseOwner === "OPPONENT" &&
    selectedPlayer !== null &&
    opponentName.trim() !== "" &&
    purchasePrice.trim() !== "" &&
    Number.isFinite(
      numericPurchasePrice,
    ) &&
    Number.isInteger(
      numericPurchasePrice,
    ) &&
    numericPurchasePrice >=
    config.minimumBid;

  const canRegisterPurchase =
    purchaseOwner === "ME"
      ? Boolean(
        auctionAdvice
          ?.isPurchaseValid,
      )
      : isOpponentPurchaseValid;


  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
      {/* Intestazione */}
      <div>

        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">
              Mercato dell&apos;asta
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Seleziona un giocatore e registra il prezzo finale.
            </p>
          </div>

          <p className="text-xs text-slate-400">
            Quotazioni aggiornate automaticamente
          </p>
        </div>
      </div>

      {/*
      * Destinatario e ruolo sulla stessa riga
      * quando lo schermo è abbastanza largo.
      *
      * Su smartphone restano uno sotto l'altro.
      */}
      <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        {/* Destinatario dell'acquisto */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Destinatario
          </p>

          <div className="grid grid-cols-2 gap-2">
            {/* Acquisto personale */}
            <button
              type="button"
              onClick={() => {
                changePurchaseOwner("ME");
              }}
              className={`
                rounded-xl border px-3 py-2.5
                text-sm font-semibold transition

                ${purchaseOwner === "ME"
                  ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }
              `}
            >
              La mia rosa
            </button>

            {/* Acquisto avversario */}
            <button
              type="button"
              onClick={() => {
                changePurchaseOwner(
                  "OPPONENT",
                );
              }}
              className={`
                rounded-xl border px-3 py-2.5
                text-sm font-semibold transition

                ${purchaseOwner === "OPPONENT"
                  ? "border-amber-500 bg-amber-50 text-amber-800"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }
              `}
            >
              Squadra avversaria
            </button>
          </div>

          {/* Selezione della squadra avversaria */}
          {purchaseOwner === "OPPONENT" && (
            <div className="mt-3">
              <label
                htmlFor="opponent-name"
                className="mb-2 block text-sm font-semibold"
              >
                Squadra avversaria
              </label>


              {hasConfiguredOpponentTeams ? (
                /*
                 * Menu mostrato quando i nomi
                 * sono stati configurati in anticipo.
                 */
                <CustomSelect
                  id="opponent-name"
                  value={opponentName}
                  tone="amber"
                  placeholder="Seleziona la squadra"
                  options={configuredOpponentTeamNames.map(
                    (teamName) => ({
                      value: teamName,
                      label: teamName,
                    }),
                  )}
                  onChange={(teamName) => {
                    setOpponentName(teamName);
                  }}
                />
              ) : (
                /*
                 * Campo manuale mantenuto per chi
                 * non usa la configurazione opzionale.
                 */
                <input
                  id="opponent-name"
                  type="text"
                  required
                  value={opponentName}
                  onChange={(event) => {
                    setOpponentName(
                      event.target.value,
                    );
                  }}
                  placeholder="Es. Team Marco"
                  className="
                    w-full rounded-xl border
                    border-slate-300 bg-white
                    px-4 py-2.5 outline-none
                    transition
                    focus:border-amber-500
                    focus:ring-2
                    focus:ring-amber-100
                  "
                />
              )}


              <p className="mt-1 text-xs text-slate-500">
                {hasConfiguredOpponentTeams
                  ? "Seleziona una delle squadre inserite nella configurazione."
                  : "Usa sempre lo stesso nome per gli acquisti della stessa squadra."}
              </p>
            </div>
          )}
        </div>


        {/* Selezione del ruolo */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Ruolo
          </p>

          <div className="grid grid-cols-4 gap-2">
            {AUCTION_ROLES.map((role) => {
              const roleButtonClasses =
                AUCTION_ROLE_BUTTON_CLASSES[role];

              const isActive =
                activeRole === role;

              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => {
                    changeRole(role);
                  }}
                  className={`
                    rounded-xl border
                    px-3 py-2.5
                    text-sm font-bold
                    shadow-sm transition

                    ${isActive
                      ? roleButtonClasses.active
                      : roleButtonClasses.inactive
                    }
                  `}
                >
                  {role}

                  <span
                    className={`
                    ml-1 text-xs
                    ${isActive
                        ? "opacity-90"
                        : "opacity-70"
                      }
                  `}
                  >
                    ({remainingSlots[role]})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>


      {purchaseOwner === "OPPONENT" && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          L&apos;acquisto verrà utilizzato per aggiornare
          le quotazioni del mercato, ma non modificherà
          il tuo budget o gli slot della tua rosa.
        </div>
      )}

      {/*
       * Layout:
       * - lista giocatori a sinistra;
       * - riepilogo acquisto a destra.
       */}
      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">

        {/* Ricerca e lista */}
        <div>
          <label
            htmlFor="auction-player-search"
            className="mb-2 block text-sm font-semibold"
          >
            Cerca tra{" "}
            {AUCTION_ROLE_SEARCH_LABELS[
              activeRole
            ]}
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
              <div className="mt-3 max-h-[calc(100vh-250px)] min-h-[420px] space-y-2 overflow-y-auto pr-1">
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


        {/* Colonna decisionale */}
        <div className="space-y-3 self-start xl:sticky xl:top-4">

          {/* Assistente strategico */}
          {purchaseOwner === "ME" && (
            <details
              className="
                group overflow-hidden
                rounded-xl border
                border-emerald-200
                bg-emerald-50
              "
            >
              <summary
                className="
                  cursor-pointer list-none
                  px-4 py-3
                "
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-emerald-950">
                      Assistente strategico
                    </p>

                    <p className="mt-0.5 truncate text-xs text-emerald-700">
                      Budget e giocatori consigliati
                    </p>
                  </div>

                  <span
                    className="
                      shrink-0 rounded-full
                      bg-white px-3 py-1.5
                      text-xs font-semibold
                      text-emerald-800
                      shadow-sm
                    "
                  >
                    <span className="group-open:hidden">
                      Apri
                    </span>

                    <span className="hidden group-open:inline">
                      Chiudi
                    </span>
                  </span>
                </div>
              </summary>

              <div
                className="
                  max-h-[calc(100dvh-12rem)]
                  overflow-y-auto
                  border-t border-emerald-200
                  p-3
                "
              >
                <AuctionSuggestions
                  players={availablePlayers}
                  role={activeRole}
                  config={config}
                  purchases={myPurchases}
                  maximumBid={maximumBid}
                  remainingBudget={remainingBudget}
                  remainingSlots={remainingSlots}
                  dynamicRoleBudgets={
                    dynamicRoleBudgets
                  }
                  onSelectPlayer={selectPlayer}
                />
              </div>
            </details>
          )}


          {/* Riepilogo dell'acquisto */}
          <aside className="rounded-xl bg-slate-100 p-3">
            <h3 className="text-base font-bold">
              Riepilogo acquisto
            </h3>

            {!selectedPlayer && (
              <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
                <p className="font-semibold text-slate-700">
                  Nessun giocatore selezionato
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Scegli un giocatore dalla lista per vedere
                  quotazione, consiglio e prezzo massimo.
                </p>
              </div>
            )}


            {selectedPlayer && (
              <form
                onSubmit={handlePurchase}
                className="mt-3 space-y-3"
              >
                {/*
                * Riepilogo compatto del giocatore.
                *
                * Mostriamo immediatamente soltanto
                * le informazioni più importanti.
                */}
                <section className="rounded-xl bg-white p-3">
                  {/* Nome, squadra e ruolo */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-950">
                        {selectedPlayer.name}
                      </p>

                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {selectedPlayer.team}
                      </p>
                    </div>

                    <span
                      className={`
                        shrink-0 rounded-full
                        px-2 py-1
                        text-xs font-bold

                        ${ROLE_BADGE_CLASSES[
                        selectedPlayer.role
                        ]}
                      `}
                    >
                      {selectedPlayer.role}
                    </span>
                  </div>


                  {/* Dati principali */}
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    {/* Punteggio Fantasy AI */}
                    <div className="rounded-lg bg-slate-50 px-2 py-2">
                      <p className="text-[10px] text-slate-500">
                        Punteggio AI
                      </p>

                      <p className="mt-0.5 text-sm font-bold">
                        {selectedPlayer.overall_score.toFixed(
                          2,
                        )}
                      </p>
                    </div>


                    {/* Quotazione dinamica */}
                    <div className="rounded-lg bg-emerald-50 px-2 py-2">
                      <p className="text-[10px] text-emerald-700">
                        Quotazione
                      </p>

                      <p className="mt-0.5 text-sm font-bold text-emerald-800">
                        {selectedValuation
                          ?.dynamicRecommendedPrice ??
                          selectedPlayer.recommended_price}
                      </p>

                      {selectedValuation
                        ?.dynamicRecommendedPrice !==
                        selectedPlayer.recommended_price && (
                          <p className="mt-0.5 text-[9px] text-slate-400">
                            Iniziale{" "}
                            {selectedPlayer.recommended_price}
                          </p>
                        )}
                    </div>


                    {/* Titolarità */}
                    <div className="rounded-lg bg-slate-50 px-2 py-2">
                      <p className="text-[10px] text-slate-500">
                        Titolarità
                      </p>

                      <p className="mt-0.5 text-sm font-bold">
                        {formatPercentage(
                          selectedPlayer.starting_probability,
                        )}
                      </p>
                    </div>
                  </div>


                  {/* Andamento e tetto prudente */}
                  {selectedValuation && (
                    <div className="mt-2 flex items-center justify-between gap-3 border-t border-slate-100 pt-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500">
                          Andamento:
                        </span>

                        <strong
                          className={`
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
                        </strong>
                      </div>

                      {purchaseOwner === "ME" && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500">
                            Tetto:
                          </span>

                          <strong>
                            {
                              selectedValuation
                                .personalMaximumBid
                            }
                          </strong>
                        </div>
                      )}
                    </div>
                  )}
                </section>


                {/* Prezzo pagato */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <label
                      htmlFor="purchase-price"
                      className="text-xs font-semibold"
                    >
                      Prezzo pagato
                    </label>

                    <span className="text-[10px] text-slate-500">
                      Minimo {config.minimumBid}
                    </span>
                  </div>

                  <input
                    id="purchase-price"
                    type="number"
                    min={config.minimumBid}
                    max={
                      purchaseOwner === "ME"
                        ? maximumBid
                        : undefined
                    }
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
                      bg-white px-3 py-2.5
                      text-lg font-bold
                      outline-none transition
                      focus:border-emerald-600
                      focus:ring-2
                      focus:ring-emerald-100
                    "
                  />
                </div>


                {/* Valutazione principale dell'assistente */}
                {auctionAdvice && (
                  <section
                    className={`
                      rounded-xl border p-3

                      ${AUCTION_ADVICE_CLASSES[
                      auctionAdvice.tone
                      ]}
                    `}
                  >
                    {/* Giudizio immediatamente visibile */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
                          Valutazione Fantasy AI
                        </p>

                        <p className="mt-0.5 text-base font-bold">
                          {auctionAdvice.label}
                        </p>
                      </div>

                      <span className="shrink-0 rounded-full bg-white/70 px-2 py-1 text-[10px] font-bold">
                        {auctionAdvice
                          .differenceFromRecommended === 0
                          ? "Prezzo consigliato"
                          : auctionAdvice
                            .differenceFromRecommended < 0
                            ? `${Math.abs(
                              auctionAdvice
                                .differenceFromRecommended,
                            )} sotto`
                            : `${auctionAdvice
                              .differenceFromRecommended} sopra`}
                      </span>
                    </div>

                    <p className="mt-1 text-xs leading-relaxed opacity-80">
                      {auctionAdvice.description}
                    </p>


                    {/*
                    * Le informazioni secondarie
                    * rimangono disponibili, ma non
                    * occupano spazio finché non servono.
                    */}
                    <details
                      className="
                        group mt-3 overflow-hidden
                        rounded-lg bg-white/60
                      "
                    >
                      <summary
                        className="
                          flex cursor-pointer
                          list-none items-center
                          justify-between gap-3
                          px-3 py-2
                          text-xs font-semibold
                        "
                      >
                        <span>
                          Dettagli strategici
                        </span>

                        <span className="opacity-70">
                          <span className="group-open:hidden">
                            Apri
                          </span>

                          <span className="hidden group-open:inline">
                            Chiudi
                          </span>
                        </span>
                      </summary>


                      <div className="border-t border-white/70 p-3">
                        {/* Indicatori economici */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-lg bg-white/70 px-2 py-2">
                            <p className="text-[10px] opacity-70">
                              Quotazione dinamica
                            </p>

                            <p className="mt-0.5 text-sm font-bold">
                              {selectedValuation
                                ?.dynamicRecommendedPrice ??
                                selectedPlayer.recommended_price}
                            </p>
                          </div>

                          <div className="rounded-lg bg-white/70 px-2 py-2">
                            <p className="text-[10px] opacity-70">
                              Tetto strategico
                            </p>

                            <p className="mt-0.5 text-sm font-bold">
                              {
                                auctionAdvice
                                  .strategicMaximumBid
                              }
                            </p>
                          </div>

                          <div className="rounded-lg bg-white/70 px-2 py-2">
                            <p className="text-[10px] opacity-70">
                              Budget dopo
                            </p>

                            <p className="mt-0.5 text-sm font-bold">
                              {
                                auctionAdvice
                                  .remainingBudgetAfterPurchase
                              }
                            </p>
                          </div>

                          <div className="rounded-lg bg-white/70 px-2 py-2">
                            <p className="text-[10px] opacity-70">
                              Da conservare
                            </p>

                            <p className="mt-0.5 text-sm font-bold">
                              {
                                auctionAdvice
                                  .minimumCreditsToReserve
                              }
                            </p>
                          </div>
                        </div>


                        {/* Situazione del ruolo */}
                        <div className="mt-2 space-y-1.5 rounded-lg bg-white/70 px-3 py-2 text-xs">
                          <div className="flex justify-between gap-3">
                            <span className="opacity-70">
                              Budget previsto ruolo
                            </span>

                            <strong>
                              {
                                auctionAdvice
                                  .plannedRoleBudget
                              }
                            </strong>
                          </div>

                          <div className="flex justify-between gap-3">
                            <span className="opacity-70">
                              Spesa dopo l&apos;acquisto
                            </span>

                            <strong>
                              {
                                auctionAdvice
                                  .spentInRoleAfter
                              }
                            </strong>
                          </div>

                          <div className="flex justify-between gap-3">
                            <span className="opacity-70">
                              Situazione del piano
                            </span>

                            <strong className="text-right">
                              {auctionAdvice
                                .roleBudgetDifference >= 0
                                ? `${auctionAdvice
                                  .roleBudgetDifference} disponibili`
                                : `${Math.abs(
                                  auctionAdvice
                                    .roleBudgetDifference,
                                )} oltre il piano`}
                            </strong>
                          </div>
                        </div>


                        {/* Eventuali avvisi */}
                        {auctionAdvice.warnings.length >
                          0 && (
                            <div className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-xs">
                              <p className="font-semibold">
                                Attenzione
                              </p>

                              <div className="mt-1 space-y-1">
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
                      </div>
                    </details>
                  </section>
                )}


                {/* Riepilogo rapido del budget */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-white px-2 py-2 text-center">
                    <p className="text-[10px] text-slate-500">
                      Residuo
                    </p>

                    <p className="mt-0.5 text-sm font-bold">
                      {remainingBudget}
                    </p>
                  </div>

                  <div className="rounded-lg bg-white px-2 py-2 text-center">
                    <p className="text-[10px] text-slate-500">
                      Offerta max
                    </p>

                    <p className="mt-0.5 text-sm font-bold">
                      {maximumBid}
                    </p>
                  </div>

                  <div className="rounded-lg bg-white px-2 py-2 text-center">
                    <p className="text-[10px] text-slate-500">
                      Slot ruolo
                    </p>

                    <p className="mt-0.5 text-sm font-bold">
                      {
                        remainingSlots[
                        selectedPlayer.role
                        ]
                      }
                    </p>
                  </div>
                </div>


                {/* Conferma acquisto */}
                <button
                  type="submit"
                  disabled={!canRegisterPurchase}
                  className={`
                    w-full rounded-xl
                    px-4 py-2.5
                    text-xs font-semibold
                    transition

                    ${canRegisterPurchase
                      ? "bg-emerald-700 text-white hover:bg-emerald-800"
                      : "cursor-not-allowed bg-slate-300 text-slate-500"
                    }
                  `}
                >
                  {purchaseOwner === "OPPONENT"
                    ? "Registra acquisto avversario"
                    : auctionAdvice?.label ===
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
      </div>
    </section>
  );
}