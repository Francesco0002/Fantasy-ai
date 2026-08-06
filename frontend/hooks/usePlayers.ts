"use client";

/*
 * Hook React utilizzati per conservare i dati,
 * recuperare la cache prima del rendering
 * ed eseguire il caricamento dal backend.
 */
import {
  useEffect,
  useLayoutEffect,
  useState,
} from "react";

/*
 * Funzione centralizzata che comunica
 * con l'API FastAPI.
 */
import { fetchPlayers } from "../lib/api";

/*
 * Tipi condivisi relativi ai giocatori
 * e al filtro per ruolo.
 */
import type {
  Player,
  Role,
} from "../types/player";


/*
 * Salviamo una sola lista: quella utilizzata
 * più recentemente dalla Home.
 *
 * In questo modo non riempiamo sessionStorage
 * con tutte le ricerche effettuate dall'utente.
 */
const PLAYER_LIST_CACHE_STORAGE_KEY =
  "fantasy-ai:home-player-list-cache";

/*
 * La cache serve soprattutto per tornare
 * immediatamente da Dettagli o Confronta.
 *
 * Dopo dieci minuti viene considerata scaduta.
 */
const PLAYER_LIST_CACHE_MAX_AGE_MS =
  10 * 60 * 1000;


/*
 * Struttura conservata temporaneamente
 * nella sessione del browser.
 */
type PlayerListCacheSnapshot = {
  role: Role;
  search: string;
  players: Player[];
  savedAt: number;
};


/*
 * Legge la cache soltanto quando corrisponde
 * esattamente ai filtri richiesti.
 */
function readPlayerListCache(
  role: Role,
  search: string,
): Player[] | null {
  if (typeof window === "undefined") {
    return null;
  }

  const storedCache =
    window.sessionStorage.getItem(
      PLAYER_LIST_CACHE_STORAGE_KEY,
    );

  if (!storedCache) {
    return null;
  }

  try {
    const parsedCache = JSON.parse(
      storedCache,
    ) as Partial<PlayerListCacheSnapshot>;

    const isValidTimestamp =
      typeof parsedCache.savedAt === "number"
      && Number.isFinite(
        parsedCache.savedAt,
      );

    const isExpired =
      !isValidTimestamp
      || Date.now() -
      (parsedCache.savedAt as number) >
      PLAYER_LIST_CACHE_MAX_AGE_MS;

    const matchesCurrentFilters =
      parsedCache.role === role
      && parsedCache.search === search;

    if (
      isExpired
      || !matchesCurrentFilters
      || !Array.isArray(
        parsedCache.players,
      )
    ) {
      if (isExpired) {
        window.sessionStorage.removeItem(
          PLAYER_LIST_CACHE_STORAGE_KEY,
        );
      }

      return null;
    }

    return parsedCache.players as Player[];
  } catch {
    /*
     * Una cache danneggiata viene eliminata
     * senza compromettere il caricamento.
     */
    window.sessionStorage.removeItem(
      PLAYER_LIST_CACHE_STORAGE_KEY,
    );

    return null;
  }
}


/*
 * Aggiorna la cache dopo una risposta valida
 * ricevuta dal backend.
 */
function writePlayerListCache(
  role: Role,
  search: string,
  players: Player[],
) {
  try {
    const cacheSnapshot:
      PlayerListCacheSnapshot = {
        role,
        search,
        players,
        savedAt: Date.now(),
      };

    window.sessionStorage.setItem(
      PLAYER_LIST_CACHE_STORAGE_KEY,
      JSON.stringify(cacheSnapshot),
    );
  } catch {
    /*
     * Il browser potrebbe impedire il salvataggio
     * oppure aver esaurito lo spazio disponibile.
     *
     * In quel caso l'hook continua normalmente
     * utilizzando soltanto il backend.
     */
  }
}


/*
 * Recupera i giocatori dal backend
 * in base al ruolo e al testo di ricerca.
 *
 * useSessionCache viene attivato soltanto
 * dalla Home, dove serve ripristinare
 * immediatamente la lista durante il ritorno.
 */
export function usePlayers(
  role: Role,
  search: string,
  useSessionCache = false,
) {
  /*
   * Lista ricevuta dal backend
   * oppure recuperata dalla cache.
   */
  const [players, setPlayers] =
    useState<Player[]>([]);

  /*
   * Indica se non è ancora disponibile
   * alcuna lista da mostrare.
   */
  const [isLoading, setIsLoading] =
    useState(true);

  /*
   * Contiene un eventuale errore.
   */
  const [error, setError] =
    useState<string | null>(null);


  /*
   * Recupera la lista dalla cache prima
   * che il browser disegni la pagina.
   *
   * Questo elimina la schermata vuota
   * nel normale ritorno da un'altra pagina.
   */
  useLayoutEffect(() => {
    const cachedPlayers =
      useSessionCache
        ? readPlayerListCache(
          role,
          search,
        )
        : null;

    if (cachedPlayers !== null) {
      setPlayers(cachedPlayers);
      setIsLoading(false);
      setError(null);

      return;
    }

    setPlayers([]);
    setIsLoading(true);
    setError(null);
  }, [
    role,
    search,
    useSessionCache,
  ]);


  useEffect(() => {
    /*
     * Permette di annullare una richiesta precedente
     * quando cambiano rapidamente ricerca o ruolo.
     */
    const controller = new AbortController();

    const cachedPlayers =
      useSessionCache
        ? readPlayerListCache(
          role,
          search,
        )
        : null;


    /*
     * Carica i dati aggiornati dal backend.
     */
    async function loadPlayers() {
      /*
       * Se esiste una cache valida continuiamo
       * a mostrarla durante l'aggiornamento.
       */
      if (cachedPlayers === null) {
        setIsLoading(true);
      }

      setError(null);

      try {
        const data = await fetchPlayers({
          role,
          search,
          limit: 1000,
          signal: controller.signal,
        });

        setPlayers(data.players);

        if (useSessionCache) {
          writePlayerListCache(
            role,
            search,
            data.players,
          );
        }
      } catch (caughtError) {
        /*
         * Ignoriamo le richieste annullate
         * intenzionalmente.
         */
        if (
          caughtError instanceof Error
          && caughtError.name === "AbortError"
        ) {
          return;
        }

        /*
         * Se abbiamo già una lista in cache,
         * la conserviamo anche quando il refresh
         * temporaneo del backend fallisce.
         */
        if (cachedPlayers !== null) {
          setPlayers(cachedPlayers);
          setError(null);

          return;
        }

        if (caughtError instanceof Error) {
          setError(caughtError.message);
        } else {
          setError(
            "Si è verificato un errore sconosciuto.",
          );
        }

        setPlayers([]);
      } finally {
        /*
         * Evitiamo che una richiesta vecchia annullata
         * modifichi lo stato della richiesta nuova.
         */
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }


    loadPlayers();


    /*
     * Annulliamo la richiesta quando:
     * - cambia il ruolo;
     * - cambia la ricerca;
     * - il componente viene smontato.
     */
    return () => {
      controller.abort();
    };
  }, [
    role,
    search,
    useSessionCache,
  ]);


  return {
    players,
    isLoading,
    error,
  };
}
