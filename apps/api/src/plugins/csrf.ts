import fp from 'fastify-plugin';
import csrf from '@fastify/csrf-protection';
import { FastifyInstance, FastifyRequest } from 'fastify';

export default fp(async function csrfPlugin(app: FastifyInstance) {
  await app.register(csrf, {
    cookieKey: '_csrf',
    cookieOpts: {
      httpOnly: true,
      sameSite: 'lax',
      secure: 'auto',
      signed: true,
      path: '/',
    },
    getToken: (req: FastifyRequest) =>
      (req.headers['x-csrf-token'] as string | undefined) ??
      (req.body as { _csrf?: string } | undefined)?._csrf,
  });

  // Apply CSRF check only to routes that opt-in via `config.csrf = true`.
  app.addHook('onRoute', (routeOptions) => {
    if ((routeOptions.config as { csrf?: boolean } | undefined)?.csrf) {
      const existing = routeOptions.preHandler;
      const list = Array.isArray(existing) ? existing : existing ? [existing] : [];
      // @ts-expect-error fastify type narrowing for csrfProtection at registration time
      routeOptions.preHandler = [...list, app.csrfProtection];
    }
  });
});
