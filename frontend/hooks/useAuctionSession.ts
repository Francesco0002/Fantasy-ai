"use client";

/*
 * Calcolo della distribuzione dinamica
 * del budget tra i ruoli incompleti.
 */
import {
  calculateDynamicRoleBudgets,
} from "../lib/auction-budget";

/*
 * Funzioni che comunicano con FastAPI.
 */
import {
  ApiRequestError,
  createAuctionPurchase,
  createAuctionSession,
  deleteAuctionPurchase,
  deleteAuctionSession,
  fetchAuctionSessionById,
} from "../lib/api";

import type {
  AuctionSessionApiResponse,
} from "../lib/api";

import {
  AUCTION_SESSION_ID_KEY,
  LEGACY_AUCTION_STORAGE_KEY,
} from "../lib/auction-storage";

/*
 * Hook React utilizzati per conservare
 * la sessione e calcolare i dati derivati.
 */
import {
  useEffect,
  useMemo,
  useState,
} from "react";

/*
 * Tipi condivisi della modalità asta.
 */
import type {
  AuctionConfig,
  AuctionPurchase,
  AuctionRole,
  AuctionSession,
} from "../types/auction";


import {
  useAuth,
} from "./useAuth";


/*
 * Valori vuoti associati ai ruoli.
 */
const EMPTY_ROLE_VALUES: Record<
  AuctionRole,
  number
> = {
  P: 0,
  D: 0,
  C: 0,
  A: 0,
};


/*
 * Crea una copia indipendente
 * della configurazione.
 */
function cloneAuctionConfig(
  config: AuctionConfig,
): AuctionConfig {
  return {
    ...config,

    rosterSlots: {
      ...config.rosterSlots,
    },

    budgetDistribution: {
      ...config.budgetDistribution,
    },

    opponentTeamNames: [
      ...(
        config.opponentTeamNames ??
        []
      ),
    ],
  };
}


/*
 * Restituisce un messaggio leggibile
 * partendo da un errore sconosciuto.
 */
function getErrorMessage(
  error: unknown,
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return (
    "Si è verificato un errore "
    + "durante la comunicazione con il backend."
  );
}


/*
 * Converte la risposta FastAPI
 * nel formato già utilizzato dal frontend.
 */
function mapApiSessionToAuctionSession(
  apiSession: AuctionSessionApiResponse,
): AuctionSession {
  /*
   * Mappa che permette di recuperare
   * rapidamente una squadra tramite UUID.
   */
  const teamsById = new Map(
    apiSession.teams.map(
      (team) => [
        team.id,
        team,
      ],
    ),
  );


  /*
   * Convertiamo gli acquisti del backend
   * nel formato AuctionPurchase.
   */
  const purchases: AuctionPurchase[] =
    apiSession.purchases.map(
      (apiPurchase) => {
        const ownerTeam =
          teamsById.get(
            apiPurchase.teamId,
          );

        const isUserPurchase =
          ownerTeam?.isUserTeam === true;

        return {
          playerId:
            apiPurchase.playerId,

          playerName:
            apiPurchase.playerName,

          /*
           * Nel frontend "team" indica
           * la squadra reale del calciatore.
           */
          team:
            apiPurchase.playerTeam,

          role:
            apiPurchase.role,

          purchasePrice:
            apiPurchase.purchasePrice,

          ownerType:
            isUserPurchase
              ? "ME"
              : "OPPONENT",

          ownerName:
            isUserPurchase
              ? undefined
              : (
                ownerTeam?.name ??
                "Squadra avversaria"
              ),

          baseRecommendedPriceAtPurchase:
            apiPurchase
              .baseRecommendedPriceAtPurchase ??
            undefined,

          dynamicRecommendedPriceAtPurchase:
            apiPurchase
              .dynamicRecommendedPriceAtPurchase ??
            undefined,

          purchasedAt:
            apiPurchase.purchasedAt,
        };
      },
    );


  /*
   * Il budget personale viene ricavato
   * dagli acquisti della nostra squadra.
   */
  const personalSpending =
    purchases
      .filter(
        (purchase) =>
          purchase.ownerType === "ME",
      )
      .reduce(
        (
          total,
          purchase,
        ) =>
          total +
          purchase.purchasePrice,
        0,
      );


  const opponentTeams =
    apiSession.teams.filter(
      (team) =>
        !team.isUserTeam,
    );


  /*
   * Consideriamo l'elenco preconfigurato
   * soltanto quando sono presenti
   * tutti gli avversari previsti.
   *
   * In caso contrario manteniamo
   * l'inserimento manuale.
   */
  const hasCompleteOpponentList =
    opponentTeams.length ===
    apiSession.participants - 1;


  return {
    id:
      apiSession.id,

    config: {
      leagueName:
        apiSession.leagueName,

      participants:
        apiSession.participants,

      startingBudget:
        apiSession.startingBudget,

      minimumBid:
        apiSession.minimumBid,

      rosterSlots: {
        ...apiSession.rosterSlots,
      },

      budgetDistribution: {
        ...apiSession
          .budgetDistribution,
      },

      auctionMode:
        apiSession.auctionMode,

      /*
       * Strategia e regole salvate
       * per questa specifica asta.
       */
      budgetStrategy:
        apiSession.budgetStrategy,

      leagueRules:
        apiSession.leagueRules,

      opponentTeamNames:
        hasCompleteOpponentList
          ? opponentTeams.map(
            (team) =>
              team.name,
          )
          : [],
    },

    remainingBudget:
      Math.max(
        apiSession.startingBudget -
        personalSpending,
        0,
      ),

    purchases,

    isStarted: true,
  };
}


/*
 * Gestisce lo stato completo
 * di una sessione d'asta.
 */
export function useAuctionSession() {
  const {
    user,
    isAuthReady,
  } = useAuth();


  const [
    session,
    setSession,
  ] = useState<AuctionSession | null>(
    null,
  );


  /*
   * Indica se abbiamo terminato
   * il recupero iniziale dal backend.
   */
  const [
    isStorageReady,
    setIsStorageReady,
  ] = useState(false);


  /*
   * Errore generale mostrato nella pagina.
   */
  const [
    actionError,
    setActionError,
  ] = useState<string | null>(null);


  /*
 * Recupera la sessione d'asta soltanto
 * dopo aver verificato l'account.
 */
  useEffect(() => {
    /*
     * Attendiamo che AuthProvider termini
     * il controllo iniziale del cookie.
     */
    if (!isAuthReady) {
      return;
    }

    /*
     * Un visitatore non autenticato
     * non deve interrogare gli endpoint
     * protetti delle aste.
     */
    if (!user) {
      setSession(null);
      setActionError(null);
      setIsStorageReady(true);

      return;
    }

    let isEffectActive = true;

    async function restoreSession() {
      setIsStorageReady(false);
      setActionError(null);
      setSession(null);

      /*
       * Eliminiamo il vecchio salvataggio
       * completo usato prima del database.
       */
      window.localStorage.removeItem(
        LEGACY_AUCTION_STORAGE_KEY,
      );

      const storedSessionId =
        window.localStorage.getItem(
          AUCTION_SESSION_ID_KEY,
        );

      if (!storedSessionId) {
        if (isEffectActive) {
          setIsStorageReady(true);
        }

        return;
      }

      try {
        const apiSession =
          await fetchAuctionSessionById(
            storedSessionId,
          );

        if (!isEffectActive) {
          return;
        }

        setSession(
          mapApiSessionToAuctionSession(
            apiSession,
          ),
        );
      } catch (error) {
        if (!isEffectActive) {
          return;
        }

        /*
         * Un 404 indica che la sessione
         * non esiste oppure appartiene
         * a un altro account.
         */
        if (
          error instanceof ApiRequestError
          && error.status === 404
        ) {
          window.localStorage.removeItem(
            AUCTION_SESSION_ID_KEY,
          );

          setSession(null);

          return;
        }

        /*
         * Può verificarsi quando il cookie
         * scade mentre la pagina è aperta.
         */
        if (
          error instanceof ApiRequestError
          && error.status === 401
        ) {
          setSession(null);

          setActionError(
            "La sessione di accesso è scaduta. "
            + "Effettua nuovamente il login.",
          );

          return;
        }

        setActionError(
          getErrorMessage(error),
        );
      } finally {
        if (isEffectActive) {
          setIsStorageReady(true);
        }
      }
    }

    void restoreSession();

    return () => {
      isEffectActive = false;
    };
  }, [
    isAuthReady,
    user,
  ]);


  /*
   * Crea una nuova sessione
   * nel database PostgreSQL.
   */
  async function startAuction(
    config: AuctionConfig,
  ): Promise<void> {
    setActionError(null);

    try {
      const apiSession =
        await createAuctionSession(
          cloneAuctionConfig(config),
        );

      const newSession =
        mapApiSessionToAuctionSession(
          apiSession,
        );

      setSession(newSession);

      window.localStorage.setItem(
        AUCTION_SESSION_ID_KEY,
        newSession.id,
      );
    } catch (error) {
      setActionError(
        getErrorMessage(error),
      );
    }
  }


  /*
   * Elimina definitivamente la sessione
   * dal database e dal browser.
   */
  async function resetAuction(
  ): Promise<void> {
    setActionError(null);

    if (!session) {
      window.localStorage.removeItem(
        AUCTION_SESSION_ID_KEY,
      );

      return;
    }

    try {
      await deleteAuctionSession(
        session.id,
      );

      setSession(null);

      window.localStorage.removeItem(
        AUCTION_SESSION_ID_KEY,
      );
    } catch (error) {
      /*
       * Se la sessione era già stata eliminata,
       * ripuliamo comunque lo stato locale.
       */
      if (
        error instanceof ApiRequestError &&
        error.status === 404
      ) {
        setSession(null);

        window.localStorage.removeItem(
          AUCTION_SESSION_ID_KEY,
        );

        return;
      }

      setActionError(
        getErrorMessage(error),
      );
    }
  }


  /*
   * Acquisti appartenenti all'utente.
   */
  const myPurchases = useMemo(() => {
    return (
      session?.purchases.filter(
        (purchase) =>
          purchase.ownerType === "ME",
      ) ?? []
    );
  }, [session]);


  /*
   * Acquisti appartenenti agli avversari.
   */
  const opponentPurchases =
    useMemo(() => {
      return (
        session?.purchases.filter(
          (purchase) =>
            purchase.ownerType ===
            "OPPONENT",
        ) ?? []
      );
    }, [session]);


  /*
   * Spesa personale per ruolo.
   */
  const spentByRole = useMemo(() => {
    const result: Record<
      AuctionRole,
      number
    > = {
      ...EMPTY_ROLE_VALUES,
    };

    myPurchases.forEach(
      (purchase) => {
        result[purchase.role] +=
          purchase.purchasePrice;
      },
    );

    return result;
  }, [myPurchases]);


  /*
   * Giocatori personali acquistati
   * per ciascun ruolo.
   */
  const purchasedByRole =
    useMemo(() => {
      const result: Record<
        AuctionRole,
        number
      > = {
        ...EMPTY_ROLE_VALUES,
      };

      myPurchases.forEach(
        (purchase) => {
          result[purchase.role] += 1;
        },
      );

      return result;
    }, [myPurchases]);


  /*
   * Slot personali ancora disponibili.
   */
  const remainingSlots =
    useMemo(() => {
      if (!session) {
        return {
          ...EMPTY_ROLE_VALUES,
        };
      }

      return {
        P: Math.max(
          session.config.rosterSlots.P -
          purchasedByRole.P,
          0,
        ),

        D: Math.max(
          session.config.rosterSlots.D -
          purchasedByRole.D,
          0,
        ),

        C: Math.max(
          session.config.rosterSlots.C -
          purchasedByRole.C,
          0,
        ),

        A: Math.max(
          session.config.rosterSlots.A -
          purchasedByRole.A,
          0,
        ),
      };
    }, [
      session,
      purchasedByRole,
    ]);


  /*
   * Budget dinamico dei ruoli.
   */
  const dynamicRoleBudgets =
    useMemo(() => {
      if (!session) {
        return {
          ...EMPTY_ROLE_VALUES,
        };
      }

      return calculateDynamicRoleBudgets(
        session.config,
        session.remainingBudget,
        remainingSlots,
        spentByRole,
        myPurchases,
      );
    }, [
      session,
      remainingSlots,
      spentByRole,
      myPurchases,
    ]);


  /*
   * Numero totale di slot liberi.
   */
  const totalRemainingSlots =
    useMemo(() => {
      return (
        remainingSlots.P +
        remainingSlots.D +
        remainingSlots.C +
        remainingSlots.A
      );
    }, [remainingSlots]);


  /*
   * Offerta personale massima.
   */
  const maximumBid = useMemo(() => {
    if (
      !session ||
      totalRemainingSlots <= 0
    ) {
      return 0;
    }

    const slotsAfterNextPurchase =
      Math.max(
        totalRemainingSlots - 1,
        0,
      );

    const creditsToReserve =
      slotsAfterNextPurchase *
      session.config.minimumBid;

    return Math.max(
      session.remainingBudget -
      creditsToReserve,
      0,
    );
  }, [
    session,
    totalRemainingSlots,
  ]);


  /*
   * Registra un acquisto nel database.
   *
   * null indica che l'operazione
   * è stata completata correttamente.
   */
  async function registerPurchase(
    purchase: AuctionPurchase,
  ): Promise<string | null> {
    if (!session) {
      return (
        "Non esiste una sessione "
        + "d'asta attiva."
      );
    }

    setActionError(null);

    /*
     * Controllo immediato per evitare
     * una richiesta chiaramente inutile.
     */
    const isAlreadyPurchased =
      session.purchases.some(
        (currentPurchase) =>
          currentPurchase.playerId ===
          purchase.playerId,
      );

    if (isAlreadyPurchased) {
      return (
        "Questo giocatore è già "
        + "stato acquistato."
      );
    }

    if (
      purchase.ownerType ===
      "OPPONENT" &&
      (
        !purchase.ownerName ||
        purchase.ownerName.trim() === ""
      )
    ) {
      return (
        "Inserisci il nome della "
        + "squadra avversaria."
      );
    }

    if (
      !Number.isInteger(
        purchase.purchasePrice,
      ) ||
      purchase.purchasePrice <
      session.config.minimumBid
    ) {
      return (
        `Il prezzo deve essere almeno `
        + `${session.config.minimumBid} crediti.`
      );
    }

    /*
     * Manteniamo i controlli personali
     * anche nel frontend per mostrare
     * immediatamente gli errori.
     */
    if (purchase.ownerType === "ME") {
      if (
        purchase.purchasePrice >
        session.remainingBudget
      ) {
        return (
          "Il prezzo supera "
          + "il budget residuo."
        );
      }

      if (
        remainingSlots[
        purchase.role
        ] <= 0
      ) {
        return (
          "Non ci sono più slot "
          + "disponibili per questo ruolo."
        );
      }

      if (
        purchase.purchasePrice >
        maximumBid
      ) {
        return (
          `Puoi spendere al massimo `
          + `${maximumBid} crediti.`
        );
      }
    }

    try {
      const apiSession =
        await createAuctionPurchase(
          session.id,
          purchase,
        );

      setSession(
        mapApiSessionToAuctionSession(
          apiSession,
        ),
      );

      return null;
    } catch (error) {
      return getErrorMessage(error);
    }
  }


  /*
   * Elimina un acquisto dal database.
   */
  async function removePurchase(
    playerId: number,
  ): Promise<void> {
    if (!session) {
      return;
    }

    setActionError(null);

    try {
      const apiSession =
        await deleteAuctionPurchase(
          session.id,
          playerId,
        );

      setSession(
        mapApiSessionToAuctionSession(
          apiSession,
        ),
      );
    } catch (error) {
      setActionError(
        getErrorMessage(error),
      );
    }
  }


  return {
    session,
    isStorageReady,
    actionError,

    myPurchases,
    opponentPurchases,

    spentByRole,
    purchasedByRole,
    remainingSlots,
    dynamicRoleBudgets,
    maximumBid,

    startAuction,
    resetAuction,
    registerPurchase,
    removePurchase,
  };
}