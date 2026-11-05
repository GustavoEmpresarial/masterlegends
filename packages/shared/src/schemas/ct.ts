import { z } from 'zod';

export interface SquadStaminaSummaryDTO {
  lineupCount: number;
  avgStamina: number;
  minStamina: number;
  maxStamina: number;
}

export interface CtRecordDTO {
  id: string;
  playerKind: 'base' | 'nft' | null;
  playerId: string | null;
  kind: 'training' | 'evolution' | 'progression';
  before: number | null;
  after: number | null;
  detail: string | null;
  createdAt: string;
}

export interface CtViewDTO {
  ctLvl: number;
  maxLevel: number;
  passiveRecoveryPerHour: number;
  recoveryBonus: number;
  evolutionStep: number;
  upgradeCost: number | null;
  canUpgrade: boolean;
  coachHired: boolean;
  canClaimDailyRest: boolean;
  nextRestAvailableAt: string | null;
  lastDailyRestAt: string | null;
  trainingStaminaCost: number;
  dailyRestStamina: number;
  squadStaminaSummary: SquadStaminaSummaryDTO;
  records: CtRecordDTO[];
}
