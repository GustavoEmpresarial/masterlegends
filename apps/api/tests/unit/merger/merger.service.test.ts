import { describe, it, expect, vi, beforeEach } from 'vitest';
import { playerAgeFromRoi } from '@mll/shared';
import { MergerService } from '../../../src/modules/merger/merger.service.js';
import type { MergerRepository } from '../../../src/modules/merger/merger.repository.js';
import type { ClubRepository } from '../../../src/modules/club/club.repository.js';
import type { StadiumRepository } from '../../../src/modules/stadium/stadium.repository.js';
import type { ItemTemplateService } from '../../../src/modules/items/item-template.service.js';
import { AppError, ErrorCode } from '../../../src/common/lib/errors.js';

const PLAYER_IDS = Array.from({ length: 5 }, (_, i) =>
  `00000000-0000-4000-8000-00000000000${i}`.slice(0, 36),
);

function makePlayers(
  rarity: number,
  overrides: Partial<{
    listed: boolean;
    id: string;
    costBasisUsdc: number;
    lifetimeEarnedUsdc: number;
    retiredAt: Date | null;
  }> = {},
) {
  return PLAYER_IDS.map((id, index) => ({
    id: overrides.id && index === 0 ? overrides.id : id,
    userId: 'user-1',
    rarity,
    overwall: 450,
    position: 3,
    name: 'Player',
    imageUrl: '/img.png',
    templateId: null,
    listed: overrides.listed ?? false,
    stamina: 100,
    staminaUpdatedAt: new Date(),
    costBasisUsdc: overrides.costBasisUsdc ?? 2,
    lifetimeEarnedUsdc: overrides.lifetimeEarnedUsdc ?? 0,
    retiredAt: overrides.retiredAt ?? null,
    createdAt: new Date(),
  }));
}

function platformPrisma(mergeDiscountPct = 0) {
  const row = {
    id: 'default',
    minDepositUsdc: 1,
    minWithdrawUsdc: 1,
    withdrawFeePct: 0.05,
    withdrawalsPaused: false,
    vaultAddress: null,
    miningBlockRewardUsdc: 0.1,
    miningBlockIntervalMin: 10,
    miningPaused: false,
    registrationOpen: true,
    maintenanceMode: false,
    maintenanceMessage: null,
    referralBonusPct: 0.05,
    treasurerWeeklyUsdc: 0,
    coachWeeklyUsdc: 0,
    coachMiningFeePct: 0.02,
    marketplaceFeeBps: 1000,
    mergeDiscountPct,
    scoutDiscountPct: 0,
    referralNftName: 'NFT',
    referralNftImageUrl: null,
    referralNftOverwall: 100,
    referralNftPosition: 0,
    referralNftDurationDays: 7,
    referralGiftNftName: 'Gift',
    referralGiftNftImageUrl: null,
    referralGiftNftOverwall: 100,
    referralGiftNftPosition: 0,
    socialRewardNftName: 'Social',
    socialRewardNftImageUrl: null,
    socialRewardNftOverwall: 100,
    socialRewardNftPosition: 0,
    socialRewardNftDays: 7,
    checkInStreakPlayerName: 'Streak',
    checkInStreakPlayerImageUrl: null,
    checkInStreakPlayerOverwall: 100,
    checkInStreakPlayerPosition: 0,
    checkInStreakPlayerDays: 7,
    checkInStreakThreshold: 7,
    allocationJson: [],
    updatedBy: null,
    updatedAt: new Date(),
  };
  return {
    platformConfig: {
      upsert: vi.fn().mockResolvedValue(row),
      findUniqueOrThrow: vi.fn().mockResolvedValue(row),
    },
  };
}

describe('MergerService', () => {
  const repo = {
    findBasePlayersByIds: vi.fn(),
    fuse: vi.fn(),
  } as unknown as MergerRepository;

  const clubRepo = {
    findByUserId: vi.fn(),
    getMgtBalance: vi.fn(),
  } as unknown as ClubRepository;

  const stadiumRepo = {
    findLineupByClubId: vi.fn(),
  } as unknown as StadiumRepository;

  const itemTemplates = {
    pickForRarity: vi.fn(),
  } as unknown as ItemTemplateService;

  let prisma = platformPrisma(0);

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = platformPrisma(0);
    vi.mocked(clubRepo.findByUserId).mockResolvedValue({ id: 'club-1', userId: 'user-1' } as never);
    vi.mocked(clubRepo.getMgtBalance).mockResolvedValue({ amount: 1000, usdcAmount: 0 } as never);
    vi.mocked(stadiumRepo.findLineupByClubId).mockResolvedValue(null);
    vi.mocked(repo.findBasePlayersByIds).mockResolvedValue(makePlayers(0) as never);
    vi.mocked(itemTemplates.pickForRarity).mockResolvedValue({
      id: 'tmpl-1',
      name: 'Fused Star',
      imageUrl: '/fused.png',
      rarity: 1,
      position: 3,
      overwall: 1500,
      weight: 1,
      active: true,
      createdBy: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    vi.mocked(repo.fuse).mockResolvedValue({
      id: 'new-player',
      rarity: 1,
      overwall: 1500,
      position: 3,
      name: 'Fused Star',
      imageUrl: '/fused.png',
    } as never);
  });

  function service(passService?: { addXp: ReturnType<typeof vi.fn> }) {
    return new MergerService(
      repo,
      clubRepo,
      stadiumRepo,
      itemTemplates,
      prisma as never,
      passService as never,
    );
  }

  it('fuses 5 common into 1 uncommon with basis=sum+fee and preserves earned', async () => {
    const players = makePlayers(0).map((p, i) => ({
      ...p,
      costBasisUsdc: 2,
      lifetimeEarnedUsdc: i === 0 ? 1.5 : 0.5,
    }));
    vi.mocked(repo.findBasePlayersByIds).mockResolvedValue(players as never);

    const result = await service().fuse('user-1', { playerIds: PLAYER_IDS });

    const expectedEarned = 1.5 + 0.5 * 4;
    const expectedBasis = 10 + 0.25;
    const expectedAge = playerAgeFromRoi(expectedBasis, expectedEarned).age;

    expect(result.inputRarity).toBe('common');
    expect(result.outputRarity).toBe('uncommon');
    expect(result.burnedIds).toEqual(PLAYER_IDS);
    expect(result.feeUsdc).toBe(0.25);
    expect(result.newPlayer.rarity).toBe('uncommon');
    expect(result.newPlayer.costBasisUsdc).toBe(expectedBasis);
    expect(result.newPlayer.age).toBe(expectedAge);
    expect(repo.fuse).toHaveBeenCalledWith(
      'user-1',
      'club-1',
      PLAYER_IDS,
      0.25,
      expect.objectContaining({
        rarity: 1,
        position: 3,
        costBasisUsdc: expectedBasis,
        lifetimeEarnedUsdc: expectedEarned,
      }),
      'gmt',
    );
  });

  it('includes discounted fee in costBasis', async () => {
    prisma = platformPrisma(0.5); // 50% off → fee 0.125
    const result = await service().fuse('user-1', { playerIds: PLAYER_IDS });

    expect(result.feeUsdc).toBe(0.125);
    expect(result.newPlayer.costBasisUsdc).toBe(10.125); // 10 + 0.125
    expect(repo.fuse).toHaveBeenCalledWith(
      'user-1',
      'club-1',
      PLAYER_IDS,
      0.125,
      expect.objectContaining({ costBasisUsdc: 10.125, lifetimeEarnedUsdc: 0, rarity: 1 }),
      'gmt',
    );
  });

  it('rejects retired player', async () => {
    const players = makePlayers(0);
    players[2] = { ...players[2]!, retiredAt: new Date() };
    vi.mocked(repo.findBasePlayersByIds).mockResolvedValue(players as never);

    await expect(service().fuse('user-1', { playerIds: PLAYER_IDS })).rejects.toMatchObject({
      code: ErrorCode.MERGE_PLAYER_RETIRED,
    });
  });

  it('rejects when count is not 5', async () => {
    await expect(
      service().fuse('user-1', { playerIds: PLAYER_IDS.slice(0, 4) }),
    ).rejects.toBeInstanceOf(Error);
  });

  it('rejects insufficient GMT balance', async () => {
    vi.mocked(clubRepo.getMgtBalance).mockResolvedValue({ amount: 0, usdcAmount: 100 } as never);

    await expect(service().fuse('user-1', { playerIds: PLAYER_IDS })).rejects.toMatchObject({
      code: ErrorCode.INSUFFICIENT_GMT,
    });
  });

  it('allows fusion when GMT balance is sufficient', async () => {
    vi.mocked(clubRepo.getMgtBalance).mockResolvedValue({ amount: 2, usdcAmount: 0 } as never);

    const result = await service().fuse('user-1', { playerIds: PLAYER_IDS });

    expect(result.feeUsdc).toBe(0.25);
    expect(repo.fuse).toHaveBeenCalled();
  });

  it('rejects duplicate player ids', async () => {
    const dupIds = [...PLAYER_IDS.slice(0, 4), PLAYER_IDS[0]!];
    await expect(service().fuse('user-1', { playerIds: dupIds })).rejects.toMatchObject({
      code: ErrorCode.MERGE_DUPLICATE_PLAYER,
    });
  });

  it('rejects mixed rarities', async () => {
    const mixed = makePlayers(0);
    mixed[1] = { ...mixed[1]!, rarity: 1 };
    vi.mocked(repo.findBasePlayersByIds).mockResolvedValue(mixed as never);

    await expect(service().fuse('user-1', { playerIds: PLAYER_IDS })).rejects.toMatchObject({
      code: ErrorCode.MERGE_DIFFERENT_RARITY,
    });
  });

  it('rejects listed player', async () => {
    vi.mocked(repo.findBasePlayersByIds).mockResolvedValue(
      makePlayers(0, { listed: true }) as never,
    );

    await expect(service().fuse('user-1', { playerIds: PLAYER_IDS })).rejects.toMatchObject({
      code: ErrorCode.MERGE_PLAYER_LISTED,
    });
  });

  it('rejects player in lineup', async () => {
    vi.mocked(stadiumRepo.findLineupByClubId).mockResolvedValue({
      clubId: 'club-1',
      assignments: { slot1: { playerId: PLAYER_IDS[0], kind: 'base' } },
    } as never);

    await expect(service().fuse('user-1', { playerIds: PLAYER_IDS })).rejects.toMatchObject({
      code: ErrorCode.MERGE_PLAYER_IN_LINEUP,
    });
  });

  it('rejects mythic as ingredient', async () => {
    vi.mocked(repo.findBasePlayersByIds).mockResolvedValue(makePlayers(5) as never);

    await expect(service().fuse('user-1', { playerIds: PLAYER_IDS })).rejects.toMatchObject({
      code: ErrorCode.MERGE_CANNOT_FUSE_LEGENDARY,
    });
  });

  it('fuses 5 uncommon into 1 rare', async () => {
    vi.mocked(repo.findBasePlayersByIds).mockResolvedValue(makePlayers(1) as never);

    const result = await service().fuse('user-1', { playerIds: PLAYER_IDS });

    expect(result.inputRarity).toBe('uncommon');
    expect(result.outputRarity).toBe('rare');
    expect(result.feeUsdc).toBe(0.5);
    expect(repo.fuse).toHaveBeenCalledWith(
      'user-1',
      'club-1',
      PLAYER_IDS,
      0.5,
      expect.objectContaining({ rarity: 2 }),
      'gmt',
    );
  });

  it('fuses 5 epic into 1 legendary and floors career cost at 3125', async () => {
    vi.mocked(repo.findBasePlayersByIds).mockResolvedValue(
      makePlayers(4, { costBasisUsdc: 10 }) as never,
    );
    vi.mocked(repo.fuse).mockResolvedValue({
      id: 'legendary-player',
      rarity: 5,
      overwall: 1500,
      position: 3,
      name: 'Legend',
      imageUrl: '/legend.png',
    } as never);

    const result = await service().fuse('user-1', { playerIds: PLAYER_IDS });

    expect(result.inputRarity).toBe('epic');
    expect(result.outputRarity).toBe('legendary');
    expect(result.feeUsdc).toBe(3);
    expect(result.newPlayer.costBasisUsdc).toBe(3125);
    expect(repo.fuse).toHaveBeenCalledWith(
      'user-1',
      'club-1',
      PLAYER_IDS,
      3,
      expect.objectContaining({ rarity: 5, costBasisUsdc: 3125 }),
      'gmt',
    );
  });

  it('rejects when not all players found', async () => {
    vi.mocked(repo.findBasePlayersByIds).mockResolvedValue(makePlayers(0).slice(0, 3) as never);

    await expect(service().fuse('user-1', { playerIds: PLAYER_IDS })).rejects.toMatchObject({
      code: ErrorCode.MERGE_PLAYER_NOT_FOUND,
    });
  });

  it('adds pass XP when passService provided', async () => {
    const passService = { addXp: vi.fn().mockResolvedValue(undefined) };
    await service(passService).fuse('user-1', { playerIds: PLAYER_IDS });
    expect(passService.addXp).toHaveBeenCalledWith('user-1', 80);
  });

  it('exposes tier fees in rules', async () => {
    const rules = await service().getRules();
    expect(rules.inputCount).toBe(5);
    expect(rules.legendaryValueGmt).toBe(3125);
    expect(rules.tiers).toHaveLength(5);
    expect(rules.tiers.map((tier) => [tier.inputRarity, tier.outputRarity, tier.feeUsdc])).toEqual([
      ['common', 'uncommon', 0.25],
      ['uncommon', 'rare', 0.5],
      ['rare', 'super-rare', 1],
      ['super-rare', 'epic', 2],
      ['epic', 'legendary', 3],
    ]);
  });
});
