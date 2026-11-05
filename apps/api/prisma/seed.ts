import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SEED_LISTINGS = [
  { tokenId: 1234n, rarity: 1, overwall: 1500, price: 40, position: 0 },
  { tokenId: 1235n, rarity: 2, overwall: 11000, price: 200, position: 1 },
  { tokenId: 1236n, rarity: 3, overwall: 55000, price: 1000, position: 2 },
  { tokenId: 1237n, rarity: 4, overwall: 300000, price: 5500, position: 3 },
  { tokenId: 1238n, rarity: 1, overwall: 1800, price: 42, position: 0 },
  { tokenId: 1239n, rarity: 2, overwall: 10500, price: 190, position: 1 },
  { tokenId: 1240n, rarity: 3, overwall: 58000, price: 1100, position: 2 },
  { tokenId: 1241n, rarity: 1, overwall: 1200, price: 38, position: 0 },
];

async function main() {
  const password = await bcrypt.hash('seedpassword', 10);
  const seller = await prisma.user.upsert({
    where: { email: 'marketplace@seed.local' },
    update: {},
    create: {
      email: 'marketplace@seed.local',
      username: 'mktseed',
      password,
      referralCode: 'MKTSEED1',
      wallet: '0x1111111111111111111111111111111111111111',
    },
  });

  await prisma.mGTBalance.upsert({
    where: { userId: seller.id },
    update: {},
    create: { userId: seller.id, amount: new Prisma.Decimal(5000) },
  });

  await prisma.club.upsert({
    where: { userId: seller.id },
    update: {},
    create: { userId: seller.id, name: 'Seed FC', lastFarmAt: new Date() },
  });

  for (const player of SEED_LISTINGS) {
    await prisma.playerCache.upsert({
      where: { tokenId: player.tokenId },
      update: {
        ownerWallet: seller.wallet!.toLowerCase(),
        rarity: player.rarity,
        overwall: player.overwall,
        position: player.position,
        stamina: 100,
        staminaUpdatedAt: new Date(),
      },
      create: {
        tokenId: player.tokenId,
        ownerWallet: seller.wallet!.toLowerCase(),
        rarity: player.rarity,
        overwall: player.overwall,
        position: player.position,
        stamina: 100,
        staminaUpdatedAt: new Date(),
      },
    });

    await prisma.listing.upsert({
      where: { tokenId: player.tokenId },
      update: {
        price: new Prisma.Decimal(player.price),
        rarity: player.rarity,
        overwall: player.overwall,
        position: player.position,
        active: true,
        sellerId: seller.id,
      },
      create: {
        id: `seed-${player.tokenId}`,
        tokenId: player.tokenId,
        sellerId: seller.id,
        price: new Prisma.Decimal(player.price),
        rarity: player.rarity,
        overwall: player.overwall,
        position: player.position,
        active: true,
      },
    });
  }

  const existingSeason = await prisma.season.findFirst({ where: { active: true } });
  if (existingSeason) {
    console.log('Skipping season seed — configure pass seasons in admin panel');
  }

  console.log(`Seeded ${SEED_LISTINGS.length} marketplace listings`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
