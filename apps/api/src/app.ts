import Fastify, { FastifyInstance } from 'fastify';
import { config } from './config/env.js';
import { fastifyLoggerOptions } from './common/lib/logger.js';

import corsPlugin from './plugins/cors.js';
import securityPlugin from './plugins/security.js';
import rateLimitPlugin from './plugins/rateLimit.js';
import jwtPlugin from './plugins/jwt.js';
import csrfPlugin from './plugins/csrf.js';
import prismaPlugin from './plugins/prisma.js';
import prismaContextPlugin from './plugins/prismaContext.js';
import redisPlugin from './plugins/redis.js';
import errorHandlerPlugin from './plugins/errorHandler.js';
import sentryPlugin from './plugins/sentry.js';
import bullBoardPlugin from './plugins/bullBoard.js';
import uploadsPlugin from './plugins/uploads.js';

import { applyGlobalPlayerApiGuards } from './common/guards/player-api.guards.js';
import { maintenanceGuard } from './common/guards/maintenance.guard.js';
import { registerAuthRoutes } from './modules/auth/auth.routes.js';
import { registerClubRoutes } from './modules/club/club.routes.js';
import { registerProfileRoutes } from './modules/profile/profile.routes.js';
import { registerMarketplaceRoutes } from './modules/marketplace/marketplace.routes.js';
import { registerBonecoRoutes } from './modules/boneco/boneco.routes.js';
import { registerPvpRoutes } from './modules/pvp/pvp.routes.js';
import { registerPassRoutes } from './modules/pass/pass.routes.js';
import { registerReferralsRoutes } from './modules/referrals/referrals.routes.js';
import { registerScoutRoutes } from './modules/scout/scout.routes.js';
import { registerAdminRoutes } from './modules/admin/admin.routes.js';
import { registerStatsRoutes } from './modules/stats/stats.routes.js';
import { registerAnnouncementRoutes } from './modules/announcements/announcement.routes.js';
import { registerSupportRoutes } from './modules/support/support.routes.js';
import { registerTelemetryFailureRoutes } from './modules/telemetry/failures.routes.js';
import { registerWalletRoutes } from './modules/wallet/wallet.routes.js';
import { registerMiningRoutes } from './modules/mining/mining.routes.js';
import { registerStadiumPlayerRoutes } from './modules/stadium/stadium-player.routes.js';
import { registerStadiumShopRoutes } from './modules/stadium-shop/stadium-shop.routes.js';
import { registerCheckInRoutes } from './modules/checkin/checkin.routes.js';
import { registerVestiarioRoutes } from './modules/vestiario/vestiario.routes.js';
import { registerCtRoutes } from './modules/ct/ct.routes.js';
import { registerOfficeRoutes } from './modules/office/office.routes.js';
import { registerMinigamesRoutes } from './modules/minigames/minigames.routes.js';
import { registerMergerRoutes } from './modules/merger/merger.routes.js';
import { registerSocialRoutes } from './modules/social/social.routes.js';
import { registerBlogRoutes } from './modules/blog/blog.routes.js';
import { registerTransparencyPublicRoutes } from './modules/transparency/transparency.routes.js';
import { registerRoadmapPublicRoutes } from './modules/roadmap/roadmap.routes.js';
import { registerNoticesPublicRoutes } from './modules/notices/notices.routes.js';
import { registerTelegramRoutes } from './modules/telegram/telegram.routes.js';
import { registerEventsRoutes } from './modules/events/events.routes.js';
import { registerWarehouseRoutes } from './modules/warehouse/warehouse.routes.js';
import { registerOfferwallRoutes } from './modules/offerwall/offerwall.routes.js';
import { registerPlayerStakeRoutes } from './modules/player-stake/player-stake.routes.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: fastifyLoggerOptions,
    trustProxy: 1,
    disableRequestLogging: false,
  });

  // Infra
  await app.register(errorHandlerPlugin);
  await app.register(sentryPlugin);
  await app.register(securityPlugin);
  await app.register(corsPlugin);
  await app.register(jwtPlugin);
  await app.register(prismaPlugin);
  await app.register(prismaContextPlugin);
  await app.register(redisPlugin);
  await app.register(rateLimitPlugin);
  await app.register(csrfPlugin);
  await app.register(bullBoardPlugin);
  await app.register(uploadsPlugin);

  // Bloqueia toda a API pública quando PlatformConfig.maintenanceMode está ligado.
  app.addHook('onRequest', maintenanceGuard);

  // Public health
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  await app.register(registerStatsRoutes, { prefix: '/stats' });

  // Auth (public + /me)
  await app.register(registerAuthRoutes, { prefix: '/auth' });

  // Player API — JWT obrigatório em todas as rotas /api/* (fail-closed via onRoute)
  await app.register(
    async (playerApi) => {
      playerApi.addHook('onRoute', applyGlobalPlayerApiGuards);

      // Loga TODA ação de usuário autenticado em /api/* → mongo via pino sink
      playerApi.addHook('onRequest', async (request) => {
        (request as unknown as { _t0: number })._t0 = Date.now();
      });
      playerApi.addHook('onResponse', async (request, reply) => {
        const userId = request.user?.id ?? null;
        // Ignora rotas sem usuário (provavelmente 401 antes do auth) ou healthchecks
        if (!userId) return;
        const start = (request as unknown as { _t0?: number })._t0 ?? Date.now();
        const durationMs = Date.now() - start;
        request.log.info(
          {
            event: 'user_action',
            userId,
            method: request.method,
            url: request.url,
            routeUrl: request.routeOptions?.url ?? null,
            statusCode: reply.statusCode,
            durationMs,
            ip: request.ip,
            userAgent: request.headers['user-agent']?.slice(0, 256),
          },
          'user_action',
        );
      });

      await playerApi.register(registerClubRoutes, { prefix: '/club' });
      await playerApi.register(registerProfileRoutes, { prefix: '/profile' });
      await playerApi.register(registerStadiumPlayerRoutes, { prefix: '/stadium' });
      await playerApi.register(registerStadiumShopRoutes, { prefix: '/stadium' });
      await playerApi.register(registerVestiarioRoutes, { prefix: '/vestiario' });
      await playerApi.register(registerCheckInRoutes, { prefix: '/checkin' });
      await playerApi.register(registerCtRoutes, { prefix: '/ct' });
      await playerApi.register(registerOfficeRoutes, { prefix: '/office' });
      await playerApi.register(registerMinigamesRoutes, { prefix: '/minigames' });
      await playerApi.register(registerMarketplaceRoutes, { prefix: '/marketplace' });
      await playerApi.register(registerBonecoRoutes, { prefix: '/boneco' });
      await playerApi.register(registerPvpRoutes, { prefix: '/pvp' });
      await playerApi.register(registerPassRoutes, { prefix: '/pass' });
      await playerApi.register(registerEventsRoutes, { prefix: '/events' });
      await playerApi.register(registerReferralsRoutes, { prefix: '/referrals' });
      await playerApi.register(registerScoutRoutes, { prefix: '/scout' });
      await playerApi.register(registerMergerRoutes, { prefix: '/merger' });
      await playerApi.register(registerWalletRoutes, { prefix: '/wallet' });
      await playerApi.register(registerMiningRoutes, { prefix: '/mining' });
      await playerApi.register(registerAnnouncementRoutes, { prefix: '/announcements' });
      await playerApi.register(registerSupportRoutes, { prefix: '/support' });
      await playerApi.register(registerTelegramRoutes, { prefix: '/telegram' });
      await playerApi.register(registerTelemetryFailureRoutes, { prefix: '/telemetry' });
      await playerApi.register(registerSocialRoutes, { prefix: '/social' });
      await playerApi.register(registerWarehouseRoutes, { prefix: '/warehouse' });
      await playerApi.register(registerOfferwallRoutes, { prefix: '/offerwall' });
      await playerApi.register(registerPlayerStakeRoutes, { prefix: '' });
    },
    { prefix: '/api' },
  );

  await app.register(registerAdminRoutes, { prefix: '/admin/api' });

  // Blog — public GET at /blog/*, admin CRUD at /blog/admin/*
  await app.register(registerBlogRoutes, { prefix: '/blog' });

  // Transparency & Notices — public routes
  await app.register(registerTransparencyPublicRoutes, { prefix: '/transparencia' });
  await app.register(registerRoadmapPublicRoutes, { prefix: '/roadmap' });
  await app.register(registerNoticesPublicRoutes, { prefix: '/notices' });

  return app;
}

export { config };
