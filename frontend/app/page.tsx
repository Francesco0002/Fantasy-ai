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
 * Funzioni utilizzate per comunicare
 * con il backend FastAPI.
 */
import { API_URL } from "../lib/api";


/*
 * Importiamo gli hook React necessari:
 *
 * useState:
 * conserva i dati e lo stato dell'interfaccia.
 * useMemo permette di calcolare la lista ordinata
 * soltanto quando cambiano i giocatori o il criterio scelto.
 */
import {
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
  Role,
  SortOption,
} from "../types/player";


export default function Home() {


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
    * Come valore iniziale mostriamo prima
    * i giocatori con il Punteggio Fantasy AI più alto.
    */
  const [sortBy, setSortBy] =
    useState<SortOption>("score_desc");

  
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