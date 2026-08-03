"use client";

/*
 * Hook React utilizzati per conservare
 * i dati e caricarli dal backend.
 */
import {
  useEffect,
  useState,
} from "react";

/*
 * Funzione centralizzata per recuperare
 * le leghe stagionali dell'utente.
 */
import {
  fetchSeasonLeagues,
} from "../lib/api";

/*
 * Tipo condiviso relativo
 * a una lega stagionale.
 */
import type {
  SeasonLeague,
} from "../types/season";


/*
 * Recupera dal backend le leghe stagionali
 * appartenenti all'utente autenticato.
 *
 * Restituisce:
 * - lista delle leghe;
 * - stato di caricamento;
 * - eventuale messaggio di errore.
 */
export function useSeasonLeagues(
  isEnabled: boolean,
) {
  /*
   * Leghe appartenenti all'account corrente.
   */
  const [leagues, setLeagues] =
    useState<SeasonLeague[]>([]);

  /*
   * Indica se il caricamento è in corso.
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
    * Non interroghiamo il backend finché
    * l'autenticazione non è stata verificata.
    */
    if (!isEnabled) {
      return;
    }


    /*
     * Permette di annullare la richiesta
     * se il componente viene smontato.
     */
    const controller = new AbortController();


    /*
     * Carica le leghe dell'utente autenticato.
     */
    async function loadSeasonLeagues() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await fetchSeasonLeagues(
          controller.signal,
        );

        setLeagues(data.leagues);
      } catch (caughtError) {
        /*
         * Ignoriamo una richiesta annullata
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

        setLeagues([]);
      } finally {
        /*
         * Evitiamo aggiornamenti dopo
         * l'annullamento della richiesta.
         */
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }


    loadSeasonLeagues();


    /*
     * Annulla la richiesta quando
     * il componente viene smontato.
     */
    return () => {
      controller.abort();
    };
  }, [isEnabled]);


  /*
  * Quando il caricamento non è abilitato,
  * esponiamo uno stato vuoto senza modificarlo
  * direttamente all'interno dell'effetto.
  */
  return {
    leagues: isEnabled ? leagues : [],
    isLoading: isEnabled ? isLoading : false,
    error: isEnabled ? error : null,
  };
}
