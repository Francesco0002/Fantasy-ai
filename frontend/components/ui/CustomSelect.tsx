"use client";

import type {
  KeyboardEvent,
} from "react";

import {
  useEffect,
  useRef,
  useState,
} from "react";


/*
 * Singola opzione mostrata
 * all'interno del menu.
 */
type CustomSelectOption<
  Value extends string,
> = {
  value: Value;
  label: string;
};


/*
 * Colore principale del menu.
 */
type CustomSelectTone =
  | "emerald"
  | "amber";


/*
 * Proprietà ricevute dal componente.
 */
type CustomSelectProps<
  Value extends string,
> = {
  id: string;

  value: Value | "";

  options: readonly CustomSelectOption<Value>[];

  onChange: (
    value: Value,
  ) => void;

  placeholder?: string;

  tone?: CustomSelectTone;

  disabled?: boolean;
};


/*
 * Classi associate ai due colori
 * utilizzati nell'applicazione.
 */
const TONE_CLASSES = {
  emerald: {
    openBorder:
      "border-emerald-500 ring-4 ring-emerald-100/70",

    highlightedOption:
      "bg-emerald-50",

    icon:
      "text-emerald-700",

    check:
      "text-emerald-700",
  },

  amber: {
    openBorder:
      "border-amber-500 ring-4 ring-amber-100/70",

    highlightedOption:
      "bg-amber-50",

    icon:
      "text-amber-700",

    check:
      "text-amber-700",
  },
} as const;


/*
 * Menu a tendina completamente
 * personalizzabile.
 *
 * A differenza del normale select,
 * anche l'elenco aperto mantiene
 * lo stile grafico dell'applicazione.
 */
export default function CustomSelect<
  Value extends string,
>({
  id,
  value,
  options,
  onChange,
  placeholder = "Seleziona un'opzione",
  tone = "emerald",
  disabled = false,
}: CustomSelectProps<Value>) {
  /*
   * Indica se il menu è aperto.
   */
  const [
    isOpen,
    setIsOpen,
  ] = useState(false);


  /*
   * Opzione evidenziata tramite
   * tastiera oppure passaggio del mouse.
   */
  const [
    highlightedIndex,
    setHighlightedIndex,
  ] = useState(-1);


  /*
   * Riferimento al contenitore completo.
   *
   * Serve per chiudere il menu
   * quando si clicca all'esterno.
   */
  const rootRef =
    useRef<HTMLDivElement | null>(
      null,
    );


  const toneClasses =
    TONE_CLASSES[tone];


  /*
   * Opzione attualmente selezionata.
   */
  const selectedIndex =
    options.findIndex(
      (option) =>
        option.value === value,
    );


  const selectedOption =
    selectedIndex >= 0
      ? options[selectedIndex]
      : null;


  /*
   * Apre il menu e posiziona
   * l'evidenziazione sull'opzione
   * già selezionata.
   */
  function openMenu() {
    if (
      disabled ||
      options.length === 0
    ) {
      return;
    }

    /*
    * All'apertura evidenziamo
    * l'opzione già selezionata.
    *
    * Se non esiste ancora una selezione,
    * non evidenziamo nessuna voce.
    */
    setHighlightedIndex(
      selectedIndex >= 0
        ? selectedIndex
        : -1,
    );

    setIsOpen(true);
  }


  /*
   * Chiude il menu.
   */
  function closeMenu() {
    setIsOpen(false);
    setHighlightedIndex(-1);
  }


  /*
   * Seleziona una specifica opzione.
   */
  function selectOption(
    index: number,
  ) {
    const option =
      options[index];

    if (!option) {
      return;
    }

    onChange(option.value);
    closeMenu();
  }


  /*
   * Sposta l'evidenziazione usando
   * le frecce della tastiera.
   */
  function moveHighlight(
    direction: 1 | -1,
  ) {
    if (options.length === 0) {
      return;
    }

    setHighlightedIndex(
      (currentIndex) => {
        const startingIndex =
          currentIndex >= 0
            ? currentIndex
            : selectedIndex >= 0
              ? selectedIndex
              : 0;

        return (
          startingIndex +
          direction +
          options.length
        ) % options.length;
      },
    );
  }


  /*
   * Navigazione tramite tastiera.
   */
  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
  ) {
    switch (event.key) {
      case "ArrowDown": {
        event.preventDefault();

        if (!isOpen) {
          openMenu();
          return;
        }

        moveHighlight(1);
        return;
      }

      case "ArrowUp": {
        event.preventDefault();

        if (!isOpen) {
          openMenu();
          return;
        }

        moveHighlight(-1);
        return;
      }

      case "Enter":
      case " ": {
        event.preventDefault();

        if (!isOpen) {
          openMenu();
          return;
        }

        if (highlightedIndex >= 0) {
          selectOption(
            highlightedIndex,
          );
        }

        return;
      }

      case "Escape": {
        event.preventDefault();
        closeMenu();
        return;
      }

      default:
        return;
    }
  }


  /*
   * Chiude il menu quando si clicca
   * fuori dal componente oppure
   * quando viene premuto Esc.
   */
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(
      event: PointerEvent,
    ) {
      const target =
        event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (
        !rootRef.current?.contains(
          target,
        )
      ) {
        closeMenu();
      }
    }


    function handleEscape(
      event: globalThis.KeyboardEvent,
    ) {
      if (event.key === "Escape") {
        closeMenu();
      }
    }


    document.addEventListener(
      "pointerdown",
      handlePointerDown,
    );

    document.addEventListener(
      "keydown",
      handleEscape,
    );


    return () => {
      document.removeEventListener(
        "pointerdown",
        handlePointerDown,
      );

      document.removeEventListener(
        "keydown",
        handleEscape,
      );
    };
  }, [isOpen]);


  return (
    <div
      ref={rootRef}
      className="relative"
    >
      {/* Pulsante principale */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`${id}-options`}
        onClick={() => {
          if (isOpen) {
            closeMenu();
          } else {
            openMenu();
          }
        }}
        onKeyDown={handleKeyDown}
        className={`
          flex w-full items-center
          justify-between gap-3
          rounded-xl border
          bg-white px-4 py-3
          text-left text-sm
          font-medium shadow-sm
          outline-none transition

          ${isOpen
            ? toneClasses.openBorder
            : "border-slate-300 hover:border-slate-400"
          }

          ${selectedOption
            ? "text-slate-900"
            : "text-slate-500"
          }

          disabled:cursor-not-allowed
          disabled:bg-slate-100
          disabled:text-slate-400
        `}
      >
        <span className="truncate">
          {selectedOption?.label ??
            placeholder}
        </span>

        {/* Freccia */}
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          className={`
            h-5 w-5 shrink-0
            transition-transform
            duration-200

            ${toneClasses.icon}

            ${isOpen
              ? "rotate-180"
              : "rotate-0"
            }
          `}
        >
          <path
            d="M5 7.5L10 12.5L15 7.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>


      {/* Elenco delle opzioni */}
      {isOpen && (
        <div
          id={`${id}-options`}
          role="listbox"
          aria-label={placeholder}
          className="
            absolute left-0 right-0
            top-full z-[80] mt-2
            max-h-64 overflow-y-auto
            rounded-xl border
            border-slate-200
            bg-white p-1.5
            shadow-[0_18px_45px_rgba(15,23,42,0.16)]
          "
        >
          {options.map(
            (option, index) => {
              const isSelected =
                option.value === value;

              const isHighlighted =
                index ===
                highlightedIndex;

              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={
                    isSelected
                  }
                  onMouseEnter={() => {
                    setHighlightedIndex(
                      index,
                    );
                  }}
                  onClick={() => {
                    selectOption(index);
                  }}
                  className={`
                    flex w-full items-center
                    justify-between gap-3
                    rounded-lg px-3 py-2.5
                    text-left text-sm
                    text-slate-700
                    transition-colors

                    ${isHighlighted
                      ? toneClasses.highlightedOption
                      : ""
                    }
                  `}
                >
                  <span className="truncate">
                    {option.label}
                  </span>

                  {/* Segno di selezione */}
                  {isSelected && (
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 20 20"
                      fill="none"
                      className={`
                        h-4 w-4 shrink-0
                        ${toneClasses.check}
                      `}
                    >
                      <path
                        d="M4 10.5L8 14L16 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              );
            },
          )}
        </div>
      )}
    </div>
  );
}