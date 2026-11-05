import type {
  PassLevelConfigDTO,
  PassMissionConfigDTO,
  PassMissionEvent,
  PassRewardBlockDTO,
  PassRewardType,
} from '@mll/shared';

export const REWARD_TYPE_OPTIONS: { value: PassRewardType; label: string }[] = [
  { value: 'catalog_item', label: 'Item do catálogo (carta de jogador)' },
  { value: 'gear', label: 'Equipamento da loja' },
  { value: 'shop_item', label: 'Stamina / consumível da loja' },
  { value: 'usdc', label: 'Saldo GMT' },
];

export const RARITY_OPTIONS = ['Comum', 'Incomum', 'Raro', 'Super Raro', 'Épico', 'Lendário'].map((label, value) => ({ value, label }));

export const EVENT_TYPE_OPTIONS: { value: PassMissionEvent; label: string }[] = [
  { value: 'login', label: 'Login' },
  { value: 'lineup_save', label: 'Salvar escalação' },
  { value: 'training', label: 'Treino (CT)' },
  { value: 'pvp_match_played', label: 'Partida PvP jogada' },
  { value: 'pvp_match_won', label: 'Partida PvP vencida' },
  { value: 'pvp_goals', label: 'Gols em PvP' },
  { value: 'penalty_goals', label: 'Gols no pênalti' },
  { value: 'tournament_knockout', label: 'Torneio / mata-mata' },
  { value: 'evolve_player', label: 'Evoluir jogador (merge)' },
  { value: 'trade_player', label: 'Negociar atleta' },
  { value: 'pass_claim', label: 'Coletar recompensa do passe' },
  { value: 'market_visit', label: 'Visitar marketplace' },
];

export const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: 'Fácil' },
  { value: 'medium', label: 'Médio' },
  { value: 'hard', label: 'Difícil' },
  { value: 'elite', label: 'Elite' },
] as const;

export const inputCls =
  'w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-emerald-500/40 focus:outline-none';

export const selectCls = inputCls;

export function defaultSeasonDates() {
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + 90);
  return {
    startsAt: toDatetimeLocal(start.toISOString()),
    endsAt: toDatetimeLocal(end.toISOString()),
  };
}

export function toDatetimeLocal(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 16);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function emptyLevel(level: number): PassLevelConfigDTO {
  return {
    level,
    xpRequired: level === 1 ? 0 : (level - 1) * 500,
    rewardType: 'catalog_item',
    rewardLabel: 'Selecione um prêmio',
    quantity: 1,
  };
}

export function generateLevels(count: number): PassLevelConfigDTO[] {
  const n = Math.max(1, Math.min(100, Math.floor(count)));
  return Array.from({ length: n }, (_, i) => emptyLevel(i + 1));
}

export function emptyMission(category: 'daily' | 'weekly' = 'daily'): PassMissionConfigDTO {
  const id = `${category[0]}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    label: 'Nova missão',
    xp: category === 'weekly' ? 50 : 10,
    target: 1,
    category,
    difficulty: 'easy',
    eventType: 'login',
  };
}

export function emptyRewardBlock(): PassRewardBlockDTO {
  return {
    fromLevel: 1,
    toLevel: 10,
    rewardType: 'catalog_item',
    rewardLabel: 'Selecione um prêmio',
    quantity: 1,
  };
}

export function renumberLevels(levels: PassLevelConfigDTO[]): PassLevelConfigDTO[] {
  return levels.map((l, i) => ({ ...l, level: i + 1 }));
}

export function totalXpSpan(levels: PassLevelConfigDTO[]): number {
  if (levels.length === 0) return 0;
  return Math.max(...levels.map((l) => l.xpRequired));
}

export function rewardIcon(type: PassRewardType): string {
  if (type === 'usdc') return '💵';
  if (type === 'player' || type === 'catalog_item') return '⚽';
  if (type === 'gear') return '👟';
  if (type === 'shop_item') return '⚡';
  if (type === 'cosmetic') return '✨';
  return '🎫';
}
