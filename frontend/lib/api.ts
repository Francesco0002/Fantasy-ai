import {
  getLeagueRules,
} from "./auction-config";


/*
 * Tipi utilizzati per descrivere
 * i dati ricevuti dal backend.
 */
import type {
  Player,
  PlayersResponse,
  Role,
} from "../types/player";

import type {
  AuctionConfig,
  AuctionPurchase,
} from "../types/auction";


/*
 * Indirizzo del backend FastAPI.
 *
 * In produzione viene letto dalla variabile
 * NEXT_PUBLIC_API_URL configurata su Vercel.
 *
 * In locale utilizziamo l'indirizzo predefinito.
 */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8000";


/*
 * Errore prodotto quando il backend
 * restituisce una risposta HTTP non valida.
 *
 * Conserviamo anche il codice HTTP,
 * così il frontend può distinguere
 * per esempio un 404 da un errore 500.
 */
export class ApiRequestError extends Error {
  readonly status: number;

  constructor(
    message: string,
    status: number,
  ) {
    super(message);

    this.name = "ApiRequestError";
    this.status = status;
  }
}


/*
 * Struttura utilizzata da FastAPI
 * per restituire gli errori.
 */
type BackendErrorResponse = {
  detail?:
  | string
  | {
    msg?: string;
  }[];
};


/*
 * Estrae un messaggio leggibile
 * dalla risposta di errore del backend.
 */
async function createApiRequestError(
  response: Response,
): Promise<ApiRequestError> {
  let message =
    `Il backend ha restituito l'errore ${response.status}.`;

  try {
    const errorData =
      await response.json() as BackendErrorResponse;

    if (
      typeof errorData.detail ===
      "string"
    ) {
      message = errorData.detail;
    } else if (
      Array.isArray(errorData.detail)
    ) {
      const validationMessages =
        errorData.detail
          .map(
            (errorItem) =>
              errorItem.msg,
          )
          .filter(
            (
              errorMessage,
            ): errorMessage is string =>
              typeof errorMessage ===
              "string",
          );

      if (
        validationMessages.length > 0
      ) {
        message =
          validationMessages.join(" ");
      }
    }
  } catch {
    /*
     * Alcune risposte potrebbero
     * non contenere JSON.
     *
     * In quel caso manteniamo
     * il messaggio generico.
     */
  }

  return new ApiRequestError(
    message,
    response.status,
  );
}


/*
 * Parametri accettati dalla funzione
 * che recupera i giocatori.
 */
type FetchPlayersOptions = {
  role: Role;
  search: string;
  limit?: number;
  signal?: AbortSignal;
};


/*
 * Recupera l'elenco dei giocatori dal backend.
 */
export async function fetchPlayers({
  role,
  search,
  limit = 100,
  signal,
}: FetchPlayersOptions): Promise<PlayersResponse> {
  const params = new URLSearchParams();

  params.set(
    "limit",
    limit.toString(),
  );

  if (role !== "") {
    params.set("role", role);
  }

  const cleanedSearch =
    search.trim();

  if (cleanedSearch !== "") {
    params.set(
      "search",
      cleanedSearch,
    );
  }

  const response = await fetch(
    `${API_URL}/players?${params.toString()}`,
    {
      signal,
    },
  );

  if (!response.ok) {
    throw await createApiRequestError(
      response,
    );
  }

  const data: PlayersResponse =
    await response.json();

  return data;
}


/*
 * Recupera un singolo giocatore
 * utilizzando il suo identificativo.
 */
export async function fetchPlayerById(
  playerId: number,
  signal?: AbortSignal,
): Promise<Player> {
  const response = await fetch(
    `${API_URL}/players/${playerId}`,
    {
      signal,
    },
  );

  if (!response.ok) {
    throw await createApiRequestError(
      response,
    );
  }

  const player: Player =
    await response.json();

  return player;
}


/*
 * Squadra restituita dal backend
 * insieme alla sessione d'asta.
 */
export type AuctionTeamApiResponse = {
  id: string;
  name: string;
  isUserTeam: boolean;
  createdAt: string;
};


/*
 * Acquisto restituito dal backend.
 */
export type AuctionPurchaseApiResponse = {
  id: string;
  teamId: string;

  playerId: number;
  playerName: string;
  playerTeam: string;

  role: AuctionPurchase["role"];
  purchasePrice: number;

  baseRecommendedPriceAtPurchase:
  number | null;

  dynamicRecommendedPriceAtPurchase:
  number | null;

  purchasedAt: string;
};


/*
 * Sessione completa restituita
 * dagli endpoint FastAPI.
 */
export type AuctionSessionApiResponse = {
  id: string;

  leagueName: string;
  participants: number;

  startingBudget: number;
  minimumBid: number;

  rosterSlots:
  AuctionConfig["rosterSlots"];

  budgetDistribution:
  AuctionConfig["budgetDistribution"];

  auctionMode:
  AuctionConfig["auctionMode"];

  budgetStrategy: NonNullable<
    AuctionConfig["budgetStrategy"]
  >;

  leagueRules: NonNullable<
    AuctionConfig["leagueRules"]
  >;

  status: string;

  createdAt: string;
  updatedAt: string;

  teams: AuctionTeamApiResponse[];

  purchases:
  AuctionPurchaseApiResponse[];
};


/*
 * Crea una nuova sessione d'asta
 * nel database PostgreSQL.
 */
export async function createAuctionSession(
  config: AuctionConfig,
): Promise<AuctionSessionApiResponse> {
  const response = await fetch(
    `${API_URL}/auction-sessions`,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        leagueName:
          config.leagueName,

        participants:
          config.participants,

        startingBudget:
          config.startingBudget,

        minimumBid:
          config.minimumBid,

        rosterSlots:
          config.rosterSlots,

        budgetDistribution:
          config.budgetDistribution,

        auctionMode:
          config.auctionMode,

        /*
         * Strategia di distribuzione
         * selezionata durante la configurazione.
         */
        budgetStrategy:
          config.budgetStrategy ??
          "AUTOMATIC",

        /*
         * Bonus, malus e modificatori
         * impostati dall'utente.
         */
        leagueRules:
          getLeagueRules(config),

        /*
         * Per ora non chiediamo all'utente
         * il nome della propria squadra.
         */
        userTeamName:
          "La mia squadra",

        opponentTeamNames:
          config.opponentTeamNames ??
          [],
      }),
    },
  );

  if (!response.ok) {
    throw await createApiRequestError(
      response,
    );
  }

  const data: AuctionSessionApiResponse =
    await response.json();

  return data;
}


/*
 * Recupera una sessione esistente
 * utilizzando il relativo UUID.
 */
export async function fetchAuctionSessionById(
  sessionId: string,
): Promise<AuctionSessionApiResponse> {
  const response = await fetch(
    `${API_URL}/auction-sessions/${encodeURIComponent(
      sessionId,
    )}`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw await createApiRequestError(
      response,
    );
  }

  const data: AuctionSessionApiResponse =
    await response.json();

  return data;
}


/*
 * Registra un acquisto nel database.
 *
 * Il backend restituisce la sessione
 * completa e aggiornata.
 */
export async function createAuctionPurchase(
  sessionId: string,
  purchase: AuctionPurchase,
): Promise<AuctionSessionApiResponse> {
  const response = await fetch(
    `${API_URL}/auction-sessions/${encodeURIComponent(
      sessionId,
    )}/purchases`,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        playerId:
          purchase.playerId,

        playerName:
          purchase.playerName,

        /*
         * Nel tipo frontend "team"
         * rappresenta la squadra reale
         * del calciatore.
         */
        team:
          purchase.team,

        role:
          purchase.role,

        purchasePrice:
          purchase.purchasePrice,

        ownerType:
          purchase.ownerType,

        ownerName:
          purchase.ownerName ??
          null,

        baseRecommendedPriceAtPurchase:
          purchase
            .baseRecommendedPriceAtPurchase ??
          null,

        dynamicRecommendedPriceAtPurchase:
          purchase
            .dynamicRecommendedPriceAtPurchase ??
          null,
      }),
    },
  );

  if (!response.ok) {
    throw await createApiRequestError(
      response,
    );
  }

  const data: AuctionSessionApiResponse =
    await response.json();

  return data;
}


/*
 * Elimina un acquisto usando
 * l'identificativo del giocatore.
 */
export async function deleteAuctionPurchase(
  sessionId: string,
  playerId: number,
): Promise<AuctionSessionApiResponse> {
  const response = await fetch(
    `${API_URL}/auction-sessions/${encodeURIComponent(
      sessionId,
    )}/purchases/${playerId}`,
    {
      method: "DELETE",
    },
  );

  if (!response.ok) {
    throw await createApiRequestError(
      response,
    );
  }

  const data: AuctionSessionApiResponse =
    await response.json();

  return data;
}


/*
 * Elimina definitivamente
 * un'intera sessione d'asta.
 */
export async function deleteAuctionSession(
  sessionId: string,
): Promise<void> {
  const response = await fetch(
    `${API_URL}/auction-sessions/${encodeURIComponent(
      sessionId,
    )}`,
    {
      method: "DELETE",
    },
  );

  if (!response.ok) {
    throw await createApiRequestError(
      response,
    );
  }
}