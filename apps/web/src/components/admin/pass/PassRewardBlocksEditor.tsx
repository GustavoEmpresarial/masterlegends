import type { PassRewardBlockDTO, PassRewardCatalogItemDTO } from '@mll/shared';
import { passRewardBlocksSchema } from '@mll/shared';
import { AdminButton } from '../AdminTable';
import { emptyRewardBlock, inputCls } from './passConstants';
import { PassRewardPicker } from './PassRewardPicker';

export function PassRewardBlocksEditor({ blocks, onChange, catalog = [], catalogLoading, catalogError, onRetryCatalog }: {
  blocks: PassRewardBlockDTO[]; onChange: (next: PassRewardBlockDTO[]) => void;
  catalog?: PassRewardCatalogItemDTO[]; catalogLoading?: boolean; catalogError?: string; onRetryCatalog?: () => void;
}) {
  const parsed = passRewardBlocksSchema.safeParse(blocks);
  const overlap = !parsed.success && parsed.error.issues.some(issue => issue.message === 'reward blocks overlap');
  const update = (index: number, patch: Partial<PassRewardBlockDTO>) => onChange(blocks.map((block, i) => i === index ? { ...block, ...patch } : block));
  return <div className="space-y-4">
    <div className="flex flex-wrap justify-between items-center gap-2"><p className="text-xs text-slate-400">Aplique o mesmo prêmio a uma faixa de níveis. Ele substitui o prêmio individual nesses níveis.</p><AdminButton size="sm" disabled={blocks.length >= 20} onClick={() => onChange([...blocks, emptyRewardBlock()])}>Adicionar faixa</AdminButton></div>
    {overlap && <p role="alert" className="text-xs text-amber-300">As faixas de níveis não podem se sobrepor.</p>}
    {blocks.length === 0 && <p className="text-sm text-slate-500 p-6 text-center">Sem faixas: cada nível entrega seu próprio prêmio.</p>}
    {blocks.map((block, index) => <fieldset key={index} className="border border-white/10 rounded-xl p-4 space-y-3"><legend className="text-sm text-amber-300 px-2">Prêmio dos níveis {block.fromLevel} a {block.toLevel}</legend>
      <div className="flex gap-3 items-end">
        <label className="text-xs text-slate-400">Do nível<input aria-label="Do nível" className={`${inputCls} mt-1`} type="number" min={1} max={100} value={block.fromLevel} onChange={event => update(index, { fromLevel: Number(event.target.value) })} /></label>
        <label className="text-xs text-slate-400">Até o nível<input aria-label="Até o nível" className={`${inputCls} mt-1`} type="number" min={1} max={100} value={block.toLevel} onChange={event => update(index, { toLevel: Number(event.target.value) })} /></label>
        <AdminButton variant="danger" size="sm" onClick={() => onChange(blocks.filter((_, i) => i !== index))}>Remover faixa</AdminButton>
      </div>
      <PassRewardPicker value={block} onChange={patch => update(index, patch)} catalog={catalog} loading={catalogLoading} error={catalogError} onRetry={onRetryCatalog} />
    </fieldset>)}
  </div>;
}
