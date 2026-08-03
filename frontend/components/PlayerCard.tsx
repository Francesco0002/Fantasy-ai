/*
 * Link viene utilizzato per navigare
 * alla pagina dettagli del giocatore.
 */
import Link from "next/link";


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
 * Proprietà ricevute dalla scheda.
 *
 * onCompare viene chiamata quando l'utente
 * vuole confrontare questo giocatore.
 */
type PlayerCardProps = {
  player: Player;
  onCompare: (player: Player) => void;
};


/*
 * Mostra le informazioni principali del giocatore
 * attraverso una riga compatta e responsive.
 *
 * Su desktop assume l'aspetto di una riga del listone.
 * Su mobile gli elementi vengono distribuiti su più righe.
 */
export default function PlayerCard({
  player,
  onCompare,
}: PlayerCardProps) {
  /*
   * Calcoliamo una sola volta i valori
   * utilizzati nell'interfaccia.
   */
  const playerTier = getPlayerTier(
    player.overall_score,
  );

  const startingPercentage = Math.min(
    Math.max(
      player.starting_probability * 100,
      0,
    ),
    100,
  );

  const injuryPercentage = Math.min(
    Math.max(
      player.injury_risk * 100,
      0,
    ),
    100,
  );


  return (
    <article
      className="
        rounded-2xl border border-slate-200
        bg-white shadow-sm transition
        hover:-translate-y-0.5
        hover:border-slate-300 hover:shadow-md
      "
    >
      <div
        className="
          grid grid-cols-2 items-center gap-4 p-4
          sm:grid-cols-3
          lg:grid-cols-[minmax(230px,1.5fr)_minmax(115px,0.7fr)_minmax(190px,1fr)_minmax(310px,1.35fr)_auto]
        "
      >
        {/* Nome, squadra e ruolo */}
        <div
          className="
            col-span-2 flex min-w-0 items-center gap-3
            sm:col-span-3
            lg:col-span-1
          "
        >
          {/* Badge colorato in base al ruolo */}
          <span
            className={`
              flex h-9 w-9 shrink-0 items-center
              justify-center rounded-full
              text-sm font-bold
              ${ROLE_BADGE_CLASSES[player.role]}
            `}
          >
            {player.role}
          </span>

          <div className="min-w-0">
            <h3
              className="
                truncate text-base font-bold
                text-slate-900
              "
            >
              {player.name}
            </h3>

            <p className="truncate text-xs text-slate-500">
              {player.team} · {player.age} anni
            </p>
          </div>
        </div>


        {/* Punteggio Fantasy AI */}
        <div>
          <p
            className="
              mb-1 text-[11px] font-medium
              uppercase tracking-wide text-slate-400
            "
          >
            Fantasy AI
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xl font-bold text-emerald-700">
              {player.overall_score.toFixed(2)}
            </span>

            <span
              className={`
                rounded-full px-2 py-0.5
                text-[10px] font-semibold
                ${PLAYER_TIER_CLASSES[playerTier]}
              `}
            >
              {playerTier}
            </span>
          </div>

          <p className="mt-0.5 text-[11px] text-slate-500">
            #{player.role_rank}{" "}
            {ROLE_RANK_LABELS[player.role]}
          </p>
        </div>


        {/* Prezzi consigliati */}
        <div>
          <p
            className="
              mb-1 text-[11px] font-medium
              uppercase tracking-wide text-slate-400
            "
          >
            Prezzi
          </p>

          <div className="flex items-center gap-2 text-center">
            <div className="min-w-11 rounded-lg bg-slate-100 px-2 py-1">
              <p className="text-[9px] text-slate-500">
                Affare
              </p>

              <p className="text-sm font-bold text-slate-700">
                {player.recommended_min}
              </p>
            </div>

            <div className="min-w-11 rounded-lg bg-emerald-600 px-2 py-1">
              <p className="text-[9px] text-emerald-100">
                Cons.
              </p>

              <p className="text-sm font-bold text-white">
                {player.recommended_price}
              </p>
            </div>

            <div className="min-w-11 rounded-lg bg-slate-100 px-2 py-1">
              <p className="text-[9px] text-slate-500">
                Max
              </p>

              <p className="text-sm font-bold text-slate-700">
                {player.absolute_max}
              </p>
            </div>
          </div>
        </div>


        {/*
        * Indicatori di titolarità e rischio.
        *
        * Su desktop sono affiancati.
        * Su tablet sono impilati e rimangono vicini.
        * Su mobile tornano affiancati.
        */}
        <div
          className="
            col-span-2 grid grid-cols-2 gap-4
            self-center
            sm:col-span-1 sm:col-start-3
            sm:grid-cols-1 sm:gap-4
            lg:col-start-auto lg:grid-cols-2
            lg:items-start lg:gap-5
          "
        >
          {/* Probabilità titolare */}
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <p
                className="
                  text-[11px] font-medium uppercase
                  tracking-wide text-slate-400
                "
              >
                Titolarità
              </p>

              <span className="text-sm font-bold text-slate-700">
                {Math.round(startingPercentage)}%
              </span>
            </div>

            <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className="
                  h-full rounded-full bg-emerald-500
                  transition-all duration-300
                "
                style={{
                  width: `${startingPercentage}%`,
                }}
              />
            </div>
          </div>

          {/* Rischio infortunio */}
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <p
                className="
                  text-[11px] font-medium uppercase
                  tracking-wide text-slate-400
                "
              >
                Rischio
              </p>

              <span className="text-sm font-bold text-slate-700">
                {player.injury_risk_available
                  ? `${Math.round(injuryPercentage)}%`
                  : "—"}
              </span>
            </div>

            {player.injury_risk_available ? (
              <>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="
                      h-full rounded-full bg-red-500
                      transition-all duration-300
                    "
                    style={{
                      width: `${injuryPercentage}%`,
                    }}
                  />
                </div>

                <p className="mt-1 text-[11px] text-slate-500">
                  {getInjuryRiskLabel(player.injury_risk)}
                </p>
              </>
            ) : (
              <p
                className="
                  rounded-lg bg-slate-100 px-2 py-1.5
                  text-center text-[11px] font-medium
                  text-slate-500
                "
              >
                Dato non disponibile
              </p>
            )}
          </div>
        </div>


        {/* Azioni disponibili */}
        <div
          className="
            col-span-2 flex items-center gap-2
            self-center
            sm:col-span-3
            lg:col-span-1 lg:justify-end
          "
        >
          <Link
            href={`/players/${player.player_id}`}
            className="
              flex-1 rounded-lg border border-slate-300
              px-3 py-2 text-center text-xs font-semibold
              text-slate-700 transition
              hover:border-slate-400 hover:bg-slate-100
              lg:flex-none
            "
          >
            Dettagli
          </Link>

          <button
            type="button"
            onClick={() => {
              onCompare(player);
            }}
            className="
              flex-1 rounded-lg bg-slate-900
              px-3 py-2 text-xs font-semibold
              text-white transition
              hover:bg-slate-700
              lg:flex-none
            "
          >
            Confronta
          </button>
        </div>
      </div>
    </article>
  );
}