import type { FastifyInstance } from 'fastify';
import { ClubRepository } from '../club/club.repository.js';
import { GearService } from './gear.service.js';
import { StadiumShopService } from './stadium-shop.service.js';

export async function registerStadiumShopRoutes(app: FastifyInstance) {
  const clubRepo = new ClubRepository(app.prisma);
  const service = new StadiumShopService(app.prisma, clubRepo);
  const gear = new GearService(app.prisma, clubRepo);

  app.get(
    '/shop',
    { schema: { tags: ['stadium-shop'], security: [{ bearerAuth: [] }] } },
    async () => {
      const [items, gearItems] = await Promise.all([
        service.listActive(),
        gear.listActiveCatalog(),
      ]);
      return { items, gear: gearItems };
    },
  );

  app.post(
    '/shop/buy',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: { tags: ['stadium-shop'], security: [{ bearerAuth: [] }] },
    },
    async (request) => service.buy(request.user.id, request.body),
  );

  app.post(
    '/shop/buy-gear',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: { tags: ['stadium-shop'], security: [{ bearerAuth: [] }] },
    },
    async (request) => gear.buy(request.user.id, request.body),
  );
}
