"use client";

/*
 * Link permette di tornare alla pagina principale
 * mantenendo la navigazione interna di Next.js.
 */
import Link from "next/link";

/*
 * Custom hook utilizzato per recuperare
 * i dati completi di entrambi i giocatori.
 */
import { usePlayer } from "../hooks/usePlayer";

/*
 * Configurazioni grafiche condivise.
 */
import {
  getInjuryRiskLabel,
  getPlayerTier,
  PLAYER_TIER_CLASSES,
  ROLE_BADGE_CLASSES,
} from "../lib/player-utils";


/*
 * Identificativi ricevuti dalla pagina /compare.
 */
type PlayerComparisonProps = {
  firstPlayerId: number | null;
  secondPlayerId: number | null;
};


/*
 * Proprietà di una singola riga
 * della tabella di confronto.
 */
type ComparisonRowProps = {
  label: string;

  firstValue: string | number;
  secondValue: string | number;

  /*
   * Valori numerici utilizzati per stabilire
   * quale giocatore è migliore nella statistica.
   */
  firstNumericValue: number;
  secondNumericValue: number;

  /*
   * Indica se un valore più alto oppure più basso
   * deve essere considerato migliore.
   */
  better: "higher" | "lower";

  /*
   * Se false, i valori vengono mostrati
   * senza evidenziare un giocatore migliore.
   */
  comparable?: boolean;
};


/*
 * Converte un valore compreso tra 0 e 1
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
 * Determina lo stile del valore migliore.
 */
function getComparisonClass(
  value: number,
  otherValue: number,
  better: "higher" | "lower",
): string {
  /*
   * In caso di parità non evidenziamo nessuno.
   */
  if (value === otherValue) {
    return "bg-slate-100 text-slate-800";
  }

  const isBetter =
    better === "higher"
      ? value > otherValue
      : value < otherValue;

  if (isBetter) {
    return "bg-emerald-100 text-emerald-800";
  }

  return "bg-slate-100 text-slate-600";
}


/*
 * Riga riutilizzabile della tabella.
 */
function ComparisonRow({
  label,
  firstValue,
  secondValue,
  firstNumericValue,
  secondNumericValue,
  better,
  comparable = true,
}: ComparisonRowProps) {
  /*
   * Se uno dei dati non è disponibile,
   * entrambi i valori mantengono uno stile neutro.
   */
  const neutralClass =
    "bg-slate-100 text-slate-600";

  const firstComparisonClass = comparable
    ? getComparisonClass(
      firstNumericValue,
      secondNumericValue,
      better,
    )
    : neutralClass;

  const secondComparisonClass = comparable
    ? getComparisonClass(
      secondNumericValue,
      firstNumericValue,
      better,
    )
    : neutralClass;
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-t border-slate-200 py-4">
      {/* Valore del primo giocatore */}
      <div
        className={`
          rounded-lg px-3 py-2 text-center font-semibold
          ${firstComparisonClass}
        `}
      >
        {firstValue}
      </div>

      {/* Nome della statistica */}
      <p className="w-32 text-center text-sm text-slate-500">
        {label}
      </p>

      {/* Valore del secondo giocatore */}
      <div
        className={`
          rounded-lg px-3 py-2 text-center font-semibold
          ${secondComparisonClass}
        `}
      >
        {secondValue}
      </div>
    </div>
  );
}


/*
 * Pagina grafica del confronto.
 */
export default function PlayerComparison({
  firstPlayerId,
  secondPlayerId,
}: PlayerComparisonProps) {
  /*
   * Gli hook vengono sempre chiamati nello stesso ordine,
   * rispettando le regole di React.
   */
  const firstPlayerState =
    usePlayer(firstPlayerId);

  const secondPlayerState =
    usePlayer(secondPlayerId);


  /*
   * Controlliamo che siano presenti due ID validi
   * e che rappresentino giocatori diversi.
   */
  const invalidSelection =
    firstPlayerId === null ||
    secondPlayerId === null ||
    firstPlayerId === secondPlayerId;


  if (invalidSelection) {
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
              Confronto non valido
            </h1>

            <p className="mt-2">
              Seleziona due giocatori diversi dalla pagina principale.
            </p>
          </div>
        </div>
      </main>
    );
  }


  /*
   * Mostriamo il caricamento finché almeno
   * uno dei due giocatori non è pronto.
   */
  if (
    firstPlayerState.isLoading ||
    secondPlayerState.isLoading
  ) {
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
            Caricamento del confronto...
          </div>
        </div>
      </main>
    );
  }


  /*
   * Gestiamo eventuali errori provenienti
   * da uno dei due caricamenti.
   */
  const comparisonError =
    firstPlayerState.error ??
    secondPlayerState.error;

  const firstPlayer =
    firstPlayerState.player;

  const secondPlayer =
    secondPlayerState.player;


  if (
    comparisonError ||
    !firstPlayer ||
    !secondPlayer
  ) {
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
              Impossibile confrontare i giocatori
            </h1>

            <p className="mt-2">
              {comparisonError ??
                "Uno dei giocatori non è disponibile."}
            </p>
          </div>
        </div>
      </main>
    );
  }


  /*
  * Il confronto diretto è valido solamente
  * tra giocatori dello stesso ruolo.
  *
  * Questo controllo protegge anche dagli URL
  * modificati manualmente.
  */
  if (
    firstPlayer.role !== secondPlayer.role
  ) {
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
              Ruoli non compatibili
            </h1>

            <p className="mt-2">
              Il confronto diretto è disponibile
              solamente tra giocatori dello stesso ruolo.
            </p>

            <p className="mt-2 text-sm">
              Hai selezionato un giocatore con ruolo{" "}
              <strong>
                {firstPlayer.role}
              </strong>{" "}
              e uno con ruolo{" "}
              <strong>
                {secondPlayer.role}
              </strong>
              .
            </p>
          </div>
        </div>
      </main>
    );
  }


  /*
   * Fasce qualitative dei due giocatori.
   */
  const firstTier = getPlayerTier(
    firstPlayer.overall_score,
  );

  const secondTier = getPlayerTier(
    secondPlayer.overall_score,
  );


  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-5xl">

        {/* Navigazione */}
        <Link
          href="/"
          className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
        >
          ← Torna ai giocatori
        </Link>


        {/* Titolo della pagina */}
        <header className="mt-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">
            Fantasy AI
          </p>

          <h1 className="mt-2 text-3xl font-bold md:text-4xl">
            Confronto giocatori
          </h1>

          <p className="mt-2 text-slate-600">
            Confronta rendimento, prezzo, affidabilità e potenziale.
          </p>
        </header>


        {/* Schede riassuntive */}
        <section className="mt-8 grid gap-5 md:grid-cols-2">
          {[firstPlayer, secondPlayer].map(
            (player, index) => {
              const tier =
                index === 0
                  ? firstTier
                  : secondTier;

              return (
                <article
                  key={player.player_id}
                  className="rounded-2xl bg-white p-6 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-bold">
                        {player.name}
                      </h2>

                      <p className="mt-1 text-sm text-slate-500">
                        {player.team} · {player.age} anni
                      </p>
                    </div>

                    <span
                      className={`
                        rounded-full px-3 py-1
                        text-xs font-bold
                        ${ROLE_BADGE_CLASSES[player.role]}
                      `}
                    >
                      {player.role}
                    </span>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <p className="text-4xl font-bold text-emerald-900">
                      {formatNumber(
                        player.overall_score,
                        2,
                      )}
                    </p>

                    <span
                      className={`
                        rounded-full px-3 py-1
                        text-xs font-semibold
                        ${PLAYER_TIER_CLASSES[tier]}
                      `}
                    >
                      {tier}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-slate-500">
                    Prezzo consigliato:{" "}
                    <strong className="text-slate-900">
                      {player.recommended_price}
                    </strong>
                  </p>
                </article>
              );
            },
          )}
        </section>


        {/* Tabella di confronto */}
        <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm md:p-7">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 pb-4">
            <p className="text-center font-bold">
              {firstPlayer.name}
            </p>

            <p className="w-32 text-center text-sm font-semibold text-slate-500">
              Statistica
            </p>

            <p className="text-center font-bold">
              {secondPlayer.name}
            </p>
          </div>

          <ComparisonRow
            label="Punteggio"
            firstValue={formatNumber(
              firstPlayer.overall_score,
              2,
            )}
            secondValue={formatNumber(
              secondPlayer.overall_score,
              2,
            )}
            firstNumericValue={
              firstPlayer.overall_score
            }
            secondNumericValue={
              secondPlayer.overall_score
            }
            better="higher"
          />

          <ComparisonRow
            label="Prezzo consigliato"
            firstValue={firstPlayer.recommended_price}
            secondValue={secondPlayer.recommended_price}
            firstNumericValue={
              firstPlayer.recommended_price
            }
            secondNumericValue={
              secondPlayer.recommended_price
            }
            better="lower"
          />

          <ComparisonRow
            label="Titolarità"
            firstValue={formatPercentage(
              firstPlayer.starting_probability,
            )}
            secondValue={formatPercentage(
              secondPlayer.starting_probability,
            )}
            firstNumericValue={
              firstPlayer.starting_probability
            }
            secondNumericValue={
              secondPlayer.starting_probability
            }
            better="higher"
          />

          <ComparisonRow
            label="Rischio"
            firstValue={
              firstPlayer.injury_risk_available
                ? `${formatPercentage(
                  firstPlayer.injury_risk,
                )} · ${getInjuryRiskLabel(
                  firstPlayer.injury_risk,
                )}`
                : "Dato non disponibile"
            }
            secondValue={
              secondPlayer.injury_risk_available
                ? `${formatPercentage(
                  secondPlayer.injury_risk,
                )} · ${getInjuryRiskLabel(
                  secondPlayer.injury_risk,
                )}`
                : "Dato non disponibile"
            }
            firstNumericValue={
              firstPlayer.injury_risk
            }
            secondNumericValue={
              secondPlayer.injury_risk
            }
            better="lower"
            comparable={
              firstPlayer.injury_risk_available &&
              secondPlayer.injury_risk_available
            }
          />

          <ComparisonRow
            label="Rendimento"
            firstValue={formatNumber(
              firstPlayer.performance_score,
            )}
            secondValue={formatNumber(
              secondPlayer.performance_score,
            )}
            firstNumericValue={
              firstPlayer.performance_score
            }
            secondNumericValue={
              secondPlayer.performance_score
            }
            better="higher"
          />

          <ComparisonRow
            label="Bonus"
            firstValue={formatNumber(
              firstPlayer.bonus_score,
            )}
            secondValue={formatNumber(
              secondPlayer.bonus_score,
            )}
            firstNumericValue={
              firstPlayer.bonus_score
            }
            secondNumericValue={
              secondPlayer.bonus_score
            }
            better="higher"
          />

          <ComparisonRow
            label="Affidabilità"
            firstValue={formatNumber(
              firstPlayer.reliability_score,
            )}
            secondValue={formatNumber(
              secondPlayer.reliability_score,
            )}
            firstNumericValue={
              firstPlayer.reliability_score
            }
            secondNumericValue={
              secondPlayer.reliability_score
            }
            better="higher"
          />

          <ComparisonRow
            label="Potenziale"
            firstValue={formatNumber(
              firstPlayer.potential_score,
            )}
            secondValue={formatNumber(
              secondPlayer.potential_score,
            )}
            firstNumericValue={
              firstPlayer.potential_score
            }
            secondNumericValue={
              secondPlayer.potential_score
            }
            better="higher"
          />

          <ComparisonRow
            label="Fantamedia"
            firstValue={formatNumber(
              firstPlayer.fantasy_average_last_season,
              2,
            )}
            secondValue={formatNumber(
              secondPlayer.fantasy_average_last_season,
              2,
            )}
            firstNumericValue={
              firstPlayer.fantasy_average_last_season
            }
            secondNumericValue={
              secondPlayer.fantasy_average_last_season
            }
            better="higher"
          />

          <ComparisonRow
            label="Gol"
            firstValue={
              firstPlayer.goals_last_season
            }
            secondValue={
              secondPlayer.goals_last_season
            }
            firstNumericValue={
              firstPlayer.goals_last_season
            }
            secondNumericValue={
              secondPlayer.goals_last_season
            }
            better="higher"
          />

          <ComparisonRow
            label="Assist"
            firstValue={
              firstPlayer.assists_last_season
            }
            secondValue={
              secondPlayer.assists_last_season
            }
            firstNumericValue={
              firstPlayer.assists_last_season
            }
            secondNumericValue={
              secondPlayer.assists_last_season
            }
            better="higher"
          />
        </section>
      </div>
    </main>
  );
}