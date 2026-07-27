"use client";

/*
 * Calcolo della distribuzione dinamica
 * del budget tra i ruoli incompleti.
 */
import {
  calculateDynamicRoleBudgets,
} from "../lib/auction-budget";

/*
 * Hook React utilizzati per conservare
 * la sessione d'asta e calcolare dati derivati.
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


/*
 * Nome utilizzato per salvare la sessione
 * nella memoria locale del browser.
 *
 * La versione finale permette di cambiare
 * struttura in futuro senza confondere
 * i vecchi dati con quelli nuovi.
 */
const AUCTION_STORAGE_KEY =
  "fantasy-ai-auction-session-v1";


/*
 * Valore vuoto utilizzato quando
 * non esiste ancora una sessione.
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
 * Controlla che un valore recuperato
 * dal browser abbia almeno la struttura
 * principale di una sessione d'asta.
 */
function isStoredAuctionSession(
  value: unknown,
): value is AuctionSession {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  const candidate =
    value as Partial<AuctionSession>;

  return (
    candidate.isStarted === true &&
    typeof candidate.remainingBudget ===
    "number" &&
    Number.isFinite(
      candidate.remainingBudget,
    ) &&
    Array.isArray(candidate.purchases) &&
    typeof candidate.config === "object" &&
    candidate.config !== null
  );
}


/*
 * Crea una copia indipendente
 * della configurazione dell'asta.
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
  };
}


/*
 * Gestisce lo stato completo
 * di una sessione d'asta.
 */
export function useAuctionSession() {
  /*
   * null indica che l'asta
   * non è ancora stata avviata.
   */
  const [session, setSession] =
    useState<AuctionSession | null>(null);

  /*
  * Indica se abbiamo già controllato
  * la memoria locale del browser.
  *
  * Serve a evitare che la pagina mostri
  * temporaneamente il modulo iniziale
  * prima di recuperare una sessione salvata.
  */
  const [
    isStorageReady,
    setIsStorageReady,
  ] = useState(false);

  /*
  * Recupera l'eventuale sessione salvata
  * quando la pagina viene aperta.
  */
  useEffect(() => {
    try {
      const storedSession =
        window.localStorage.getItem(
          AUCTION_STORAGE_KEY,
        );

      /*
       * Nessuna sessione precedentemente salvata.
       */
      if (!storedSession) {
        return;
      }

      const parsedSession: unknown =
        JSON.parse(storedSession);

      /*
       * Ripristiniamo solamente dati
       * con una struttura valida.
       */
      if (
        isStoredAuctionSession(
          parsedSession,
        )
      ) {
        setSession(parsedSession);
      } else {
        /*
         * Eliminiamo eventuali dati corrotti.
         */
        window.localStorage.removeItem(
          AUCTION_STORAGE_KEY,
        );
      }
    } catch (storageError) {
      /*
       * Un JSON danneggiato non deve
       * bloccare il funzionamento del sito.
       */
      console.error(
        "Impossibile recuperare la sessione d'asta:",
        storageError,
      );

      window.localStorage.removeItem(
        AUCTION_STORAGE_KEY,
      );
    } finally {
      setIsStorageReady(true);
    }
  }, []);

  /*
  * Salva automaticamente la sessione
  * ogni volta che budget, rosa o acquisti cambiano.
  */
  useEffect(() => {
    /*
     * Non salviamo nulla prima di aver
     * controllato i dati già presenti.
     */
    if (!isStorageReady) {
      return;
    }

    try {
      if (session) {
        window.localStorage.setItem(
          AUCTION_STORAGE_KEY,
          JSON.stringify(session),
        );
      } else {
        /*
         * Quando la sessione viene terminata,
         * eliminiamo anche il salvataggio.
         */
        window.localStorage.removeItem(
          AUCTION_STORAGE_KEY,
        );
      }
    } catch (storageError) {
      console.error(
        "Impossibile salvare la sessione d'asta:",
        storageError,
      );
    }
  }, [session, isStorageReady]);

  /*
   * Avvia una nuova sessione d'asta.
   */
  function startAuction(
    config: AuctionConfig,
  ) {
    const clonedConfig =
      cloneAuctionConfig(config);

    setSession({
      config: clonedConfig,
      remainingBudget:
        clonedConfig.startingBudget,
      purchases: [],
      isStarted: true,
    });
  }


  /*
   * Termina e cancella la sessione corrente.
   *
   * Per ora i dati vengono rimossi
   * solamente dalla memoria del browser.
   */
  function resetAuction() {
    setSession(null);
  }


  /*
   * Calcola quanto è stato speso
   * per ciascun ruolo.
   */
  const spentByRole = useMemo(() => {
    if (!session) {
      return {
        ...EMPTY_ROLE_VALUES,
      };
    }

    const result: Record<
      AuctionRole,
      number
    > = {
      ...EMPTY_ROLE_VALUES,
    };

    session.purchases.forEach(
      (purchase) => {
        result[purchase.role] +=
          purchase.purchasePrice;
      },
    );

    return result;
  }, [session]);


  /*
   * Calcola quanti giocatori sono stati
   * acquistati per ciascun ruolo.
   */
  const purchasedByRole = useMemo(() => {
    if (!session) {
      return {
        ...EMPTY_ROLE_VALUES,
      };
    }

    const result: Record<
      AuctionRole,
      number
    > = {
      ...EMPTY_ROLE_VALUES,
    };

    session.purchases.forEach(
      (purchase) => {
        result[purchase.role] += 1;
      },
    );

    return result;
  }, [session]);


  /*
   * Calcola quanti slot rimangono
   * disponibili per ciascun ruolo.
   */
  const remainingSlots = useMemo(() => {
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
  }, [session, purchasedByRole]);


  /*
  * Budget attualmente consigliato
  * per ogni ruolo.
  *
  * Si aggiorna automaticamente dopo
  * acquisti, annullamenti e completamenti.
  */
  const dynamicRoleBudgets =
    useMemo(() => {
      if (!session) {
        return {
          P: 0,
          D: 0,
          C: 0,
          A: 0,
        };
      }

      return calculateDynamicRoleBudgets(
        session.config,
        session.remainingBudget,
        remainingSlots,
        spentByRole,
      );
    }, [
      session,
      remainingSlots,
    ]);


  /*
  * Numero complessivo di slot
  * ancora da completare.
  */
  const totalRemainingSlots = useMemo(() => {
    return (
      remainingSlots.P +
      remainingSlots.D +
      remainingSlots.C +
      remainingSlots.A
    );
  }, [remainingSlots]);


  /*
   * Calcola quanto si può spendere al massimo
   * sul prossimo giocatore.
   *
   * Conserviamo l'offerta minima necessaria
   * per tutti gli altri slot ancora liberi.
   *
   * Esempio:
   * - budget residuo: 100;
   * - slot ancora liberi: 5;
   * - offerta minima: 1.
   *
   * Per gli altri 4 slot dobbiamo conservare
   * almeno 4 crediti, quindi possiamo spendere 96.
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
  }, [session, totalRemainingSlots]);


  /*
   * Registra un nuovo acquisto.
   *
   * Restituisce:
   * - null quando l'acquisto è valido;
   * - un messaggio quando non può essere registrato.
   */
  function registerPurchase(
    purchase: AuctionPurchase,
  ): string | null {
    if (!session) {
      return "Non esiste una sessione d'asta attiva.";
    }

    /*
     * Un giocatore non può essere acquistato
     * più di una volta nella stessa sessione.
     */
    const isAlreadyPurchased =
      session.purchases.some(
        (currentPurchase) =>
          currentPurchase.playerId ===
          purchase.playerId,
      );

    if (isAlreadyPurchased) {
      return "Questo giocatore è già stato acquistato.";
    }

    /*
     * Il prezzo deve essere un numero intero
     * almeno uguale all'offerta minima.
     */
    if (
      !Number.isInteger(
        purchase.purchasePrice,
      ) ||
      purchase.purchasePrice <
      session.config.minimumBid
    ) {
      return `Il prezzo deve essere almeno ${session.config.minimumBid} crediti.`;
    }

    /*
     * Non si può superare
     * il budget ancora disponibile.
     */
    if (
      purchase.purchasePrice >
      session.remainingBudget
    ) {
      return "Il prezzo supera il budget residuo.";
    }

    /*
     * Controlliamo che esista ancora
     * uno slot libero per il ruolo.
     */
    if (
      remainingSlots[purchase.role] <= 0
    ) {
      return "Non ci sono più slot disponibili per questo ruolo.";
    }

    /*
    * Impediamo di spendere i crediti
    * necessari per completare gli altri slot.
    */
    if (
      purchase.purchasePrice >
      maximumBid
    ) {
      return `Puoi spendere al massimo ${maximumBid} crediti, altrimenti non riusciresti a completare la rosa.`;
    }

    /*
     * Aggiorniamo sessione, budget e acquisti.
     */
    setSession((currentSession) => {
      if (!currentSession) {
        return currentSession;
      }

      return {
        ...currentSession,

        remainingBudget:
          currentSession.remainingBudget -
          purchase.purchasePrice,

        purchases: [
          ...currentSession.purchases,
          purchase,
        ],
      };
    });

    return null;
  }


  /*
   * Rimuove un acquisto registrato.
   *
   * Il prezzo viene restituito
   * al budget residuo.
   */
  function removePurchase(
    playerId: number,
  ) {
    setSession((currentSession) => {
      if (!currentSession) {
        return currentSession;
      }

      const purchaseToRemove =
        currentSession.purchases.find(
          (purchase) =>
            purchase.playerId ===
            playerId,
        );

      if (!purchaseToRemove) {
        return currentSession;
      }

      return {
        ...currentSession,

        remainingBudget:
          currentSession.remainingBudget +
          purchaseToRemove.purchasePrice,

        purchases:
          currentSession.purchases.filter(
            (purchase) =>
              purchase.playerId !==
              playerId,
          ),
      };
    });
  }


  return {
    session,
    isStorageReady,

    /*
     * Dati calcolati.
     */
    spentByRole,
    purchasedByRole,
    remainingSlots,
    dynamicRoleBudgets,
    maximumBid,

    /*
     * Azioni disponibili.
     */
    startAuction,
    resetAuction,
    registerPurchase,
    removePurchase,
  };
}