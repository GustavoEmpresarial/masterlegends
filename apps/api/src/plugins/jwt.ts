import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import { FastifyInstance } from 'fastify';
import { config } from '../config/env.js';

export default fp(async function jwtPlugin(app: FastifyInstance) {
  // @ts-expect-error @fastify/cookie plugin types lag behind Fastify 5
  await app.register(cookie, {
    secret: config.COOKIE_SECRET || config.JWT_SECRET,
  });

  await app.register(jwt, {
    secret: config.JWT_SECRET,
    sign: { expiresIn: config.JWT_EXPIRY },
  });

  await app.register(jwt, {
    secret: config.adminJwtSecret,
    namespace: 'admin',
    sign: { expiresIn: config.ADMIN_JWT_EXPIRY },
  });
});
