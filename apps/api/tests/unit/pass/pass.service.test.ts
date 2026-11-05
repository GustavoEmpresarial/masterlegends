import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PassRepository, PassService } from '../../../src/modules/pass/pass.service.js';
import { AppError } from '../../../src/common/lib/errors.js';
import type { ConfiguredPassSeason } from '../../../src/modules/pass/pass-season.service.js';

const configuredSeason: ConfiguredPassSeason = {
  id: 1,
  name: 'Season 1',
  startsAt: new Date(),
  endsAt: new Date(Date.now() + 86400000),
  premiumPriceUsdc: 500,
  levels: [
    { level: 1, xpRequired: 0, rewardType: 'usdc', rewardLabel: '100 USDC', usdcAmount: 100 },
    { level: 2, xpRequired: 500, rewardType: 'player', rewardLabel: 'Base Player', playerRarity: 0 },
  ],
  missions: [
    { id: 'scout', label: 'Scout', xp: 150, target: 1, category: 'daily', difficulty: 'easy', eventType: 'login' },
  ],
  rewardBlocks: [],
};

function mkPrisma() {
  return {
    missionProgress: { findMany: vi.fn().mockResolvedValue([]) },
    platformConfig: { findUnique: vi.fn().mockResolvedValue({ passRankConfig: null }) },
  } as any;
}

describe('PassService', () => {
  const repo = {
    findConfiguredSeason: vi.fn(),
    findConfiguredSeasons: vi.fn(),
    findProgress: vi.fn(),
    upsertProgress: vi.fn(),
    claimLevel: vi.fn(),
    claimConfiguredReward: vi.fn(),
    setPremium: vi.fn(),
    creditMgt: vi.fn(),
    mintRewardPlayer: vi.fn(),
    debitMgt: vi.fn(),
    purchasePremium: vi.fn(),
  } as unknown as PassRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(repo.purchasePremium).mockReset().mockResolvedValue(undefined as never);
    vi.mocked(repo.findConfiguredSeason).mockResolvedValue(configuredSeason);
    vi.mocked(repo.findConfiguredSeasons).mockImplementation(async () => {
      const season = await vi.mocked(repo.findConfiguredSeason)();
      return season ? [season] : [];
    });
    vi.mocked(repo.claimConfiguredReward).mockResolvedValue(undefined);
    vi.mocked(repo.findProgress).mockResolvedValue({ xp: 100, premium: false, claimedLevels: [] } as never);
  });

  it('addXp upserts progress when season active', async () => {
    const service = new PassService(repo, mkPrisma());
    await service.addXp('user-1', 150);
    expect(repo.upsertProgress).toHaveBeenCalledWith('user-1', 1, 150);
  });

  it('claim delegates delivery and claiming to the atomic repository operation', async () => {
    vi.mocked(repo.findProgress).mockResolvedValue({ xp: 100, premium: false, claimedLevels: [] } as never);
    const service = new PassService(repo, mkPrisma());
    await service.claim('user-1', 1);
    expect(repo.claimConfiguredReward).toHaveBeenCalledWith('user-1', configuredSeason, 1);
    expect(repo.creditMgt).not.toHaveBeenCalled();
  });

  it('claim propagates atomic XP validation errors', async () => {
    vi.mocked(repo.claimConfiguredReward).mockRejectedValue(new AppError('PASS_LEVEL_NOT_CLAIMABLE' as any, 400));
    vi.mocked(repo.findProgress).mockResolvedValue({ xp: 0, premium: false, claimedLevels: [] } as never);
    const service = new PassService(repo, mkPrisma());
    await expect(service.claim('user-1', 2)).rejects.toBeInstanceOf(AppError);
  });

  it('addXp is a no-op when amount is zero or negative', async () => {
    const service = new PassService(repo, mkPrisma());
    await service.addXp('user-1', 0);
    await service.addXp('user-1', -10);
    expect(repo.upsertProgress).not.toHaveBeenCalled();
  });

  it('addXp is a no-op when no active season', async () => {
    vi.mocked(repo.findConfiguredSeason).mockResolvedValue(null);
    const service = new PassService(repo, mkPrisma());
    await service.addXp('user-1', 100);
    expect(repo.upsertProgress).not.toHaveBeenCalled();
  });

  it('getProgress returns inactive state when no configured season', async () => {
    vi.mocked(repo.findConfiguredSeason).mockResolvedValue(null);
    const service = new PassService(repo, mkPrisma());
    const progress = await service.getProgress('user-1');
    expect(progress.active).toBe(false);
    expect(progress.xp).toBe(0);
    expect(progress.seasonId).toBeNull();
  });

  it('claim propagates PASS_ALREADY_CLAIMED from atomic delivery', async () => {
    vi.mocked(repo.claimConfiguredReward).mockRejectedValue(new AppError('PASS_ALREADY_CLAIMED' as any, 400));
    vi.mocked(repo.findProgress).mockResolvedValue({ xp: 9999, premium: false, claimedLevels: [1] } as never);
    const service = new PassService(repo, mkPrisma());
    await expect(service.claim('user-1', 1)).rejects.toMatchObject({ code: 'PASS_ALREADY_CLAIMED' });
    expect(repo.creditMgt).not.toHaveBeenCalled();
  });

  it('claim throws PASS_NO_ACTIVE_SEASON when no season', async () => {
    vi.mocked(repo.findConfiguredSeason).mockResolvedValue(null);
    const service = new PassService(repo, mkPrisma());
    await expect(service.claim('user-1', 1)).rejects.toMatchObject({ code: 'PASS_NO_ACTIVE_SEASON' });
  });

  it('buyPremium throws PASS_NO_ACTIVE_SEASON when no season', async () => {
    vi.mocked(repo.findConfiguredSeason).mockResolvedValue(null);
    const service = new PassService(repo, mkPrisma());
    await expect(service.buyPremium('user-1')).rejects.toMatchObject({ code: 'PASS_NO_ACTIVE_SEASON' });
  });

  it('buyPremium throws PASS_ALREADY_PREMIUM when already premium', async () => {
    vi.mocked(repo.purchasePremium).mockRejectedValue(new AppError('PASS_ALREADY_PREMIUM' as any, 400));
    const service = new PassService(repo, mkPrisma());
    await expect(service.buyPremium('user-1')).rejects.toMatchObject({ code: 'PASS_ALREADY_PREMIUM' });
    expect(repo.debitMgt).not.toHaveBeenCalled();
  });

  it('buyPremium delegates current pricing, debit and activation to one atomic repository operation', async () => {
    vi.mocked(repo.findProgress).mockResolvedValue({ xp: 0, premium: false, claimedLevels: [] } as never);
    vi.mocked(repo.debitMgt).mockResolvedValue(undefined);
    vi.mocked(repo.setPremium).mockResolvedValue(undefined);
    const service = new PassService(repo, mkPrisma());
    await service.buyPremium('user-1');
    expect(repo.purchasePremium).toHaveBeenCalledWith('user-1', configuredSeason.id);
    expect(repo.debitMgt).not.toHaveBeenCalled();
    expect(repo.setPremium).not.toHaveBeenCalled();
  });
});
