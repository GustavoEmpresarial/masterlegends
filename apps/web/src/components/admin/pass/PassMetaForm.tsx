import { inputCls } from './passConstants';

export interface PassMetaState {
  name: string;
  premiumPriceUsdc: string;
  startsAt: string;
  endsAt: string;
  active: boolean;
}

export function PassMetaForm({
  value,
  onChange,
}: {
  value: PassMetaState;
  onChange: (next: PassMetaState) => void;
}) {
  const set = <K extends keyof PassMetaState>(key: K, v: PassMetaState[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-slate-400 mb-1.5 block">Nome da temporada</label>
          <input
            value={value.name}
            onChange={(e) => set('name', e.target.value)}
            className={inputCls}
            placeholder="Ex: Temporada Verão 2026"
            maxLength={64}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-400 mb-1.5 block">Preço Premium (GMT)</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={value.premiumPriceUsdc}
            onChange={(e) => set('premiumPriceUsdc', e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-400 mb-1.5 block">Início</label>
          <input
            type="datetime-local"
            value={value.startsAt}
            onChange={(e) => set('startsAt', e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-400 mb-1.5 block">Fim</label>
          <input
            type="datetime-local"
            value={value.endsAt}
            onChange={(e) => set('endsAt', e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      <label className="flex items-center gap-3 cursor-pointer rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
        <div className="relative">
          <input
            type="checkbox"
            className="sr-only"
            checked={value.active}
            onChange={(e) => set('active', e.target.checked)}
          />
          <div className={`h-5 w-9 rounded-full transition-colors ${value.active ? 'bg-emerald-500' : 'bg-slate-700'}`} />
          <div
            className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
              value.active ? 'translate-x-4' : ''
            }`}
          />
        </div>
        <div>
          <p className="text-sm text-slate-200 font-medium">Temporada ativa / publicar</p>
          <p className="text-xs text-slate-500">
            Só uma temporada pode ficar ativa. Ativar desativa as demais.
          </p>
        </div>
      </label>
    </div>
  );
}
