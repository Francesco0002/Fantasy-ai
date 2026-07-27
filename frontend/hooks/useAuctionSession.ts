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
        /*
        * Le vecchie sessioni non possiedono
        * ancora ownerType.
        *
        * Tutti gli acquisti già salvati vengono
        * considerati acquisti dell'utente.
        */
        const restoredPurchases =
          parsedSession.purchases.map(
            (purchase) => ({
              ...purchase,

              ownerType:
                purchase.ownerType ??
                "ME",
            }),
          );

        const restoredSession: AuctionSession = {
          ...parsedSession,

          purchases: restoredPurchases,

          config: {
            ...parsedSession.config,

            auctionMode:
              parsedSession.config
                .auctionMode ??
              "ROLE_BY_ROLE",
          },
        };

        setSession(restoredSession);
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
  * Giocatori acquistati dall'utente.
  *
  * Solamente questi acquisti modificano:
  * - budget;
  * - slot;
  * - rosa personale;
  * - budget dinamici dei ruoli.
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
   * Giocatori acquistati dagli avversari.
   *
   * Questi acquisti influenzano il mercato,
   * ma non la nostra situazione economica.
   */
  const opponentPurchases = useMemo(() => {
    return (
      session?.purchases.filter(
        (purchase) =>
          purchase.ownerType ===
          "OPPONENT",
      ) ?? []
    );
  }, [session]);


  /*
  * Calcola quanto abbiamo speso
  * personalmente per ciascun ruolo.
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
  * Calcola quanti giocatori abbiamo
  * acquistato personalmente per ruolo.
  */
  const purchasedByRole = useMemo(() => {
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
        myPurchases,
      );
    }, [
      session,
      remainingSlots,
      spentByRole,
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
  * Registra un acquisto effettuato
  * dall'utente oppure da un avversario.
  */
  function registerPurchase(
    purchase: AuctionPurchase,
  ): string | null {
    if (!session) {
      return "Non esiste una sessione d'asta attiva.";
    }

    /*
     * Un giocatore non può essere assegnato
     * a più squadre nella stessa asta.
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
     * Verifichiamo che il proprietario
     * abbia un valore valido.
     */
    if (
      purchase.ownerType !== "ME" &&
      purchase.ownerType !== "OPPONENT"
    ) {
      return "Tipo di acquisto non valido.";
    }

    /*
    * Per gli acquisti avversari è necessario
    * indicare la squadra proprietaria.
    */
    if (
      purchase.ownerType === "OPPONENT" &&
      (
        !purchase.ownerName ||
        purchase.ownerName.trim() === ""
      )
    ) {
      return "Inserisci il nome della squadra avversaria.";
    }

    /*
     * Il prezzo deve essere intero
     * e rispettare l'offerta minima.
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

    const isMyPurchase =
      purchase.ownerType === "ME";

    /*
     * I vincoli personali vengono applicati
     * soltanto ai nostri acquisti.
     */
    if (isMyPurchase) {
      if (
        purchase.purchasePrice >
        session.remainingBudget
      ) {
        return "Il prezzo supera il budget residuo.";
      }

      if (
        remainingSlots[purchase.role] <= 0
      ) {
        return "Non ci sono più slot disponibili per questo ruolo.";
      }

      if (
        purchase.purchasePrice >
        maximumBid
      ) {
        return `Puoi spendere al massimo ${maximumBid} crediti, altrimenti non riusciresti a completare la rosa.`;
      }
    }

    /*
     * Gli acquisti avversari vengono salvati,
     * ma non modificano il nostro budget.
     */
    setSession((currentSession) => {
      if (!currentSession) {
        return currentSession;
      }

      return {
        ...currentSession,

        remainingBudget:
          isMyPurchase
            ? currentSession
              .remainingBudget -
            purchase.purchasePrice
            : currentSession
              .remainingBudget,

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

        /*
        * Il rimborso avviene soltanto
        * se il giocatore apparteneva a noi.
        */
        remainingBudget:
          purchaseToRemove.ownerType === "ME"
            ? currentSession.remainingBudget +
            purchaseToRemove.purchasePrice
            : currentSession.remainingBudget,

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

    myPurchases,
    opponentPurchases,

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