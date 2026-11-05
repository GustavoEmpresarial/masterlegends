import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlatformConfigService } from '../../../src/modules/platform/platform-config.service.js';

const defaultRow = {
  id: 'default',
  minDepositUsdc: 1,
  minWithdrawUsdc: 1,
  withdrawalsPaused: false,
  vaultAddress: null,
  miningBlockRewardUsdc: 0.1,
  miningBlockIntervalMin: 10,
  miningPaused: false,
  registrationOpen: true,
  maintenanceMode: false,
  maintenanceMessage: null,
  referralBonusPct: 5,
  updatedBy: null,
  updatedAt: new Date('2026-06-08T00:00:00Z'),
};

function makePrisma(row = defaultRow) {
  return {
    platformConfig: {
      upsert: vi.fn().mockResolvedValue(row),
      findUniqueOrThrow: vi.fn().mockResolvedValue(row),
      update: vi.fn().mockResolvedValue(row),
    },
  } as any;
}

describe('PlatformConfigService', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('get', () => {
    it('returns mapped config DTO', async () => {
      const prisma = makePrisma();
      const svc = new PlatformConfigService(prisma);
      const cfg = await svc.get();

      expect(cfg.minDepositUsdc).toBe(1);
      expect(cfg.miningBlockRewardUsdc).toBe(0.1);
      expect(cfg.registrationOpen).toBe(true);
      expect(cfg.updatedAt).toBe(defaultRow.updatedAt.toISOString());
    });

    it('calls upsert to ensure default row exists', async () => {
      const prisma = makePrisma();
      const svc = new PlatformConfigService(prisma);
      await svc.get();
      expect(prisma.platformConfig.upsert).toHaveBeenCalledOnce();
    });
  });

  describe('update', () => {
    it('applies partial fields and returns updated config', async () => {
      const updatedRow = { ...defaultRow, miningPaused: true, updatedBy: 'admin' };
      const prisma = makePrisma();
      prisma.platformConfig.update.mockResolvedValue(updatedRow);
      prisma.platformConfig.findUniqueOrThrow.mockResolvedValue(updatedRow);

      const svc = new PlatformConfigService(prisma);
      const cfg = await svc.update({ miningPaused: true }, 'admin');

      expect(prisma.platformConfig.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ miningPaused: true, updatedBy: 'admin' }),
        }),
      );
      expect(cfg.miningPaused).toBe(true);
    });

    it('does not include undefined fields in update payload', async () => {
      const prisma = makePrisma();
      prisma.platformConfig.update.mockResolvedValue(defaultRow);

      const svc = new PlatformConfigService(prisma);
      await svc.update({ withdrawalsPaused: true }, 'admin');

      const [call] = prisma.platformConfig.update.mock.calls;
      expect(call[0].data).not.toHaveProperty('miningPaused');
      expect(call[0].data).toHaveProperty('withdrawalsPaused', true);
    });
  });
});
