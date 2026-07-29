"use client";

import {
  useEffect,
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
  ] = useState(
    formatNumericValue(value),
  );

  const [
    isFocused,
    setIsFocused,
  ] = useState(false);


  /*
   * Sincronizza il testo quando il valore
   * cambia esternamente, per esempio dopo
   * il ripristino della configurazione.
   */
  useEffect(() => {
    if (!isFocused) {
      setDraftValue(
        formatNumericValue(value),
      );
    }
  }, [
    value,
    isFocused,
  ]);


  return (
    <input
      {...inputProps}
      type="number"
      value={draftValue}
      onFocus={(event) => {
        setIsFocused(true);

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
        setIsFocused(false);

        /*
         * Se il campo viene lasciato vuoto,
         * ripristiniamo il valore precedente.
         */
        if (
          event.target.value === ""
        ) {
          setDraftValue(
            formatNumericValue(value),
          );
        }

        onBlur?.(event);
      }}
    />
  );
}