import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { FastifyAdapter } from '@bull-board/fastify';
import { Queue } from 'bullmq';
import { AdminRole, ALL_QUEUE_NAMES } from '@mll/shared';
import { config } from '../config/env.js';
import { asBullMqConnection } from '../common/lib/redis-queue.js';
import { verifyAdminTokenForBoard } from '../common/guards/admin.guard.js';

export default fp(async function bullBoardPlugin(app: FastifyInstance) {
  if (!config.ENABLE_BULL_BOARD || config.isProduction) return;

  const serverAdapter = new FastifyAdapter();
  serverAdapter.setBasePath('/admin/queues');

  const connection = asBullMqConnection(app.redisQueue);
  const queues = ALL_QUEUE_NAMES.map(
    (name) => new BullMQAdapter(new Queue(name, { connection })),
  );

  createBullBoard({ queues, serverAdapter });

  app.addHook('onRequest', async (request, reply) => {
    if (!request.url.startsWith('/admin/queues')) return;
    const ok = await verifyAdminTokenForBoard(request, reply, [AdminRole.SUPER, AdminRole.OPS]);
    if (!ok) return reply;
  });

  await app.register(serverAdapter.registerPlugin(), {
    prefix: '/admin/queues',
    basePath: '/admin/queues',
  });

  app.log.info('Bull Board enabled at /admin/queues (admin JWT required)');
});
