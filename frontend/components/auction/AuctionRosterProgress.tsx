/*
 * Costanti e funzioni condivise
 * della modalità asta.
 */
import {
  AUCTION_ROLES,
  AUCTION_ROLE_NAMES,
  calculateRoleBudget,
  calculateTotalRosterSlots,
} from "../../lib/auction-config";

/*
 * Colori utilizzati per i badge dei ruoli.
 */
import {
  ROLE_BADGE_CLASSES,
} from "../../lib/player-utils";

/*
 * Tipi della modalità asta.
 */
import type {
  AuctionConfig,
  AuctionRole,
} from "../../types/auction";


/*
 * Proprietà ricevute dal componente.
 */
type AuctionRosterProgressProps = {
  config: AuctionConfig;

  /*
   * Slot ancora disponibili
   * per ogni ruolo.
   */
  remainingSlots: Record<
    AuctionRole,
    number
  >;

  /*
   * Crediti già spesi
   * per ogni ruolo.
   */
  spentByRole: Record<
    AuctionRole,
    number
  >;

  /*
 * Budget residuo dinamicamente
 * assegnato a ciascun ruolo.
 */
  dynamicRoleBudgets: Record<
    AuctionRole,
    number
  >;
};


/*
 * Colore della barra di avanzamento
 * associato a ciascun ruolo.
 */
const ROLE_PROGRESS_CLASSES: Record<
  AuctionRole,
  string
> = {
  P: "bg-amber-500",
  D: "bg-emerald-500",
  C: "bg-sky-500",
  A: "bg-red-500",
};


/*
 * Limita una percentuale
 * tra 0 e 100.
 */
function clampPercentage(
  value: number,
): number {
  return Math.min(
    Math.max(value, 0),
    100,
  );
}


/*
 * Mostra l'avanzamento complessivo
 * della rosa e dei singoli ruoli.
 */
export default function AuctionRosterProgress({
  config,
  remainingSlots,
  spentByRole,
  dynamicRoleBudgets,
}: AuctionRosterProgressProps) {
  /*
   * Numero totale di giocatori
   * previsti nella rosa.
   */
  const totalRosterSlots =
    calculateTotalRosterSlots(config);

  /*
   * Numero totale di slot
   * ancora da completare.
   */
  const totalRemainingSlots =
    remainingSlots.P +
    remainingSlots.D +
    remainingSlots.C +
    remainingSlots.A;

  /*
   * Numero di giocatori
   * già acquistati.
   */
  const totalPurchased =
    totalRosterSlots -
    totalRemainingSlots;

  /*
   * Percentuale complessiva
   * di completamento della rosa.
   */
  const overallProgress =
    totalRosterSlots > 0
      ? clampPercentage(
        Math.round(
          (
            totalPurchased /
            totalRosterSlots
          ) * 100,
        ),
      )
      : 0;

  /*
   * La rosa è completa quando
   * non rimangono slot disponibili.
   */
  const isRosterComplete =
    totalRemainingSlots === 0;


  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      {/* Intestazione */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">
            Rosa
          </p>

          <h2 className="mt-1 text-2xl font-bold">
            Avanzamento della rosa
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Controlla quanti giocatori mancano
            per completare ogni ruolo.
          </p>
        </div>

        <div className="w-fit rounded-xl bg-slate-100 px-4 py-3 text-center">
          <p className="text-xs text-slate-500">
            Completamento
          </p>

          <p className="mt-1 text-2xl font-bold">
            {overallProgress}%
          </p>
        </div>
      </div>


      {/* Rosa completata */}
      {isRosterComplete && (
        <div className="mt-5 rounded-xl border border-emerald-300 bg-emerald-50 p-5 text-emerald-950">
          <p className="text-lg font-bold">
            Rosa completata
          </p>

          <p className="mt-1 text-sm text-emerald-800">
            Hai riempito tutti i {totalRosterSlots} slot
            previsti dalla configurazione.
          </p>
        </div>
      )}


      {/* Rosa ancora incompleta */}
      {!isRosterComplete && (
        <div className="mt-5 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sky-950">
          <p className="font-semibold">
            Mancano {totalRemainingSlots} giocatori
          </p>

          <p className="mt-1 text-sm text-sky-800">
            Hai acquistato {totalPurchased} giocatori
            su {totalRosterSlots}.
          </p>
        </div>
      )}


      {/* Barra complessiva */}
      <div className="mt-5">
        <div className="flex justify-between gap-4 text-sm">
          <span className="text-slate-500">
            Progresso complessivo
          </span>

          <span className="font-semibold">
            {totalPurchased}/{totalRosterSlots}
          </span>
        </div>

        <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-emerald-600 transition-all duration-300"
            style={{
              width: `${overallProgress}%`,
            }}
          />
        </div>
      </div>


      {/* Avanzamento per ruolo */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {AUCTION_ROLES.map((role) => {
          const totalRoleSlots =
            config.rosterSlots[role];

          const remainingRoleSlots =
            remainingSlots[role];

          const purchasedRolePlayers =
            totalRoleSlots -
            remainingRoleSlots;

          const roleProgress =
            totalRoleSlots > 0
              ? clampPercentage(
                Math.round(
                  (
                    purchasedRolePlayers /
                    totalRoleSlots
                  ) * 100,
                ),
              )
              : 100;

          /*
          * Budget inizialmente assegnato
          * a questo ruolo.
          */
          const plannedBudget =
            calculateRoleBudget(
              config,
              role,
            );

          /*
           * Crediti ancora disponibili
           * secondo il piano del ruolo.
           *
           * Non scendiamo sotto zero:
           * l'eventuale superamento viene mostrato
           * separatamente.
           */
          const remainingRoleBudget =
            Math.max(
              plannedBudget -
              spentByRole[role],
              0,
            );

          /*
           * Crediti spesi oltre il budget
           * previsto per il ruolo.
           */
          const roleOverspending =
            Math.max(
              spentByRole[role] -
              plannedBudget,
              0,
            );

          /*
          * Budget definito all'inizio dell'asta.
          */
          const initialRoleBudget =
            calculateRoleBudget(
              config,
              role,
            );

          /*
           * Quanto è ancora consigliato spendere
           * nel ruolo dopo la ridistribuzione.
           */
          const availableRoleBudget =
            dynamicRoleBudgets[role];

          /*
           * Budget totale aggiornato del ruolo:
           * quanto è già stato speso più
           * quanto rimane ora disponibile.
           */
          const updatedRoleBudget =
            spentByRole[role] +
            availableRoleBudget;

          return (
            <article
              key={role}
              className="rounded-xl border border-slate-200 p-4"
            >
              {/* Ruolo e conteggio */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`
                      rounded-full px-2.5 py-1
                      text-xs font-bold
                      ${ROLE_BADGE_CLASSES[role]}
                    `}
                  >
                    {role}
                  </span>

                  <p className="font-bold">
                    {AUCTION_ROLE_NAMES[role]}
                  </p>
                </div>

                <span className="text-sm font-semibold">
                  {purchasedRolePlayers}/
                  {totalRoleSlots}
                </span>
              </div>


              {/* Stato del ruolo */}
              <p
                className={`
                  mt-3 text-sm font-semibold
                  ${remainingRoleSlots === 0
                    ? "text-emerald-700"
                    : "text-slate-700"
                  }
                `}
              >
                {remainingRoleSlots === 0
                  ? "Ruolo completo"
                  : `Mancano ${remainingRoleSlots}`}
              </p>


              {/* Barra del ruolo */}
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`
                    h-full rounded-full
                    transition-all duration-300
                    ${ROLE_PROGRESS_CLASSES[role]}
                  `}
                  style={{
                    width: `${roleProgress}%`,
                  }}
                />
              </div>


              {/* Informazioni sul budget */}
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">
                    Budget iniziale
                  </dt>

                  <dd className="font-semibold">
                    {initialRoleBudget}
                  </dd>
                </div>

                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">
                    Budget aggiornato
                  </dt>

                  <dd
                    className={`
        font-semibold
        ${updatedRoleBudget >
                        initialRoleBudget
                        ? "text-emerald-700"
                        : updatedRoleBudget <
                          initialRoleBudget
                          ? "text-amber-700"
                          : "text-slate-900"
                      }
      `}
                  >
                    {updatedRoleBudget}
                  </dd>
                </div>

                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">
                    Già speso
                  </dt>

                  <dd className="font-semibold">
                    {spentByRole[role]}
                  </dd>
                </div>

                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">
                    Disponibile ora
                  </dt>

                  <dd className="font-semibold text-emerald-700">
                    {availableRoleBudget}
                  </dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>
    </section>
  );
}