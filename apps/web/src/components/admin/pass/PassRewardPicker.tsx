import { useState } from 'react';
import type { PassLevelConfigDTO, PassRewardCatalogItemDTO, PassRewardType } from '@mll/shared';
import { resolveUploadUrl } from '../../../lib/resolveUploadUrl';
import { inputCls, REWARD_TYPE_OPTIONS, selectCls } from './passConstants';

type Reward = Pick<PassLevelConfigDTO, 'rewardType' | 'rewardLabel' | 'usdcAmount' | 'playerRarity' | 'rewardItemId' | 'quantity' | 'rewardImageUrl'>;
export function PassRewardPicker({ value, onChange, catalog, loading = false, error = '', onRetry }: {
  value: Reward; onChange: (patch: Partial<Reward>) => void; catalog: PassRewardCatalogItemDTO[];
  loading?: boolean; error?: string; onRetry?: () => void;
}) {
  const [search, setSearch] = useState('');
  const isItem = ['catalog_item', 'gear', 'shop_item'].includes(value.rewardType);
  const selected = catalog.find(item => item.id === value.rewardItemId && item.rewardType === value.rewardType);
  const items = catalog.filter(item => item.rewardType === value.rewardType && `${item.name} ${item.description}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const quantity = value.quantity ?? 1;
  const selectItem = (item: PassRewardCatalogItemDTO, count = quantity) => onChange({ rewardItemId: item.id, rewardImageUrl: item.imageUrl, rewardLabel: `${count}× ${item.name}`, quantity: count });
  function changeType(type: PassRewardType) {
    setSearch('');
    onChange({ rewardType: type, rewardItemId: undefined, rewardImageUrl: null, quantity: 1,
      usdcAmount: type === 'usdc' ? 0 : undefined, playerRarity: undefined,
      rewardLabel: type === 'usdc' ? 'Saldo GMT' : 'Selecione um prêmio' });
  }
  return <div className="space-y-3">
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <label className="text-xs text-slate-400">Tipo de prêmio
        <select aria-label="Tipo de prêmio" className={`${selectCls} mt-1`} value={value.rewardType} onChange={event => changeType(event.target.value as PassRewardType)}>
          {REWARD_TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          {['player', 'cosmetic', 'ticket'].includes(value.rewardType) && <option disabled value={value.rewardType}>Prêmio antigo — selecione um item do catálogo</option>}
        </select>
      </label>
      {value.rewardType === 'usdc' ? <label className="text-xs text-slate-400">Valor do prêmio (GMT)
        <input aria-label="Valor do prêmio (GMT)" type="number" min="0.000001" step="0.01" className={`${inputCls} mt-1`} value={value.usdcAmount ?? 0}
          onChange={event => { const amount = Number(event.target.value); onChange({ usdcAmount: amount, rewardLabel: `${amount} GMT` }); }} />
      </label> : <label className="text-xs text-slate-400">Quantidade
        <input aria-label="Quantidade" type="number" min={1} max={100} className={`${inputCls} mt-1`} value={quantity} onChange={event => {
          const count = Math.min(100, Math.max(1, Math.floor(Number(event.target.value) || 1)));
          if (selected) selectItem(selected, count);
          else onChange({ quantity: count });
        }} />
      </label>}
    </div>
    {isItem && <div className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-3">
      <input type="search" aria-label="Buscar prêmio no catálogo" placeholder="Buscar por nome, raridade ou posição…" className={inputCls} value={search} onChange={event => setSearch(event.target.value)} />
      {loading ? <p role="status" className="text-xs text-slate-400">Carregando catálogo…</p> : error ? <div role="alert" className="text-xs text-red-300">{error} <button type="button" className="underline ml-2" onClick={onRetry}>Tentar novamente</button></div> : <>
        <p className="text-[11px] text-slate-400">{items.length} itens disponíveis · clique no prêmio para selecionar</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 max-h-72 overflow-y-auto">
          {items.map(item => <button key={item.id} type="button" aria-pressed={selected?.id === item.id} onClick={() => selectItem(item)}
            className={`flex items-center gap-3 p-2 rounded-lg border text-left ${selected?.id === item.id ? 'border-emerald-400 bg-emerald-500/15' : 'border-white/10 bg-white/[0.02] hover:border-white/30'}`}>
            {item.imageUrl ? <img src={resolveUploadUrl(item.imageUrl)} alt="" className="w-16 h-16 object-contain shrink-0" /> : <i className="bi bi-gift text-2xl px-4 text-slate-500" />}
            <span className="min-w-0"><span className="block text-xs font-semibold text-white">{item.name}</span><span className="block text-[10px] text-slate-400 mt-1">{item.description}</span></span>
          </button>)}
        </div>
        {items.length === 0 && <p className="text-xs text-slate-400">Nenhum item encontrado nesta categoria. Confira os filtros ou cadastre um item ativo no admin.</p>}
      </>}
      <p className={`text-xs ${selected ? 'text-emerald-300' : 'text-amber-300'}`}>{selected ? `Selecionado: ${quantity}× ${selected.name}` : value.rewardItemId ? 'Este prêmio não está mais disponível no catálogo. Escolha outro.' : 'Selecione um item para completar este prêmio.'}</p>
    </div>}
    {['player', 'cosmetic', 'ticket'].includes(value.rewardType) && <p className="text-xs text-amber-300">Escolha um item real do catálogo para que o jogador receba a recompensa.</p>}
  </div>;
}
