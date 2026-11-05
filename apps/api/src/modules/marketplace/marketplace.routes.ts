import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  buyListingParamsSchema,
  cancelListingParamsSchema,
  listItemSchema,
  listingsQuerySchema,
  updateListingPriceSchema,
} from '@mll/shared';
import { MarketplaceRepository, MarketplaceService } from './marketplace.service.js';
import { PassRepository, PassService } from '../pass/pass.service.js';

const listBulkSchema = z.object({
  items: z.array(listItemSchema).min(1).max(50),
});

export async function registerMarketplaceRoutes(app: FastifyInstance) {
  const passService = new PassService(new PassRepository(app.prisma), app.prisma);
  const service = new MarketplaceService(
    new MarketplaceRepository(app.prisma),
    app.prisma,
    passService,
  );

  app.get(
    '/info',
    { schema: { tags: ['marketplace'], security: [{ bearerAuth: [] }] } },
    async (request) => {
      const info = await service.getInfo();
      if (request.user?.id) {
        const { bumpQuestTrigger } = await import('../events/events.routes.js');
        await Promise.all([
          passService.getMissionProgressService().incrementEvent(request.user.id, 'market_visit', 1),
          bumpQuestTrigger(app, request.user.id, 'market_visit', 1),
        ]);
      }
      return info;
    },
  );

  app.get(
    '/search',
    {
      config: {},
      schema: { tags: ['marketplace'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const query = listingsQuerySchema.parse(request.query);
      const result = await service.search(query, request.user?.id);
      if (request.user?.id) {
        const { bumpQuestTrigger } = await import('../events/events.routes.js');
        await Promise.all([
          passService.getMissionProgressService().incrementEvent(request.user.id, 'market_visit', 1),
          bumpQuestTrigger(app, request.user.id, 'market_visit', 1),
        ]);
      }
      return result;
    },
  );

  app.get(
    '/my-listings',
    {
      config: {},
      schema: { tags: ['marketplace'], security: [{ bearerAuth: [] }] },
    },
    async (request) => service.getMyListings(request.user.id),
  );

  app.post(
    '/list',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      schema: { tags: ['marketplace'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const body = listItemSchema.parse(request.body);
      const result = await service.listItem(request.user.id, body);
      void passService.getMissionProgressService().incrementEvent(request.user.id, 'trade_player', 1);
      const { bumpQuestTrigger } = await import('../events/events.routes.js');
      bumpQuestTrigger(app, request.user.id, 'trade_player', 1);
      return result;
    },
  );

  app.post(
    '/buy/:listingId',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: { tags: ['marketplace'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const params = buyListingParamsSchema.parse(request.params);
      const result = await service.buyItem(request.user.id, params.listingId);
      void passService.getMissionProgressService().incrementEvent(request.user.id, 'trade_player', 1);
      const { bumpQuestTrigger } = await import('../events/events.routes.js');
      bumpQuestTrigger(app, request.user.id, 'trade_player', 1);
      return result;
    },
  );

  app.post(
    '/list-bulk',
    {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: { tags: ['marketplace'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const body = listBulkSchema.parse(request.body);
      return service.listItemsBulk(request.user.id, body.items);
    },
  );

  app.patch(
    '/listings/:listingId/price',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: { tags: ['marketplace'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { listingId } = cancelListingParamsSchema.parse(request.params);
      const { price } = updateListingPriceSchema.parse(request.body);
      return service.updateItemPrice(request.user.id, listingId, price);
    },
  );

  app.post(
    '/cancel/:listingId',
    {
      config: {},
      schema: { tags: ['marketplace'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const params = cancelListingParamsSchema.parse(request.params);
      return service.cancelItem(request.user.id, params.listingId);
    },
  );
}
