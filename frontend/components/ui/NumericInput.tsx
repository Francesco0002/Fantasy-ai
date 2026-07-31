"use client";

import {
  useState,
} from "react";

import type {
  InputHTMLAttributes,
} from "react";


type NumericInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value"
> & {
  value: number;
};


/*
 * Converte il valore numerico
 * nel testo mostrato nell'input.
 */
function formatNumericValue(
  value: number,
): string {
  if (!Number.isFinite(value)) {
    return "";
  }

  return String(value);
}


/*
 * Input numerico che permette
 * di cancellare temporaneamente
 * tutto il contenuto.
 *
 * Il valore precedente viene conservato
 * finché non viene digitato un nuovo numero.
 */
export default function NumericInput({
  value,
  onChange,
  onFocus,
  onBlur,
  ...inputProps
}: NumericInputProps) {
  const [
    draftValue,
    setDraftValue,
  ] = useState<string | null>(null);


  return (
    <input
      {...inputProps}
      type="number"
      value={
        draftValue ??
        formatNumericValue(value)
      }
      onFocus={(event) => {
        /*
         * Conserva un testo locale soltanto
         * mentre l'utente modifica il campo.
         */
        setDraftValue(
          event.currentTarget.value,
        );

        onFocus?.(event);
      }}
      onChange={(event) => {
        const nextValue =
          event.target.value;

        /*
         * L'interfaccia può rimanere vuota,
         * ma non salviamo subito zero
         * nella configurazione.
         */
        setDraftValue(nextValue);

        if (nextValue !== "") {
          onChange?.(event);
        }
      }}
      onBlur={(event) => {
        /*
         * Terminata la modifica, torniamo
         * a mostrare il valore ricevuto
         * dalla configurazione.
         */
        setDraftValue(null);

        onBlur?.(event);
      }}
    />
  );
}