import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDefaultPassTemplate } from '../../../src/modules/pass/pass-template.service';
import { claimPassReward, getPassRewardCatalog, normalizePassRewards } from '../../../src/modules/pass/pass-reward.service';
import type { ConfiguredPassSeason } from '../../../src/modules/pass/pass-season.service';
const card = { id: '10000000-0000-4000-8000-000000000001', name: 'Carta', rarity: 5, position: 3, overwall: 3200, imageUrl: '/card.webp' };
const gear = { id: '10000000-0000-4000-8000-000000000002', nameKey: 'Chuteira', rarity: 4, owBonus: 16, imageUrl: '/gear.webp' };
const shop = { id: '10000000-0000-4000-8000-000000000003', nameKey: 'Stamina', effectType: 'stamina_full', effectValue: 0, imageUrl: '/stamina.webp' };
function database() {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    itemTemplate: { findMany: vi.fn().mockResolvedValue([card]), findUnique: vi.fn().mockResolvedValue(card) },
    gearCatalogItem: { findMany: vi.fn().mockResolvedValue([gear]), findUnique: vi.fn().mockResolvedValue(gear) },
    stadiumShopItem: { findMany: vi.fn().mockResolvedValue([shop]), findUnique: vi.fn().mockResolvedValue(shop) },
    warehouseItem: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
    userGear: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
    passProgress: { upsert: vi.fn().mockResolvedValue({}), findUniqueOrThrow: vi.fn().mockResolvedValue({ xp: 500, claimedLevels: [] }), update: vi.fn().mockResolvedValue({}) },
  };
  const prisma = { ...tx, $transaction: vi.fn((operation: any) => operation(tx)) };
  return { tx, prisma: prisma as any };
}
function season(type = 'catalog_item', id = card.id): ConfiguredPassSeason {
  return { id: 1, name: 'Test', startsAt: new Date(Date.now()-1000), endsAt: new Date(Date.now()+60000), premiumPriceUsdc: 1,
    levels: [{ level: 1, xpRequired: 100, rewardType: type as any, rewardItemId: id, quantity: 2, rewardLabel: 'Prêmio' }], rewardBlocks: [], missions: [] };
}
describe('pass reward delivery', () => {
  it('returns all active card/gear/stamina categories and filters affiliates', async () => {
    const { prisma } = database(); const catalog = await getPassRewardCatalog(prisma);
    expect(catalog.map(item => item.rewardType)).toEqual(['catalog_item', 'gear', 'shop_item']);
    expect(prisma.itemTemplate.findMany.mock.calls[0][0].where).toEqual({ active: true });
    expect(prisma.stadiumShopItem.findMany.mock.calls[0][0].where.effectType.in).toEqual(['stamina_full', 'stamina_flat']);
  });
  it('resolves label and image authoritatively from selected identity', async () => {
    const { prisma } = database();
    const result = await normalizePassRewards(prisma, [{ ...season().levels[0], rewardLabel: 'forged', rewardImageUrl: '/forged' }]);
    expect(result[0]).toMatchObject({ rewardLabel: '2× Carta', rewardImageUrl: '/card.webp' });
  });
  it.each(['gear', 'shop_item'])('rejects a card id under the %s category', async type => {
    const { prisma } = database(); await expect(normalizePassRewards(prisma, season(type).levels)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
  it.each(['player', 'cosmetic', 'ticket'])('rejects undeliverable legacy %s prizes', async type => {
    const { prisma } = database(); await expect(normalizePassRewards(prisma, season(type).levels)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
  it('refuses legacy synthetic player delivery without marking the prize claimed', async () => {
    const { prisma, tx } = database();
    await expect(claimPassReward(prisma, 'user', season('player'), 1)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(tx.warehouseItem.createMany).not.toHaveBeenCalled();
    expect(tx.passProgress.update).not.toHaveBeenCalled();
  });
  it('builds the default template entirely from active catalog items and GMT', async () => {
    const { prisma } = database();
    const cards = [{ ...card, rarity: 0 }, { ...card, id: '10000000-0000-4000-8000-000000000004', rarity: 0 }, { ...card, id: '10000000-0000-4000-8000-000000000005', rarity: 1 }, { ...card, id: '10000000-0000-4000-8000-000000000006', rarity: 2 }];
    prisma.itemTemplate.findMany.mockResolvedValue(cards);
    prisma.gearCatalogItem.findFirst = vi.fn().mockResolvedValue(gear);
    prisma.stadiumShopItem.findFirst = vi.fn().mockResolvedValue(shop);
    const template = await getDefaultPassTemplate(prisma);
    expect(template.levels).toHaveLength(10); expect(template.missions).toHaveLength(17);
    expect(template.levels.filter(level => level.rewardType !== 'usdc').every(level => ['catalog_item', 'gear', 'shop_item'].includes(level.rewardType) && level.rewardItemId && level.rewardImageUrl)).toBe(true);
    expect(template.levels[1].rewardItemId).toBe(cards[0].id);
    expect(template.levels[6].rewardItemId).toBe(cards[1].id);
    expect(template.levels[9].rewardItemId).toBe(cards[2].id);
    expect(template.levels.filter(level => level.rewardType === 'usdc').reduce((total, level) => total + (level.usdcAmount ?? 0), 0)).toBe(450);
  });
  it('does not invent a player if the template has no active matching card', async () => {
    const { prisma } = database();
    prisma.itemTemplate.findMany.mockResolvedValue([]);
    prisma.gearCatalogItem.findFirst = vi.fn().mockResolvedValue(gear);
    prisma.stadiumShopItem.findFirst = vi.fn().mockResolvedValue(shop);
    await expect(getDefaultPassTemplate(prisma)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
  it('places each catalog card in a separate warehouse slot with its complete snapshot', async () => {
    const { prisma, tx } = database(); await claimPassReward(prisma, 'user', season(), 1);
    expect(tx.warehouseItem.createMany.mock.calls[0][0].data).toEqual(Array(2).fill({ userId: 'user', itemType: 'player_card', name: card.name, imageUrl: card.imageUrl, rarity: 5, quantity: 1, data: { templateId: card.id, overwall: 3200, position: 3 }, source: 'pass', sourceRef: 'pass:1:1' }));
    expect(tx.passProgress.update).toHaveBeenCalledOnce(); expect(prisma.$transaction).toHaveBeenCalledOnce(); expect(tx.$queryRaw).toHaveBeenCalledOnce();
  });
  it('delivers gear to the bag with pass origin', async () => {
    const { prisma, tx } = database(); await claimPassReward(prisma, 'user', season('gear', gear.id), 1);
    expect(tx.userGear.createMany.mock.calls[0][0].data).toEqual(Array(2).fill({ userId: 'user', catalogItemId: gear.id, source: 'pass' }));
    expect(tx.warehouseItem.createMany).not.toHaveBeenCalled();
  });
  it('delivers full stamina as consumables with 100 restoration', async () => {
    const { prisma, tx } = database(); await claimPassReward(prisma, 'user', season('shop_item', shop.id), 1);
    expect(tx.warehouseItem.createMany.mock.calls[0][0].data[0]).toMatchObject({ itemType: 'stamina_boost', quantity: 1, data: { effectValue: 100, effectType: 'stamina_full' } });
  });
  it('uses the whole range reward instead of mixing its id with the individual reward', async () => {
    const { prisma, tx } = database(); const s = season(); s.rewardBlocks = [{ fromLevel: 1, toLevel: 2, rewardType: 'gear', rewardItemId: gear.id, quantity: 3, rewardLabel: 'Gear' }];
    await claimPassReward(prisma, 'user', s, 1);
    expect(tx.userGear.createMany.mock.calls[0][0].data).toHaveLength(3); expect(tx.warehouseItem.createMany).not.toHaveBeenCalled();
  });
  it.each([{ xp: 0, claimedLevels: [] }, { xp: 9999, claimedLevels: [1] }])('does not deliver locked or already claimed prizes', async progress => {
    const { prisma, tx } = database(); tx.passProgress.findUniqueOrThrow.mockResolvedValue(progress);
    await expect(claimPassReward(prisma, 'user', season(), 1)).rejects.toBeTruthy();
    expect(tx.warehouseItem.createMany).not.toHaveBeenCalled(); expect(tx.passProgress.update).not.toHaveBeenCalled();
  });
  it('does not mark claimed when an item has been deleted or delivery fails', async () => {
    const { prisma, tx } = database(); tx.itemTemplate.findUnique.mockResolvedValue(null as any);
    await expect(claimPassReward(prisma, 'user', season(), 1)).rejects.toBeTruthy(); expect(tx.passProgress.update).not.toHaveBeenCalled();
  });
});
