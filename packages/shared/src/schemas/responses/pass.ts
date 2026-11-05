export interface PassLevelDTO {
  level: number;
  xpRequired: number;
  rewardLabel: string;
  rewardType: string;
  rewardImageUrl?: string | null;
  quantity?: number;
  claimed: boolean;
  locked: boolean;
}

export interface PassMissionDTO {
  id: string;
  label: string;
  progress: number;
  target: number;
  xp: number;
  category: 'daily' | 'weekly';
  difficulty: 'easy' | 'medium' | 'hard' | 'elite';
  eventType: string;
  period: string;
  expiresAt: string;
  claimed: boolean;
}

export interface PassRankBadgeDTO {
  rank: 'bronze' | 'prata' | 'ouro' | 'diamante' | 'lendario';
  bonusPct: number;
  minLevel: number;
  maxLevel: number;
}

export interface PassPremiumPricingDTO {
  currency: 'GMT';
  basePriceGmt: number;
  discountGmt: number;
  priceGmt: number;
  completedLevels: number;
  totalLevels: number;
  completionPct: number;
  milestones: {
    completionPct: number;
    requiredLevels: number;
    discountGmt: number;
    reached: boolean;
  }[];
}

export interface PassProgressDTO {
  active: boolean;
  xp: number;
  level: number;
  premium: boolean;
  claimedLevels: number[];
  seasonId: number | null;
  seasonName: string | null;
  seasonEndsAt: string | null;
  /** Legacy field name; the season price is charged in GMT. */
  premiumPriceUsdc: number;
  premiumPricing?: PassPremiumPricingDTO | null;
  levels: PassLevelDTO[];
  missions: PassMissionDTO[];
  dailyMissions: PassMissionDTO[];
  weeklyMissions: PassMissionDTO[];
  rank: PassRankBadgeDTO;
  /** Other live seasons. Empty or omitted when only one pass is running. */
  passes?: PassProgressDTO[];
}
