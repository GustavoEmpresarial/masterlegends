import type { preHandlerHookHandler, RouteOptions } from 'fastify';
import { authGuard } from './auth.guard.js';
import { verifiedEmailGuard } from './verified-email.guard.js';

function normalizePreHandler(
  existing: RouteOptions['preHandler'],
): preHandlerHookHandler[] {
  if (!existing) return [];
  return Array.isArray(existing) ? [...existing] : [existing];
}

/**
 * Aplica auth global em todas as rotas do sub-app `/api/*`.
 *
 * - `config.public: true` — opt-out explícito (ex.: Telegram webhook).
 * - `config.requireVerifiedEmail: true` — adiciona verifiedEmailGuard após authGuard
 *   (scout mint, marketplace search).
 *
 * Registrado via hook `onRoute` em `app.ts`; módulos não repetem `preHandler: authGuard`.
 */
export function applyGlobalPlayerApiGuards(routeOptions: RouteOptions): void {
  const routeConfig = routeOptions.config ?? {};
  if (routeConfig.public) return;

  const chain: preHandlerHookHandler[] = [
    authGuard,
    ...normalizePreHandler(routeOptions.preHandler),
  ];

  if (routeConfig.requireVerifiedEmail) {
    chain.push(verifiedEmailGuard);
  }

  routeOptions.preHandler = chain;
}
