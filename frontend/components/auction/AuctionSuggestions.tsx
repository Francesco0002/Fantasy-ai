"use client";

/*
 * useMemo evita di ripetere i calcoli
 * quando i dati della sessione non cambiano.
 */
import { useMemo } from "react";

/*
 * Funzione che calcola il budget
 * inizialmente previsto per un ruolo.
 */
import {
    calculateRoleBudget,
} from "../../lib/auction-config";

/*
 * Colori associati ai ruoli.
 */
import {
    ROLE_BADGE_CLASSES,
} from "../../lib/player-utils";

/*
 * Tipi della modalità asta.
 */
import type {
    AuctionConfig,
    AuctionPurchase,
    AuctionRole,
} from "../../types/auction";

/*
 * Tipo completo del giocatore.
 */
import type {
    Player,
} from "../../types/player";


/*
 * Proprietà ricevute dal componente.
 */
type AuctionSuggestionsProps = {
    /*
     * Giocatori ancora disponibili
     * nel ruolo selezionato.
     */
    players: Player[];

    /*
     * Ruolo attualmente visualizzato.
     */
    role: AuctionRole;

    /*
     * Configurazione generale dell'asta.
     */
    config: AuctionConfig;

    /*
     * Acquisti già registrati.
     */
    purchases: AuctionPurchase[];

    /*
     * Massimo tecnicamente spendibile
     * sul prossimo giocatore.
     */
    maximumBid: number;

    /*
   * Budget complessivo ancora disponibile.
   */
    remainingBudget: number;

    /*
     * Slot ancora disponibili per tutti i ruoli.
     */
    remainingSlots: Record<
        AuctionRole,
        number
    >;

    dynamicRoleBudgets: Record<
        AuctionRole,
        number
    >;

    /*
     * Permette di selezionare direttamente
     * uno dei giocatori suggeriti.
     */
    onSelectPlayer: (
        player: Player,
    ) => void;
};


/*
 * Possibile suggerimento prodotto
 * dall'assistente d'asta.
 */
type PlayerSuggestion = {
    player: Player;

    label:
    | "Miglior punteggio"
    | "Miglior qualità/prezzo"
    | "Più affidabile"
    | "Miglior titolarità/prezzo"
    | "Seconda scelta conveniente"
    | "Terza scelta conveniente";

    description: string;
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
 * Elimina eventuali suggerimenti duplicati.
 *
 * Lo stesso giocatore potrebbe infatti essere:
 * - quello con il punteggio più alto;
 * - quello con il miglior rapporto qualità/prezzo;
 * - quello più affidabile.
 */
function removeDuplicateSuggestions(
    suggestions: PlayerSuggestion[],
): PlayerSuggestion[] {
    return suggestions.filter(
        (suggestion, index, currentSuggestions) =>
            currentSuggestions.findIndex(
                (currentSuggestion) =>
                    currentSuggestion.player.player_id ===
                    suggestion.player.player_id,
            ) === index,
    );
}


/*
 * Mostra i giocatori consigliati
 * in base alla situazione dell'asta.
 */
export default function AuctionSuggestions({
    players,
    role,
    config,
    purchases,
    maximumBid,
    remainingBudget,
    remainingSlots,
    dynamicRoleBudgets,
    onSelectPlayer,
}: AuctionSuggestionsProps) {
    /*
     * Crediti già spesi nel ruolo corrente.
     */
    const spentInRole = useMemo(() => {
        return purchases
            .filter(
                (purchase) =>
                    purchase.role === role,
            )
            .reduce(
                (total, purchase) =>
                    total +
                    purchase.purchasePrice,
                0,
            );
    }, [purchases, role]);


    /*
    * Budget iniziale usato solamente
    * come riferimento.
    */
    const initialRoleBudget =
        calculateRoleBudget(
            config,
            role,
        );

    /*
     * Budget effettivamente disponibile ora.
     *
     * Questo valore tiene conto di risparmi
     * e spese eccessive negli altri ruoli.
     */
    const remainingRoleBudget =
        dynamicRoleBudgets[role];

    /*
     * Budget totale aggiornato del ruolo.
     */
    const updatedRoleBudget =
        spentInRole +
        remainingRoleBudget;


    /*
    * Slot ancora da completare
    * nel ruolo attualmente selezionato.
    */
    const remainingRoleSlots =
        remainingSlots[role];


    /*
     * Crediti minimi necessari per riempire
     * gli slot rimanenti del ruolo.
     */
    const minimumCreditsForRole =
        remainingRoleSlots *
        config.minimumBid;


    /*
    * La strategia risparmio viene attivata
    * quando il budget dinamico rimasto è vicino
    * al minimo necessario per completare il ruolo.
    */
    const criticalBudgetThreshold =
        Math.max(
            minimumCreditsForRole,
            Math.round(
                initialRoleBudget * 0.1,
            ),
        );


    /*
    * Consideriamo critica la situazione
    * quando il budget dinamico rimasto
    * è vicino al minimo necessario.
    */
    const isRoleBudgetCritical =
        remainingRoleBudget <=
        criticalBudgetThreshold;


    /*
     * Numero complessivo di slot
     * ancora da completare nella rosa.
     */
    const totalRemainingSlots =
        remainingSlots.P +
        remainingSlots.D +
        remainingSlots.C +
        remainingSlots.A;


    /*
     * Budget medio prudente utilizzabile
     * per ciascuno slot ancora libero.
     */
    const averageBudgetPerSlot =
        totalRemainingSlots > 0
            ? Math.floor(
                remainingBudget /
                totalRemainingSlots,
            )
            : 0;


    /*
    * Il tetto di emergenza non può superare:
    * - il massimo tecnicamente spendibile;
    * - il budget dinamico del ruolo;
    * - il budget medio prudente per slot.
    */
    const emergencyBudget =
        Math.min(
            maximumBid,
            remainingRoleBudget,
            Math.max(
                config.minimumBid,
                averageBudgetPerSlot,
            ),
        );


    /*
    * In condizioni normali utilizziamo
    * il budget ancora previsto per il ruolo.
    *
    * Quando il ruolo è al limite,
    * utilizziamo invece un budget prudente
    * calcolato sull'intera rosa.
    */
    const strategicBudget =
        isRoleBudgetCritical
            ? emergencyBudget
            : Math.min(
                maximumBid,
                Math.max(
                    config.minimumBid,
                    remainingRoleBudget,
                ),
            );


    /*
     * Consideriamo compatibili i giocatori
     * il cui prezzo consigliato non supera
     * il budget strategico disponibile.
     */
    const affordablePlayers =
        useMemo(() => {
            return players.filter(
                (player) =>
                    player.recommended_price <=
                    strategicBudget,
            );
        }, [players, strategicBudget]);


    /*
     * Creiamo i suggerimenti principali.
     */
    const suggestions =
        useMemo<PlayerSuggestion[]>(() => {
            if (
                affordablePlayers.length === 0
            ) {
                return [];
            }

            /*
            * Quando il budget del ruolo è critico,
            * ordiniamo i giocatori in base al rapporto
            * tra probabilità di titolarità e prezzo.
            *
            * Un valore più alto indica:
            * - maggiore probabilità di giocare;
            * - minore costo richiesto.
            */
            if (isRoleBudgetCritical) {
                const playersByStartingValue = [
                    ...affordablePlayers,
                ].sort(
                    (
                        firstPlayer,
                        secondPlayer,
                    ) => {
                        const firstRatio =
                            firstPlayer.starting_probability /
                            Math.max(
                                firstPlayer.recommended_price,
                                1,
                            );

                        const secondRatio =
                            secondPlayer.starting_probability /
                            Math.max(
                                secondPlayer.recommended_price,
                                1,
                            );

                        /*
                         * Prima consideriamo il rapporto
                         * titolarità/prezzo.
                         */
                        if (
                            secondRatio !== firstRatio
                        ) {
                            return (
                                secondRatio - firstRatio
                            );
                        }

                        /*
                         * In caso di parità preferiamo
                         * la probabilità titolare più alta.
                         */
                        const startingDifference =
                            secondPlayer.starting_probability -
                            firstPlayer.starting_probability;

                        if (
                            startingDifference !== 0
                        ) {
                            return startingDifference;
                        }

                        /*
                         * Come ultimo criterio utilizziamo
                         * il punteggio Fantasy AI.
                         */
                        return (
                            secondPlayer.overall_score -
                            firstPlayer.overall_score
                        );
                    },
                );

                const emergencyLabels: PlayerSuggestion["label"][] =
                    [
                        "Miglior titolarità/prezzo",
                        "Seconda scelta conveniente",
                        "Terza scelta conveniente",
                    ];

                return playersByStartingValue
                    .slice(0, 3)
                    .map((player, index) => ({
                        player,
                        label: emergencyLabels[index],
                        description:
                            "Giocatore economico con un buon rapporto tra probabilità di titolarità e prezzo consigliato.",
                    }));
            }


            /*
             * Giocatore con il punteggio
             * Fantasy AI più alto.
             */
            const highestScorePlayer = [
                ...affordablePlayers,
            ].sort(
                (
                    firstPlayer,
                    secondPlayer,
                ) =>
                    secondPlayer.overall_score -
                    firstPlayer.overall_score,
            )[0];


            /*
             * Giocatore con il miglior rapporto
             * tra punteggio e prezzo consigliato.
             */
            const bestValuePlayer = [
                ...affordablePlayers,
            ].sort(
                (
                    firstPlayer,
                    secondPlayer,
                ) => {
                    const firstValue =
                        firstPlayer.overall_score /
                        Math.max(
                            firstPlayer.recommended_price,
                            1,
                        );

                    const secondValue =
                        secondPlayer.overall_score /
                        Math.max(
                            secondPlayer.recommended_price,
                            1,
                        );

                    return secondValue - firstValue;
                },
            )[0];


            /*
             * Giocatore con la probabilità
             * di titolarità più alta.
             */
            const mostReliablePlayer = [
                ...affordablePlayers,
            ].sort(
                (
                    firstPlayer,
                    secondPlayer,
                ) => {
                    const startingDifference =
                        secondPlayer.starting_probability -
                        firstPlayer.starting_probability;

                    /*
                     * In caso di stessa titolarità,
                     * preferiamo il punteggio più alto.
                     */
                    if (
                        startingDifference !== 0
                    ) {
                        return startingDifference;
                    }

                    return (
                        secondPlayer.overall_score -
                        firstPlayer.overall_score
                    );
                },
            )[0];


            return removeDuplicateSuggestions([
                {
                    player: highestScorePlayer,
                    label: "Miglior punteggio",
                    description:
                        "È il giocatore disponibile con il punteggio Fantasy AI più alto entro il budget.",
                },

                {
                    player: bestValuePlayer,
                    label:
                        "Miglior qualità/prezzo",
                    description:
                        "Offre il miglior rapporto tra valutazione Fantasy AI e prezzo consigliato.",
                },

                {
                    player: mostReliablePlayer,
                    label: "Più affidabile",
                    description:
                        "È il giocatore disponibile con la probabilità di titolarità più alta.",
                },
            ]);
        }, [
            affordablePlayers,
            isRoleBudgetCritical,
        ]);


    return (
        <section className="bg-transparent">
            {/* Intestazione compatta */}
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                        Strategia del ruolo
                    </p>

                    <h3 className="mt-0.5 text-base font-bold text-emerald-950">
                        {isRoleBudgetCritical
                            ? "Scelte economiche"
                            : "Migliori scelte"}
                    </h3>

                    <p className="mt-0.5 text-xs leading-relaxed text-emerald-800">
                        {isRoleBudgetCritical
                            ? "Priorità al rapporto tra titolarità e prezzo."
                            : "Giocatori compatibili con il budget attuale."}
                    </p>
                </div>

                {/* Tetto suggerito */}
                <div
                    className="
                    shrink-0 rounded-lg
                    bg-white px-3 py-2
                    text-right shadow-sm
                    "
                >
                    <p className="text-[11px] text-slate-500">
                        Tetto
                    </p>

                    <p className="text-lg font-bold text-slate-900">
                        {strategicBudget}
                    </p>
                </div>
            </div>


            {/* Situazione economica */}
            <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-white px-2 py-2.5 text-center">
                    <p className="text-[11px] text-slate-500">
                        Budget ruolo
                    </p>

                    <p className="mt-0.5 text-base font-bold">
                        {updatedRoleBudget}
                    </p>

                    <p className="mt-0.5 text-[10px] text-slate-400">
                        Iniziale {initialRoleBudget}
                    </p>
                </div>

                <div className="rounded-lg bg-white px-2 py-2.5 text-center">
                    <p className="text-[11px] text-slate-500">
                        Speso
                    </p>

                    <p className="mt-0.5 text-base font-bold">
                        {spentInRole}
                    </p>
                </div>

                <div className="rounded-lg bg-white px-2 py-2.5 text-center">
                    <p className="text-[11px] text-slate-500">
                        Disponibile
                    </p>

                    <p
                        className={`
                            mt-0.5 text-base font-bold

                            ${remainingRoleBudget >
                                                criticalBudgetThreshold
                                                ? "text-emerald-700"
                                                : "text-amber-700"
                                            }
                        `}
                    >
                        {remainingRoleBudget}
                    </p>
                </div>
            </div>


            {/* Strategia risparmio */}
            {isRoleBudgetCritical && (
                <div
                    className="
                    mt-3 rounded-lg border
                    border-amber-300 bg-amber-50
                    px-3 py-2.5
                    text-xs text-amber-950
                    "
                >
                    <p className="font-semibold">
                        Strategia risparmio attiva
                    </p>

                    <p className="mt-1 leading-relaxed">
                        Il budget del ruolo è vicino al minimo necessario.
                        I suggerimenti privilegiano giocatori economici
                        con buona probabilità di titolarità.
                    </p>
                </div>
            )}


            {/* Nessun suggerimento */}
            {suggestions.length === 0 && (
                <div className="mt-3 rounded-lg bg-white p-4 text-center">
                    <p className="text-sm font-semibold text-slate-800">
                        Nessun giocatore compatibile
                    </p>

                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                        Nessuna quotazione rientra nel budget strategico
                        attuale. Puoi comunque scegliere manualmente un
                        giocatore dalla lista.
                    </p>
                </div>
            )}


            {/* Giocatori suggeriti */}
            {suggestions.length > 0 && (
                <div className="mt-3 space-y-2">
                    {suggestions.map(
                        (suggestion) => {
                            const player =
                                suggestion.player;

                            return (
                                <article
                                    key={player.player_id}
                                    className="
                                    rounded-xl border
                                    border-emerald-100
                                    bg-white p-3
                                    shadow-sm
                                    "
                                >
                                    {/* Intestazione del giocatore */}
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                                                {suggestion.label}
                                            </p>

                                            <p className="mt-1 truncate font-bold text-slate-950">
                                                {player.name}
                                            </p>

                                            <p className="mt-0.5 truncate text-xs text-slate-500">
                                                {player.team}
                                            </p>
                                        </div>

                                        <span
                                            className={`
                                            shrink-0 rounded-full
                                            px-2 py-1
                                            text-xs font-bold

                                            ${ROLE_BADGE_CLASSES[
                                                                        player.role
                                                                        ]}
                                            `}
                                        >
                                            {player.role}
                                        </span>
                                    </div>


                                    {/* Dati principali */}
                                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                                        <div className="rounded-lg bg-slate-50 px-2 py-2">
                                            <p className="text-[10px] text-slate-500">
                                                Punteggio
                                            </p>

                                            <p className="mt-0.5 text-sm font-bold">
                                                {player.overall_score.toFixed(
                                                    2,
                                                )}
                                            </p>
                                        </div>

                                        <div className="rounded-lg bg-slate-50 px-2 py-2">
                                            <p className="text-[10px] text-slate-500">
                                                Prezzo
                                            </p>

                                            <p className="mt-0.5 text-sm font-bold">
                                                {player.recommended_price}
                                            </p>
                                        </div>

                                        <div className="rounded-lg bg-slate-50 px-2 py-2">
                                            <p className="text-[10px] text-slate-500">
                                                Titolarità
                                            </p>

                                            <p className="mt-0.5 text-sm font-bold">
                                                {formatPercentage(
                                                    player.starting_probability,
                                                )}
                                            </p>
                                        </div>
                                    </div>


                                    {/* Convenienza durante la strategia risparmio */}
                                    {isRoleBudgetCritical && (
                                        <div className="mt-2 flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-xs">
                                            <span className="text-amber-800">
                                                Convenienza titolarità/prezzo
                                            </span>

                                            <strong className="text-amber-950">
                                                {(
                                                    (
                                                        player.starting_probability *
                                                        100
                                                    ) /
                                                    Math.max(
                                                        player.recommended_price,
                                                        1,
                                                    )
                                                ).toFixed(1)}
                                            </strong>
                                        </div>
                                    )}


                                    {/* Motivazione */}
                                    <p className="mt-3 text-xs leading-relaxed text-slate-600">
                                        {suggestion.description}
                                    </p>


                                    {/* Selezione */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onSelectPlayer(player);
                                        }}
                                        className="
                                            mt-3 w-full rounded-lg
                                            bg-slate-900 px-3 py-2
                                            text-xs font-semibold
                                            text-white transition
                                            hover:bg-slate-700
                                        "
                                    >
                                        Seleziona giocatore
                                    </button>
                                </article>
                            );
                        },
                    )}
                </div>
            )}
        </section>
    );
}