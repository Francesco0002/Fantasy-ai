"use client";

import type { ReactNode } from "react";

import { useId } from "react";

type InfoTooltipProps = {
    /*
     * Nome del campo spiegato dal tooltip.
     * Viene utilizzato anche dai lettori di schermo.
     */
    label: string;

    /*
     * Testo mostrato all'interno del tooltip.
     */
    children: ReactNode;
};

/*
 * Piccolo indicatore informativo riutilizzabile.
 *
 * Il messaggio viene mostrato:
 * - passando il cursore sull'indicatore;
 * - raggiungendo l'indicatore con la tastiera;
 * - toccandolo su dispositivi mobili.
 */
export function InfoTooltip({
    label,
    children,
}: InfoTooltipProps) {
    const tooltipId = useId();

    return (
        <span className="group relative inline-flex">
            <button
                type="button"
                aria-label={`Informazioni su ${label}`}
                aria-describedby={tooltipId}
                className="
                flex h-5 w-5 items-center justify-center
                rounded-full border border-slate-400
                text-xs font-bold text-slate-500
                transition
                hover:border-emerald-600
                hover:text-emerald-700
                focus:outline-none
                focus:ring-2
                focus:ring-emerald-500
                focus:ring-offset-2
                "
            >
                i
            </button>

            <span
                id={tooltipId}
                role="tooltip"
                className="
                invisible absolute left-full top-1/2 z-30
                ml-3 w-72 max-w-[calc(100vw-3rem)]
                -translate-y-1/2
                rounded-lg bg-slate-900
                px-3 py-2
                text-left text-xs font-normal
                leading-relaxed text-white
                opacity-0 shadow-lg
                transition-opacity
                group-hover:visible
                group-hover:opacity-100
                group-focus-within:visible
                group-focus-within:opacity-100
                "
            >
                {children}
            </span>
        </span>
    );
}