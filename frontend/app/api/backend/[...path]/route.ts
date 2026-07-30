import type {
  NextRequest,
} from "next/server";


/*
 * Il proxy utilizza il runtime Node.js
 * perché comunica con il backend FastAPI
 * e deve inoltrare correttamente i cookie.
 */
export const runtime = "nodejs";


/*
 * Le risposte autenticate non devono
 * essere memorizzate nella cache.
 */
export const dynamic =
  "force-dynamic";


/*
 * Operazioni che modificano dati
 * e che richiedono il controllo Origin.
 */
const UNSAFE_METHODS = new Set([
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
]);


/*
 * Recupera l'indirizzo privato
 * del backend configurato sul server.
 */
function getBackendApiUrl(): string {
  const backendApiUrl =
    process.env.BACKEND_API_URL
      ?.trim()
      .replace(
        /\/+$/,
        "",
      );

  if (!backendApiUrl) {
    throw new Error(
      "BACKEND_API_URL non è configurata.",
    );
  }

  return backendApiUrl;
}


/*
 * Blocca richieste di modifica provenienti
 * da un sito diverso dal frontend corrente.
 *
 * Questo costituisce la prima protezione
 * contro richieste CSRF.
 */
function validateRequestOrigin(
  request: NextRequest,
): Response | null {
  if (
    !UNSAFE_METHODS.has(
      request.method,
    )
  ) {
    return null;
  }

  const requestOrigin =
    request.headers.get(
      "origin",
    );

  const expectedOrigin =
    request.nextUrl.origin;

  if (
    requestOrigin !==
    expectedOrigin
  ) {
    return Response.json(
      {
        detail:
          "Origine della richiesta non valida.",
      },
      {
        status: 403,
      },
    );
  }

  return null;
}


/*
 * Copia gli header della risposta FastAPI
 * eliminando quelli gestiti automaticamente
 * dal server Next.js.
 */
function createResponseHeaders(
  upstreamResponse: Response,
): Headers {
  const responseHeaders =
    new Headers();

  const excludedHeaders =
    new Set([
      "connection",
      "content-encoding",
      "content-length",
      "set-cookie",
      "transfer-encoding",
    ]);

  upstreamResponse.headers.forEach(
    (
      value,
      key,
    ) => {
      if (
        excludedHeaders.has(
          key.toLowerCase(),
        )
      ) {
        return;
      }

      responseHeaders.append(
        key,
        value,
      );
    },
  );

  /*
   * Set-Cookie deve essere gestito
   * separatamente perché possono esserci
   * più cookie nella stessa risposta.
   */
  const cookies =
    upstreamResponse
      .headers
      .getSetCookie();

  cookies.forEach(
    (cookie) => {
      responseHeaders.append(
        "set-cookie",
        cookie,
      );
    },
  );

  return responseHeaders;
}


/*
 * Inoltra una richiesta del browser
 * al backend FastAPI su Render.
 */
async function proxyRequest(
  request: NextRequest,
): Promise<Response> {
  const originError =
    validateRequestOrigin(
      request,
    );

  if (originError) {
    return originError;
  }

  const backendPath =
    request.nextUrl.pathname.replace(
      /^\/api\/backend/,
      "",
    );

  const targetUrl = new URL(
    (
      getBackendApiUrl()
      + (
        backendPath ||
        "/"
      )
    ),
  );

  targetUrl.search =
    request.nextUrl.search;


  /*
   * Inoltriamo cookie, Content-Type
   * e gli altri header utili.
   */
  const requestHeaders =
    new Headers(
      request.headers,
    );

  requestHeaders.delete(
    "host",
  );

  requestHeaders.delete(
    "content-length",
  );

  requestHeaders.delete(
    "connection",
  );

  /*
   * Evita problemi dovuti alla
   * decompressione automatica del fetch.
   */
  requestHeaders.set(
    "accept-encoding",
    "identity",
  );


  let requestBody:
    ArrayBuffer | undefined;

  if (
    request.method !== "GET"
    && request.method !== "HEAD"
  ) {
    const bodyBuffer =
      await request.arrayBuffer();

    if (
      bodyBuffer.byteLength > 0
    ) {
      requestBody =
        bodyBuffer;
    }
  }


  try {
    const upstreamResponse =
      await fetch(
        targetUrl,
        {
          method:
            request.method,

          headers:
            requestHeaders,

          body:
            requestBody,

          cache:
            "no-store",

          redirect:
            "manual",

          signal:
            request.signal,
        },
      );

    return new Response(
      upstreamResponse.body,
      {
        status:
          upstreamResponse.status,

        statusText:
          upstreamResponse.statusText,

        headers:
          createResponseHeaders(
            upstreamResponse,
          ),
      },
    );
  } catch (error) {
    console.error(
      "Errore proxy FastAPI:",
      error,
    );

    return Response.json(
      {
        detail:
          "Il backend non è raggiungibile.",
      },
      {
        status: 502,
      },
    );
  }
}


export const GET =
  proxyRequest;

export const POST =
  proxyRequest;

export const PUT =
  proxyRequest;

export const PATCH =
  proxyRequest;

export const DELETE =
  proxyRequest;

export const OPTIONS =
  proxyRequest;