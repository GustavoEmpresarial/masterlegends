import type { PrismaClient } from '@prisma/client';
import { parseScoutRarityWeights, SCOUT_COST_GMT, type PlatformConfigDTO } from '@mll/shared';
import { config } from '../../config/env.js';

async function readScoutCostGmt(prisma: PrismaClient): Promise<number> {
  try {
    const rows = await prisma.$queryRaw<Array<{ scoutCostGmt: unknown }>>`
      SELECT "scoutCostGmt" FROM "PlatformConfig" WHERE id = 'default'`;
    const value = Number(rows[0]?.scoutCostGmt);
    if (Number.isFinite(value) && value > 0) return parseFloat(value.toFixed(4));
  } catch {
    // A coluna chega com a migration. Até lá vale o preço do código.
  }
  return SCOUT_COST_GMT;
}

export class PlatformConfigService {
  constructor(private readonly prisma: PrismaClient) {}

  async ensureDefault() {
    await this.prisma.platformConfig.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        minDepositUsdc: 1,
        minWithdrawUsdc: 1,
        vaultAddress: config.CONTRACT_USDC_VAULT || null,
      },
      update: {},
    });
  }

  async get(): Promise<PlatformConfigDTO> {
    await this.ensureDefault();
    const row = await this.prisma.platformConfig.findUniqueOrThrow({ where: { id: 'default' } });
    return {
      minDepositUsdc: Number(row.minDepositUsdc),
      minWithdrawUsdc: Number(row.minWithdrawUsdc),
      withdrawFeePct: Number(row.withdrawFeePct),
      withdrawalsPaused: row.withdrawalsPaused,
      vaultAddress: row.vaultAddress ?? config.CONTRACT_USDC_VAULT ?? null,
      chainId: config.CHAIN_ID,
      miningBlockRewardUsdc: Number(row.miningBlockRewardUsdc),
      miningBlockIntervalMin: row.miningBlockIntervalMin,
      miningPaused: row.miningPaused,
      registrationOpen: row.registrationOpen,
      maintenanceMode: row.maintenanceMode,
      maintenanceMessage: row.maintenanceMessage,
      referralBonusPct: Number(row.referralBonusPct),
      treasurerWeeklyUsdc: Number(row.treasurerWeeklyUsdc),
      coachWeeklyUsdc: Number(row.coachWeeklyUsdc),
      coachMiningFeePct: Number(row.coachMiningFeePct),
      marketplaceFeeBps: row.marketplaceFeeBps,
      mergeDiscountPct: Number(row.mergeDiscountPct),
      scoutDiscountPct: Number(row.scoutDiscountPct),
      scoutCostGmt: await readScoutCostGmt(this.prisma),
      scoutRarityWeights: parseScoutRarityWeights(row.scoutRarityWeights),
      referralNftName: row.referralNftName,
      referralNftImageUrl: row.referralNftImageUrl ?? null,
      referralNftOverwall: row.referralNftOverwall,
      referralNftPosition: row.referralNftPosition,
      referralNftDurationDays: row.referralNftDurationDays,
      referralGiftNftName: row.referralGiftNftName,
      referralGiftNftImageUrl: row.referralGiftNftImageUrl ?? null,
      referralGiftNftOverwall: row.referralGiftNftOverwall,
      referralGiftNftPosition: row.referralGiftNftPosition,
      socialRewardNftName: row.socialRewardNftName,
      socialRewardNftImageUrl: row.socialRewardNftImageUrl ?? null,
      socialRewardNftOverwall: row.socialRewardNftOverwall,
      socialRewardNftPosition: row.socialRewardNftPosition,
      socialRewardNftDays: row.socialRewardNftDays,
      checkInStreakPlayerName: row.checkInStreakPlayerName,
      checkInStreakPlayerImageUrl: row.checkInStreakPlayerImageUrl ?? null,
      checkInStreakPlayerOverwall: row.checkInStreakPlayerOverwall,
      checkInStreakPlayerPosition: row.checkInStreakPlayerPosition,
      checkInStreakPlayerDays: row.checkInStreakPlayerDays,
      checkInStreakThreshold: row.checkInStreakThreshold,
      allocationJson: row.allocationJson as Array<{ label: string; pct: number; color?: string }>,
      updatedBy: row.updatedBy,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async update(
    data: Partial<{
      minDepositUsdc: number;
      minWithdrawUsdc: number;
      withdrawFeePct?: number;
      withdrawalsPaused: boolean;
      miningBlockRewardUsdc: number;
      miningBlockIntervalMin: number;
      miningPaused: boolean;
      registrationOpen: boolean;
      maintenanceMode: boolean;
      maintenanceMessage: string | null;
      referralBonusPct: number;
      treasurerWeeklyUsdc: number;
      coachWeeklyUsdc: number;
      coachMiningFeePct: number;
      marketplaceFeeBps: number;
      mergeDiscountPct: number;
      scoutDiscountPct: number;
      scoutCostGmt: number;
      scoutRarityWeights: PlatformConfigDTO['scoutRarityWeights'];
      referralNftName: string;
      referralNftImageUrl: string | null;
      referralNftOverwall: number;
      referralNftPosition: number;
      referralNftDurationDays: number;
      referralGiftNftName: string;
      referralGiftNftImageUrl: string | null;
      referralGiftNftOverwall: number;
      referralGiftNftPosition: number;
      socialRewardNftName?: string;
      socialRewardNftImageUrl?: string | null;
      socialRewardNftOverwall?: number;
      socialRewardNftPosition?: number;
      socialRewardNftDays?: number;
      checkInStreakPlayerName?: string;
      checkInStreakPlayerImageUrl?: string | null;
      checkInStreakPlayerOverwall?: number;
      checkInStreakPlayerPosition?: number;
      checkInStreakPlayerDays?: number;
      checkInStreakThreshold?: number;
      allocationJson: Array<{ label: string; pct: number; color?: string }>;
    }>,
    adminLogin: string,
  ): Promise<PlatformConfigDTO> {
    await this.ensureDefault();
    await this.prisma.platformConfig.update({
      where: { id: 'default' },
      data: {
        ...(data.minDepositUsdc !== undefined ? { minDepositUsdc: data.minDepositUsdc } : {}),
        ...(data.minWithdrawUsdc !== undefined ? { minWithdrawUsdc: data.minWithdrawUsdc } : {}),
        ...(data.withdrawFeePct !== undefined ? { withdrawFeePct: data.withdrawFeePct } : {}),
        ...(data.withdrawalsPaused !== undefined ? { withdrawalsPaused: data.withdrawalsPaused } : {}),
        ...(data.miningBlockRewardUsdc !== undefined ? { miningBlockRewardUsdc: data.miningBlockRewardUsdc } : {}),
        ...(data.miningBlockIntervalMin !== undefined ? { miningBlockIntervalMin: data.miningBlockIntervalMin } : {}),
        ...(data.miningPaused !== undefined ? { miningPaused: data.miningPaused } : {}),
        ...(data.registrationOpen !== undefined ? { registrationOpen: data.registrationOpen } : {}),
        ...(data.maintenanceMode !== undefined ? { maintenanceMode: data.maintenanceMode } : {}),
        ...(data.maintenanceMessage !== undefined ? { maintenanceMessage: data.maintenanceMessage } : {}),
        ...(data.referralBonusPct !== undefined ? { referralBonusPct: data.referralBonusPct } : {}),
        ...(data.treasurerWeeklyUsdc !== undefined ? { treasurerWeeklyUsdc: data.treasurerWeeklyUsdc } : {}),
        ...(data.coachWeeklyUsdc !== undefined ? { coachWeeklyUsdc: data.coachWeeklyUsdc } : {}),
        ...(data.coachMiningFeePct !== undefined ? { coachMiningFeePct: data.coachMiningFeePct } : {}),
        ...(data.marketplaceFeeBps !== undefined ? { marketplaceFeeBps: data.marketplaceFeeBps } : {}),
        ...(data.mergeDiscountPct !== undefined ? { mergeDiscountPct: data.mergeDiscountPct } : {}),
        ...(data.scoutDiscountPct !== undefined ? { scoutDiscountPct: data.scoutDiscountPct } : {}),
        ...(data.scoutRarityWeights !== undefined ? { scoutRarityWeights: data.scoutRarityWeights } : {}),
        ...(data.referralNftName !== undefined ? { referralNftName: data.referralNftName } : {}),
        ...(data.referralNftImageUrl !== undefined ? { referralNftImageUrl: data.referralNftImageUrl } : {}),
        ...(data.referralNftOverwall !== undefined ? { referralNftOverwall: data.referralNftOverwall } : {}),
        ...(data.referralNftPosition !== undefined ? { referralNftPosition: data.referralNftPosition } : {}),
        ...(data.referralNftDurationDays !== undefined ? { referralNftDurationDays: data.referralNftDurationDays } : {}),
        ...(data.referralGiftNftName !== undefined ? { referralGiftNftName: data.referralGiftNftName } : {}),
        ...(data.referralGiftNftImageUrl !== undefined ? { referralGiftNftImageUrl: data.referralGiftNftImageUrl } : {}),
        ...(data.referralGiftNftOverwall !== undefined ? { referralGiftNftOverwall: data.referralGiftNftOverwall } : {}),
        ...(data.referralGiftNftPosition !== undefined ? { referralGiftNftPosition: data.referralGiftNftPosition } : {}),
        ...(data.socialRewardNftName !== undefined ? { socialRewardNftName: data.socialRewardNftName } : {}),
        ...(data.socialRewardNftImageUrl !== undefined ? { socialRewardNftImageUrl: data.socialRewardNftImageUrl } : {}),
        ...(data.socialRewardNftOverwall !== undefined ? { socialRewardNftOverwall: data.socialRewardNftOverwall } : {}),
        ...(data.socialRewardNftPosition !== undefined ? { socialRewardNftPosition: data.socialRewardNftPosition } : {}),
        ...(data.socialRewardNftDays !== undefined ? { socialRewardNftDays: data.socialRewardNftDays } : {}),
        ...(data.checkInStreakPlayerName !== undefined ? { checkInStreakPlayerName: data.checkInStreakPlayerName } : {}),
        ...(data.checkInStreakPlayerImageUrl !== undefined ? { checkInStreakPlayerImageUrl: data.checkInStreakPlayerImageUrl } : {}),
        ...(data.checkInStreakPlayerOverwall !== undefined ? { checkInStreakPlayerOverwall: data.checkInStreakPlayerOverwall } : {}),
        ...(data.checkInStreakPlayerPosition !== undefined ? { checkInStreakPlayerPosition: data.checkInStreakPlayerPosition } : {}),
        ...(data.checkInStreakPlayerDays !== undefined ? { checkInStreakPlayerDays: data.checkInStreakPlayerDays } : {}),
        ...(data.checkInStreakThreshold !== undefined ? { checkInStreakThreshold: data.checkInStreakThreshold } : {}),
        ...(data.allocationJson !== undefined ? { allocationJson: data.allocationJson } : {}),
        vaultAddress: config.CONTRACT_USDC_VAULT || null,
        updatedBy: adminLogin,
      },
    });
    if (data.scoutCostGmt !== undefined) {
      await this.prisma.$executeRaw`
        UPDATE "PlatformConfig" SET "scoutCostGmt" = ${data.scoutCostGmt} WHERE id = 'default'`;
    }
    return this.get();
  }
}
