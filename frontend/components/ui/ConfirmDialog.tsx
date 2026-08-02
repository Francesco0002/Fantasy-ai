"use client";

import {
  useEffect,
  useSyncExternalStore,
} from "react";

import {
  createPortal,
} from "react-dom";


type ConfirmDialogProps = {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  isConfirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};


/*
 * Permette di creare il portal soltanto
 * dopo l'idratazione nel browser.
 */
function subscribeToPortalMount() {
  return () => { };
}


function getPortalClientSnapshot() {
  return true;
}


function getPortalServerSnapshot() {
  return false;
}


/*
 * Finestra di conferma coerente con
 * l'interfaccia di Fantasy AI.
 */
export default function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel = "Annulla",
  tone = "primary",
  isConfirming = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  /*
   * La finestra viene renderizzata direttamente
   * nel body, sopra anche ai pannelli laterali.
   */
  const isPortalMounted =
    useSyncExternalStore(
      subscribeToPortalMount,
      getPortalClientSnapshot,
      getPortalServerSnapshot,
    );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (
        event.key === "Escape" &&
        !isConfirming
      ) {
        onCancel();
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [
    isOpen,
    isConfirming,
    onCancel,
  ]);

  if (!isOpen || !isPortalMounted) {
    return null;
  }

  const confirmClasses =
    tone === "danger"
      ? "bg-red-700 hover:bg-red-800"
      : "bg-emerald-700 hover:bg-emerald-800";

  return createPortal(
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/50 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget &&
          !isConfirming
        ) {
          onCancel();
        }
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
      >
        <h2
          id="confirm-dialog-title"
          className="text-xl font-bold text-slate-900"
        >
          {title}
        </h2>

        <p
          id="confirm-dialog-description"
          className="mt-3 text-sm leading-6 text-slate-600"
        >
          {description}
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isConfirming}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            className={`rounded-xl px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${confirmClasses}`}
          >
            {isConfirming
              ? "Operazione in corso..."
              : confirmLabel}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
