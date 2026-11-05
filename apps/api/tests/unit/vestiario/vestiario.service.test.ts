import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VestiarioService } from '../../../src/modules/vestiario/vestiario.service.js';
import { ErrorCode } from '@mll/shared';

function mockClubRepo() {
  return {
    findByUserId: vi.fn(),
    getInventory: vi.fn(),
  };
}

function mockStadiumPlayer() {
  return {
    getVestiarioView: vi.fn(),
    saveLineup: vi.fn(),
  };
}

function mockStaminaService() {
  return {
    syncDrift: vi.fn().mockResolvedValue(undefined),
    restoreSquad: vi.fn().mockResolvedValue(undefined),
  };
}

function mockPrisma() {
  return {
    platformConfig: {
      findUnique: vi.fn().mockResolvedValue({ coachStaminaRecoveryPerHour: 24 }),
    },
    affliction: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  };
}

describe('VestiarioService', () => {
  let clubRepo: ReturnType<typeof mockClubRepo>;
  let stadiumPlayer: ReturnType<typeof mockStadiumPlayer>;
  let staminaService: ReturnType<typeof mockStaminaService>;
  let prisma: ReturnType<typeof mockPrisma>;
  let service: VestiarioService;

  beforeEach(() => {
    clubRepo = mockClubRepo();
    stadiumPlayer = mockStadiumPlayer();
    staminaService = mockStaminaService();
    prisma = mockPrisma();
    service = new VestiarioService(
      prisma as never,
      clubRepo as never,
      stadiumPlayer as never,
      staminaService as never,
    );
  });

  it('getView includes bench and daily rest status', async () => {
    clubRepo.findByUserId.mockResolvedValue({
      id: 'c1',
      userId: 'u1',
      ctLvl: 2,
      lastDailyRestAt: null,
      user: { wallet: null },
    });
    stadiumPlayer.getVestiarioView.mockResolvedValue({
      template: { id: 't1', name: 'Default', imageUrl: '/x.png', slots: [] },
      assignments: {},
      slots: [],
      stadiumLvl: 1,
    });
    clubRepo.getInventory.mockResolvedValue({
      basePlayers: [
        {
          id: 'p1',
          rarity: 0,
          overwall: 500,
          position: 3,
          listed: false,
          name: 'A',
          imageUrl: null,
          stamina: 40,
          createdAt: new Date(),
        },
      ],
      nfts: [],
    });

    const view = await service.getView('u1');
    expect(view.bench).toHaveLength(1);
    expect(view.bench[0].stamina).toBe(40);
    expect(view.canClaimDailyRest).toBe(true);
    expect(view.passiveRecoveryPerHour).toBe(0);
  });

  it('getView reports coach recovery when treinador contratado', async () => {
    clubRepo.findByUserId.mockResolvedValue({
      id: 'c1',
      userId: 'u1',
      ctLvl: 2,
      coachHiredAt: new Date(),
      lastDailyRestAt: null,
      user: { wallet: null },
    });
    stadiumPlayer.getVestiarioView.mockResolvedValue({
      template: { id: 't1', name: 'Default', imageUrl: '/x.png', slots: [] },
      assignments: {},
      slots: [],
      stadiumLvl: 1,
    });
    clubRepo.getInventory.mockResolvedValue({ basePlayers: [], nfts: [] });

    const view = await service.getView('u1');
    expect(view.passiveRecoveryPerHour).toBe(26);
  });

  it('claimDailyRest restores all players once per day', async () => {
    clubRepo.findByUserId.mockResolvedValue({
      id: 'c1',
      userId: 'u1',
      lastDailyRestAt: null,
      user: { wallet: '0xabc' },
    });
    clubRepo.getInventory.mockResolvedValue({
      basePlayers: [{ id: 'p1' }],
      nfts: [{ tokenId: 1n }],
    });

    const result = await service.claimDailyRest('u1');
    expect(result.restoredCount).toBe(2);
    expect(staminaService.restoreSquad).toHaveBeenCalled();
    expect(result.canClaimDailyRest).toBe(false);
  });

  it('claimDailyRest rejects when already claimed today', async () => {
    const today = new Date();
    clubRepo.findByUserId.mockResolvedValue({
      id: 'c1',
      userId: 'u1',
      lastDailyRestAt: today,
      user: { wallet: null },
    });

    await expect(service.claimDailyRest('u1')).rejects.toMatchObject({
      code: ErrorCode.DAILY_REST_ALREADY_CLAIMED,
    });
  });
});
