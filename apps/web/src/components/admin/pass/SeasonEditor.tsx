import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  passSeasonCreateSchema,
  findRewardBlockForLevel,
  type PassRewardCatalogItemDTO,
  type PassLevelConfigDTO,
  type PassMissionConfigDTO,
  type PassRewardBlockDTO,
  type PassSeasonDTO,
} from '@mll/shared';
import { isAxiosError } from 'axios';
import { adminClient } from '../../../lib/api/adminClient';
import { AdminButton } from '../AdminTable';
import { PassLevelsEditor } from './PassLevelsEditor';
import { PassMetaForm, type PassMetaState } from './PassMetaForm';
import { PassMissionsEditor } from './PassMissionsEditor';
import { PassRewardBlocksEditor } from './PassRewardBlocksEditor';
import { PassSeasonPreview } from './PassSeasonPreview';
import {
  defaultSeasonDates,
  emptyLevel,
  selectCls,
  toDatetimeLocal,
  totalXpSpan,
} from './passConstants';

type TabId = 'meta' | 'levels' | 'missions' | 'blocks' | 'preview';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'meta', label: 'Dados da temporada', icon: 'bi-sliders' },
  { id: 'levels', label: 'Prêmios por nível', icon: 'bi-layers' },
  { id: 'missions', label: 'Missões', icon: 'bi-list-check' },
  { id: 'blocks', label: 'Prêmios por faixa', icon: 'bi-gift' },
  { id: 'preview', label: 'Preview', icon: 'bi-eye' },
];

function seasonToMeta(season?: PassSeasonDTO | null): PassMetaState {
  const dates = defaultSeasonDates();
  if (!season) {
    return {
      name: 'Temporada 1',
      premiumPriceUsdc: '500',
      startsAt: dates.startsAt,
      endsAt: dates.endsAt,
      active: false,
    };
  }
  return {
    name: season.name,
    premiumPriceUsdc: String(season.premiumPriceUsdc),
    startsAt: toDatetimeLocal(season.startsAt),
    endsAt: toDatetimeLocal(season.endsAt),
    active: season.active,
  };
}

export function SeasonEditor({
  season,
  seasons,
  autoLoadTemplate = false,
  onCancel,
  onSaved,
}: {
  season: PassSeasonDTO | null;
  seasons: PassSeasonDTO[];
  autoLoadTemplate?: boolean;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const isEdit = season != null;
  const [tab, setTab] = useState<TabId>(season ? 'meta' : 'levels');
  const [meta, setMeta] = useState<PassMetaState>(() => seasonToMeta(season));
  const [levels, setLevels] = useState<PassLevelConfigDTO[]>(() => season?.levels ?? [emptyLevel(1)]);
  const [missions, setMissions] = useState<PassMissionConfigDTO[]>(() => season?.missions ?? []);
  const [rewardBlocks, setRewardBlocks] = useState<PassRewardBlockDTO[]>(
    () => season?.rewardBlocks ?? [],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [cloneId, setCloneId] = useState('');
  const [catalog, setCatalog] = useState<PassRewardCatalogItemDTO[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true); setCatalogError('');
    try { const { data } = await adminClient.get<{ items: PassRewardCatalogItemDTO[] }>('/pass/reward-catalog'); setCatalog(data.items); }
    catch { setCatalogError('Não foi possível carregar os prêmios do catálogo.'); }
    finally { setCatalogLoading(false); }
  }, []);
  useEffect(() => { void loadCatalog(); }, [loadCatalog]);
  const catalogProps = { catalog, catalogLoading, catalogError, onRetryCatalog: loadCatalog };
  const safeDate = (value: string) => { const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toISOString() : ''; };

  const premiumNum = Number(meta.premiumPriceUsdc);
  const payload = useMemo(
    () => ({
      name: meta.name.trim(),
      startsAt: safeDate(meta.startsAt),
      endsAt: safeDate(meta.endsAt),
      premiumPriceUsdc: Number.isFinite(premiumNum) ? premiumNum : 0,
      active: meta.active,
      levels: levels.map(level => { const block = findRewardBlockForLevel(level.level, rewardBlocks); return block ? { ...level, ...block, level: level.level, xpRequired: level.xpRequired } : level; }),
      missions,
      rewardBlocks,
    }),
    [meta, levels, missions, rewardBlocks, premiumNum],
  );

  async function loadTemplate() {
    setError('');
    try {
      const { data } = await adminClient.get<{
        levels: PassLevelConfigDTO[];
        missions: PassMissionConfigDTO[];
      }>('/pass/template');
      setLevels(data.levels.map(level => level.rewardType === 'usdc' ? { ...level, rewardLabel: level.rewardLabel.replace(/USDC/g, 'GMT') } : level));
      setMissions(data.missions);
      setTab('levels');
    } catch {
      setError('Não foi possível carregar o template padrão.');
    }
  }

  useEffect(() => {
    if (autoLoadTemplate && !isEdit) void loadTemplate();
  }, [autoLoadTemplate, isEdit]);

  function cloneFrom(id: string) {
    const src = seasons.find((s) => String(s.id) === id);
    if (!src) return;
    setLevels(structuredClone(src.levels));
    setMissions(structuredClone(src.missions));
    setRewardBlocks(structuredClone(src.rewardBlocks ?? []));
    setTab('levels');
  }

  async function save() {
    setError('');
    const parsed = passSeasonCreateSchema.safeParse(payload);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const msg = issue?.path?.includes('rewardItemId') ? 'Selecione um prêmio do catálogo para cada nível ou faixa.' : issue?.path?.includes('rewardLabel') ? 'Escolha e configure o prêmio deste nível.' : issue?.path?.includes('startsAt') || issue?.path?.includes('endsAt') ? 'Informe datas válidas e um fim posterior ao início.' : issue?.message ?? 'Dados inválidos';
      const path = parsed.error.issues[0]?.path?.join('.') ?? '';
      setError(path ? `${path}: ${msg}` : msg);
      if (path.startsWith('levels')) setTab('levels');
      else if (path.startsWith('missions')) setTab('missions');
      else if (path.startsWith('rewardBlocks')) setTab('blocks');
      else setTab('meta');
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await adminClient.patch(`/pass/seasons/${season.id}`, parsed.data);
      } else {
        await adminClient.post('/pass/seasons', parsed.data);
      }
      onSaved();
    } catch (e) {
      if (isAxiosError(e)) {
        const data = e.response?.data as { error?: { message?: string; code?: string } } | undefined;
        setError((e.response?.data as { error?: { details?: { message?: string } } })?.error?.details?.message ?? data?.error?.message ?? e.message ?? 'Erro ao salvar');
      } else {
        setError(e instanceof Error ? e.message : 'Erro ao salvar');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-card p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">
            {isEdit ? `Editar · ${season.name}` : 'Nova temporada'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {levels.length} níveis · {missions.length} missões · {rewardBlocks.length} blocos · XP máx{' '}
            {totalXpSpan(levels).toLocaleString('pt-BR')}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <AdminButton size="sm" variant="ghost" onClick={() => void loadTemplate()}>
            <i className="bi bi-download text-xs" /> Template padrão
          </AdminButton>
          {seasons.length > 0 && (
            <div className="flex items-center gap-1">
              <select
                className={`${selectCls} w-40 py-1.5 text-xs`}
                value={cloneId}
                onChange={(e) => setCloneId(e.target.value)}
              >
                <option value="">Clonar de…</option>
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    #{s.id} {s.name}
                  </option>
                ))}
              </select>
              <AdminButton
                size="sm"
                variant="secondary"
                disabled={!cloneId}
                onClick={() => cloneFrom(cloneId)}
              >
                Clonar
              </AdminButton>
            </div>
          )}
          <AdminButton size="sm" variant="ghost" onClick={onCancel}>
            Cancelar
          </AdminButton>
          <AdminButton size="sm" onClick={() => void save()} disabled={saving}>
            {saving ? 'Salvando…' : isEdit ? 'Salvar alterações' : 'Criar temporada'}
          </AdminButton>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-white/[0.06] pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-colors ${
              tab === t.id
                ? 'bg-white/[0.06] text-emerald-300 border border-b-0 border-white/[0.08]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <i className={`bi ${t.icon}`} />
            {t.label}
            {t.id === 'levels' && (
              <span className="text-[10px] text-slate-500">{levels.length}</span>
            )}
            {t.id === 'missions' && (
              <span className="text-[10px] text-slate-500">{missions.length}</span>
            )}
            {t.id === 'blocks' && (
              <span className="text-[10px] text-slate-500">{rewardBlocks.length}</span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {tab === 'meta' && <PassMetaForm value={meta} onChange={setMeta} />}
      {tab === 'levels' && <PassLevelsEditor levels={levels} onChange={setLevels} {...catalogProps} />}
      {tab === 'missions' && <PassMissionsEditor missions={missions} onChange={setMissions} />}
      {tab === 'blocks' && (
        <PassRewardBlocksEditor blocks={rewardBlocks} onChange={setRewardBlocks} {...catalogProps} />
      )}
      {tab === 'preview' && (
        <PassSeasonPreview
          name={meta.name}
          premiumPriceUsdc={Number.isFinite(premiumNum) ? premiumNum : 0}
          levels={levels}
          missions={missions}
          rewardBlocks={rewardBlocks}
        />
      )}

      <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.04]">
        <AdminButton variant="ghost" onClick={onCancel}>
          Cancelar
        </AdminButton>
        <AdminButton onClick={() => void save()} disabled={saving}>
          {saving ? (
            <>
              <i className="bi bi-arrow-repeat animate-spin text-xs" /> Salvando…
            </>
          ) : (
            <>
              <i className="bi bi-check-circle text-xs" />
              {isEdit ? 'Salvar alterações' : 'Criar temporada'}
            </>
          )}
        </AdminButton>
      </div>
    </div>
  );
}
