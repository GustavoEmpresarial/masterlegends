import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { runRequestContext, resolveScopeFromPath } from '../common/lib/prisma-context.js';

export default fp(async function prismaContextPlugin(app: FastifyInstance) {
  // Scope inicial por path; userId/adminId são preenchidos pelos guards JWT no preHandler.
  // `run()` isola o contexto por request (enterWith vazava entre requests concorrentes).
  app.addHook('onRequest', (request, reply, done) => {
    const scope = resolveScopeFromPath(request.url);
    runRequestContext(scope, () => done());
  });
});
