import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { StadiumShopService } from '../../../src/modules/stadium-shop/stadium-shop.service.js';
import { ErrorCode, WarehouseSource } from '@mll/shared';

vi.mock('../../../src/modules/wallet/mgt-ledger.js', () => ({
  applyMgtDebit: vi.fn().mockResolvedValue(90),
}));

function mockPrisma() {
  const tx = {
    mGTBalance: {
      upsert: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({ amount: new Prisma.Decimal(90) }),
      findUnique: vi.fn().mockResolvedValue({ amount: new Prisma.Decimal(90) }),
    },
    mGTTransaction: { create: vi.fn().mockResolvedValue({}) },
    warehouseItem: {
      create: vi.fn().mockResolvedValue({ id: 'wh-1' }),
    },
  };
  return {
    __tx: tx,
    stadiumShopItem: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
  };
}

function mockClubRepo() {
  return {
    findByUserId: vi.fn().mockResolvedValue({
      id: 'c1',
      userId: 'u1',
      user: { wallet: null },
    }),
  };
}

describe('StadiumShopService', () => {
  let prisma: ReturnType<typeof mockPrisma>;
  let service: StadiumShopService;

  beforeEach(() => {
    prisma = mockPrisma();
    service = new StadiumShopService(prisma as never, mockClubRepo() as never);
  });

  it('listActive returns shop items', async () => {
    prisma.stadiumShopItem.findMany.mockResolvedValue([
      {
        id: '11111111-1111-4111-8111-111111111111',
        slug: 'energy_drink',
        nameKey: 'shop.items.energyDrink',
        effectType: 'stamina_flat',
        effectValue: 25,
        priceUsdc: new Prisma.Decimal(10),
        active: true,
        sortOrder: 1,
      },
    ]);

    const items = await service.listActive();
    expect(items).toHaveLength(1);
    expect(items[0].priceUsdc).toBe(10);
  });

  it('buy rejects missing item', async () => {
    prisma.stadiumShopItem.findFirst.mockResolvedValue(null);

    await expect(
      service.buy('u1', { itemId: '00000000-0000-4000-8000-000000000001' }),
    ).rejects.toMatchObject({ code: ErrorCode.SHOP_ITEM_NOT_FOUND });
  });

  it('buy sends item to warehouse instead of applying stamina directly', async () => {
    prisma.stadiumShopItem.findFirst.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      slug: 'energy_drink',
      nameKey: 'shop.items.energyDrink',
      effectType: 'stamina_flat',
      effectValue: 25,
      priceUsdc: new Prisma.Decimal(10),
      active: true,
      sortOrder: 1,
      imageUrl: null,
      description: null,
    });

    const result = await service.buy('u1', { itemId: '11111111-1111-4111-8111-111111111111' });

    expect(prisma.__tx.warehouseItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'u1',
          itemType: 'stamina_boost',
          source: WarehouseSource.STADIUM_SHOP,
          sourceRef: '11111111-1111-4111-8111-111111111111',
        }),
      }),
    );
    expect(result.warehouseItemId).toBe('wh-1');
    expect(result.pricePaid).toBe(10);
  });
});
