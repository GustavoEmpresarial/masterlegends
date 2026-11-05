import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { ErrorCode, GearSlot } from '@mll/shared';
import { GearService } from '../../../src/modules/stadium-shop/gear.service.js';

vi.mock('../../../src/modules/wallet/mgt-ledger.js', () => ({
  applyMgtDebit: vi.fn().mockResolvedValue(50),
}));

import { applyMgtDebit } from '../../../src/modules/wallet/mgt-ledger.js';

const catalogId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const userGearId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const playerId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function catalogRow(overrides: Record<string, unknown> = {}) {
  return {
    id: catalogId,
    slug: 'boots-test',
    nameKey: 'gear.boots.test',
    slot: GearSlot.BOOTS,
    rarity: 1,
    owBonus: 25,
    priceGmt: new Prisma.Decimal(50),
    imageUrl: '/uploads/gear/x.png',
    description: null,
    active: true,
    sortOrder: 0,
    ...overrides,
  };
}

function makePrisma() {
  const tx = {
    userGear: {
      create: vi.fn().mockResolvedValue({
        id: userGearId,
        catalogItemId: catalogId,
        source: 'shop',
        acquiredAt: new Date('2026-07-18T00:00:00.000Z'),
        catalogItem: catalogRow(),
        equip: null,
      }),
    },
    mGTBalance: {
      findUnique: vi.fn().mockResolvedValue({ amount: new Prisma.Decimal(50) }),
    },
    playerGearEquip: {
      delete: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 'eq-1' }),
    },
  };

  return {
    gearCatalogItem: {
      findMany: vi.fn().mockResolvedValue([catalogRow()]),
      findFirst: vi.fn().mockResolvedValue(catalogRow()),
      findUnique: vi.fn().mockResolvedValue(catalogRow()),
      create: vi.fn().mockResolvedValue(catalogRow()),
      update: vi.fn().mockResolvedValue(catalogRow({ rarity: 2 })),
    },
    userGear: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn(),
    },
    basePlayer: {
      findFirst: vi.fn().mockResolvedValue({ id: playerId, userId: 'u1' }),
    },
    playerCache: {
      findFirst: vi.fn(),
    },
    playerGearEquip: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    __tx: tx,
  } as any;
}

function mockClubRepo(wallet: string | null = null) {
  return {
    findByUserId: vi.fn().mockResolvedValue({
      id: 'c1',
      userId: 'u1',
      user: { wallet },
    }),
  };
}

describe('GearService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: GearService;

  beforeEach(() => {
    vi.mocked(applyMgtDebit).mockClear();
    prisma = makePrisma();
    service = new GearService(prisma, mockClubRepo() as never);
  });

  it('buy debits GMT and creates ownership', async () => {
    const result = await service.buy('u1', { catalogItemId: catalogId });

    expect(applyMgtDebit).toHaveBeenCalled();
    expect(prisma.__tx.userGear.create).toHaveBeenCalled();
    expect(result.pricePaid).toBe(50);
    expect(result.item.owBonus).toBe(25);
  });

  it('buy rejects missing club', async () => {
    service = new GearService(prisma, {
      findByUserId: vi.fn().mockResolvedValue(null),
    } as never);

    await expect(service.buy('u1', { catalogItemId: catalogId })).rejects.toMatchObject({
      code: ErrorCode.CLUB_NOT_FOUND,
    });
  });

  it('buy rejects inactive catalog item', async () => {
    prisma.gearCatalogItem.findFirst.mockResolvedValue(null);
    await expect(service.buy('u1', { catalogItemId: catalogId })).rejects.toMatchObject({
      code: ErrorCode.GEAR_NOT_FOUND,
    });
  });

  it('equip rejects gear not owned', async () => {
    prisma.userGear.findFirst.mockResolvedValue(null);
    await expect(
      service.equip('u1', { userGearId, playerId, kind: 'base' }),
    ).rejects.toMatchObject({ code: ErrorCode.GEAR_NOT_FOUND });
  });

  it('equip clears slot uniqueness and attaches gear', async () => {
    prisma.userGear.findFirst.mockResolvedValue({
      id: userGearId,
      userId: 'u1',
      catalogItem: catalogRow(),
      equip: null,
    });
    prisma.userGear.findMany.mockResolvedValue([
      {
        id: userGearId,
        catalogItemId: catalogId,
        source: 'shop',
        acquiredAt: new Date(),
        catalogItem: catalogRow(),
        equip: { playerId, playerKind: 'base' },
      },
    ]);

    const bag = await service.equip('u1', { userGearId, playerId, kind: 'base' });

    expect(prisma.__tx.playerGearEquip.deleteMany).toHaveBeenCalled();
    expect(prisma.__tx.playerGearEquip.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'u1',
          playerId,
          slot: GearSlot.BOOTS,
          userGearId,
        }),
      }),
    );
    expect(bag.total).toBe(1);
  });

  it('equip rejects player not owned', async () => {
    prisma.basePlayer.findFirst.mockResolvedValue(null);
    await expect(
      service.equip('u1', { userGearId, playerId, kind: 'base' }),
    ).rejects.toMatchObject({ code: ErrorCode.PLAYER_NOT_FOUND });
  });
});
