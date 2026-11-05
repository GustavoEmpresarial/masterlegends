/**
 * Seed 3 ItemTemplate por raridade (15 total) para o pool de scout/merge.
 * Imagem placeholder — admin substitui via PATCH multipart em /admin/api/items/:id
 *
 * Uso:
 *   cd apps/api && npx tsx prisma/seed-item-templates.ts
 *   # ou na VM:
 *   docker compose exec api npx tsx prisma/seed-item-templates.ts
 */
import { PrismaClient } from '@prisma/client';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const prisma = new PrismaClient();

const POSITIONS = ['GK', 'DEF', 'MID', 'FW'] as const;

const RARITY_BANDS = [
  { rarity: 0, label: 'Comum', pt: 'COMUM', min: 350, max: 350, chance: '84.82%' },
  { rarity: 1, label: 'Raro', pt: 'RARO', min: 2_000, max: 2_000, chance: '15%' },
  { rarity: 2, label: 'Super Raro', pt: 'S.RARO', min: 14_000, max: 14_000, chance: '0.15%' },
  { rarity: 3, label: 'Épico', pt: 'ÉPICO', min: 70_000, max: 70_000, chance: '0.02%' },
  { rarity: 4, label: 'Lendário', pt: 'LENDÁRIO', min: 350_000, max: 350_000, chance: '0.01%' },
] as const;

const PER_RARITY = 3;
const SEED_TAG = 'seed-v1';
const PLACEHOLDER_FILENAME = '_seed-player-placeholder.png';

/** 1×1 PNG transparente — substituível pelo admin depois */
const PLACEHOLDER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

function overwallInBand(min: number, max: number, index: number): number {
  if (PER_RARITY <= 1) return min;
  return Math.round(min + ((max - min) * index) / (PER_RARITY - 1));
}

function seedName(band: (typeof RARITY_BANDS)[number], index: number): string {
  const n = String(index + 1).padStart(2, '0');
  return `${band.label} #${n}`;
}

async function ensurePlaceholderImage(): Promise<string> {
  const candidates = [
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../uploads/items'),
    '/app/apps/api/uploads/items',
  ];
  let uploadsDir = candidates[0]!;
  for (const dir of candidates) {
    try {
      await fs.mkdir(dir, { recursive: true });
      uploadsDir = dir;
      break;
    } catch {
      /* try next */
    }
  }
  const fullPath = path.join(uploadsDir, PLACEHOLDER_FILENAME);
  try {
    await fs.access(fullPath);
  } catch {
    await fs.writeFile(fullPath, PLACEHOLDER_PNG);
  }
  return `/uploads/items/${PLACEHOLDER_FILENAME}`;
}

async function main() {
  const imageUrl = await ensurePlaceholderImage();
  let created = 0;
  let updated = 0;

  for (const band of RARITY_BANDS) {
    for (let i = 0; i < PER_RARITY; i += 1) {
      const name = seedName(band, i);
      const position = i % POSITIONS.length;
      const overwall = overwallInBand(band.min, band.max, i);
      const lookupName = `[${SEED_TAG}] ${name}`;

      const existing = await prisma.itemTemplate.findFirst({
        where: { name: lookupName },
      });

      if (existing) {
        await prisma.itemTemplate.update({
          where: { id: existing.id },
          data: {
            rarity: band.rarity,
            position,
            overwall,
            weight: 1,
            active: true,
          },
        });
        updated += 1;
      } else {
        await prisma.itemTemplate.create({
          data: {
            name: lookupName,
            imageUrl,
            rarity: band.rarity,
            position,
            overwall,
            weight: 1,
            active: true,
            createdBy: 'seed-item-templates',
          },
        });
        created += 1;
      }
    }
  }

  const totals = await prisma.itemTemplate.groupBy({
    by: ['rarity'],
    where: { active: true, name: { startsWith: `[${SEED_TAG}]` } },
    _count: { _all: true },
  });

  console.log(`Item templates: ${created} created, ${updated} updated`);
  console.log('Active seeded templates by rarity:');
  for (const row of totals.sort((a, b) => a.rarity - b.rarity)) {
    const band = RARITY_BANDS[row.rarity];
    console.log(
      `  ${band?.pt ?? row.rarity}: ${row._count._all} (overwall ${band?.min}–${band?.max}, chance ${band?.chance})`,
    );
  }
  console.log(`Placeholder image: ${imageUrl} (admin pode trocar a foto de cada item)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
