import type {
  PassLevelConfigDTO,
  PassMissionConfigDTO,
} from '@mll/shared';

export type PassRewardType = PassLevelConfigDTO['rewardType'];

export interface PassLevelConfig {
  level: number;
  xpRequired: number;
  rewardType: PassRewardType;
  rewardLabel: string;
  usdcAmount?: number;
  playerRarity?: number;
}

/** Default template for admin when creating a new pass season. */
export const DEFAULT_PASS_LEVELS: PassLevelConfigDTO[] = [
  { level: 1, xpRequired: 0, rewardType: 'usdc', rewardLabel: '100 USDC', usdcAmount: 100 },
  { level: 2, xpRequired: 500, rewardType: 'player', rewardLabel: 'Base Player', playerRarity: 0 },
  { level: 3, xpRequired: 1000, rewardType: 'usdc', rewardLabel: '50 USDC', usdcAmount: 50 },
  { level: 4, xpRequired: 1500, rewardType: 'cosmetic', rewardLabel: 'Neon Stadium' },
  { level: 5, xpRequired: 2000, rewardType: 'usdc', rewardLabel: '200 USDC', usdcAmount: 200 },
  { level: 6, xpRequired: 2500, rewardType: 'ticket', rewardLabel: 'MST Ticket' },
  { level: 7, xpRequired: 3000, rewardType: 'player', rewardLabel: 'Base Player', playerRarity: 0 },
  { level: 8, xpRequired: 3500, rewardType: 'usdc', rewardLabel: '100 USDC', usdcAmount: 100 },
  { level: 9, xpRequired: 4000, rewardType: 'cosmetic', rewardLabel: 'Golden Ball' },
  { level: 10, xpRequired: 5000, rewardType: 'player', rewardLabel: 'Rare Player', playerRarity: 1 },
];

export const DEFAULT_PASS_MISSIONS: PassMissionConfigDTO[] = [
  // ===== DAILY EASY (10 XP) =====
  { id: 'd_login', label: 'Fazer login', xp: 10, target: 1, category: 'daily', difficulty: 'easy', eventType: 'login' },
  { id: 'd_lineup', label: 'Escalar o time', xp: 10, target: 1, category: 'daily', difficulty: 'easy', eventType: 'lineup_save' },
  { id: 'd_train1', label: 'Treinar 1 jogador', xp: 10, target: 1, category: 'daily', difficulty: 'easy', eventType: 'training' },
  { id: 'd_claim', label: 'Coletar recompensa do passe', xp: 10, target: 1, category: 'daily', difficulty: 'easy', eventType: 'pass_claim' },
  { id: 'd_market', label: 'Visitar o mercado', xp: 10, target: 1, category: 'daily', difficulty: 'easy', eventType: 'market_visit' },
  // ===== DAILY MEDIUM (15 XP) =====
  { id: 'd_pvp1', label: 'Disputar 1 partida', xp: 15, target: 1, category: 'daily', difficulty: 'medium', eventType: 'pvp_match_played' },
  { id: 'd_pen3', label: 'Marcar 3 gols no pênalti', xp: 15, target: 3, category: 'daily', difficulty: 'medium', eventType: 'penalty_goals' },
  { id: 'd_win1', label: 'Vencer 1 partida', xp: 15, target: 1, category: 'daily', difficulty: 'medium', eventType: 'pvp_match_won' },
  { id: 'd_train3', label: 'Completar 3 treinamentos', xp: 15, target: 3, category: 'daily', difficulty: 'medium', eventType: 'training' },
  // ===== DAILY HARD (20 XP) =====
  { id: 'd_win3', label: 'Vencer 3 partidas', xp: 20, target: 3, category: 'daily', difficulty: 'hard', eventType: 'pvp_match_won' },
  { id: 'd_evolve', label: 'Evoluir um jogador', xp: 20, target: 1, category: 'daily', difficulty: 'hard', eventType: 'evolve_player' },
  { id: 'd_tournament', label: 'Participar de um torneio', xp: 20, target: 1, category: 'daily', difficulty: 'hard', eventType: 'tournament_knockout' },
  { id: 'd_trade', label: 'Negociar um atleta', xp: 20, target: 1, category: 'daily', difficulty: 'hard', eventType: 'trade_player' },
  // ===== WEEKLY =====
  { id: 'w_play10', label: 'Jogar 10 partidas', xp: 50, target: 10, category: 'weekly', difficulty: 'easy', eventType: 'pvp_match_played' },
  { id: 'w_goals50', label: 'Marcar 50 gols', xp: 75, target: 50, category: 'weekly', difficulty: 'medium', eventType: 'pvp_goals' },
  { id: 'w_win25', label: 'Vencer 25 partidas', xp: 100, target: 25, category: 'weekly', difficulty: 'hard', eventType: 'pvp_match_won' },
  { id: 'w_knockout', label: 'Chegar ao mata-mata de um torneio', xp: 150, target: 1, category: 'weekly', difficulty: 'elite', eventType: 'tournament_knockout' },
];

/** @deprecated use season config from database */
export const PASS_LEVELS = DEFAULT_PASS_LEVELS;

/** @deprecated use season config from database */
export const PASS_MISSIONS = DEFAULT_PASS_MISSIONS.map((m) => ({
  id: m.id,
  xp: m.xp,
  target: m.target,
}));

export function passLevelFromXp(xp: number, levels: PassLevelConfig[] = DEFAULT_PASS_LEVELS): number {
  let level = 1;
  for (const entry of levels) {
    if (xp >= entry.xpRequired) level = entry.level;
  }
  return level;
}

export function getPassLevelConfig(
  level: number,
  levels: PassLevelConfig[] = DEFAULT_PASS_LEVELS,
): PassLevelConfig | undefined {
  return levels.find((l) => l.level === level);
}
