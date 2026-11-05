import type { FastifyInstance } from 'fastify';
import type { JWT } from '@fastify/jwt';

/** Namespaced admin JWT from @fastify/jwt (`namespace: 'admin'`). */
export function getAdminJwt(app: FastifyInstance): JWT {
  return (app.jwt as JWT & { admin: JWT }).admin;
}
