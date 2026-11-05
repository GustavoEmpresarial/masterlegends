import type { GearCatalogItem, PrismaClient } from '@prisma/client';
import { GearSlot } from '@mll/shared';
import { runWithSystemContext } from '../../src/common/lib/prisma-context.js';

let seq = 0;

export async function createTestGearCatalog(
  prisma: PrismaClient,
  opts?: {
    slug?: string;
    nameKey?: string;
    slot?: string;
    rarity?: number;
    owBonus?: number;
    priceGmt?: number;
    active?: boolean;
    imageUrl?: string | null;
  },
): Promise<GearCatalogItem> {
  seq += 1;
  return runWithSystemContext(async () =>
    prisma.gearCatalogItem.create({
      data: {
        slug: opts?.slug ?? `boots-factory-${seq}`,
        nameKey: opts?.nameKey ?? 'gear.boots.factory',
        slot: opts?.slot ?? GearSlot.BOOTS,
        rarity: opts?.rarity ?? 1,
        owBonus: opts?.owBonus ?? 25,
        priceGmt: opts?.priceGmt ?? 50,
        imageUrl: opts?.imageUrl === undefined ? '/uploads/gear/factory.png' : opts.imageUrl,
        active: opts?.active ?? true,
        sortOrder: seq,
      },
    }),
  );
}

export async function truncateGearTables(prisma: PrismaClient): Promise<void> {
  await runWithSystemContext(async () => {
    await prisma.playerGearEquip.deleteMany();
    await prisma.userGear.deleteMany();
    await prisma.gearCatalogItem.deleteMany();
  });
}
