"use client";


import Link from "next/link";


/*
 * Finestra utilizzata per scegliere
 * il secondo giocatore del confronto.
 */
import ComparePlayerModal from "../components/ComparePlayerModal";


import AuthPanel from "../components/auth/AuthPanel";

import {
  useAuth,
} from "../hooks/useAuth";


/*
 * Componente contenente ricerca,
 * filtro per ruolo e ordinamento.
 */
import PlayerFilters from "../components/PlayerFilters";

/*
 * Componente grafico che rappresenta
 * la scheda di un singolo giocatore.
 */
import PlayerCard from "../components/PlayerCard";


/*
 * Importiamo gli hook React necessari:
 *
 * useState:
 * conserva i dati e lo stato dell'interfaccia.
 * useMemo permette di calcolare la lista ordinata
 * soltanto quando cambiano i giocatori o il criterio scelto.
 */
import type {
  MouseEvent,
} from "react";


import {
  useEffect,
  useMemo,
  useState,
} from "react";


/*
 * Custom hook che gestisce il caricamento
 * dei giocatori dal backend.
 */
import { usePlayers } from "../hooks/usePlayers";


/*
 * Tipi TypeScript condivisi relativi
 * ai giocatori, ai filtri e all'ordinamento.
 */
import type {
  Player,
  Role,
  SortOption,
} from "../types/player";


/*
 * Ordine utilizzato per mostrare i ruoli nel listone:
 * Portieri, Difensori, Centrocampisti e Attaccanti.
 */
const ROLE_ORDER: Record<Player["role"], number> = {
  P: 0,
  D: 1,
  C: 2,
  A: 3,
};


/*
 * Chiave usata per conservare temporaneamente
 * lo stato della lista quando si apre un giocatore.
 */
const PLAYER_LIST_STATE_STORAGE_KEY =
  "fantasy-ai:player-list-state";


/*
 * Stato della lista da ripristinare
 * quando si torna dalla pagina dettagli.
 */
type PlayerListStateSnapshot = {
  search: string;
  role: Role;
  sortBy: SortOption;
  scrollY: number;
};


export default function Home() {

  const {
    user,
    isAuthReady,
  } = useAuth();


  /*
 * Indica se la transizione verso
 * la pagina delle aste è in corso.
 */
  const [
    isAuctionOpening,
    setIsAuctionOpening,
  ] = useState(false);


  /*
   * Testo scritto nel campo di ricerca.
   */
  const [search, setSearch] = useState("");

  /*
   * Ruolo selezionato nel menu.
   * La stringa vuota indica nessun filtro.
   */
  const [role, setRole] = useState<Role>("");


  /*
  * Criterio di ordinamento attualmente selezionato.
  *
  * Come valore iniziale mostriamo i giocatori
  * ordinati per ruolo: P → D → C → A.
  */
  const [sortBy, setSortBy] =
    useState<SortOption>("role_asc");


  /*
   * Stato che resta valorizzato fino a quando
   * posizione e filtri non sono stati ripristinati.
   */
  const [
    pendingListState,
    setPendingListState,
  ] = useState<PlayerListStateSnapshot | null>(
    null,
  );


  /*
   * Recupera lo stato salvato prima
   * dell'apertura della pagina dettagli.
   */
  useEffect(() => {
    const storedState =
      window.sessionStorage.getItem(
        PLAYER_LIST_STATE_STORAGE_KEY,
      );

    if (!storedState) {
      return;
    }

    try {
      const parsedState = JSON.parse(
        storedState,
      ) as Partial<PlayerListStateSnapshot>;

      const validRoles: Role[] = [
        "",
        "P",
        "D",
        "C",
        "A",
      ];

      const validSortOptions: SortOption[] = [
        "role_asc",
        "score_desc",
        "starting_desc",
        "injury_asc",
      ];

      const isValidRole =
        typeof parsedState.role === "string"
        && validRoles.includes(
          parsedState.role as Role,
        );

      const isValidSortOption =
        typeof parsedState.sortBy === "string"
        && validSortOptions.includes(
          parsedState.sortBy as SortOption,
        );

      const isValidSearch =
        typeof parsedState.search === "string";

      const isValidScrollPosition =
        typeof parsedState.scrollY === "number"
        && Number.isFinite(
          parsedState.scrollY,
        )
        && parsedState.scrollY >= 0;

      if (
        !isValidRole
        || !isValidSortOption
        || !isValidSearch
        || !isValidScrollPosition
      ) {
        window.sessionStorage.removeItem(
          PLAYER_LIST_STATE_STORAGE_KEY,
        );

        return;
      }

      const restoredState: PlayerListStateSnapshot = {
        search: parsedState.search as string,
        role: parsedState.role as Role,
        sortBy: parsedState.sortBy as SortOption,
        scrollY: parsedState.scrollY as number,
      };

      setSearch(restoredState.search);
      setRole(restoredState.role);
      setSortBy(restoredState.sortBy);
      setPendingListState(restoredState);
    } catch {
      /*
       * Un valore non valido non deve
       * compromettere il caricamento della home.
       */
      window.sessionStorage.removeItem(
        PLAYER_LIST_STATE_STORAGE_KEY,
      );
    }
  }, []);


  /*
  * Carichiamo i giocatori in base
  * ai filtri attualmente selezionati.
  */
  const {
    players,
    isLoading,
    error,
  } = usePlayers(role, search);


  /*
    * Creiamo una nuova lista ordinata senza modificare
    * direttamente l'array originale contenuto nello stato.
    *
    * L'operatore [...players] genera una copia
    * prima di applicare il metodo sort.
    */
  const sortedPlayers = useMemo(() => {
    const playersCopy = [...players];

    switch (sortBy) {
      case "role_asc":
        return playersCopy.sort((firstPlayer, secondPlayer) => {
          /*
           * Prima confrontiamo il ruolo:
           * P → D → C → A.
           */
          const roleDifference =
            ROLE_ORDER[firstPlayer.role] -
            ROLE_ORDER[secondPlayer.role];

          if (roleDifference !== 0) {
            return roleDifference;
          }

          /*
           * I giocatori dello stesso ruolo vengono ordinati
           * dal punteggio Fantasy AI più alto al più basso.
           */
          return (
            secondPlayer.overall_score -
            firstPlayer.overall_score
          );
        });


      /*
      * Punteggio Fantasy AI:
      * dal valore più alto al più basso.
      */
      case "score_desc":
        return playersCopy.sort(
          (firstPlayer, secondPlayer) =>
            secondPlayer.overall_score -
            firstPlayer.overall_score,
        );

      /*
      * Prezzo consigliato:
      * dal giocatore più costoso al meno costoso.
      */
      case "price_desc":
        return playersCopy.sort(
          (firstPlayer, secondPlayer) =>
            secondPlayer.recommended_price -
            firstPlayer.recommended_price,
        );

      /*
      * Probabilità di titolarità:
      * dalla probabilità più alta alla più bassa.
      */
      case "starting_desc":
        return playersCopy.sort(
          (firstPlayer, secondPlayer) =>
            secondPlayer.starting_probability -
            firstPlayer.starting_probability,
        );

      /*
      * Rischio infortunio:
      * i giocatori con un dato disponibile
      * vengono ordinati dal rischio più basso
      * al rischio più alto.
      *
      * I giocatori senza un dato reale vengono
      * spostati in fondo senza utilizzare
      * il valore tecnico di fallback.
      */
      case "injury_asc":
        return playersCopy.sort(
          (firstPlayer, secondPlayer) => {
            const firstAvailable =
              firstPlayer.injury_risk_available;

            const secondAvailable =
              secondPlayer.injury_risk_available;

            /*
             * Se soltanto uno dei due giocatori
             * possiede il dato, quello disponibile
             * deve comparire per primo.
             */
            if (
              firstAvailable !== secondAvailable
            ) {
              return firstAvailable ? -1 : 1;
            }

            /*
             * Se entrambi sono senza dato,
             * manteniamo il loro ordine precedente.
             */
            if (
              !firstAvailable &&
              !secondAvailable
            ) {
              return 0;
            }

            /*
             * Se entrambi possiedono il dato,
             * ordiniamo dal rischio minore
             * al rischio maggiore.
             */
            return (
              firstPlayer.injury_risk -
              secondPlayer.injury_risk
            );
          },
        );

      /*
      * Nome del giocatore:
      * ordine alfabetico italiano.
      */
      case "name_asc":
        return playersCopy.sort(
          (firstPlayer, secondPlayer) =>
            firstPlayer.name.localeCompare(
              secondPlayer.name,
              "it",
            ),
        );

      /*
      * Caso di sicurezza.
      *
      * Se arriva un criterio non previsto,
      * restituiamo la lista senza modificarla.
      */
      default:
        return playersCopy;
    }
  }, [players, sortBy]);


  /*
   * Ripristina lo scroll soltanto quando:
   *
   * - i filtri salvati sono stati applicati;
   * - il caricamento dei giocatori ? terminato;
   * - la lista corretta ? presente nella pagina.
   */
  useEffect(() => {
    if (
      !pendingListState
      || isLoading
      || error
      || search !== pendingListState.search
      || role !== pendingListState.role
      || sortBy !== pendingListState.sortBy
    ) {
      return;
    }

    const animationFrame =
      window.requestAnimationFrame(() => {
        window.scrollTo({
          top: pendingListState.scrollY,
          behavior: "auto",
        });

        window.sessionStorage.removeItem(
          PLAYER_LIST_STATE_STORAGE_KEY,
        );

        setPendingListState(null);
      });

    return () => {
      window.cancelAnimationFrame(
        animationFrame,
      );
    };
  }, [
    error,
    isLoading,
    pendingListState,
    role,
    search,
    sortBy,
    sortedPlayers.length,
  ]);


  /*
   * Salva lo stato corrente prima di lasciare
   * la lista per dettagli o confronto.
   */
  function savePlayerListState() {
    const stateToSave: PlayerListStateSnapshot = {
      search,
      role,
      sortBy,
      scrollY: window.scrollY,
    };

    window.sessionStorage.setItem(
      PLAYER_LIST_STATE_STORAGE_KEY,
      JSON.stringify(stateToSave),
    );
  }


  /*
  * Primo giocatore fissato per il confronto.
  *
  * null indica che la finestra
  * di confronto è chiusa.
  */
  const [
    compareBasePlayer,
    setCompareBasePlayer,
  ] = useState<Player | null>(null);

  /*
  * Apre la pagina di gestione delle aste
  * utilizzando la transizione globale.
  */
  function handleOpenAuction(
    event: MouseEvent<HTMLButtonElement>,
  ) {
    if (isAuctionOpening) {
      return;
    }

    const buttonRectangle =
      event.currentTarget
        .getBoundingClientRect();

    const originX =
      buttonRectangle.left +
      buttonRectangle.width / 2;

    const originY =
      buttonRectangle.top +
      buttonRectangle.height / 2;

    setIsAuctionOpening(true);

    /*
     * Dalla Home non creiamo direttamente
     * una sessione: apriamo l'elenco delle aste.
     */
    window.dispatchEvent(
      new CustomEvent(
        "fantasy-ai:open-auction",
        {
          detail: {
            originX,
            originY,
            destination:
              "/my-auctions",
          },
        },
      ),
    );
  }


  return (
    /*
     * Contenitore principale della pagina.
     */
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-6xl">

        {/* Intestazione della pagina */}
        <header className="mb-8">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-emerald-700">
            Assistente d&apos;asta
          </p>

          <h1 className="text-4xl font-bold">
            Fantasy AI
          </h1>

          <p className="mt-3 max-w-2xl text-slate-600">
            Consulta le valutazioni proprietarie e i prezzi
            d&apos;asta consigliati per ciascun giocatore.
          </p>

          <AuthPanel />

          {/* Accesso alle modalità principali */}
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleOpenAuction}
              aria-busy={isAuctionOpening}
              disabled={
                !isAuthReady ||
                user === null ||
                isAuctionOpening
              }
              className="
                inline-flex items-center
                justify-center rounded-xl
                bg-emerald-700 px-5 py-3
                text-sm font-semibold text-white
                transition-colors duration-200
                hover:bg-emerald-800
                disabled:cursor-not-allowed
                disabled:bg-slate-400
              "
            >
              {!isAuthReady
                ? "Verifica account..."
                : !user
                  ? "Accedi per gestire le aste"
                  : isAuctionOpening
                    ? "Apertura aste..."
                    : "Gestisci aste"}
            </button>

            {isAuthReady && user && (
              <Link
                href="/season"
                className="
                  inline-flex items-center
                  justify-center rounded-xl
                  border border-emerald-700
                  bg-white px-5 py-3
                  text-sm font-semibold text-emerald-700
                  transition-colors duration-200
                  hover:bg-emerald-50
                "
              >
                Gestisci stagione
              </Link>
            )}
          </div>
        </header>


        {/* Ricerca, filtro per ruolo e ordinamento */}
        <PlayerFilters
          search={search}
          role={role}
          sortBy={sortBy}
          onSearchChange={setSearch}
          onRoleChange={setRole}
          onSortChange={setSortBy}
        />


        {/*
         * Riepilogo del numero di risultati.
         */}
        <section className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            Giocatori
          </h2>

          {!isLoading && !error && (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800">
              {players.length} risultati
            </span>
          )}
        </section>


        {/*
         * Messaggio mostrato durante il caricamento.
         */}
        {isLoading && (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            Caricamento dei giocatori...
          </div>
        )}


        {/*
         * Messaggio mostrato quando il backend
         * non è raggiungibile o restituisce un errore.
         */}
        {!isLoading && error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
            <p className="font-semibold">
              Impossibile caricare i giocatori
            </p>

            <p className="mt-2 text-sm">
              {error}
            </p>

            <p className="mt-2 text-sm">
              Controlla che FastAPI sia attivo sulla
              porta 8000.
            </p>
          </div>
        )}


        {/*
         * Messaggio mostrato quando i filtri
         * non producono risultati.
         */}
        {!isLoading &&
          !error &&
          players.length === 0 && (
            <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
              Nessun giocatore trovato.
            </div>
          )}


        {/*
         * Griglia delle schede dei giocatori.
         */}
        {!isLoading &&
          !error &&
          players.length > 0 && (
            <section className="space-y-3">
              {sortedPlayers.map((player) => (
                <PlayerCard
                  key={player.player_id}
                  player={player}
                  onOpenDetails={
                    savePlayerListState
                  }
                  onCompare={(selectedPlayer) => {
                    /*
                     * Fissiamo il giocatore selezionato
                     * e apriamo la finestra.
                     */
                    setCompareBasePlayer(
                      selectedPlayer,
                    );
                  }}
                />
              ))}
            </section>
          )}
      </div>
      {/*
      * La finestra viene mostrata solamente
      * quando esiste un giocatore fissato.
      */}
      {compareBasePlayer && (
        <ComparePlayerModal
          basePlayer={compareBasePlayer}
          onOpenComparison={
            savePlayerListState
          }
          onClose={() => {
            setCompareBasePlayer(null);
          }}
        />
      )}
    </main>
  );
}