import { useEffect, useState } from 'react';
import type { StadiumTemplateDTO } from '@mll/shared';
import { adminClient } from '../../../lib/api/adminClient';
import { resolveUploadUrl } from '../../../lib/resolveUploadUrl';
import {
  AdminPageHeader,
  AdminBadge,
  AdminButton,
} from '../../../components/admin/AdminTable';
import { StadiumBuilder } from '../../../components/admin/StadiumBuilder';

export function AdminStadiumsPage() {
  const [stadiums, setStadiums] = useState<StadiumTemplateDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<StadiumTemplateDTO | 'new' | null>(null);
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    try {
      const { data } = await adminClient.get<{ stadiums: StadiumTemplateDTO[] }>('/stadiums');
      setStadiums(data.stadiums);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function toggleActive(id: string, active: boolean) {
    await adminClient.post(`/stadiums/${id}/active`, { active });
    void load();
  }

  async function remove(id: string) {
    if (!window.confirm('Excluir este template de estádio?')) return;
    try {
      await adminClient.delete(`/stadiums/${id}`);
      setMessage('Estádio excluído com sucesso');
      void load();
    } catch {
      setMessage('Não foi possível excluir (padrão ou em uso)');
    }
  }

  if (editing !== null) {
    return (
      <StadiumBuilder
        initial={editing === 'new' ? null : editing}
        stadiumOptions={stadiums.map((s) => ({ id: s.id, name: s.name }))}
        onSaved={() => { setEditing(null); void load(); }}
        onCancel={() => { setEditing(null); void load(); }}
      />
    );
  }

  const activeCount = stadiums.filter((s) => s.active).length;
  const totalSlots = stadiums.reduce((sum, s) => sum + s.slots.length, 0);
  const paidCount = stadiums.filter((s) => s.priceUsdc != null && s.priceUsdc > 0).length;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Estádios"
        subtitle="Templates visuais de estádio — posicione slots para NFTs/jogadores"
        actions={
          <AdminButton onClick={() => setEditing('new')}>
            <i className="bi bi-plus-circle text-xs" /> Novo estádio
          </AdminButton>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total de estádios', value: stadiums.length, icon: 'bi-building', accent: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/20' },
          { label: 'Ativos', value: activeCount, icon: 'bi-check-circle-fill', accent: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
          { label: 'Pagos', value: paidCount, icon: 'bi-currency-dollar', accent: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
        ].map(({ label, value, icon, accent, bg }) => (
          <div key={label} className="admin-card p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${bg}`}>
                <i className={`bi ${icon} text-xs ${accent}`} />
              </span>
            </div>
            <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Feedback */}
      {message && (
        <p className={`rounded-xl border px-4 py-2 text-sm ${
          message.includes('sucesso')
            ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
            : 'border-red-500/25 bg-red-500/10 text-red-300'
        }`}>
          {message}
        </p>
      )}

      {loading ? (
        <div className="admin-card flex items-center justify-center py-16">
          <p className="text-sm text-slate-400">Carregando estádios…</p>
        </div>
      ) : stadiums.length === 0 ? (
        <div className="admin-card flex flex-col items-center justify-center py-16 text-center">
          <i className="bi bi-building text-3xl text-slate-600 mb-3" />
          <p className="text-sm text-slate-500">Nenhum template cadastrado.</p>
          <AdminButton className="mt-4" onClick={() => setEditing('new')}>
            <i className="bi bi-plus-circle text-xs" /> Criar primeiro estádio
          </AdminButton>
        </div>
      ) : (
        /* Card grid */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stadiums.map((st) => (
            <div
              key={st.id}
              className={`group rounded-xl border bg-white/[0.02] overflow-hidden transition-colors hover:border-white/[0.12] ${
                st.active ? 'border-white/[0.08]' : 'border-white/[0.04] opacity-60'
              }`}
            >
              {/* Preview */}
              <div className="relative h-36 bg-[#060d14] overflow-hidden">
                <img
                  src={resolveUploadUrl(st.imageUrl)}
                  alt={st.name}
                  className="h-full w-full object-cover opacity-80 transition-transform duration-300 group-hover:scale-105"
                />
                {/* Overlay badges */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                  {st.isDefault && (
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                      DEFAULT
                    </span>
                  )}
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                    st.active
                      ? 'border-emerald-500/25 bg-emerald-500/15 text-emerald-300'
                      : 'border-white/[0.08] bg-black/40 text-slate-400'
                  }`}>
                    {st.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                {/* Slot dots overlay */}
                <div className="absolute bottom-2 right-2">
                  <span className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-slate-300">
                    <i className="bi bi-grid-3x3 text-[9px]" />
                    {st.slots.length} slots
                  </span>
                </div>
              </div>

              {/* Info */}
              <div className="p-3">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="font-semibold text-slate-200 text-sm">{st.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {st.priceUsdc != null && st.priceUsdc > 0
                        ? <span className="text-amber-400 font-mono">${st.priceUsdc} USDC</span>
                        : <span className="text-emerald-400">Grátis</span>
                      }
                    </p>
                  </div>
                  <AdminBadge variant={st.active ? 'success' : 'default'}>
                    {st.slots.length} slots
                  </AdminBadge>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <AdminButton
                    size="sm"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setEditing(st)}
                  >
                    <i className="bi bi-pencil text-xs" /> Editar
                  </AdminButton>
                  <AdminButton
                    size="sm"
                    variant={st.active ? 'ghost' : 'secondary'}
                    onClick={() => void toggleActive(st.id, !st.active)}
                  >
                    <i className={`bi ${st.active ? 'bi-pause-circle' : 'bi-play-circle'} text-xs`} />
                    {st.active ? 'Desativar' : 'Ativar'}
                  </AdminButton>
                  {!st.isDefault && (
                    <AdminButton
                      size="sm"
                      variant="danger"
                      onClick={() => void remove(st.id)}
                    >
                      <i className="bi bi-trash text-xs" />
                    </AdminButton>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Add new card */}
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/[0.08] bg-white/[0.01] text-slate-500 transition-colors hover:border-white/[0.16] hover:text-slate-300"
          >
            <i className="bi bi-plus-circle text-2xl" />
            <span className="text-sm font-medium">Novo estádio</span>
          </button>
        </div>
      )}

      {/* Summary footer */}
      {stadiums.length > 0 && (
        <p className="text-xs text-slate-600 text-center">
          {stadiums.length} estádios · {totalSlots} slots no total · {activeCount} ativos
        </p>
      )}
    </div>
  );
}
