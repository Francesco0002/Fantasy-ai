"use client";

/*
 * Hook React utilizzati per conservare i dati
 * ed eseguire il caricamento dal backend.
 */
import { useEffect, useState } from "react";

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
 * Recupera i giocatori dal backend
 * in base al ruolo e al testo di ricerca.
 *
 * Restituisce:
 * - lista dei giocatori;
 * - stato di caricamento;
 * - eventuale messaggio di errore.
 */
export function usePlayers(
  role: Role,
  search: string,
) {
  /*
   * Lista ricevuta dal backend.
   */
  const [players, setPlayers] =
    useState<Player[]>([]);

  /*
   * Indica se una richiesta è in corso.
   */
  const [isLoading, setIsLoading] =
    useState(true);

  /*
   * Contiene un eventuale errore.
   */
  const [error, setError] =
    useState<string | null>(null);


  useEffect(() => {
    /*
     * Permette di annullare una richiesta precedente
     * quando cambiano rapidamente ricerca o ruolo.
     */
    const controller = new AbortController();


    /*
     * Carica i giocatori dal backend.
     */
    async function loadPlayers() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await fetchPlayers({
          role,
          search,
          limit: 1000,
          signal: controller.signal,
        });

        setPlayers(data.players);
      } catch (caughtError) {
        /*
         * Ignoriamo le richieste annullate
         * intenzionalmente.
         */
        if (
          caughtError instanceof Error &&
          caughtError.name === "AbortError"
        ) {
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
  }, [role, search]);


  /*
   * Valori messi a disposizione
   * della pagina che utilizza l'hook.
   */
  return {
    players,
    isLoading,
    error,
  };
}