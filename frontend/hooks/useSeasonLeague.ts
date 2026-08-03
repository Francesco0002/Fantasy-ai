"use client";

import {
    useEffect,
    useState,
} from "react";

import {
    fetchSeasonLeague,
} from "../lib/api";

import type {
    SeasonLeague,
} from "../types/season";


/*
 * Recupera una singola lega stagionale
 * appartenente all'utente autenticato.
 */
export function useSeasonLeague(
    leagueId: string | null,
    isEnabled: boolean,
) {
    const [league, setLeague] =
        useState<SeasonLeague | null>(null);

    const [isLoading, setIsLoading] =
        useState(true);

    const [error, setError] =
        useState<string | null>(null);


    useEffect(() => {
        /*
         * La richiesta parte soltanto dopo
         * la verifica dell'autenticazione
         * e in presenza dell'identificativo.
         */
        if (!isEnabled || !leagueId) {
            return;
        }


        const currentLeagueId = leagueId;


        const controller = new AbortController();


        async function loadSeasonLeague() {
            setIsLoading(true);
            setError(null);
            setLeague(null);

            try {
                const data = await fetchSeasonLeague(
                    currentLeagueId,
                    controller.signal,
                );

                setLeague(data);
            } catch (caughtError) {
                /*
                 * Ignoriamo le richieste annullate
                 * durante lo smontaggio del componente.
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
                        "Non è stato possibile recuperare la lega.",
                    );
                }
            } finally {
                if (!controller.signal.aborted) {
                    setIsLoading(false);
                }
            }
        }


        loadSeasonLeague();


        return () => {
            controller.abort();
        };
    }, [
        isEnabled,
        leagueId,
    ]);


    return {
        league: isEnabled ? league : null,
        isLoading:
            isEnabled && Boolean(leagueId)
                ? isLoading
                : false,
        error: isEnabled ? error : null,
    };
}