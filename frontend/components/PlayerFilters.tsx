"use client";

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

  onSearchChange: (value: string) => void;
  onRoleChange: (value: Role) => void;
  onSortChange: (value: SortOption) => void;
};

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
            onSearchChange(event.target.value);
          }}
          placeholder="Esempio: Colombo"
          className="
            w-full rounded-xl border border-slate-300
            px-4 py-3 outline-none transition
            focus:border-emerald-600
            focus:ring-2 focus:ring-emerald-100
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

        <select
          id="role-filter"
          value={role}
          onChange={(event) => {
            onRoleChange(event.target.value as Role);
          }}
          className="
            w-full rounded-xl border border-slate-300
            bg-white px-4 py-3 outline-none transition
            focus:border-emerald-600
            focus:ring-2 focus:ring-emerald-100
          "
        >
          <option value="">Tutti i ruoli</option>
          <option value="P">Portieri</option>
          <option value="D">Difensori</option>
          <option value="C">Centrocampisti</option>
          <option value="A">Attaccanti</option>
        </select>
      </div>

      {/* Ordinamento dei risultati */}
      <div>
        <label
          htmlFor="sort-filter"
          className="mb-2 block text-sm font-semibold"
        >
          Ordina per
        </label>

        <select
          id="sort-filter"
          value={sortBy}
          onChange={(event) => {
            onSortChange(
              event.target.value as SortOption,
            );
          }}
          className="
            w-full rounded-xl border border-slate-300
            bg-white px-4 py-3 outline-none transition
            focus:border-emerald-600
            focus:ring-2 focus:ring-emerald-100
          "
        >
          <option value="score_desc">
            Punteggio Fantasy AI
          </option>

          <option value="price_desc">
            Prezzo consigliato
          </option>

          <option value="starting_desc">
            Probabilità titolare
          </option>

          <option value="injury_asc">
            Minor rischio infortunio
          </option>

          <option value="name_asc">
            Nome alfabetico
          </option>
        </select>
      </div>
    </section>
  );
}