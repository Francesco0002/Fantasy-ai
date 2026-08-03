"use client";

import {
  useState,
} from "react";

import type {
  FormEvent,
} from "react";

import type {
  CreateSeasonLeagueInput,
} from "../types/season";


type SeasonLeagueFormProps = {
  isSubmitting: boolean;
  onCreate: (
    input: CreateSeasonLeagueInput,
  ) => Promise<void>;
};


/*
 * Form utilizzato per creare una nuova
 * lega stagionale dell'utente autenticato.
 */
export function SeasonLeagueForm({
  isSubmitting,
  onCreate,
}: SeasonLeagueFormProps) {
  const [leagueName, setLeagueName] =
    useState("");

  const [teamName, setTeamName] =
    useState("");

  const [season, setSeason] =
    useState("2026/27");

  const [error, setError] =
    useState<string | null>(null);

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);


  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const normalizedLeagueName =
      leagueName.trim();

    const normalizedTeamName =
      teamName.trim();

    const normalizedSeason =
      season.trim();

    setError(null);
    setSuccessMessage(null);


    if (
      !normalizedLeagueName ||
      !normalizedTeamName
    ) {
      setError(
        "Inserisci il nome della lega e della squadra.",
      );

      return;
    }

    if (
      !/^\d{4}\/\d{2}$/.test(
        normalizedSeason,
      )
    ) {
      setError(
        "La stagione deve rispettare il formato 2026/27.",
      );

      return;
    }


    try {
      await onCreate({
        leagueName: normalizedLeagueName,
        teamName: normalizedTeamName,
        season: normalizedSeason,
      });

      setLeagueName("");
      setTeamName("");

      setSuccessMessage(
        "Lega stagionale creata correttamente.",
      );
    } catch (caughtError) {
      if (caughtError instanceof Error) {
        setError(caughtError.message);
      } else {
        setError(
          "Non è stato possibile creare la lega.",
        );
      }
    }
  }


  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">
          Nuova lega
        </p>

        <h2 className="mt-2 text-2xl font-bold">
          Crea una lega stagionale
        </h2>

        <p className="mt-2 text-sm text-slate-600">
          Inserisci i dati principali della tua lega.
          La modalità iniziale sarà Classica.
        </p>
      </div>


      <form
        onSubmit={handleSubmit}
        className="mt-6 grid gap-4 md:grid-cols-3"
      >
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Nome della lega

          <input
            type="text"
            value={leagueName}
            onChange={(event) => {
              setLeagueName(event.target.value);
            }}
            maxLength={120}
            required
            disabled={isSubmitting}
            placeholder="Es. Lega degli amici"
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
          />
        </label>


        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Nome della squadra

          <input
            type="text"
            value={teamName}
            onChange={(event) => {
              setTeamName(event.target.value);
            }}
            maxLength={120}
            required
            disabled={isSubmitting}
            placeholder="Es. Michi FC"
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
          />
        </label>


        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Stagione

          <input
            type="text"
            value={season}
            onChange={(event) => {
              setSeason(event.target.value);
            }}
            maxLength={7}
            pattern="[0-9]{4}/[0-9]{2}"
            required
            disabled={isSubmitting}
            placeholder="2026/27"
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
          />
        </label>


        <div className="md:col-span-3">
          {error && (
            <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </p>
          )}

          {successMessage && (
            <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              {successMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isSubmitting
              ? "Creazione in corso..."
              : "Crea lega"}
          </button>
        </div>
      </form>
    </section>
  );
}