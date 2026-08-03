"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  createSeasonLeague,
  fetchSeasonLeagues,
} from "../lib/api";

import type {
  CreateSeasonLeagueInput,
  SeasonLeague,
} from "../types/season";


/*
 * Recupera e gestisce le leghe stagionali
 * appartenenti all'utente autenticato.
 */
export function useSeasonLeagues(
  isEnabled: boolean,
) {
  const [leagues, setLeagues] =
    useState<SeasonLeague[]>([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isCreating, setIsCreating] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);


  /*
   * Aggiunge una nuova lega tramite il backend
   * e aggiorna immediatamente l'elenco locale.
   */
  const addSeasonLeague = useCallback(
    async (
      input: CreateSeasonLeagueInput,
    ): Promise<SeasonLeague> => {
      setIsCreating(true);

      try {
        const createdLeague =
          await createSeasonLeague(input);

        setLeagues((currentLeagues) => [
          createdLeague,
          ...currentLeagues,
        ]);

        return createdLeague;
      } finally {
        setIsCreating(false);
      }
    },
    [],
  );


  useEffect(() => {
    /*
     * Non interroghiamo il backend finché
     * l'autenticazione non è stata verificata.
     */
    if (!isEnabled) {
      return;
    }

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
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }


    loadSeasonLeagues();


    return () => {
      controller.abort();
    };
  }, [isEnabled]);


  return {
    leagues: isEnabled ? leagues : [],
    isLoading: isEnabled ? isLoading : false,
    isCreating: isEnabled
      ? isCreating
      : false,
    error: isEnabled ? error : null,
    addSeasonLeague,
  };
}
