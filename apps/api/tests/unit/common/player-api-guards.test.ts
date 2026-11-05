import { describe, it, expect, vi } from 'vitest';
import type { RouteOptions } from 'fastify';
import { applyGlobalPlayerApiGuards } from '../../../src/common/guards/player-api.guards.js';
import { authGuard } from '../../../src/common/guards/auth.guard.js';
import { verifiedEmailGuard } from '../../../src/common/guards/verified-email.guard.js';

function routeOptions(overrides: Partial<RouteOptions> = {}): RouteOptions {
  return {
    method: 'GET',
    url: '/',
    handler: vi.fn(),
    ...overrides,
  };
}

describe('applyGlobalPlayerApiGuards', () => {
  it('prepends authGuard when no existing preHandler', () => {
    const options = routeOptions();
    applyGlobalPlayerApiGuards(options);
    expect(options.preHandler).toEqual([authGuard]);
  });

  it('skips all guards when config.public is true', () => {
    const custom = vi.fn();
    const options = routeOptions({ preHandler: custom, config: { public: true } });
    applyGlobalPlayerApiGuards(options);
    expect(options.preHandler).toBe(custom);
  });

  it('appends verifiedEmailGuard when requireVerifiedEmail is set', () => {
    const options = routeOptions({ config: { requireVerifiedEmail: true } });
    applyGlobalPlayerApiGuards(options);
    expect(options.preHandler).toEqual([authGuard, verifiedEmailGuard]);
  });

  it('keeps module preHandlers after authGuard', () => {
    const custom = vi.fn();
    const options = routeOptions({ preHandler: custom });
    applyGlobalPlayerApiGuards(options);
    expect(options.preHandler).toEqual([authGuard, custom]);
  });

  it('chains authGuard, custom preHandler and verifiedEmailGuard', () => {
    const custom = vi.fn();
    const options = routeOptions({
      preHandler: [custom],
      config: { requireVerifiedEmail: true },
    });
    applyGlobalPlayerApiGuards(options);
    expect(options.preHandler).toEqual([authGuard, custom, verifiedEmailGuard]);
  });
});
