/*
 * Tipo TypeScript utilizzato per descrivere
 * il giocatore ricevuto dal componente.
 */
import type { Player } from "../types/player";

/*
 * Funzioni e configurazioni grafiche
 * condivise tra le schede dei giocatori.
 */
import {
  getInjuryRiskLabel,
  getPlayerTier,
  PLAYER_TIER_CLASSES,
  ROLE_BADGE_CLASSES,
  ROLE_RANK_LABELS,
} from "../lib/player-utils";


/*
 * Proprietà ricevute dal componente PlayerCard.
 */
type PlayerCardProps = {
  player: Player;
  apiUrl: string;
};


/*
 * Mostra tutte le informazioni principali
 * relative a un singolo giocatore.
 */
export default function PlayerCard({
  player,
  apiUrl,
}: PlayerCardProps) {
  /*
   * Calcoliamo la fascia una sola volta,
   * evitando di richiamare più volte la funzione.
   */
  const playerTier = getPlayerTier(
    player.overall_score,
  );

  return (
    <article className="rounded-2xl bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
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

        {/* Badge colorato in base al ruolo */}
        <span
          className={`
            min-w-8 rounded-full px-3 py-1
            text-center text-xs font-bold
            ${ROLE_BADGE_CLASSES[player.role]}
          `}
        >
          {player.role}
        </span>
      </div>


      {/* Punteggio Fantasy AI */}
      <div className="mb-5 rounded-xl bg-emerald-50 p-4">
        <p className="text-sm text-emerald-800">
          Punteggio Fantasy AI
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-3">
          <p className="text-3xl font-bold text-emerald-900">
            {player.overall_score.toFixed(2)}
          </p>

          {/* Fascia qualitativa */}
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

        {/* Posizione nella classifica del ruolo */}
        <p className="mt-1 text-xs text-emerald-700">
          #{player.role_rank}{" "}
          {ROLE_RANK_LABELS[player.role]}
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


      {/* Informazioni aggiuntive */}
      <div className="mt-5 space-y-5 text-sm">
        {/* Età */}
        <div className="flex justify-between">
          <span className="text-slate-500">
            Età
          </span>

          <span className="font-semibold">
            {player.age}
          </span>
        </div>


        {/* Probabilità titolare */}
        <div>
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

          <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
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


        {/* Rischio infortunio */}
        <div>
          <div className="mb-2 flex justify-between">
            <span className="text-slate-500">
              Rischio infortunio
            </span>

            <span className="font-semibold">
              {Math.round(
                player.injury_risk * 100,
              )}
              % ·{" "}
              {getInjuryRiskLabel(
                player.injury_risk,
              )}
            </span>
          </div>

          <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
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


      {/* Azioni disponibili */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <a
          href={`${apiUrl}/players/${player.player_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="
            rounded-xl border border-slate-300
            px-4 py-2 text-center text-sm font-semibold
            transition
            hover:border-slate-400 hover:bg-slate-100
          "
        >
          Dettagli
        </a>

        <button
          type="button"
          disabled
          title="Funzionalità in sviluppo"
          className="
            cursor-not-allowed rounded-xl
            bg-slate-300 px-4 py-2 text-sm
            font-semibold text-slate-600
          "
        >
          Confronta
        </button>
      </div>
    </article>
  );
}