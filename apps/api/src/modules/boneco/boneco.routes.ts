import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { BONECO_KITS, BONECO_POSES, BONECO_POSITIONS, BONECO_TRIMS } from './boneco.prompt.js';
import { BonecoService } from './boneco.service.js';

const generateSchema = z.object({
  playerId: z.string().trim().min(1).max(64),
  playerKind: z.enum(['base', 'nft']),
  position: z.enum(BONECO_POSITIONS).optional().default('FW'),
  kit: z.enum(BONECO_KITS).optional(),
  trim: z.enum(BONECO_TRIMS).optional(),
  pose: z.enum(BONECO_POSES).optional(),
  note: z.string().max(400).optional().default(''),
});

export async function registerBonecoRoutes(app: FastifyInstance) {
  const service = new BonecoService(app.prisma);

  app.get(
    '/',
    { schema: { tags: ['boneco'], security: [{ bearerAuth: [] }] } },
    async (request) => ({ looks: await service.listMine(request.user.id) }),
  );

  app.post(
    '/generate',
    {
      schema: { tags: ['boneco'], security: [{ bearerAuth: [] }] },
      config: { rateLimit: { max: 8, timeWindow: '1 hour' } },
    },
    async (request) => {
      const body = generateSchema.parse(request.body);
      return { look: await service.generate(request.user.id, body) };
    },
  );
}
