import { useState } from 'react';
import type { AdminUserFilterState, TriState } from '../../lib/admin/userFilters';
import { countActiveUserFilters, DEFAULT_USER_FILTERS } from '../../lib/admin/userFilters';
import { AdminInput } from './AdminTable';

interface AdminUserFiltersProps {
  filters: AdminUserFilterState;
  onChange: (next: AdminUserFilterState) => void;
  searchPlaceholder?: string;
}

function TriSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: TriState;
  onChange: (v: TriState) => void;
}) {
  return (
    <label className="flex min-w-[140px] flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as TriState)}
        className="admin-input rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-xs text-slate-100"
      >
        <option value="all">Todos</option>
        <option value="yes">Sim</option>
        <option value="no">Não</option>
      </select>
    </label>
  );
}

export function AdminUserFilters({
  filters,
  onChange,
  searchPlaceholder = 'Buscar e-mail, nick, ID, clube ou carteira…',
}: AdminUserFiltersProps) {
  const [expanded, setExpanded] = useState(false);
  const activeCount = countActiveUserFilters(filters);

  function patch(partial: Partial<AdminUserFilterState>) {
    onChange({ ...filters, ...partial });
  }

  function reset() {
    onChange({ ...DEFAULT_USER_FILTERS });
  }

  return (
    <div className="mb-4 space-y-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
      <div className="flex flex-wrap items-end gap-2">
        <AdminInput
          type="search"
          placeholder={searchPlaceholder}
          value={filters.search}
          onChange={(e) => patch({ search: e.target.value })}
          className="min-w-[240px] flex-1"
        />
        <TriSelect label="Banido" value={filters.banned} onChange={(banned) => patch({ banned })} />
        <TriSelect label="Depositante" value={filters.depositor} onChange={(depositor) => patch({ depositor })} />
        <TriSelect
          label="Carteira"
          value={filters.walletLinked}
          onChange={(walletLinked) => patch({ walletLinked })}
        />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-xs text-slate-300 hover:bg-white/[0.07]"
        >
          {expanded ? 'Menos filtros' : 'Mais filtros'}
          {activeCount > 0 ? (
            <span className="ml-1.5 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-300">
              {activeCount}
            </span>
          ) : null}
        </button>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={reset}
            className="rounded-lg px-3 py-2 text-xs text-slate-500 hover:text-slate-300"
          >
            Limpar
          </button>
        )}
      </div>

      {expanded && (
        <div className="flex flex-wrap gap-2 border-t border-white/[0.06] pt-3">
          <TriSelect label="Desativado" value={filters.disabled} onChange={(disabled) => patch({ disabled })} />
          <TriSelect
            label="E-mail verificado"
            value={filters.emailVerified}
            onChange={(emailVerified) => patch({ emailVerified })}
          />
          <TriSelect label="Tem clube" value={filters.hasClub} onChange={(hasClub) => patch({ hasClub })} />
          <TriSelect
            label="Ticket aberto"
            value={filters.openTickets}
            onChange={(openTickets) => patch({ openTickets })}
          />
          <TriSelect
            label="Saque pendente"
            value={filters.pendingWithdrawal}
            onChange={(pendingWithdrawal) => patch({ pendingWithdrawal })}
          />
          <TriSelect label="Indicado" value={filters.referred} onChange={(referred) => patch({ referred })} />
        </div>
      )}
    </div>
  );
}
