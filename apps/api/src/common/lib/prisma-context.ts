import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Contexto Prisma por requisição (AsyncLocalStorage).
 *
 * Cada request HTTP recebe um scope no `onRequest` (`prismaContext` plugin).
 * Guards JWT preenchem `userId` / `adminId` após autenticação.
 * A Prisma extension em `create-prisma-client.ts` consulta `isPrismaAccessAllowed()`
 * antes de executar qualquer query — rede de segurança além dos repositories.
 *
 * Fora de request: seeds, teardown de testes e jobs internos usam `runWithSystemContext()`.
 */

export type PrismaScope = 'system' | 'player' | 'admin' | 'blocked';

export interface PrismaRequestContext {
  scope: PrismaScope;
  userId?: string;
  adminId?: string;
}

export class PrismaContextError extends Error {
  constructor(message = 'Prisma access denied: no authorized request context') {
    super(message);
    this.name = 'PrismaContextError';
  }
}

const storage = new AsyncLocalStorage<PrismaRequestContext>();

export function getPrismaContext(): PrismaRequestContext | undefined {
  return storage.getStore();
}

/**
 * Inicia contexto mutável para o request HTTP (chamado no onRequest).
 * Usa `run()` — `enterWith()` compartilha estado entre requests concorrentes.
 */
export function runRequestContext<T>(scope: PrismaScope, fn: () => T): T {
  const ctx: PrismaRequestContext = { scope };
  return storage.run(ctx, fn);
}

/** Apenas testes unitários — produção usa `runRequestContext`. */
export function initRequestContext(scope: PrismaScope): PrismaRequestContext {
  const ctx: PrismaRequestContext = { scope };
  storage.enterWith(ctx);
  return ctx;
}

/** Chamado por authGuard após JWT válido — libera queries Prisma em rotas /api/*. */
export function authorizePlayer(userId: string): void {
  const ctx = storage.getStore();
  if (!ctx) return;
  ctx.scope = 'player';
  ctx.userId = userId;
}

/** Chamado por adminGuard após JWT admin válido — libera queries em /admin/api/*. */
export function authorizeAdmin(adminId: string): void {
  const ctx = storage.getStore();
  if (!ctx) return;
  ctx.scope = 'admin';
  ctx.adminId = adminId;
}

export function isPrismaAccessAllowed(): boolean {
  if (process.env.PRISMA_GUARD_DISABLED === 'true') return true;
  const ctx = storage.getStore();
  if (!ctx) return false;

  switch (ctx.scope) {
    case 'system':
      return true;
    case 'player':
      return Boolean(ctx.userId);
    case 'admin':
      return Boolean(ctx.adminId);
    default:
      return false;
  }
}

/** Mapeia URL → scope inicial (antes do JWT). Rotas /api/* começam como player sem userId. */
export function resolveScopeFromPath(url: string): PrismaScope {
  const path = url.split('?')[0] ?? url;

  if (
    path === '/health' ||
    path.startsWith('/auth') ||
    path.startsWith('/stats/') ||
    path.startsWith('/notices') ||
    path.startsWith('/transparencia') ||
    path === '/api/telegram/webhook' ||
    path === '/api/offerwall/zerads/ptc'
  ) {
    return 'system';
  }
  if (path.startsWith('/api/')) {
    return 'player';
  }
  if (path.startsWith('/admin/api')) {
    const systemAdminPaths = new Set([
      '/admin/api/csrf',
      '/admin/api/login',
      '/admin/api/verify-2fa',
      '/admin/api/refresh',
      '/admin/api/logout',
    ]);
    if (systemAdminPaths.has(path)) {
      return 'system';
    }
    return 'admin';
  }
  if (path.startsWith('/admin/queues')) {
    return 'admin';
  }
  return 'blocked';
}

/** Escopo system para seeds, teardown de testes e scripts internos (fora de HTTP). */
export async function runWithSystemContext<T>(fn: () => Promise<T>): Promise<T> {
  return storage.run({ scope: 'system' }, fn);
}
