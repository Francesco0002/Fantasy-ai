"use client";

/*
 * Link permette di aprire direttamente
 * la pagina di confronto.
 */
import Link from "next/link";

/*
 * Hook React utilizzati per:
 * - gestire la ricerca;
 * - filtrare la lista;
 * - gestire apertura e chiusura della finestra.
 */
import {
  useEffect,
  useMemo,
  useState,
} from "react";

/*
 * Recupera i giocatori dal backend.
 */
import { usePlayers } from "../hooks/usePlayers";

/*
 * Configurazione grafica dei ruoli.
 */
import {
  ROLE_BADGE_CLASSES,
} from "../lib/player-utils";

/*
 * Tipo completo del giocatore.
 */
import type { Player } from "../types/player";


/*
 * Nome completo associato a ciascun ruolo.
 */
const ROLE_NAMES: Record<
  Player["role"],
  string
> = {
  P: "portiere",
  D: "difensore",
  C: "centrocampista",
  A: "attaccante",
};


/*
 * Proprietà ricevute dalla finestra.
 */
type ComparePlayerModalProps = {
  /*
   * Primo giocatore già scelto.
   */
  basePlayer: Player;

  /*
   * Funzione utilizzata per chiudere
   * la finestra.
   */
  onClose: () => void;
};


/*
 * Trasforma un valore tra 0 e 1
 * in una percentuale.
 */
function formatPercentage(
  value: number,
): string {
  const percentage = Math.min(
    Math.max(value * 100, 0),
    100,
  );

  return `${Math.round(percentage)}%`;
}


/*
 * Finestra per scegliere il secondo giocatore
 * da confrontare con quello fissato.
 */
export default function ComparePlayerModal({
  basePlayer,
  onClose,
}: ComparePlayerModalProps) {
  /*
   * Ricerca interna alla finestra.
   */
  const [search, setSearch] =
    useState("");

  /*
   * Recuperiamo solamente giocatori
   * dello stesso ruolo del giocatore fissato.
   */
  const {
    players,
    isLoading,
    error,
  } = usePlayers(
    basePlayer.role,
    search,
  );


  /*
   * Escludiamo il giocatore già selezionato
   * e ordiniamo gli altri per punteggio.
   */
  const candidates = useMemo(() => {
    return players
      .filter(
        (player) =>
          player.player_id !==
          basePlayer.player_id,
      )
      .sort(
        (firstPlayer, secondPlayer) =>
          secondPlayer.overall_score -
          firstPlayer.overall_score,
      );
  }, [players, basePlayer.player_id]);


  /*
   * La finestra può essere chiusa
   * premendo il tasto Escape.
   *
   * Inoltre blocchiamo lo scorrimento
   * della pagina sottostante.
   */
  useEffect(() => {
    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [onClose]);


  return (
    /*
     * Sfondo scuro della finestra.
     *
     * Cliccando fuori dal contenuto,
     * la finestra viene chiusa.
     */
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="compare-modal-title"
      className="
        fixed inset-0 z-50 flex items-center
        justify-center bg-slate-950/60 p-4
      "
      onMouseDown={onClose}
    >
      {/*
       * Contenuto della finestra.
       *
       * stopPropagation impedisce che un clic
       * interno chiuda accidentalmente la finestra.
       */}
      <div
        className="
          flex max-h-[90vh] w-full max-w-3xl
          flex-col overflow-hidden rounded-2xl
          bg-white shadow-xl
        "
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
      >
        {/* Intestazione */}
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">
              Confronto giocatori
            </p>

            <h2
              id="compare-modal-title"
              className="mt-1 text-2xl font-bold"
            >
              Scegli un altro{" "}
              {ROLE_NAMES[basePlayer.role]}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Puoi confrontare solamente
              giocatori dello stesso ruolo.
            </p>
          </div>

          {/* Chiusura */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi finestra"
            className="
              rounded-lg px-3 py-2
              text-xl text-slate-500
              transition hover:bg-slate-100
              hover:text-slate-900
            "
          >
            ×
          </button>
        </header>


        {/*
         * La parte centrale può scorrere
         * senza spostare la pagina sottostante.
         */}
        <div className="overflow-y-auto p-5">

          {/* Giocatore fissato */}
          <section className="rounded-xl bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Giocatore selezionato
            </p>

            <div className="mt-3 flex items-start justify-between gap-4">
              <div>
                <p className="text-xl font-bold text-emerald-950">
                  {basePlayer.name}
                </p>

                <p className="mt-1 text-sm text-emerald-700">
                  {basePlayer.team}
                </p>

                <p className="mt-2 text-sm text-emerald-800">
                  Punteggio:{" "}
                  <strong>
                    {basePlayer.overall_score.toFixed(
                      2,
                    )}
                  </strong>
                  {" · "}
                  Prezzo:{" "}
                  <strong>
                    {
                      basePlayer.recommended_price
                    }
                  </strong>
                </p>
              </div>

              <span
                className={`
                  rounded-full px-3 py-1
                  text-xs font-bold
                  ${
                    ROLE_BADGE_CLASSES[
                      basePlayer.role
                    ]
                  }
                `}
              >
                {basePlayer.role}
              </span>
            </div>
          </section>


          {/* Ricerca del secondo giocatore */}
          <div className="mt-5">
            <label
              htmlFor="compare-player-search"
              className="mb-2 block text-sm font-semibold"
            >
              Cerca il secondo giocatore
            </label>

            <input
              id="compare-player-search"
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
              }}
              placeholder="Cerca per nome o squadra..."
              autoFocus
              className="
                w-full rounded-xl border
                border-slate-300 px-4 py-3
                outline-none transition
                focus:border-emerald-600
                focus:ring-2
                focus:ring-emerald-100
              "
            />
          </div>


          {/* Caricamento */}
          {isLoading && (
            <div className="mt-5 rounded-xl bg-slate-100 p-6 text-center text-sm text-slate-600">
              Caricamento dei giocatori...
            </div>
          )}


          {/* Errore */}
          {!isLoading && error && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">
              {error}
            </div>
          )}


          {/* Nessun risultato */}
          {!isLoading &&
            !error &&
            candidates.length === 0 && (
              <div className="mt-5 rounded-xl bg-slate-100 p-6 text-center text-sm text-slate-600">
                Nessun altro giocatore trovato.
              </div>
            )}


          {/* Lista dei possibili confronti */}
          {!isLoading &&
            !error &&
            candidates.length > 0 && (
              <section className="mt-5">
                <div className="mb-3 flex items-center justify-between gap-4">
                  <h3 className="font-bold">
                    Giocatori disponibili
                  </h3>

                  <span className="text-sm text-slate-500">
                    {candidates.length} risultati
                  </span>
                </div>

                <div className="space-y-3">
                  {candidates.map(
                    (candidate) => (
                      <Link
                        key={
                          candidate.player_id
                        }
                        href={`/compare?first=${basePlayer.player_id}&second=${candidate.player_id}`}
                        onClick={onClose}
                        className="
                          flex flex-col gap-4
                          rounded-xl border
                          border-slate-200 p-4
                          transition
                          hover:border-emerald-400
                          hover:bg-emerald-50
                          sm:flex-row sm:items-center
                          sm:justify-between
                        "
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold">
                              {candidate.name}
                            </p>

                            <span
                              className={`
                                rounded-full px-2 py-0.5
                                text-xs font-bold
                                ${
                                  ROLE_BADGE_CLASSES[
                                    candidate.role
                                  ]
                                }
                              `}
                            >
                              {candidate.role}
                            </span>
                          </div>

                          <p className="mt-1 text-sm text-slate-500">
                            {candidate.team}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-sm">
                          <div>
                            <p className="text-xs text-slate-500">
                              Punteggio
                            </p>

                            <p className="font-bold">
                              {candidate.overall_score.toFixed(
                                2,
                              )}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-slate-500">
                              Prezzo
                            </p>

                            <p className="font-bold">
                              {
                                candidate.recommended_price
                              }
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-slate-500">
                              Titolarità
                            </p>

                            <p className="font-bold">
                              {formatPercentage(
                                candidate.starting_probability,
                              )}
                            </p>
                          </div>

                          <span className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white">
                            Seleziona
                          </span>
                        </div>
                      </Link>
                    ),
                  )}
                </div>
              </section>
            )}
        </div>
      </div>
    </div>
  );
}