import { PrismaClient } from '@prisma/client';
import { isPrismaAccessAllowed, PrismaContextError } from './prisma-context.js';

/**
 * PrismaClient com extension que bloqueia queries fora de contexto ALS autorizado.
 * Worker (`apps/worker`) usa PrismaClient próprio — não passa por este guard.
 *
 * Para scripts/seeds que precisam de acesso total, use createSystemPrismaClient().
 */
export function createPrismaClient(): PrismaClient {
  const base = new PrismaClient({
    log: ['warn', 'error'],
  });

  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ query, args }) {
          // Fail-closed: sem contexto system/player+userId/admin+adminId → nega
          if (!isPrismaAccessAllowed()) {
            throw new PrismaContextError();
          }
          return query(args);
        },
      },
    },
  }) as unknown as PrismaClient;
}

/**
 * PrismaClient sem guard — para seeds, scripts e testes.
 * NUNCA usar em código HTTP/request-scoped.
 */
export function createSystemPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: ['warn', 'error'],
  });
}
