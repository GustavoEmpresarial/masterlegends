import { createLogger } from '@mll/logging';
import { config } from '../config/env.js';

export const logger = createLogger({
  service: 'worker',
  level: config.LOG_LEVEL,
  isProduction: config.isProduction,
  mongo: {
    enabled: config.LOG_MONGO_ENABLED,
    uri: config.MONGODB_URI,
    ttlDays: config.LOG_MONGO_TTL_DAYS,
    batchSize: config.LOG_MONGO_BATCH_SIZE,
    flushMs: config.LOG_MONGO_FLUSH_MS,
  },
});
