"use client";

/*
 * Menu personalizzato utilizzato
 * anche nella modalità asta.
 */
import CustomSelect from
  "./ui/CustomSelect";

/*
 * Tipi utilizzati dai controlli
 * di filtro e ordinamento.
 */
import type {
  Role,
  SortOption,
} from "../types/player";

/*
 * Proprietà ricevute dal componente.
 *
 * I valori arrivano dalla pagina principale,
 * mentre le funzioni onChange comunicano
 * alla pagina le scelte dell'utente.
 */
type PlayerFiltersProps = {
  search: string;
  role: Role;
  sortBy: SortOption;

  onSearchChange: (
    value: string,
  ) => void;

  onRoleChange: (
    value: Role,
  ) => void;

  onSortChange: (
    value: SortOption,
  ) => void;
};

/*
 * Opzioni disponibili per
 * il filtro dei ruoli.
 */
const ROLE_OPTIONS = [
  {
    value: "",
    label: "Tutti i ruoli",
  },
  {
    value: "P",
    label: "Portieri",
  },
  {
    value: "D",
    label: "Difensori",
  },
  {
    value: "C",
    label: "Centrocampisti",
  },
  {
    value: "A",
    label: "Attaccanti",
  },
];

/*
 * Opzioni disponibili per
 * l'ordinamento dei giocatori.
 */
const SORT_OPTIONS = [
  {
    value: "role_asc",
    label: "Ruolo",
  },
  {
    value: "score_desc",
    label: "Punteggio Fantasy AI",
  },
  {
    value: "starting_desc",
    label: "Probabilità titolare",
  },
  {
    value: "injury_asc",
    label: "Minor rischio infortunio",
  },
];

/*
 * Pannello contenente ricerca,
 * filtro per ruolo e ordinamento.
 */
export default function PlayerFilters({
  search,
  role,
  sortBy,
  onSearchChange,
  onRoleChange,
  onSortChange,
}: PlayerFiltersProps) {
  return (
    <section className="mb-8 grid gap-4 rounded-2xl bg-white p-5 shadow-sm md:grid-cols-3">
      {/* Ricerca per nome del giocatore o squadra */}
      <div>
        <label
          htmlFor="player-search"
          className="mb-2 block text-sm font-semibold"
        >
          Cerca giocatore o squadra
        </label>

        <input
          id="player-search"
          type="search"
          value={search}
          onChange={(event) => {
            onSearchChange(
              event.target.value,
            );
          }}
          placeholder="Esempio: Colombo"
          className="
            w-full rounded-xl
            border border-slate-300
            px-4 py-3
            outline-none transition
            focus:border-emerald-600
            focus:ring-2
            focus:ring-emerald-100
          "
        />
      </div>

      {/* Filtro per ruolo */}
      <div>
        <label
          htmlFor="role-filter"
          className="mb-2 block text-sm font-semibold"
        >
          Filtra per ruolo
        </label>

        <CustomSelect
          id="role-filter"
          value={role}
          tone="emerald"
          options={ROLE_OPTIONS}
          onChange={(value) => {
            onRoleChange(
              value as Role,
            );
          }}
        />
      </div>

      {/* Ordinamento dei risultati */}
      <div>
        <label
          htmlFor="sort-filter"
          className="mb-2 block text-sm font-semibold"
        >
          Ordina per
        </label>

        <CustomSelect
          id="sort-filter"
          value={sortBy}
          tone="emerald"
          options={SORT_OPTIONS}
          onChange={(value) => {
            onSortChange(
              value as SortOption,
            );
          }}
        />
      </div>
    </section>
  );
}