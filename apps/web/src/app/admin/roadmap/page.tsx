import { useCallback, useEffect, useState } from 'react';
import type { RoadmapAdminPhaseDTO, RoadmapLocale } from '@mll/shared';
import { adminClient } from '../../../lib/api/adminClient';
import { AdminButton, AdminPageHeader } from '../../../components/admin/AdminTable';

const LOCALES: RoadmapLocale[] = ['pt-BR', 'en', 'es'];
const LOCALE_LABELS: Record<RoadmapLocale, string> = {
  'pt-BR': 'PT-BR',
  en: 'EN',
  es: 'ES',
};

const inputCls =
  'w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-emerald-500/40 focus:outline-none';
const selectCls = `${inputCls} appearance-none`;

type PhaseI18n = RoadmapAdminPhaseDTO['i18n'];
type ItemI18n = RoadmapAdminPhaseDTO['items'][0]['i18n'];

function emptyPhaseI18n(): PhaseI18n {
  return {
    'pt-BR': { phase: 'Nova fase', title: 'Título', statusLabel: 'EM BREVE' },
    en: { phase: 'New phase', title: 'Title', statusLabel: 'COMING SOON' },
    es: { phase: 'Nueva fase', title: 'Título', statusLabel: 'PRÓXIMAMENTE' },
  };
}

function emptyItemI18n(): ItemI18n {
  return {
    'pt-BR': { text: 'Novo item' },
    en: { text: 'New item' },
    es: { text: 'Nuevo ítem' },
  };
}

function LocaleTabs({
  locale,
  onChange,
}: {
  locale: RoadmapLocale;
  onChange: (l: RoadmapLocale) => void;
}) {
  return (
    <div className="flex gap-1 mb-3">
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onChange(l)}
          className={`px-3 py-1 text-xs rounded-md border ${
            locale === l
              ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-200'
              : 'border-white/10 text-slate-400 hover:text-slate-200'
          }`}
        >
          {LOCALE_LABELS[l]}
        </button>
      ))}
    </div>
  );
}

export function AdminRoadmapPage() {
  const [phases, setPhases] = useState<RoadmapAdminPhaseDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [locale, setLocale] = useState<RoadmapLocale>('pt-BR');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await adminClient.get<{ phases: RoadmapAdminPhaseDTO[] }>('/roadmap');
      setPhases(data.phases);
    } catch {
      setError('Falha ao carregar roadmap.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function savePhase(phase: RoadmapAdminPhaseDTO) {
    setSaving(true);
    try {
      await adminClient.patch(`/roadmap/phases/${phase.id}`, {
        status: phase.status,
        color: phase.color,
        visible: phase.visible,
        order: phase.order,
        i18n: phase.i18n,
      });
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function saveItem(phaseId: string, item: RoadmapAdminPhaseDTO['items'][0]) {
    setSaving(true);
    try {
      await adminClient.patch(`/roadmap/items/${item.id}`, {
        done: item.done,
        visible: item.visible,
        order: item.order,
        i18n: item.i18n,
      });
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function addPhase() {
    setSaving(true);
    try {
      await adminClient.post('/roadmap/phases', {
        status: 'upcoming',
        color: 'var(--blue)',
        visible: true,
        i18n: emptyPhaseI18n(),
      });
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function addItem(phaseId: string) {
    setSaving(true);
    try {
      await adminClient.post('/roadmap/items', {
        phaseId,
        i18n: emptyItemI18n(),
      });
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function deletePhase(id: string) {
    if (!confirm('Excluir esta fase e todos os itens?')) return;
    await adminClient.delete(`/roadmap/phases/${id}`);
    await load();
  }

  async function deleteItem(id: string) {
    if (!confirm('Excluir este item?')) return;
    await adminClient.delete(`/roadmap/items/${id}`);
    await load();
  }

  async function movePhase(id: string, dir: -1 | 1) {
    const sorted = [...phases].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((p) => p.id === id);
    const swap = idx + dir;
    if (swap < 0 || swap >= sorted.length) return;
    const reordered = sorted.map((p, i) => {
      if (i === idx) return { id: p.id, order: sorted[swap]!.order };
      if (i === swap) return { id: p.id, order: sorted[idx]!.order };
      return { id: p.id, order: p.order };
    });
    await adminClient.patch('/roadmap/reorder', { phases: reordered });
    await load();
  }

  function updatePhaseLocal(id: string, patch: Partial<RoadmapAdminPhaseDTO>) {
    setPhases((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function updatePhaseI18n(id: string, loc: RoadmapLocale, field: keyof PhaseI18n['pt-BR'], value: string) {
    setPhases((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        return {
          ...p,
          i18n: {
            ...p.i18n,
            [loc]: { ...p.i18n[loc], [field]: value },
          },
        };
      }),
    );
  }

  function updateItemLocal(phaseId: string, itemId: string, patch: Partial<RoadmapAdminPhaseDTO['items'][0]>) {
    setPhases((prev) =>
      prev.map((p) => {
        if (p.id !== phaseId) return p;
        return {
          ...p,
          items: p.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
        };
      }),
    );
  }

  function updateItemI18n(phaseId: string, itemId: string, loc: RoadmapLocale, text: string) {
    setPhases((prev) =>
      prev.map((p) => {
        if (p.id !== phaseId) return p;
        return {
          ...p,
          items: p.items.map((item) => {
            if (item.id !== itemId) return item;
            return { ...item, i18n: { ...item.i18n, [loc]: { text } } };
          }),
        };
      }),
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Roadmap"
        subtitle="Monte e edite fases e itens do roadmap público (3 idiomas)."
        actions={
          <AdminButton onClick={() => void addPhase()} disabled={saving}>
            + Nova fase
          </AdminButton>
        }
      />

      {error && <p className="text-sm text-red-400">{error}</p>}
      {loading ? (
        <p className="text-slate-400 text-sm">Carregando…</p>
      ) : (
        <div className="space-y-4">
          <LocaleTabs locale={locale} onChange={setLocale} />

          {[...phases]
            .sort((a, b) => a.order - b.order)
            .map((phase) => (
              <div
                key={phase.id}
                className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden"
              >
                <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
                  <button type="button" onClick={() => setExpandedId(expandedId === phase.id ? null : phase.id)} className="text-slate-300 hover:text-white">
                    {expandedId === phase.id ? '▼' : '▶'}
                  </button>
                  <span className="text-sm font-medium text-slate-200 flex-1">
                    {phase.i18n[locale]?.title ?? phase.i18n['pt-BR'].title}
                  </span>
                  <span className="text-xs text-slate-500">#{phase.order + 1}</span>
                  <button type="button" onClick={() => void movePhase(phase.id, -1)} className="text-xs text-slate-400 hover:text-white px-2">↑</button>
                  <button type="button" onClick={() => void movePhase(phase.id, 1)} className="text-xs text-slate-400 hover:text-white px-2">↓</button>
                  <button type="button" onClick={() => void deletePhase(phase.id)} className="text-xs text-red-400 hover:text-red-300 px-2">Excluir</button>
                </div>

                {expandedId === phase.id && (
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Status</label>
                        <select
                          value={phase.status}
                          onChange={(e) => updatePhaseLocal(phase.id, { status: e.target.value })}
                          className={selectCls}
                        >
                          <option value="done">done</option>
                          <option value="active">active</option>
                          <option value="upcoming">upcoming</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Cor (CSS)</label>
                        <input
                          value={phase.color}
                          onChange={(e) => updatePhaseLocal(phase.id, { color: e.target.value })}
                          className={inputCls}
                        />
                      </div>
                      <div className="flex items-end">
                        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={phase.visible}
                            onChange={(e) => updatePhaseLocal(phase.id, { visible: e.target.checked })}
                          />
                          Visível
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {(['phase', 'title', 'statusLabel'] as const).map((field) => (
                        <div key={field}>
                          <label className="text-xs text-slate-400 block mb-1 capitalize">{field} ({LOCALE_LABELS[locale]})</label>
                          <input
                            value={phase.i18n[locale]?.[field] ?? ''}
                            onChange={(e) => updatePhaseI18n(phase.id, locale, field, e.target.value)}
                            className={inputCls}
                          />
                        </div>
                      ))}
                    </div>

                    <AdminButton onClick={() => void savePhase(phase)} disabled={saving}>
                      Salvar fase
                    </AdminButton>

                    <div className="border-t border-white/[0.06] pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-slate-300">Itens</h3>
                        <AdminButton onClick={() => void addItem(phase.id)} disabled={saving}>
                          + Item
                        </AdminButton>
                      </div>

                      {phase.items.map((item) => (
                        <div key={item.id} className="rounded-lg border border-white/[0.06] p-3 space-y-2">
                          <div className="flex gap-2 items-start">
                            <input
                              value={item.i18n[locale]?.text ?? ''}
                              onChange={(e) => updateItemI18n(phase.id, item.id, locale, e.target.value)}
                              className={inputCls}
                            />
                            <label className="flex items-center gap-1 text-xs text-slate-400 shrink-0 pt-2">
                              <input
                                type="checkbox"
                                checked={item.done}
                                onChange={(e) => updateItemLocal(phase.id, item.id, { done: e.target.checked })}
                              />
                              OK
                            </label>
                            <button type="button" onClick={() => void deleteItem(item.id)} className="text-xs text-red-400 shrink-0 pt-2">×</button>
                          </div>
                          <AdminButton onClick={() => void saveItem(phase.id, item)} disabled={saving}>
                            Salvar item
                          </AdminButton>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
