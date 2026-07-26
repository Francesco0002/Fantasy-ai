"use client";

/*
 * Importiamo gli hook React necessari:
 *
 * useState:
 * conserva i dati e lo stato dell'interfaccia.
 *
 * useEffect:
 * esegue il caricamento dei giocatori quando
 * la pagina viene aperta o cambiano i filtri.
 */
/*
 * useMemo permette di calcolare la lista ordinata
 * soltanto quando cambiano i giocatori o il criterio scelto.
 */
import { useEffect, useMemo, useState } from "react";


/*
 * Definiamo i quattro ruoli del Fantacalcio Classic.
 *
 * La stringa vuota rappresenta la scelta
 * "Tutti i ruoli".
 */
type Role = "" | "P" | "D" | "C" | "A";


/*
 * Criteri di ordinamento disponibili nell'interfaccia.
 *
 * Ogni valore identifica una diversa modalità
 * con cui ordinare l'elenco dei giocatori.
 */
type SortOption =
  | "score_desc"
  | "price_desc"
  | "starting_desc"
  | "injury_asc"
  | "name_asc";


/*
 * Descriviamo la struttura di un giocatore
 * restituito dall'API FastAPI.
 *
 * TypeScript controllerà che i dati usati
 * nella pagina rispettino questa struttura.
 */
type Player = {
  player_id: number;
  name: string;
  team: string;
  role: "P" | "D" | "C" | "A";
  age: number;
  overall_score: number;
  role_rank: number;
  starting_probability: number;
  injury_risk: number;
  recommended_min: number;
  recommended_price: number;
  recommended_max: number;
  absolute_max: number;
  market_coverage: number;
};


/*
 * Struttura completa della risposta
 * restituita dall'endpoint GET /players.
 */
type PlayersResponse = {
  count: number;

  filters: {
    role: Role | null;
    search: string | null;
    limit: number;
  };

  players: Player[];
};


/*
 * Frase grammaticalmente corretta utilizzata
 * per indicare la posizione del giocatore
 * nella classifica del proprio ruolo.
 */
const ROLE_RANK_LABELS: Record<Player["role"], string> = {
  P: "tra i portieri",
  D: "tra i difensori",
  C: "tra i centrocampisti",
  A: "tra gli attaccanti",
};


/*
 * Classi grafiche utilizzate per distinguere
 * immediatamente il ruolo di ogni giocatore.
 *
 * Usiamo un testo scuro sul giallo per garantire
 * una buona leggibilità, mentre sugli altri colori
 * utilizziamo il testo bianco.
 */
const ROLE_BADGE_CLASSES: Record<Player["role"], string> = {
  P: "bg-yellow-400 text-yellow-950",
  D: "bg-green-600 text-white",
  C: "bg-blue-600 text-white",
  A: "bg-red-600 text-white",
};


/*
 * Trasforma il rischio numerico di infortunio
 * in un'etichetta più immediata da comprendere.
 *
 * Il valore ricevuto è compreso tra 0 e 1:
 * - meno di 0.15: rischio basso;
 * - da 0.15 a meno di 0.30: rischio medio;
 * - da 0.30 in poi: rischio alto.
 */
function getInjuryRiskLabel(risk: number): string {
  if (risk < 0.15) {
    return "Basso";
  }

  if (risk < 0.30) {
    return "Medio";
  }

  return "Alto";
}


/*
 * Elenco delle possibili fasce assegnate
 * ai giocatori in base al Punteggio Fantasy AI.
 */
type PlayerTier =
  | "Top"
  | "Ottimo"
  | "Buono"
  | "Scommessa"
  | "Bassa priorità";


/*
 * Assegna una fascia qualitativa al giocatore
 * utilizzando il suo Punteggio Fantasy AI.
 *
 * Le soglie sono inizialmente sperimentali
 * e potranno essere modificate quando utilizzeremo
 * un dataset reale e più completo.
 */
function getPlayerTier(score: number): PlayerTier {
  if (score >= 85) {
    return "Top";
  }

  if (score >= 75) {
    return "Ottimo";
  }

  if (score >= 65) {
    return "Buono";
  }

  if (score >= 50) {
    return "Scommessa";
  }

  return "Bassa priorità";
}


/*
 * Colore utilizzato per rappresentare visivamente
 * ciascuna fascia del giocatore.
 */
const PLAYER_TIER_CLASSES: Record<PlayerTier, string> = {
  Top: "bg-amber-100 text-amber-800",
  Ottimo: "bg-emerald-100 text-emerald-800",
  Buono: "bg-blue-100 text-blue-800",
  Scommessa: "bg-violet-100 text-violet-800",
  "Bassa priorità": "bg-slate-200 text-slate-700",
};


/*
 * Recuperiamo l'indirizzo del backend
 * dalla variabile definita in .env.local.
 *
 * Se la variabile manca, usiamo l'indirizzo locale
 * come valore predefinito.
 */
const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8000";


export default function Home() {
  /*
   * Lista dei giocatori ricevuti dal backend.
   */
  const [players, setPlayers] = useState<Player[]>([]);

  /*
   * Testo scritto nel campo di ricerca.
   */
  const [search, setSearch] = useState("");

  /*
   * Ruolo selezionato nel menu.
   * La stringa vuota indica nessun filtro.
   */
  const [role, setRole] = useState<Role>("");

  /*
   * Stato usato per mostrare il messaggio
   * di caricamento.
   */
  const [isLoading, setIsLoading] = useState(true);

  /*
   * Contiene un eventuale messaggio di errore.
   * null significa che non ci sono errori.
   */
  const [error, setError] = useState<string | null>(null);


  /*
    * Criterio di ordinamento attualmente selezionato.
    *
    * Come valore iniziale mostriamo prima
    * i giocatori con il Punteggio Fantasy AI più alto.
    */
  const [sortBy, setSortBy] =
    useState<SortOption>("score_desc");


  /*
   * useEffect esegue una richiesta al backend.
   *
   * La richiesta viene ripetuta quando cambiano:
   * - il ruolo selezionato;
   * - il testo di ricerca.
   */
  useEffect(() => {
    /*
     * AbortController permette di annullare
     * una richiesta precedente quando l'utente
     * cambia rapidamente un filtro.
     */
    const controller = new AbortController();


    async function loadPlayers() {
      /*
       * Prima di iniziare una nuova richiesta:
       * - attiviamo il caricamento;
       * - cancelliamo eventuali vecchi errori.
       */
      setIsLoading(true);
      setError(null);

      /*
       * URLSearchParams costruisce correttamente
       * i parametri dell'indirizzo.
       */
      const params = new URLSearchParams();

      /*
       * Richiediamo fino a 100 giocatori.
       */
      params.set("limit", "100");

      /*
       * Aggiungiamo il ruolo soltanto
       * quando l'utente ne ha selezionato uno.
       */
      if (role !== "") {
        params.set("role", role);
      }

      /*
       * Eliminiamo gli spazi iniziali e finali.
       */
      const cleanedSearch = search.trim();

      /*
       * Aggiungiamo il testo solo quando
       * contiene almeno un carattere.
       */
      if (cleanedSearch !== "") {
        params.set("search", cleanedSearch);
      }

      try {
        /*
         * Effettuiamo la richiesta HTTP
         * verso l'endpoint FastAPI.
         */
        const response = await fetch(
          `${API_URL}/players?${params.toString()}`,
          {
            signal: controller.signal,
          },
        );

        /*
         * fetch non genera automaticamente un errore
         * per risposte HTTP come 404 o 500.
         *
         * Controlliamo quindi manualmente response.ok.
         */
        if (!response.ok) {
          throw new Error(
            `Il backend ha restituito l'errore ${response.status}.`,
          );
        }

        /*
         * Convertiamo la risposta JSON
         * nella struttura PlayersResponse.
         */
        const data: PlayersResponse =
          await response.json();

        /*
         * Salviamo i giocatori nello stato React.
         */
        setPlayers(data.players);
      } catch (caughtError) {
        /*
         * Non mostriamo un errore quando la richiesta
         * è stata annullata volontariamente.
         */
        if (
          caughtError instanceof Error &&
          caughtError.name === "AbortError"
        ) {
          return;
        }

        /*
         * Gestiamo gli errori normali,
         * ad esempio backend non raggiungibile.
         */
        if (caughtError instanceof Error) {
          setError(caughtError.message);
        } else {
          setError(
            "Si è verificato un errore sconosciuto.",
          );
        }

        /*
         * In caso di errore svuotiamo
         * l'elenco precedente.
         */
        setPlayers([]);
      } finally {
        /*
         * Disattiviamo lo stato di caricamento.
         */
        setIsLoading(false);
      }
    }


    /*
     * Avviamo la funzione asincrona.
     */
    loadPlayers();


    /*
     * Questa funzione viene eseguita quando
     * l'effetto deve essere interrotto o ricreato.
     */
    return () => {
      controller.abort();
    };
  }, [role, search]);


  /*
    * Creiamo una nuova lista ordinata senza modificare
    * direttamente l'array originale contenuto nello stato.
    *
    * L'operatore [...players] genera una copia
    * prima di applicare il metodo sort.
    */
  const sortedPlayers = useMemo(() => {
    const playersCopy = [...players];

    switch (sortBy) {
      /*
      * Punteggio Fantasy AI:
      * dal valore più alto al più basso.
      */
      case "score_desc":
        return playersCopy.sort(
          (firstPlayer, secondPlayer) =>
            secondPlayer.overall_score -
            firstPlayer.overall_score,
        );

      /*
      * Prezzo consigliato:
      * dal giocatore più costoso al meno costoso.
      */
      case "price_desc":
        return playersCopy.sort(
          (firstPlayer, secondPlayer) =>
            secondPlayer.recommended_price -
            firstPlayer.recommended_price,
        );

      /*
      * Probabilità di titolarità:
      * dalla probabilità più alta alla più bassa.
      */
      case "starting_desc":
        return playersCopy.sort(
          (firstPlayer, secondPlayer) =>
            secondPlayer.starting_probability -
            firstPlayer.starting_probability,
        );

      /*
      * Rischio infortunio:
      * dal rischio più basso al più alto.
      *
      * In questo caso un valore minore
      * viene considerato migliore.
      */
      case "injury_asc":
        return playersCopy.sort(
          (firstPlayer, secondPlayer) =>
            firstPlayer.injury_risk -
            secondPlayer.injury_risk,
        );

      /*
      * Nome del giocatore:
      * ordine alfabetico italiano.
      */
      case "name_asc":
        return playersCopy.sort(
          (firstPlayer, secondPlayer) =>
            firstPlayer.name.localeCompare(
              secondPlayer.name,
              "it",
            ),
        );

      /*
      * Caso di sicurezza.
      *
      * Se arriva un criterio non previsto,
      * restituiamo la lista senza modificarla.
      */
      default:
        return playersCopy;
    }
  }, [players, sortBy]);



  return (
    /*
     * Contenitore principale della pagina.
     */
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-6xl">

        {/* Intestazione della pagina */}
        <header className="mb-8">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-emerald-700">
            Assistente d&apos;asta
          </p>

          <h1 className="text-4xl font-bold">
            Fantasy AI
          </h1>

          <p className="mt-3 max-w-2xl text-slate-600">
            Consulta le valutazioni proprietarie e i prezzi
            d&apos;asta consigliati per ciascun giocatore.
          </p>
        </header>


        {/*
         * Pannello contenente ricerca e filtro per ruolo.
         */}
        <section className="mb-8 grid gap-4 rounded-2xl bg-white p-5 shadow-sm md:grid-cols-3">
          <div>
            <label
              htmlFor="player-search"
              className="mb-2 block text-sm font-semibold"
            >
              Cerca giocatore o squadra
            </label>

            <input
              id="player-search"
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
              }}
              placeholder="Esempio: Colombo"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div>
            <label
              htmlFor="role-filter"
              className="mb-2 block text-sm font-semibold"
            >
              Filtra per ruolo
            </label>

            <select
              id="role-filter"
              value={role}
              onChange={(event) => {
                setRole(event.target.value as Role);
              }}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="">Tutti i ruoli</option>
              <option value="P">Portieri</option>
              <option value="D">Difensori</option>
              <option value="C">Centrocampisti</option>
              <option value="A">Attaccanti</option>
            </select>
          </div>
          {/*
          * Menu utilizzato per scegliere
          * l'ordinamento dei giocatori visualizzati.
          */}
          <div>
            <label
              htmlFor="sort-filter"
              className="mb-2 block text-sm font-semibold"
            >
              Ordina per
            </label>

            <select
              id="sort-filter"
              value={sortBy}
              onChange={(event) => {
                /*
                * TypeScript riceve genericamente una stringa.
                * Specifichiamo che il valore appartiene
                * al tipo SortOption definito in precedenza.
                */
                setSortBy(event.target.value as SortOption);
              }}
              className="
                w-full rounded-xl border border-slate-300
                bg-white px-4 py-3 outline-none transition
                focus:border-emerald-600
                focus:ring-2 focus:ring-emerald-100
              "
            >
              <option value="score_desc">
                Punteggio Fantasy AI
              </option>

              <option value="price_desc">
                Prezzo consigliato
              </option>

              <option value="starting_desc">
                Probabilità titolare
              </option>

              <option value="injury_asc">
                Minor rischio infortunio
              </option>

              <option value="name_asc">
                Nome alfabetico
              </option>
            </select>
          </div>
        </section>


        {/*
         * Riepilogo del numero di risultati.
         */}
        <section className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            Giocatori
          </h2>

          {!isLoading && !error && (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800">
              {players.length} risultati
            </span>
          )}
        </section>


        {/*
         * Messaggio mostrato durante il caricamento.
         */}
        {isLoading && (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            Caricamento dei giocatori...
          </div>
        )}


        {/*
         * Messaggio mostrato quando il backend
         * non è raggiungibile o restituisce un errore.
         */}
        {!isLoading && error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
            <p className="font-semibold">
              Impossibile caricare i giocatori
            </p>

            <p className="mt-2 text-sm">
              {error}
            </p>

            <p className="mt-2 text-sm">
              Controlla che FastAPI sia attivo sulla
              porta 8000.
            </p>
          </div>
        )}


        {/*
         * Messaggio mostrato quando i filtri
         * non producono risultati.
         */}
        {!isLoading &&
          !error &&
          players.length === 0 && (
            <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
              Nessun giocatore trovato.
            </div>
          )}


        {/*
         * Griglia delle schede dei giocatori.
         */}
        {!isLoading &&
          !error &&
          players.length > 0 && (
            <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {sortedPlayers.map((player) => (
                <article
                  key={player.player_id}
                  className="rounded-2xl bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                >
                  {/* Nome, squadra e ruolo */}
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-bold">
                        {player.name}
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        {player.team}
                      </p>
                    </div>

                    {/* Badge colorato in base al ruolo del giocatore */}
                    <span
                      className={`
                        min-w-8 rounded-full px-3 py-1 text-center text-xs font-bold
                        ${ROLE_BADGE_CLASSES[player.role]}
                      `}
                    >
                      {player.role}
                    </span>
                  </div>


                  {/* Punteggio e fascia qualitativa del giocatore */}
                  <div className="mb-5 rounded-xl bg-emerald-50 p-4">

                    {/* Nome del punteggio */}
                    <p className="text-sm text-emerald-800">
                      Punteggio Fantasy AI
                    </p>

                    {/*
                    * Punteggio numerico e fascia vengono mostrati
                    * sulla stessa riga quando lo spazio lo permette.
                    */}
                    <div className="mt-1 flex flex-wrap items-center gap-3">
                      <p className="text-3xl font-bold text-emerald-900">
                        {player.overall_score.toFixed(2)}
                      </p>

                      {/*
                      * Il colore del badge viene scelto automaticamente
                      * in base alla fascia calcolata.
                      */}
                      <span
                        className={`
                          rounded-full px-3 py-1 text-xs font-semibold
                          ${PLAYER_TIER_CLASSES[
                          getPlayerTier(player.overall_score)
                          ]}
                        `}
                      >
                        {getPlayerTier(player.overall_score)}
                      </span>
                    </div>

                    {/* Posizione nella classifica del ruolo */}
                    <p className="mt-1 text-xs text-emerald-700">
                      #{player.role_rank} {ROLE_RANK_LABELS[player.role]}
                    </p>
                  </div>


                  {/* Prezzi consigliati */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-slate-100 p-3">
                      <p className="text-xs text-slate-500">
                        Affare
                      </p>

                      <p className="mt-1 font-bold">
                        {player.recommended_min}
                      </p>
                    </div>

                    <div className="rounded-xl bg-emerald-600 p-3 text-white">
                      <p className="text-xs text-emerald-100">
                        Consigliato
                      </p>

                      <p className="mt-1 text-xl font-bold">
                        {player.recommended_price}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-100 p-3">
                      <p className="text-xs text-slate-500">
                        Massimo
                      </p>

                      <p className="mt-1 font-bold">
                        {player.absolute_max}
                      </p>
                    </div>
                  </div>


                  {/*
                  * Informazioni aggiuntive del giocatore.
                  *
                  * Titolarità e rischio infortunio vengono rappresentati
                  * anche attraverso una barra per rendere i valori
                  * più immediati da comprendere.
                  */}
                  <div className="mt-5 space-y-5 text-sm">

                    {/* Età del giocatore */}
                    <div className="flex justify-between">
                      <span className="text-slate-500">
                        Età
                      </span>

                      <span className="font-semibold">
                        {player.age}
                      </span>
                    </div>


                    {/* Probabilità di partire titolare */}
                    <div>
                      {/*
                      * Riga contenente l'etichetta
                      * e la percentuale numerica.
                      */}
                      <div className="mb-2 flex justify-between">
                        <span className="text-slate-500">
                          Probabilità titolare
                        </span>

                        <span className="font-semibold">
                          {Math.round(
                            player.starting_probability * 100,
                          )}
                          %
                        </span>
                      </div>

                      {/*
                      * Sfondo grigio della barra.
                      */}
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">

                        {/*
                        * Parte verde della barra.
                        *
                        * La larghezza viene calcolata utilizzando
                        * la probabilità di titolarità del giocatore.
                        *
                        * Un valore di 0.86, ad esempio,
                        * produce una barra larga l'86%.
                        */}
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                          style={{
                            width: `${Math.min(
                              Math.max(
                                player.starting_probability * 100,
                                0,
                              ),
                              100,
                            )}%`,
                          }}
                        />
                      </div>
                    </div>


                    {/* Rischio di infortunio */}
                    <div>
                      {/*
                      * Riga contenente l'etichetta
                      * e la percentuale numerica.
                      */}
                      <div className="mb-2 flex justify-between">
                        <span className="text-slate-500">
                          Rischio infortunio
                        </span>

                        {/*
                        * Mostriamo sia la percentuale numerica
                        * sia l'etichetta Basso, Medio oppure Alto.
                        */}
                        <span className="font-semibold">
                          {Math.round(
                            player.injury_risk * 100,
                          )}
                          % · {getInjuryRiskLabel(player.injury_risk)}
                        </span>
                      </div>

                      {/*
                      * Sfondo grigio della barra.
                      */}
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">

                        {/*
                        * Parte rossa della barra.
                        *
                        * Più il rischio è alto,
                        * più la barra rossa sarà lunga.
                        */}
                        <div
                          className="h-full rounded-full bg-red-500 transition-all duration-300"
                          style={{
                            width: `${Math.min(
                              Math.max(
                                player.injury_risk * 100,
                                0,
                              ),
                              100,
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  {/*
                  * Azioni disponibili per il giocatore.
                  *
                  * Il pulsante Dettagli apre temporaneamente
                  * la risposta completa dell'API in una nuova scheda.
                  *
                  * Il pulsante Confronta verrà collegato successivamente
                  * al sistema di confronto tra giocatori.
                  */}
                  <div className="mt-6 grid grid-cols-2 gap-3">

                    {/* Apertura dei dati completi del giocatore */}
                    <a
                      href={`${API_URL}/players/${player.player_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="
                        rounded-xl border border-slate-300 px-4 py-2
                        text-center text-sm font-semibold
                        transition
                        hover:border-slate-400 hover:bg-slate-100
                      "
                    >
                      Dettagli
                    </a>

                    {/* Pulsante predisposto per il confronto futuro */}
                    <button
                      type="button"
                      disabled
                      title="Funzionalità in sviluppo"
                      className="
                        cursor-not-allowed rounded-xl bg-slate-300
                        px-4 py-2 text-sm font-semibold text-slate-600
                      "
                    >
                      Confronta
                    </button>
                  </div>
                </article>
              ))}
            </section>
          )}
      </div>
    </main>
  );
}