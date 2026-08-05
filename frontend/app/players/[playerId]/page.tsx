"use client";

/*
 * Link permette di navigare tra le pagine Next.js
 * senza effettuare un ricaricamento completo.
 */
import Link from "next/link";

import { InfoTooltip } from "../../../components/InfoTooltip";

/*
 * useParams permette di leggere il parametro dinamico
 * presente nell'indirizzo /players/[playerId].
 */
import { useParams } from "next/navigation";

/*
 * Custom hook che recupera un singolo giocatore
 * tramite l'endpoint GET /players/{playerId}.
 */
import { usePlayer } from "../../../hooks/usePlayer";

/*
 * Funzioni e configurazioni grafiche condivise.
 */
import {
  getInjuryRiskLabel,
  getPlayerTier,
  PLAYER_TIER_CLASSES,
  ROLE_BADGE_CLASSES,
  ROLE_RANK_LABELS,
} from "../../../lib/player-utils";


/*
 * Nome completo associato a ciascun ruolo.
 */
const ROLE_NAMES = {
  P: "Portiere",
  D: "Difensore",
  C: "Centrocampista",
  A: "Attaccante",
} as const;


/*
 * Trasforma un valore compreso tra 0 e 1
 * in una percentuale intera.
 */
function formatPercentage(value: number): string {
  const percentage = Math.min(
    Math.max(value * 100, 0),
    100,
  );

  return `${Math.round(percentage)}%`;
}


/*
 * Formatta un numero decimale.
 *
 * In caso di dato non valido viene mostrato
 * un trattino invece di provocare un errore.
 */
function formatNumber(
  value: number,
  decimalPlaces = 1,
): string {
  if (!Number.isFinite(value)) {
    return "—";
  }

  return value.toFixed(decimalPlaces);
}


/*
 * Pagina dettagli del singolo giocatore.
 */
export default function PlayerDetailsPage() {
  /*
   * Leggiamo playerId dall'indirizzo.
   *
   * Esempio:
   * /players/15 produce params.playerId = "15".
   */
  const params = useParams<{
    playerId: string;
  }>();

  /*
   * Convertiamo l'identificativo da stringa a numero.
   */
  const parsedPlayerId = Number(params.playerId);

  /*
   * Passiamo null al custom hook quando
   * l'identificativo non è valido.
   */
  const playerId =
    Number.isInteger(parsedPlayerId) &&
      parsedPlayerId > 0
      ? parsedPlayerId
      : null;

  /*
   * Recuperiamo il giocatore dal backend.
   */
  const {
    player,
    isLoading,
    error,
  } = usePlayer(playerId);


  /*
   * Schermata mostrata durante il caricamento.
   */
  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900">
        <div className="mx-auto max-w-5xl">
          <Link
            href="/"
            className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
          >
            ← Torna ai giocatori
          </Link>

          <div className="mt-8 rounded-2xl bg-white p-10 text-center shadow-sm">
            Caricamento del giocatore...
          </div>
        </div>
      </main>
    );
  }


  /*
   * Schermata mostrata quando il giocatore
   * non esiste oppure la richiesta fallisce.
   */
  if (error || !player) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900">
        <div className="mx-auto max-w-5xl">
          <Link
            href="/"
            className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
          >
            ← Torna ai giocatori
          </Link>

          <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-8 text-red-800">
            <h1 className="text-xl font-bold">
              Impossibile mostrare il giocatore
            </h1>

            <p className="mt-2">
              {error ??
                "Giocatore non trovato."}
            </p>
          </div>
        </div>
      </main>
    );
  }


  /*
   * Fascia qualitativa calcolata una sola volta.
   */
  const playerTier = getPlayerTier(
    player.overall_score,
  );


  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-5xl">

        {/* Collegamento alla pagina principale */}
        <Link
          href="/"
          className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
        >
          ← Torna ai giocatori
        </Link>


        {/* Intestazione del giocatore */}
        <header className="mt-6 rounded-2xl bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">
                Scheda giocatore
              </p>

              <h1 className="mt-2 text-3xl font-bold md:text-4xl">
                {player.name}
              </h1>

              <p className="mt-2 text-slate-500">
                {player.team} ·{" "}
                {ROLE_NAMES[player.role]} ·{" "}
                {player.age} anni
              </p>
            </div>

            {/* Badge del ruolo */}
            <span
              className={`
                w-fit rounded-full px-4 py-2
                text-sm font-bold
                ${ROLE_BADGE_CLASSES[player.role]}
              `}
            >
              {player.role}
            </span>
          </div>
        </header>


        {/* Punteggio principale e prezzo */}
        <section className="mt-6 grid gap-5 md:grid-cols-2">

          {/* Punteggio Fantasy AI */}
          <div className="rounded-2xl bg-emerald-50 p-6">
            <p className="text-sm font-semibold text-emerald-800">
              Punteggio Fantasy AI
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <p className="text-4xl font-bold text-emerald-950">
                {formatNumber(
                  player.overall_score,
                  2,
                )}
              </p>

              <span
                className={`
                  rounded-full px-3 py-1
                  text-xs font-semibold
                  ${PLAYER_TIER_CLASSES[playerTier]}
                `}
              >
                {playerTier}
              </span>
            </div>

            <p className="mt-3 text-sm text-emerald-700">
              #{player.role_rank}{" "}
              {ROLE_RANK_LABELS[player.role]}
            </p>

            <p className="mt-1 text-sm text-emerald-700">
              #{player.overall_rank} nella classifica generale
            </p>
          </div>


          {/* Prezzo consigliato */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-slate-600">
              Valutazione d&apos;asta
            </p>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-slate-100 p-3">
                <p className="text-xs text-slate-500">
                  Affare
                </p>

                <p className="mt-1 text-xl font-bold">
                  {player.recommended_min}
                </p>
              </div>

              <div className="rounded-xl bg-emerald-600 p-3 text-white">
                <p className="text-xs text-emerald-100">
                  Consigliato
                </p>

                <p className="mt-1 text-2xl font-bold">
                  {player.recommended_price}
                </p>
              </div>

              <div className="rounded-xl bg-slate-100 p-3">
                <p className="text-xs text-slate-500">
                  Non superare
                </p>

                <p className="mt-1 text-xl font-bold">
                  {player.absolute_max}
                </p>
              </div>
            </div>

            <p className="mt-4 text-sm text-slate-500">
              Prezzo base stimato:{" "}
              <strong className="text-slate-800">
                {player.base_price}
              </strong>
            </p>
          </div>
        </section>


        {/* Componenti del punteggio */}
        <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">
            Componenti del punteggio
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Valori utilizzati per calcolare il Punteggio Fantasy AI.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-xl bg-slate-100 p-4">
              <div className="flex items-center gap-2">
                <p className="text-sm text-slate-500">
                  Rendimento
                </p>

                <InfoTooltip label="Rendimento">
                  Misura la qualità media delle prestazioni
                  nella stagione precedente rispetto agli
                  altri giocatori dello stesso ruolo. Il valore
                  50 rappresenta la media del ruolo.
                </InfoTooltip>
              </div>

              <p className="mt-1 text-2xl font-bold">
                {formatNumber(
                  player.performance_score,
                )}
              </p>
            </div>

            <div className="rounded-xl bg-slate-100 p-4">
              <div className="flex items-center gap-2">
                <p className="text-sm text-slate-500">
                  Titolarità
                </p>

                <InfoTooltip label="Titolarità">
                  Indica la percentuale delle giornate della
                  stagione precedente in cui il giocatore è
                  partito titolare. Considera anche le partite
                  saltate e misura quindi la continuità da
                  titolare nell&apos;intera stagione.
                </InfoTooltip>
              </div>

              <p className="mt-1 text-2xl font-bold">
                {formatNumber(
                  player.starting_score,
                )}
              </p>
            </div>

            <div className="rounded-xl bg-slate-100 p-4">
              <div className="flex items-center gap-2">
                <p className="text-sm text-slate-500">
                  Bonus/Malus
                </p>

                <InfoTooltip label="Bonus e Malus">
                  Indica la capacità di produrre bonus e
                  limitare i malus nella stagione precedente,
                  rispetto agli altri giocatori dello stesso
                  ruolo. Il valore 50 rappresenta la media
                  del ruolo.
                </InfoTooltip>
              </div>

              <p className="mt-1 text-2xl font-bold">
                {formatNumber(
                  player.bonus_score,
                )}
              </p>
            </div>

            <div className="rounded-xl bg-slate-100 p-4">
              <div className="flex items-center gap-2">
                <p className="text-sm text-slate-500">
                  Affidabilità
                </p>

                <InfoTooltip label="Affidabilità">
                  Indica la continuità con cui il giocatore
                  ha garantito una presenza valutabile nella
                  stagione precedente.
                </InfoTooltip>
              </div>

              <p className="mt-1 text-2xl font-bold">
                {formatNumber(
                  player.reliability_score,
                )}
              </p>
            </div>
          </div>
        </section>


        {/* Titolarità e rischio */}
        <section className="mt-6 grid gap-5 md:grid-cols-2">

          {/* Probabilità titolare */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-bold">
                Probabilità titolare
              </h2>

              <span className="font-bold">
                {formatPercentage(
                  player.starting_probability,
                )}
              </span>
            </div>

            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{
                  width: formatPercentage(
                    player.starting_probability,
                  ),
                }}
              />
            </div>
          </div>


          {/* Rischio infortunio */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-bold">
                Rischio infortunio
              </h2>

              <span className="font-bold">
                {player.injury_risk_available
                  ? `${formatPercentage(
                    player.injury_risk,
                  )} · ${getInjuryRiskLabel(
                    player.injury_risk,
                  )}`
                  : "Dato non disponibile"}
              </span>
            </div>

            {player.injury_risk_available ? (
              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-red-500"
                  style={{
                    width: formatPercentage(
                      player.injury_risk,
                    ),
                  }}
                />
              </div>
            ) : (
              <p
                className="
                  mt-4 rounded-xl bg-slate-100
                  px-4 py-3 text-sm text-slate-500
                "
              >
                Il rischio infortunio non è disponibile
                per questo giocatore.
              </p>
            )}
          </div>
        </section>


        {/* Statistiche della stagione precedente */}
        <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">
            Statistiche ultima stagione
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {player.role === "P"
              ? "Dati generali e statistiche specifiche del portiere."
              : "Presenze, rendimento e bonus prodotti nella stagione."}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {/* Statistiche di utilizzo comuni a tutti i ruoli */}
            <div className="rounded-xl bg-slate-100 p-4">
              <p className="text-sm text-slate-500">
                Presenze
              </p>

              <p className="mt-1 text-xl font-bold">
                {player.appearances_last_season}
              </p>
            </div>

            <div className="rounded-xl bg-slate-100 p-4">
              <p className="text-sm text-slate-500">
                Da titolare
              </p>

              <p className="mt-1 text-xl font-bold">
                {player.starts_last_season}
              </p>
            </div>

            <div className="rounded-xl bg-slate-100 p-4">
              <p className="text-sm text-slate-500">
                Minuti
              </p>

              <p className="mt-1 text-xl font-bold">
                {player.minutes_last_season}
              </p>
            </div>

            {player.role === "P" ? (
              <>
                {/*
                 * Per i portieri diamo priorità alle
                 * statistiche specifiche del ruolo.
                 */}
                <div className="rounded-xl bg-slate-100 p-4">
                  <p className="text-sm text-slate-500">
                    Porte inviolate
                  </p>

                  <p className="mt-1 text-xl font-bold">
                    {player.clean_sheets_last_season}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-100 p-4">
                  <p className="text-sm text-slate-500">
                    Gol subiti
                  </p>

                  <p className="mt-1 text-xl font-bold">
                    {player.goals_conceded_last_season}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-100 p-4">
                  <p className="text-sm text-slate-500">
                    Parate
                  </p>

                  <p className="mt-1 text-xl font-bold">
                    {player.saves_last_season}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-100 p-4">
                  <p className="text-sm text-slate-500">
                    Rigori parati
                  </p>

                  <p className="mt-1 text-xl font-bold">
                    {player.penalties_saved_last_season}
                    {" / "}
                    {player.penalties_faced_last_season}
                  </p>
                </div>

                {/*
                 * Gol e assist restano visibili anche
                 * per i portieri, pur essendo eventi rari.
                 */}
                <div className="rounded-xl bg-slate-100 p-4">
                  <p className="text-sm text-slate-500">
                    Gol
                  </p>

                  <p className="mt-1 text-xl font-bold">
                    {player.goals_last_season}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-100 p-4">
                  <p className="text-sm text-slate-500">
                    Assist
                  </p>

                  <p className="mt-1 text-xl font-bold">
                    {player.assists_last_season}
                  </p>
                </div>
              </>
            ) : (
              <>
                {/* Bonus principali dei giocatori di movimento */}
                <div className="rounded-xl bg-slate-100 p-4">
                  <p className="text-sm text-slate-500">
                    Gol
                  </p>

                  <p className="mt-1 text-xl font-bold">
                    {player.goals_last_season}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-100 p-4">
                  <p className="text-sm text-slate-500">
                    Assist
                  </p>

                  <p className="mt-1 text-xl font-bold">
                    {player.assists_last_season}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-100 p-4">
                  <p className="text-sm text-slate-500">
                    Rigori segnati
                  </p>

                  <p className="mt-1 text-xl font-bold">
                    {player.penalties_scored_last_season}
                    {" / "}
                    {player.penalties_scored_last_season +
                      player.penalties_missed_last_season}
                  </p>
                </div>
              </>
            )}

            {/* Medie comuni a tutti i ruoli */}
            <div className="rounded-xl bg-slate-100 p-4">
              <p className="text-sm text-slate-500">
                Media voto
              </p>

              <p className="mt-1 text-xl font-bold">
                {formatNumber(
                  player.average_rating_last_season,
                  2,
                )}
              </p>
            </div>

            <div className="rounded-xl bg-slate-100 p-4">
              <p className="text-sm text-slate-500">
                Fantamedia
              </p>

              <p className="mt-1 text-xl font-bold">
                {formatNumber(
                  player.fantasy_average_last_season,
                  2,
                )}
              </p>
            </div>
          </div>
        </section>


        {/* Informazioni aggiuntive */}
        <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">
            Informazioni aggiuntive
          </h2>

          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-slate-500">
                Pericolosità sui piazzati
              </dt>

              <dd className="mt-1 font-semibold">
                {formatPercentage(
                  player.set_piece_level,
                )}
              </dd>
            </div>

            <div>
              <dt className="text-sm text-slate-500">
                Posizione nella classifica prezzi
              </dt>

              <dd className="mt-1 font-semibold">
                #{player.price_rank}
              </dd>
            </div>

            <div>
              <dt className="text-sm text-slate-500">
                Fonte del dato
              </dt>

              <dd className="mt-1 font-semibold">
                {player.data_source}
              </dd>
            </div>
          </dl>

          {player.notes && (
            <div className="mt-5 rounded-xl bg-slate-100 p-4">
              <p className="text-sm font-semibold">
                Note
              </p>

              <p className="mt-1 text-sm text-slate-600">
                {player.notes}
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}