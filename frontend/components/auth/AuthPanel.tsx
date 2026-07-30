"use client";

/*
 * Hook globale che gestisce
 * l'utente autenticato.
 */
import {
  useAuth,
} from "../../hooks/useAuth";

/*
 * Tipi e hook React utilizzati
 * dal modulo di autenticazione.
 */
import {
  useState,
} from "react";

import type {
  FormEvent,
} from "react";


type AuthMode =
  | "LOGIN"
  | "REGISTER";


/*
 * Pannello utilizzato per:
 *
 * - registrare un account;
 * - effettuare il login;
 * - mostrare l'utente collegato;
 * - effettuare il logout.
 */
export default function AuthPanel() {
  const {
    user,
    isAuthReady,
    isAuthActionLoading,
    authError,
    register,
    login,
    logout,
    clearAuthError,
  } = useAuth();


  const [
    mode,
    setMode,
  ] = useState<AuthMode>(
    "LOGIN",
  );


  const [
    email,
    setEmail,
  ] = useState("");


  const [
    displayName,
    setDisplayName,
  ] = useState("");


  const [
    password,
    setPassword,
  ] = useState("");


  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");


  const [
    localError,
    setLocalError,
  ] = useState<string | null>(
    null,
  );


  /*
   * Cambia tra login e registrazione
   * ripulendo gli errori precedenti.
   */
  function changeMode(
    nextMode: AuthMode,
  ) {
    setMode(nextMode);

    setLocalError(null);
    clearAuthError();

    setPassword("");
    setConfirmPassword("");
  }


  /*
   * Invia il modulo al backend.
   */
  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setLocalError(null);
    clearAuthError();

    const normalizedEmail =
      email.trim();

    if (normalizedEmail === "") {
      setLocalError(
        "Inserisci la tua email.",
      );

      return;
    }

    if (password === "") {
      setLocalError(
        "Inserisci la password.",
      );

      return;
    }

    if (mode === "REGISTER") {
      const normalizedDisplayName =
        displayName.trim();

      if (
        normalizedDisplayName === ""
      ) {
        setLocalError(
          "Inserisci il nome da visualizzare.",
        );

        return;
      }

      if (password.length < 8) {
        setLocalError(
          "La password deve contenere "
          + "almeno 8 caratteri.",
        );

        return;
      }

      if (
        password !==
        confirmPassword
      ) {
        setLocalError(
          "Le password non coincidono.",
        );

        return;
      }

      const succeeded =
        await register({
          email: normalizedEmail,

          displayName:
            normalizedDisplayName,

          password,
        });

      if (succeeded) {
        setPassword("");
        setConfirmPassword("");
      }

      return;
    }

    const succeeded =
      await login({
        email: normalizedEmail,
        password,
      });

    if (succeeded) {
      setPassword("");
    }
  }


  /*
   * Durante il controllo iniziale
   * non sappiamo ancora se esiste
   * una sessione valida.
   */
  if (!isAuthReady) {
    return (
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-600">
          Verifica dell&apos;account...
        </p>
      </section>
    );
  }


  /*
   * Utente già autenticato.
   */
  if (user) {
    return (
      <section className="mt-6 flex flex-col gap-4 rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
            Account collegato
          </p>

          <p className="mt-1 text-lg font-bold text-slate-900">
            {user.displayName}
          </p>

          <p className="mt-1 text-sm text-slate-500">
            {user.email}
          </p>
        </div>

        <button
          type="button"
          disabled={
            isAuthActionLoading
          }
          onClick={() => {
            void logout();
          }}
          className="
            rounded-xl border
            border-slate-300 bg-white
            px-4 py-2 text-sm
            font-semibold text-slate-700
            transition
            hover:bg-slate-100
            disabled:cursor-not-allowed
            disabled:opacity-60
          "
        >
          {isAuthActionLoading
            ? "Disconnessione..."
            : "Esci"}
        </button>
      </section>
    );
  }


  const displayedError =
    localError ?? authError;


  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            changeMode("LOGIN");
          }}
          className={`
            rounded-xl px-4 py-2
            text-sm font-semibold
            transition
            ${
              mode === "LOGIN"
                ? (
                  "bg-emerald-700 "
                  + "text-white"
                )
                : (
                  "bg-slate-100 "
                  + "text-slate-700 "
                  + "hover:bg-slate-200"
                )
            }
          `}
        >
          Accedi
        </button>

        <button
          type="button"
          onClick={() => {
            changeMode("REGISTER");
          }}
          className={`
            rounded-xl px-4 py-2
            text-sm font-semibold
            transition
            ${
              mode === "REGISTER"
                ? (
                  "bg-emerald-700 "
                  + "text-white"
                )
                : (
                  "bg-slate-100 "
                  + "text-slate-700 "
                  + "hover:bg-slate-200"
                )
            }
          `}
        >
          Registrati
        </button>
      </div>


      <form
        onSubmit={handleSubmit}
        className="mt-5 grid gap-4"
      >
        {mode === "REGISTER" && (
          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-slate-700">
              Nome
            </span>

            <input
              type="text"
              value={displayName}
              maxLength={80}
              autoComplete="name"
              onChange={(event) => {
                setDisplayName(
                  event.target.value,
                );
              }}
              className="rounded-xl border border-slate-300 px-4 py-2.5 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              placeholder="Mario Rossi"
            />
          </label>
        )}


        <label className="grid gap-1.5">
          <span className="text-sm font-semibold text-slate-700">
            Email
          </span>

          <input
            type="email"
            value={email}
            maxLength={320}
            autoComplete="email"
            onChange={(event) => {
              setEmail(
                event.target.value,
              );
            }}
            className="rounded-xl border border-slate-300 px-4 py-2.5 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            placeholder="nome@example.com"
          />
        </label>


        <label className="grid gap-1.5">
          <span className="text-sm font-semibold text-slate-700">
            Password
          </span>

          <input
            type="password"
            value={password}
            maxLength={128}
            autoComplete={
              mode === "REGISTER"
                ? "new-password"
                : "current-password"
            }
            onChange={(event) => {
              setPassword(
                event.target.value,
              );
            }}
            className="rounded-xl border border-slate-300 px-4 py-2.5 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            placeholder="Almeno 8 caratteri"
          />
        </label>


        {mode === "REGISTER" && (
          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-slate-700">
              Conferma password
            </span>

            <input
              type="password"
              value={confirmPassword}
              maxLength={128}
              autoComplete="new-password"
              onChange={(event) => {
                setConfirmPassword(
                  event.target.value,
                );
              }}
              className="rounded-xl border border-slate-300 px-4 py-2.5 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              placeholder="Ripeti la password"
            />
          </label>
        )}


        {displayedError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
            {displayedError}
          </div>
        )}


        <button
          type="submit"
          disabled={
            isAuthActionLoading
          }
          className="
            rounded-xl bg-emerald-700
            px-5 py-3 text-sm
            font-semibold text-white
            transition
            hover:bg-emerald-800
            disabled:cursor-not-allowed
            disabled:opacity-60
          "
        >
          {isAuthActionLoading
            ? "Operazione in corso..."
            : mode === "REGISTER"
              ? "Crea account"
              : "Accedi"}
        </button>
      </form>
    </section>
  );
}