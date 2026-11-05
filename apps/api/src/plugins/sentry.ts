import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import * as Sentry from '@sentry/node';
import { config } from '../config/env.js';

export default fp(async function sentryPlugin(app: FastifyInstance) {
  if (!config.SENTRY_DSN) return;

  Sentry.init({
    dsn: config.SENTRY_DSN,
    environment: config.NODE_ENV,
    tracesSampleRate: config.isProduction ? 0.1 : 0,
  });

  app.addHook('onError', async (request, _reply, error) => {
    const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
    if (statusCode >= 500) {
      Sentry.withScope((scope) => {
        scope.setTag('url', request.url);
        scope.setTag('method', request.method);
        const userId = (request as { user?: { id: string } }).user?.id;
        if (userId) scope.setUser({ id: userId });
        Sentry.captureException(error);
      });
    }
  });

  app.log.info('Sentry error tracking enabled');
});
