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
    * Risultato dell'ultima richiesta completata.
    * Conserviamo anche l'ID per non mostrare
    * i dati del giocatore precedente.
    */
    const [
        requestState,
        setRequestState,
    ] = useState<{
        playerId: number;
        player: Player | null;
        error: string | null;
    } | null>(null);


    /*
     * Verifica l'identificativo durante il rendering,
     * senza aggiornare lo stato nel useEffect.
     */
    const isPlayerIdValid =
        playerId !== null &&
        Number.isInteger(playerId) &&
        playerId > 0;


    useEffect(() => {
        /*
        * Un ID non valido non richiede
        * alcuna chiamata al backend.
        */
        if (!isPlayerIdValid) {
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
            try {
                const receivedPlayer =
                    await fetchPlayerById(
                        validPlayerId,
                        controller.signal,
                    );

                setRequestState({
                    playerId: validPlayerId,
                    player: receivedPlayer,
                    error: null,
                });
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
                    setRequestState({
                        playerId: validPlayerId,
                        player: null,
                        error: caughtError.message,
                    });
                } else {
                    setRequestState({
                        playerId: validPlayerId,
                        player: null,
                        error:
                            "Si è verificato un errore sconosciuto.",
                    });
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
    }, [
        playerId,
        isPlayerIdValid,
    ]);


    /*
     * Verifica che la risposta appartenga
     * all'ID richiesto attualmente.
     */
    const hasCurrentResult =
        isPlayerIdValid &&
        requestState?.playerId === playerId;


    return {
        player:
            hasCurrentResult
                ? requestState.player
                : null,

        isLoading:
            isPlayerIdValid &&
            !hasCurrentResult,

        error:
            !isPlayerIdValid
                ? "Identificativo del giocatore non valido."
                : hasCurrentResult
                    ? requestState.error
                    : null,
    };
}