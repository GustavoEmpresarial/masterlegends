/**
 * Estoque inicial do marketplace.
 * As imagens já precisam estar em apps/api/uploads/items com o mesmo nome do servidor de desenvolvimento.
 *
 *   cd apps/api && npx tsx prisma/seed-market-stock.ts
 */
import { PrismaClient } from '@prisma/client';
import {
  MARKET_STOCK_CARDS,
  OFFICIAL_MARKET_SELLER_ID,
  marketStockTotal,
} from '@mll/shared';

const prisma = new PrismaClient();

const SIMPLE_TEMPLATE = /^(comum|raro|super raro|épico|epico|lendário|lendario)( \d+)?$/i;

const UNCOMMON_TEMPLATE_ID = 'b1000002-0000-4000-8000-000000000001';

async function ensureUncommonScoutCard() {
  await prisma.itemTemplate.upsert({
    where: { id: UNCOMMON_TEMPLATE_ID },
    create: {
      id: UNCOMMON_TEMPLATE_ID,
      name: 'Ravi',
      imageUrl: '/uploads/items/owned-uncommon.jpg',
      rarity: 1,
      position: 1,
      overwall: 15,
      weight: 1,
      active: true,
      createdBy: 'scout-pool',
    },
    update: {
      name: 'Ravi',
      imageUrl: '/uploads/items/owned-uncommon.jpg',
      rarity: 1,
      position: 1,
      overwall: 15,
      weight: 1,
      active: true,
      createdBy: 'scout-pool',
    },
  });
}

async function ensureSeller() {
  await prisma.user.upsert({
    where: { id: OFFICIAL_MARKET_SELLER_ID },
    create: {
      id: OFFICIAL_MARKET_SELLER_ID,
      email: 'liga-oficial@masterlegends.internal',
      username: 'Liga',
      referralCode: 'LIGA0001',
      emailVerifiedAt: new Date(),
    },
    update: {},
  });
  await prisma.club.upsert({
    where: { userId: OFFICIAL_MARKET_SELLER_ID },
    create: { userId: OFFICIAL_MARKET_SELLER_ID, name: 'Liga Oficial' },
    update: {},
  });
}

async function main() {
  await ensureSeller();
  await ensureUncommonScoutCard();

  for (const card of MARKET_STOCK_CARDS) {
    await prisma.itemTemplate.upsert({
      where: { id: card.templateId },
      create: {
        id: card.templateId,
        name: card.name,
        imageUrl: card.imageUrl,
        rarity: card.rarityIndex,
        position: card.positionIndex,
        overwall: card.overwall,
        weight: 1,
        active: true,
        createdBy: 'market-stock',
      },
      update: {
        name: card.name,
        imageUrl: card.imageUrl,
        rarity: card.rarityIndex,
        position: card.positionIndex,
        overwall: card.overwall,
        weight: 1,
        active: true,
        createdBy: 'market-stock',
      },
    });

    const existing = await prisma.marketSupply.findUnique({ where: { id: card.id } });
    if (!existing) {
      await prisma.marketSupply.create({
        data: {
          id: card.id,
          templateId: card.templateId,
          initialQty: card.quantity,
          remaining: card.quantity,
          priceGmt: card.priceGmt,
        },
      });
      continue;
    }
    const sold = Math.max(0, existing.initialQty - existing.remaining);
    await prisma.marketSupply.update({
      where: { id: card.id },
      data: {
        initialQty: card.quantity,
        remaining: Math.max(0, card.quantity - sold),
        priceGmt: card.priceGmt,
      },
    });
  }

  const retired = await prisma.itemTemplate.findMany({
    where: { createdBy: { not: 'market-stock' } },
    select: { id: true, name: true, imageUrl: true, rarity: true },
  });
  for (const row of retired) {
    if (!SIMPLE_TEMPLATE.test(row.name.trim())) continue;
    const official = MARKET_STOCK_CARDS.find((card) => card.rarityIndex === row.rarity);
    if (official) {
      await prisma.basePlayer.updateMany({
        where: {
          templateId: row.id,
          OR: [{ imageUrl: row.imageUrl }, { imageUrl: null }],
        },
        data: { imageUrl: official.imageUrl },
      });
    }
    await prisma.itemTemplate.update({
      where: { id: row.id },
      data: { active: false, weight: 0 },
    });
  }

  const totals = await prisma.marketSupply.groupBy({
    by: ['templateId'],
    _sum: { remaining: true },
  });
  const remaining = totals.reduce((sum, row) => sum + (row._sum.remaining ?? 0), 0);
  console.log(`Estoque oficial: ${remaining} cópias restantes (catálogo ${marketStockTotal()}).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
