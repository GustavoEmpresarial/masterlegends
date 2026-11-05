import { useMemo, useState } from 'react';
import type {
  PassMissionConfigDTO,
  PassMissionDifficulty,
  PassMissionEvent,
} from '@mll/shared';
import { AdminButton } from '../AdminTable';
import {
  DIFFICULTY_OPTIONS,
  emptyMission,
  EVENT_TYPE_OPTIONS,
  inputCls,
  selectCls,
} from './passConstants';

export function PassMissionsEditor({
  missions,
  onChange,
}: {
  missions: PassMissionConfigDTO[];
  onChange: (next: PassMissionConfigDTO[]) => void;
}) {
  const [filter, setFilter] = useState<'all' | 'daily' | 'weekly'>('all');

  const visible = useMemo(() => {
    if (filter === 'all') return missions.map((m, i) => ({ m, i }));
    return missions.map((m, i) => ({ m, i })).filter(({ m }) => m.category === filter);
  }, [missions, filter]);

  const update = (index: number, patch: Partial<PassMissionConfigDTO>) => {
    onChange(missions.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  };

  const remove = (index: number) => onChange(missions.filter((_, i) => i !== index));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg border border-white/[0.06] p-0.5">
          {([
            ['all', 'Todas'],
            ['daily', 'Diárias'],
            ['weekly', 'Semanais'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                filter === id
                  ? 'bg-emerald-600/30 text-emerald-200'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <AdminButton
            size="sm"
            variant="secondary"
            onClick={() => onChange([...missions, emptyMission('daily')])}
            disabled={missions.length >= 40}
          >
            + Diária
          </AdminButton>
          <AdminButton
            size="sm"
            variant="secondary"
            onClick={() => onChange([...missions, emptyMission('weekly')])}
            disabled={missions.length >= 40}
          >
            + Semanal
          </AdminButton>
        </div>
      </div>

      <p className="text-xs text-slate-500">{missions.length}/40 missões</p>

      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/[0.1] py-10 text-center text-sm text-slate-500">
          Nenhuma missão neste filtro.
        </div>
      ) : (
        <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
          {visible.map(({ m, i }) => (
            <div
              key={`${m.id}-${i}`}
              className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded ${
                    m.category === 'weekly'
                      ? 'bg-purple-500/15 text-purple-300'
                      : 'bg-sky-500/15 text-sky-300'
                  }`}
                >
                  {m.category}
                </span>
                <AdminButton size="sm" variant="danger" onClick={() => remove(i)}>
                  <i className="bi bi-trash text-xs" />
                </AdminButton>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 mb-1 block">ID</label>
                  <input
                    className={inputCls}
                    value={m.id}
                    maxLength={32}
                    onChange={(e) => update(i, { id: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] text-slate-500 mb-1 block">Label</label>
                  <input
                    className={inputCls}
                    value={m.label}
                    maxLength={128}
                    onChange={(e) => update(i, { label: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 mb-1 block">XP</label>
                  <input
                    type="number"
                    min={1}
                    className={inputCls}
                    value={m.xp}
                    onChange={(e) => update(i, { xp: Math.max(1, Number(e.target.value) || 1) })}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 mb-1 block">Meta (target)</label>
                  <input
                    type="number"
                    min={1}
                    className={inputCls}
                    value={m.target}
                    onChange={(e) => update(i, { target: Math.max(1, Number(e.target.value) || 1) })}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 mb-1 block">Categoria</label>
                  <select
                    className={selectCls}
                    value={m.category}
                    onChange={(e) =>
                      update(i, { category: e.target.value as 'daily' | 'weekly' })
                    }
                  >
                    <option value="daily">Diária</option>
                    <option value="weekly">Semanal</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 mb-1 block">Dificuldade</label>
                  <select
                    className={selectCls}
                    value={m.difficulty}
                    onChange={(e) =>
                      update(i, { difficulty: e.target.value as PassMissionDifficulty })
                    }
                  >
                    {DIFFICULTY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] text-slate-500 mb-1 block">Evento</label>
                  <select
                    className={selectCls}
                    value={m.eventType}
                    onChange={(e) =>
                      update(i, { eventType: e.target.value as PassMissionEvent })
                    }
                  >
                    {EVENT_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
