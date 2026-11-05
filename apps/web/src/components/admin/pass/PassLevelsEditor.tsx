import { useState } from 'react';
import type { PassLevelConfigDTO, PassRewardCatalogItemDTO } from '@mll/shared';
import { AdminButton } from '../AdminTable';
import { emptyLevel, generateLevels, inputCls, renumberLevels } from './passConstants';
import { PassRewardPicker } from './PassRewardPicker';

export function PassLevelsEditor({ levels, onChange, catalog = [], catalogLoading, catalogError, onRetryCatalog }: {
  levels: PassLevelConfigDTO[]; onChange: (next: PassLevelConfigDTO[]) => void;
  catalog?: PassRewardCatalogItemDTO[]; catalogLoading?: boolean; catalogError?: string; onRetryCatalog?: () => void;
}) {
  const [count, setCount] = useState(10);
  const update = (index: number, patch: Partial<PassLevelConfigDTO>) => onChange(levels.map((level, i) => i === index ? { ...level, ...patch } : level));
  return <div className="space-y-4">
    <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-3 text-xs text-slate-300">Escolha o prêmio de cada nível. Itens do catálogo e stamina vão para o almoxarifado; equipamentos vão para a mochila.</div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-slate-400">{levels.length}/100 níveis com prêmios</p>
      <div className="flex flex-wrap items-center gap-2">
        <input aria-label="Quantidade de níveis a gerar" type="number" min={1} max={100} className={`${inputCls} !w-20`} value={count} onChange={event => setCount(Number(event.target.value))} />
        <AdminButton size="sm" variant="ghost" onClick={() => onChange(generateLevels(Number.isFinite(count) ? count : 1))}>Gerar níveis</AdminButton>
        <AdminButton size="sm" variant="secondary" disabled={levels.length >= 100} onClick={() => onChange([...levels, emptyLevel(levels.length + 1)])}><i className="bi bi-plus" /> Adicionar nível</AdminButton>
      </div>
    </div>
    {levels.length === 0 && <div className="rounded-lg border border-dashed border-white/10 p-6 text-center"><p className="text-sm text-slate-400 mb-3">Adicione um nível para escolher o primeiro prêmio.</p><AdminButton onClick={() => onChange([emptyLevel(1)])}>Escolher primeiro prêmio</AdminButton></div>}
    <div className="space-y-4">{levels.map((level, index) => <fieldset key={index} className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
      <legend className="px-2 text-sm font-semibold text-sky-300">Prêmio do nível {level.level}</legend>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-xs text-slate-400">XP necessário <input aria-label={`XP do nível ${level.level}`} type="number" min={0} className={`${inputCls} mt-1 !w-36`} value={level.xpRequired} onChange={event => update(index, { xpRequired: Number(event.target.value) || 0 })} /></label>
        <div className="flex gap-2"><AdminButton size="sm" variant="ghost" disabled={levels.length >= 100} onClick={() => onChange(renumberLevels([...levels.slice(0, index + 1), { ...level }, ...levels.slice(index + 1)]))}>Duplicar</AdminButton><AdminButton size="sm" variant="danger" onClick={() => onChange(renumberLevels(levels.filter((_, i) => i !== index)))}>Remover</AdminButton></div>
      </div>
      <PassRewardPicker value={level} onChange={patch => update(index, patch)} catalog={catalog} loading={catalogLoading} error={catalogError} onRetry={onRetryCatalog} />
    </fieldset>)}</div>
  </div>;
}
