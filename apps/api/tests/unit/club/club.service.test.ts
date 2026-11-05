import { describe, it, expect, vi } from 'vitest';
import { ClubService } from '../../../src/modules/club/club.service.js';
import { ErrorCode } from '../../../src/common/lib/errors.js';

const baseClub = {
  id: 'c1',
  name: 'FC Test',
  userId: 'u1',
  stadiumLvl: 1,
  ctLvl: 1,
  treasurerLvl: 1,
  trophyRoomLvl: 1,
  totalOverwall: 0,
  lastFarmAt: new Date(),
  user: { wallet: null, referralCode: 'ABC12345' },
};

function mockRepo(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    findByUserId: vi.fn().mockResolvedValue(null),
    findByName: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(baseClub),
    getInventory: vi.fn().mockResolvedValue({ nfts: [], basePlayers: [] }),
    getBasePlayerOverwalls: vi.fn().mockResolvedValue([]),
    getMgtBalance: vi.fn().mockResolvedValue({ amount: 1000 }),
    upgradeBuildingTx: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as any;
}

function mockStaminaService() {
  return {
    consumeLineupFarmInTx: vi.fn().mockResolvedValue({ playersUpdated: 2, totalDrained: 20 }),
    syncDrift: vi.fn().mockResolvedValue(undefined),
  };
}

function mockPrisma() {
  return {
    club: { findUnique: vi.fn().mockResolvedValue(null), update: vi.fn(), create: vi.fn() },
    user: { findUnique: vi.fn().mockResolvedValue(null) },
    basePlayer: { findMany: vi.fn().mockResolvedValue([]), aggregate: vi.fn().mockResolvedValue({ _sum: { overwall: 0 } }) },
    clubLineup: { findUnique: vi.fn().mockResolvedValue(null) },
    miningBalance: { findUnique: vi.fn().mockResolvedValue(null) },
    miningBlock: { findFirst: vi.fn().mockResolvedValue(null) },
    playerCache: { aggregate: vi.fn().mockResolvedValue({ _sum: { overwall: 0 } }) },
    platformConfig: {
      upsert: vi.fn().mockResolvedValue({}),
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        minDepositUsdc: 1,
        minWithdrawUsdc: 1,
        withdrawalsPaused: false,
        vaultAddress: null,
        coachStaminaRecoveryPerHour: 24,
        treasurerPerks: [],
        coachPerks: [],
        miningBlockRewardUsdc: 0.009,
        miningBlockIntervalMin: 10,
        miningPaused: false,
        registrationOpen: true,
        maintenanceMode: false,
        maintenanceMessage: null,
        referralBonusPct: 0,
        treasurerWeeklyUsdc: 0,
        coachWeeklyUsdc: 0,
        coachMiningFeePct: 0,
        marketplaceFeeBps: 0,
        mergeDiscountPct: 0,
        scoutDiscountPct: 0,
        referralNftName: '',
        referralNftImageUrl: null,
        referralNftOverwall: 0,
        referralNftPosition: 0,
        referralNftDurationDays: 0,
        referralGiftNftName: '',
        referralGiftNftImageUrl: null,
        referralGiftNftOverwall: 0,
        referralGiftNftPosition: 0,
        socialRewardNftName: '',
        socialRewardNftImageUrl: null,
        socialRewardNftOverwall: 0,
        socialRewardNftPosition: 0,
        socialRewardNftDays: 0,
        allocationJson: [],
        updatedBy: null,
        updatedAt: new Date(),
      }),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        club: { update: vi.fn(), create: vi.fn(), findUnique: vi.fn().mockResolvedValue(null) },
        user: { findUnique: vi.fn().mockResolvedValue(null) },
        basePlayer: { findMany: vi.fn().mockResolvedValue([]), aggregate: vi.fn().mockResolvedValue({ _sum: { overwall: 0 } }) },
        miningBalance: { findUnique: vi.fn().mockResolvedValue(null), update: vi.fn() },
        mGTBalance: { upsert: vi.fn() },
      };
      return fn(tx);
    }),
  };
}

function createService(repo: ReturnType<typeof mockRepo>) {
  return new ClubService(repo, mockStaminaService() as never, mockPrisma() as never);
}

describe('ClubService', () => {
  it('throws when club not found', async () => {
    await expect(createService(mockRepo()).getClub('u1')).rejects.toMatchObject({
      code: ErrorCode.CLUB_NOT_FOUND,
    });
  });

  it('creates club when none exists', async () => {
    const repo = mockRepo({
      findByUserId: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValue(baseClub),
    });
    const club = await createService(repo).createClub('u1', { name: 'FC Test' });
    expect(club.name).toBe('FC Test');
    expect(club.gmtBalance).toBe(1000);
  });

  it('rejects duplicate club per user', async () => {
    const repo = mockRepo({ findByUserId: vi.fn().mockResolvedValue({ id: 'c1' }) });
    await expect(createService(repo).createClub('u1', { name: 'FC' })).rejects.toMatchObject({
      code: ErrorCode.CLUB_ALREADY_EXISTS,
    });
  });

  it('rejects upgrade when insufficient MGT', async () => {
    const repo = mockRepo({
      findByUserId: vi.fn().mockResolvedValue({ id: 'c1', stadiumLvl: 1 }),
      getMgtBalance: vi.fn().mockResolvedValue({ amount: 0 }),
    });
    await expect(createService(repo).upgradeBuilding('u1', 'stadium')).rejects.toMatchObject({
      code: ErrorCode.INSUFFICIENT_USDC,
    });
  });

  it('rejects upgrade when club name already taken', async () => {
    const repo = mockRepo({ findByName: vi.fn().mockResolvedValue({ id: 'other' }) });
    await expect(createService(repo).createClub('u1', { name: 'Taken FC' })).rejects.toMatchObject({
      code: ErrorCode.CLUB_NAME_TAKEN,
    });
  });

  it('rejects upgrade when building is invalid', async () => {
    const repo = mockRepo({
      findByUserId: vi.fn().mockResolvedValue({ id: 'c1', stadiumLvl: 1 }),
    });
    await expect(
      createService(repo).upgradeBuilding('u1', 'nonExistent' as any),
    ).rejects.toMatchObject({ code: ErrorCode.CLUB_INVALID_BUILDING });
  });

  it('rejects upgrade when building is at max level', async () => {
    const { GAME_CONFIG } = await import('../../../src/config/game.js');
    const maxLvl = GAME_CONFIG.MAX_BUILDING_LEVEL;
    const repo = mockRepo({
      findByUserId: vi.fn().mockResolvedValue({ id: 'c1', stadiumLvl: maxLvl }),
    });
    await expect(createService(repo).upgradeBuilding('u1', 'stadium')).rejects.toMatchObject({
      code: ErrorCode.CLUB_MAX_LEVEL_REACHED,
    });
  });

  it('successfully upgrades building', async () => {
    const repo = mockRepo({
      findByUserId: vi
        .fn()
        .mockResolvedValueOnce({ id: 'c1', stadiumLvl: 1 })
        .mockResolvedValue(baseClub),
    });
    const result = await createService(repo).upgradeBuilding('u1', 'stadium');
    expect(repo.upgradeBuildingTx).toHaveBeenCalled();
    expect(result.building).toBe('stadium');
    expect(result.newLevel).toBe(2);
  });

  it('getInventory returns sorted players by overwall desc', async () => {
    const repo = mockRepo({
      findByUserId: vi.fn().mockResolvedValue(baseClub),
      getInventory: vi.fn().mockResolvedValue({
        nfts: [],
        basePlayers: [
          {
            id: 'p1',
            rarity: 0,
            overwall: 400,
            position: 0,
            listed: false,
            stamina: 100,
            createdAt: new Date(),
          },
          {
            id: 'p2',
            rarity: 2,
            overwall: 12000,
            position: 1,
            listed: false,
            stamina: 80,
            createdAt: new Date(),
          },
        ],
      }),
    });
    const result = await createService(repo).getInventory('u1');
    expect(result.players[0].overwall).toBe(12000);
    expect(result.totalPlayers).toBe(2);
  });

});
