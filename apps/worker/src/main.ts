import { closeMongoSink } from '@mll/logging';
import { config } from './config/env.js';
import { logger } from './lib/logger.js';
import { createQueueRedis } from './lib/redis.js';
import { disconnectPrisma, getPrisma } from './lib/prisma.js';
import { setupWorkers, type WorkerHandles } from './workers/index.js';

let handles: WorkerHandles | null = null;
const redis = createQueueRedis();

async function main() {
  if (config.isTest) {
    logger.warn('Worker skipped in test mode');
    return;
  }

  const prisma = getPrisma();
  handles = await setupWorkers(redis, prisma, logger);

  logger.info({ event: 'worker.start' }, 'Worker process ready');
}

async function shutdown(signal: string) {
  logger.info({ event: 'worker.shutdown', signal }, 'Shutting down worker');

  if (handles) {
    await Promise.all(handles.workers.map((w) => w.close()));
    await Promise.all(handles.queues.map((q) => q.close()));
  }

  await redis.quit();
  await disconnectPrisma();
  await closeMongoSink();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

main().catch((err) => {
  logger.error({ err, event: 'worker.fatal' }, 'Worker failed to start');
  process.exit(1);
});
