/**
 * Renomeia BasePlayers com nome placeholder `[seed-v1]…` para
 * `Nome Sobrenome — Apelido` gerado (estável por id).
 *
 * Uso: cd apps/api && npx tsx prisma/backfill-player-nicknames.ts
 */
import { PrismaClient } from '@prisma/client';
import { generatePlayerDisplayName, isPlaceholderPlayerName } from '@mll/shared';

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.basePlayer.findMany({
    select: { id: true, name: true },
  });

  let updated = 0;
  for (const row of rows) {
    if (!isPlaceholderPlayerName(row.name)) continue;
    const name = generatePlayerDisplayName(row.id);
    await prisma.basePlayer.update({ where: { id: row.id }, data: { name } });
    updated += 1;
    console.log(`${row.name} → ${name}`);
  }

  console.log(`Updated ${updated} / ${rows.length} players`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
