import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildTestApp } from '../../helpers/test-app.js';
import { isIntegrationEnabled } from '../../helpers/integration-env.js';

const run = isIntegrationEnabled() ? describe : describe.skip;

/** Rotas representativas de cada módulo sob /api/* — todas exigem Bearer via onRoute global. */
const PROTECTED_PLAYER_ROUTES = [
  { method: 'GET' as const, url: '/api/club' },
  { method: 'GET' as const, url: '/api/club/inventory' },
  { method: 'GET' as const, url: '/api/marketplace/search' },
  { method: 'POST' as const, url: '/api/scout/mint' },
  { method: 'GET' as const, url: '/api/pass/progress' },
  { method: 'GET' as const, url: '/api/referrals/stats' },
  { method: 'GET' as const, url: '/api/pvp/board' },
];

run('global /api auth (integration)', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.listen({ port: 0, host: '127.0.0.1' });
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it.each(PROTECTED_PLAYER_ROUTES)(
    'returns 401 for $method $url without Bearer token',
    async ({ method, url }) => {
      const res = await app.inject({ method, url });
      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe('AUTH_UNAUTHORIZED');
    },
  );

  it('returns 401 for invalid Bearer token on /api/club', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/club',
      headers: { authorization: 'Bearer not-a-valid-jwt' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('AUTH_UNAUTHORIZED');
  });

  it('allows GET /health without authentication', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('ok');
  });

  it('does not apply global authGuard to /auth/register', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'x', username: 'y', password: 'z' },
    });
    // Falha por validação/Turnstile, não por AUTH_UNAUTHORIZED do guard global
    expect(res.json().error?.code).not.toBe('AUTH_UNAUTHORIZED');
  });
});
