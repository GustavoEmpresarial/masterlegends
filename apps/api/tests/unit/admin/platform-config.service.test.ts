import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { PlatformConfigService } from '../../../src/modules/platform/platform-config.service.js';

function makePrisma() {
  return {
    platformConfig: {
      upsert: vi.fn().mockResolvedValue(undefined),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
  } as any;
}

const baseRow = {
  id: 'default',
  minDepositUsdc: new Prisma.Decimal(1),
  minWithdrawUsdc: new Prisma.Decimal(1),
  withdrawalsPaused: false,
  vaultAddress: null,
  miningBlockRewardUsdc: new Prisma.Decimal('0.1'),
  miningBlockIntervalMin: 10,
  miningPaused: false,
  registrationOpen: true,
  maintenanceMode: false,
  maintenanceMessage: null,
  referralBonusPct: new Prisma.Decimal('0.05'),
  updatedBy: null,
  updatedAt: new Date('2026-06-06T00:00:00Z'),
};

beforeEach(() => vi.clearAllMocks());

describe('PlatformConfigService.get', () => {
  it('exposes new settings fields in DTO', async () => {
    const prisma = makePrisma();
    prisma.platformConfig.findUniqueOrThrow.mockResolvedValue(baseRow);
    const svc = new PlatformConfigService(prisma);
    const out = await svc.get();
    expect(out).toMatchObject({
      registrationOpen: true,
      maintenanceMode: false,
      maintenanceMessage: null,
      referralBonusPct: 0.05,
      miningBlockRewardUsdc: 0.1,
      miningBlockIntervalMin: 10,
    });
  });
});

describe('PlatformConfigService.update', () => {
  it('only updates provided fields and stamps adminLogin', async () => {
    const prisma = makePrisma();
    prisma.platformConfig.findUniqueOrThrow.mockResolvedValue({
      ...baseRow,
      registrationOpen: false,
      maintenanceMode: true,
      maintenanceMessage: 'volto já',
    });
    const svc = new PlatformConfigService(prisma);
    await svc.update(
      {
        registrationOpen: false,
        maintenanceMode: true,
        maintenanceMessage: 'volto já',
      },
      'admin-1',
    );
    const data = prisma.platformConfig.update.mock.calls[0][0].data;
    expect(data).toMatchObject({
      registrationOpen: false,
      maintenanceMode: true,
      maintenanceMessage: 'volto já',
      updatedBy: 'admin-1',
    });
    // Should NOT include unrelated fields
    expect(data.miningBlockRewardUsdc).toBeUndefined();
  });

  it('allows clearing maintenanceMessage with null', async () => {
    const prisma = makePrisma();
    prisma.platformConfig.findUniqueOrThrow.mockResolvedValue(baseRow);
    const svc = new PlatformConfigService(prisma);
    await svc.update({ maintenanceMessage: null }, 'admin-1');
    const data = prisma.platformConfig.update.mock.calls[0][0].data;
    expect(data.maintenanceMessage).toBeNull();
  });

  it('updates referralBonusPct', async () => {
    const prisma = makePrisma();
    prisma.platformConfig.findUniqueOrThrow.mockResolvedValue(baseRow);
    const svc = new PlatformConfigService(prisma);
    await svc.update({ referralBonusPct: 0.1 }, 'admin-1');
    const data = prisma.platformConfig.update.mock.calls[0][0].data;
    expect(data.referralBonusPct).toBe(0.1);
  });
});
