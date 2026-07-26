"use client";

/*
 * Hook React utilizzati per conservare
 * il singolo giocatore e lo stato della richiesta.
 */
import { useEffect, useState } from "react";

/*
 * Funzione API che recupera un giocatore
 * tramite il suo identificativo.
 */
import { fetchPlayerById } from "../lib/api";

/*
 * Tipo completo del giocatore.
 */
import type { Player } from "../types/player";


/*
 * Recupera un singolo giocatore dal backend.
 *
 * Esempio:
 * usePlayer(12) effettua una richiesta a /players/12.
 */
export function usePlayer(
    playerId: number | null,
) {
    /*
     * Giocatore restituito dal backend.
     */
    const [player, setPlayer] =
        useState<Player | null>(null);

    /*
     * Stato di caricamento.
     */
    const [isLoading, setIsLoading] =
        useState(true);

    /*
     * Eventuale errore della richiesta.
     */
    const [error, setError] =
        useState<string | null>(null);


    useEffect(() => {
        /*
         * Controlliamo che l'identificativo
         * sia un numero intero positivo.
         */
        if (
            playerId === null ||
            !Number.isInteger(playerId) ||
            playerId <= 0
        ) {
            setPlayer(null);
            setError(
                "Identificativo del giocatore non valido.",
            );
            setIsLoading(false);

            return;
        }


        /*
        * Dopo i controlli precedenti sappiamo
        * che l'identificativo è un numero valido.
        *
        * Utilizziamo una nuova costante affinché
        * TypeScript mantenga correttamente il tipo number
        * anche dentro la funzione asincrona.
        */
        const validPlayerId = playerId;

        /*
         * Permette di annullare la richiesta
         * quando si lascia la pagina.
         */
        const controller = new AbortController();


        /*
         * Caricamento del singolo giocatore.
         */
        async function loadPlayer() {
            setIsLoading(true);
            setError(null);
            setPlayer(null);

            try {
                const receivedPlayer =
                    await fetchPlayerById(
                        validPlayerId,
                        controller.signal,
                    );

                setPlayer(receivedPlayer);
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

                setPlayer(null);
            } finally {
                /*
                 * Una richiesta annullata non deve
                 * aggiornare lo stato della pagina.
                 */
                if (!controller.signal.aborted) {
                    setIsLoading(false);
                }
            }
        }


        loadPlayer();


        /*
         * Pulizia eseguita quando cambia l'ID
         * o il componente viene chiuso.
         */
        return () => {
            controller.abort();
        };
    }, [playerId]);


    /*
     * Valori utilizzati dalla pagina dettagli.
     */
    return {
        player,
        isLoading,
        error,
    };
}