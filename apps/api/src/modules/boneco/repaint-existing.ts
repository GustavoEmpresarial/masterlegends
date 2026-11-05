import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { readPlayerAttributes } from '@mll/shared';
import { config } from '../../config/env.js';
import { deleteBonecoImage, saveBonecoImage } from '../../common/lib/uploads.js';
import { paintBonecoStats } from './boneco-stats-paint.js';

const prisma = new PrismaClient();
const players = await prisma.basePlayer.findMany({
  where: { retiredAt: null, imageUrl: { contains: '/bonecos/' } },
  orderBy: { createdAt: 'desc' },
});

console.log('count', players.length);
let ok = 0;
for (const player of players) {
  const filename = path.basename(player.imageUrl ?? '');
  const file = path.resolve(config.UPLOADS_DIR, 'bonecos', filename);
  const attributes = readPlayerAttributes(player.attributes, player.id, player.rarity, player.position);
  const painted = await paintBonecoStats(readFileSync(file), {
    strength: attributes.forca,
    speed: attributes.velocidade,
    stamina: attributes.resistencia,
    performance: attributes.tecnica,
  }, player.rarity);
  const saved = await saveBonecoImage(painted);
  await prisma.basePlayer.update({
    where: { id: player.id },
    data: { imageUrl: saved.url },
  });
  await deleteBonecoImage(player.imageUrl);
  ok += 1;
  console.log('ok', ok, player.name, saved.url);
}
console.log('done', ok);
await prisma.$disconnect();
