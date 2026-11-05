import { resolveUploadUrl } from '../../../lib/resolveUploadUrl';
import {
  findRewardBlockForLevel,
  type PassLevelConfigDTO,
  type PassMissionConfigDTO,
  type PassRewardBlockDTO,
} from '@mll/shared';
import { rewardIcon, totalXpSpan } from './passConstants';

export function PassSeasonPreview({
  name,
  premiumPriceUsdc,
  levels,
  missions,
  rewardBlocks,
}: {
  name: string;
  premiumPriceUsdc: number;
  levels: PassLevelConfigDTO[];
  missions: PassMissionConfigDTO[];
  rewardBlocks: PassRewardBlockDTO[];
}) {
  const maxXp = totalXpSpan(levels);
  const daily = missions.filter((m) => m.category === 'daily');
  const weekly = missions.filter((m) => m.category === 'weekly');

  return (
    <div className="rounded-xl border border-white/[0.08] bg-gradient-to-b from-[#0c1520] to-[#070b10] p-4 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-slate-500">Preview do jogador</p>
          <h3 className="text-lg font-semibold text-white mt-0.5">{name || 'Sem nome'}</h3>
        </div>
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-right">
          <p className="text-[10px] text-emerald-400/80">Premium</p>
          <p className="text-sm font-semibold text-emerald-300">{premiumPriceUsdc} GMT</p>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-xs text-slate-400 mb-1">
          <span>Nível 1</span>
          <span>0 / {maxXp} XP</span>
        </div>
        <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
          <div className="h-full w-[8%] rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400" />
        </div>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2">
          Track de recompensas
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {levels.slice(0, 20).map((lvl) => {
            const block = findRewardBlockForLevel(lvl.level, rewardBlocks);
            const label = block?.rewardLabel ?? lvl.rewardLabel;
            const type = block?.rewardType ?? lvl.rewardType;
            return (
              <div
                key={lvl.level}
                className="min-w-[88px] rounded-lg border border-white/[0.08] bg-white/[0.03] p-2 text-center"
              >
                <p className="text-[10px] text-slate-500">Nv {lvl.level}</p>
                {(block ?? lvl).rewardImageUrl ? <img src={resolveUploadUrl((block ?? lvl).rewardImageUrl!)} alt="" className="w-20 h-20 object-contain mx-auto" /> : <p className="text-lg leading-none my-1">{rewardIcon(type)}</p>}
                <p className="text-[10px] text-slate-300 truncate" title={label}>{label}</p>
                <p className="text-[9px] text-slate-600 mt-0.5">{lvl.xpRequired} XP</p>
                {block && (
                  <p className="text-[9px] text-amber-400/80 mt-0.5">bloco</p>
                )}
              </div>
            );
          })}
          {levels.length > 20 && (
            <div className="min-w-[72px] flex items-center justify-center text-xs text-slate-500">
              +{levels.length - 20}
            </div>
          )}
          {levels.length === 0 && (
            <p className="text-sm text-slate-500">Sem níveis para pré-visualizar.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <MissionColumn title="Missões diárias" items={daily} />
        <MissionColumn title="Missões semanais" items={weekly} />
      </div>
    </div>
  );
}

function MissionColumn({ title, items }: { title: string; items: PassMissionConfigDTO[] }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2">
        {title} ({items.length})
      </p>
      <ul className="space-y-1.5 max-h-48 overflow-y-auto">
        {items.length === 0 && (
          <li className="text-xs text-slate-600">Nenhuma</li>
        )}
        {items.map((m) => (
          <li
            key={m.id}
            className="rounded-md border border-white/[0.05] bg-white/[0.02] px-2.5 py-1.5 flex justify-between gap-2"
          >
            <span className="text-xs text-slate-300 truncate">{m.label}</span>
            <span className="text-[10px] text-emerald-400 shrink-0">+{m.xp} XP</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
