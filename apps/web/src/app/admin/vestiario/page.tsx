import { useEffect, useState } from 'react';
import type { VestiarioTemplateDTO } from '@mll/shared';
import { adminClient } from '../../../lib/api/adminClient';
import { resolveUploadUrl } from '../../../lib/resolveUploadUrl';
import {
  AdminPageHeader,
  AdminBadge,
  AdminButton,
} from '../../../components/admin/AdminTable';
import { VestiarioBuilder } from '../../../components/admin/VestiarioBuilder';

export function AdminVestiarioPage() {
  const [templates, setTemplates] = useState<VestiarioTemplateDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<VestiarioTemplateDTO | 'new' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const { data } = await adminClient.get<{ templates: VestiarioTemplateDTO[] }>('/vestiario-templates');
      setTemplates(data.templates);
    } catch {
      setError('Não foi possível carregar os vestiários');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function toggleActive(id: string, active: boolean) {
    await adminClient.post(`/vestiario-templates/${id}/active`, { active });
    void load();
  }

  async function setDefault(id: string) {
    await adminClient.post(`/vestiario-templates/${id}/default`, {});
    setMessage('Vestiário padrão atualizado');
    void load();
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`Excluir "${name}"?`)) return;
    try {
      await adminClient.delete(`/vestiario-templates/${id}`);
      setMessage('Vestiário excluído');
      void load();
    } catch {
      setMessage('Não é possível excluir o vestiário padrão');
    }
  }

  if (editing !== null) {
    return (
      <VestiarioBuilder
        initial={editing === 'new' ? null : editing}
        onSaved={() => { setEditing(null); void load(); }}
        onCancel={() => { setEditing(null); void load(); }}
      />
    );
  }

  const activeCount = templates.filter((t) => t.active).length;
  const defaultTemplate = templates.find((t) => t.isDefault);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Vestiários"
        subtitle="Templates de vestiário — defina fundo e posições de escalação exibidas no clube"
        actions={
          <AdminButton onClick={() => setEditing('new')}>
            <i className="bi bi-plus-circle text-xs" /> Novo vestiário
          </AdminButton>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', value: templates.length, icon: 'bi-layout-text-sidebar', accent: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/20' },
          { label: 'Ativos', value: activeCount, icon: 'bi-check-circle-fill', accent: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
          { label: 'Padrão', value: defaultTemplate?.name ?? '—', icon: 'bi-star-fill', accent: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
        ].map(({ label, value, icon, accent, bg }) => (
          <div key={label} className="admin-card p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${bg}`}>
                <i className={`bi ${icon} text-xs ${accent}`} />
              </span>
            </div>
            <p className="mt-2 text-xl font-semibold text-white truncate">{value}</p>
          </div>
        ))}
      </div>

      {/* Feedback */}
      {(message || error) && (
        <p className={`rounded-xl border px-4 py-2 text-sm ${
          error
            ? 'border-red-500/25 bg-red-500/10 text-red-300'
            : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
        }`}>
          {error || message}
        </p>
      )}

      {loading ? (
        <div className="admin-card flex items-center justify-center py-16">
          <p className="text-sm text-slate-400">Carregando vestiários…</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="admin-card flex flex-col items-center justify-center py-16 text-center">
          <i className="bi bi-people text-3xl text-slate-600 mb-3" />
          <p className="text-sm text-slate-500">Nenhum vestiário cadastrado.</p>
          <AdminButton className="mt-4" onClick={() => setEditing('new')}>
            <i className="bi bi-plus-circle text-xs" /> Criar primeiro vestiário
          </AdminButton>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <div
              key={t.id}
              className={`group rounded-xl border bg-white/[0.02] overflow-hidden transition-colors hover:border-white/[0.12] ${
                t.active ? 'border-white/[0.08]' : 'border-white/[0.04] opacity-60'
              }`}
            >
              {/* Preview */}
              <div className="relative h-36 bg-[#060d14] overflow-hidden">
                {t.imageUrl ? (
                  t.backgroundType === 'video' ? (
                    <video
                      src={resolveUploadUrl(t.imageUrl)}
                      className="h-full w-full object-cover opacity-80 transition-transform duration-300 group-hover:scale-105"
                      muted loop autoPlay playsInline
                    />
                  ) : (
                    <img
                      src={resolveUploadUrl(t.imageUrl)}
                      alt={t.name}
                      className="h-full w-full object-cover opacity-80 transition-transform duration-300 group-hover:scale-105"
                    />
                  )
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <i className="bi bi-image text-3xl text-slate-700" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                {/* Badges */}
                <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                  {t.isDefault && (
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                      <i className="bi bi-star-fill mr-0.5" />PADRÃO
                    </span>
                  )}
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                    t.active
                      ? 'border-emerald-500/25 bg-emerald-500/15 text-emerald-300'
                      : 'border-white/[0.08] bg-black/40 text-slate-400'
                  }`}>
                    {t.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                {/* Slot count */}
                <div className="absolute bottom-2 right-2">
                  <span className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-slate-300">
                    <i className="bi bi-grid-3x3 text-[9px]" />
                    {t.slots.length} slots
                  </span>
                </div>
              </div>

              {/* Info */}
              <div className="p-3">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="font-semibold text-slate-200 text-sm">{t.name}</p>
                    {t.backgroundType === 'video' && (
                      <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                        <i className="bi bi-film" /> Vídeo
                      </p>
                    )}
                  </div>
                  <AdminBadge variant={t.active ? 'success' : 'default'}>
                    {t.slots.length} slots
                  </AdminBadge>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-1.5">
                  <AdminButton size="sm" variant="secondary" className="flex-1" onClick={() => setEditing(t)}>
                    <i className="bi bi-pencil text-xs" /> Editar
                  </AdminButton>
                  {!t.isDefault && (
                    <AdminButton size="sm" variant="ghost" onClick={() => void setDefault(t.id)} title="Definir como padrão">
                      <i className="bi bi-star text-xs" />
                    </AdminButton>
                  )}
                  <AdminButton
                    size="sm"
                    variant={t.active ? 'ghost' : 'secondary'}
                    onClick={() => void toggleActive(t.id, !t.active)}
                    title={t.active ? 'Desativar' : 'Ativar'}
                  >
                    <i className={`bi ${t.active ? 'bi-pause-circle' : 'bi-play-circle'} text-xs`} />
                  </AdminButton>
                  {!t.isDefault && (
                    <AdminButton size="sm" variant="danger" onClick={() => void remove(t.id, t.name)}>
                      <i className="bi bi-trash text-xs" />
                    </AdminButton>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Add card */}
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/[0.08] bg-white/[0.01] text-slate-500 transition-colors hover:border-white/[0.16] hover:text-slate-300"
          >
            <i className="bi bi-plus-circle text-2xl" />
            <span className="text-sm font-medium">Novo vestiário</span>
          </button>
        </div>
      )}

      {templates.length > 0 && (
        <p className="text-xs text-slate-600 text-center">
          {templates.length} vestiários · {activeCount} ativos
        </p>
      )}
    </div>
  );
}
