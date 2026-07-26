"use client";


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
 *
 * useEffect:
 * esegue il caricamento dei giocatori quando
 * la pagina viene aperta o cambiano i filtri.
 */
/*
 * useMemo permette di calcolare la lista ordinata
 * soltanto quando cambiano i giocatori o il criterio scelto.
 */
import { useEffect, useMemo, useState } from "react";


/*
 * Tipi TypeScript condivisi relativi
 * ai giocatori, ai filtri e all'ordinamento.
 */
import type {
  Player,
  PlayersResponse,
  PlayerTier,
  Role,
  SortOption,
} from "../types/player";


/*
 * Recuperiamo l'indirizzo del backend
 * dalla variabile definita in .env.local.
 *
 * Se la variabile manca, usiamo l'indirizzo locale
 * come valore predefinito.
 */
const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8000";


export default function Home() {
  /*
   * Lista dei giocatori ricevuti dal backend.
   */
  const [players, setPlayers] = useState<Player[]>([]);

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
   * Stato usato per mostrare il messaggio
   * di caricamento.
   */
  const [isLoading, setIsLoading] = useState(true);

  /*
   * Contiene un eventuale messaggio di errore.
   * null significa che non ci sono errori.
   */
  const [error, setError] = useState<string | null>(null);


  /*
    * Criterio di ordinamento attualmente selezionato.
    *
    * Come valore iniziale mostriamo prima
    * i giocatori con il Punteggio Fantasy AI più alto.
    */
  const [sortBy, setSortBy] =
    useState<SortOption>("score_desc");


  /*
   * useEffect esegue una richiesta al backend.
   *
   * La richiesta viene ripetuta quando cambiano:
   * - il ruolo selezionato;
   * - il testo di ricerca.
   */
  useEffect(() => {
    /*
     * AbortController permette di annullare
     * una richiesta precedente quando l'utente
     * cambia rapidamente un filtro.
     */
    const controller = new AbortController();


    async function loadPlayers() {
      /*
       * Prima di iniziare una nuova richiesta:
       * - attiviamo il caricamento;
       * - cancelliamo eventuali vecchi errori.
       */
      setIsLoading(true);
      setError(null);

      /*
       * URLSearchParams costruisce correttamente
       * i parametri dell'indirizzo.
       */
      const params = new URLSearchParams();

      /*
       * Richiediamo fino a 100 giocatori.
       */
      params.set("limit", "100");

      /*
       * Aggiungiamo il ruolo soltanto
       * quando l'utente ne ha selezionato uno.
       */
      if (role !== "") {
        params.set("role", role);
      }

      /*
       * Eliminiamo gli spazi iniziali e finali.
       */
      const cleanedSearch = search.trim();

      /*
       * Aggiungiamo il testo solo quando
       * contiene almeno un carattere.
       */
      if (cleanedSearch !== "") {
        params.set("search", cleanedSearch);
      }

      try {
        /*
         * Effettuiamo la richiesta HTTP
         * verso l'endpoint FastAPI.
         */
        const response = await fetch(
          `${API_URL}/players?${params.toString()}`,
          {
            signal: controller.signal,
          },
        );

        /*
         * fetch non genera automaticamente un errore
         * per risposte HTTP come 404 o 500.
         *
         * Controlliamo quindi manualmente response.ok.
         */
        if (!response.ok) {
          throw new Error(
            `Il backend ha restituito l'errore ${response.status}.`,
          );
        }

        /*
         * Convertiamo la risposta JSON
         * nella struttura PlayersResponse.
         */
        const data: PlayersResponse =
          await response.json();

        /*
         * Salviamo i giocatori nello stato React.
         */
        setPlayers(data.players);
      } catch (caughtError) {
        /*
         * Non mostriamo un errore quando la richiesta
         * è stata annullata volontariamente.
         */
        if (
          caughtError instanceof Error &&
          caughtError.name === "AbortError"
        ) {
          return;
        }

        /*
         * Gestiamo gli errori normali,
         * ad esempio backend non raggiungibile.
         */
        if (caughtError instanceof Error) {
          setError(caughtError.message);
        } else {
          setError(
            "Si è verificato un errore sconosciuto.",
          );
        }

        /*
         * In caso di errore svuotiamo
         * l'elenco precedente.
         */
        setPlayers([]);
      } finally {
        /*
         * Disattiviamo lo stato di caricamento.
         */
        setIsLoading(false);
      }
    }


    /*
     * Avviamo la funzione asincrona.
     */
    loadPlayers();


    /*
     * Questa funzione viene eseguita quando
     * l'effetto deve essere interrotto o ricreato.
     */
    return () => {
      controller.abort();
    };
  }, [role, search]);


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
      * dal rischio più basso al più alto.
      *
      * In questo caso un valore minore
      * viene considerato migliore.
      */
      case "injury_asc":
        return playersCopy.sort(
          (firstPlayer, secondPlayer) =>
            firstPlayer.injury_risk -
            secondPlayer.injury_risk,
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
            <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {sortedPlayers.map((player) => (
                <PlayerCard
                  key={player.player_id}
                  player={player}
                  apiUrl={API_URL}
                />
              ))}
            </section>
          )}
      </div>
    </main>
  );
}