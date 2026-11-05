import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { createPrismaClient } from '../common/lib/create-prisma-client.js';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export default fp(async function prismaPlugin(app: FastifyInstance) {
  // Client estendido com guard ALS — ver create-prisma-client.ts
  const prisma = createPrismaClient();

  await prisma.$connect();
  app.decorate('prisma', prisma);

  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
});
