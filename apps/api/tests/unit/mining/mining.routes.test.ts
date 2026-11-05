import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';

const summary = {
  lifetimeEarned: 0,
  currentOverwall: 100,
  networkOverwall: 1000,
  sharePct: 10,
  estimatedPerBlock: 0.01,
  blockRewardUsdc: 0.1,
  blockIntervalMin: 10,
  paused: false,
  lastBlockNumber: null,
  lastBlockAt: null,
};

const getSummary = vi.fn().mockResolvedValue(summary);
const listBlocks = vi.fn().mockResolvedValue([{ blockNumber: 1 }]);
const listHistory = vi.fn().mockResolvedValue([{ id: 'r1' }]);

vi.mock('../../../src/modules/mining/mining.service.js', () => ({
  MiningService: vi.fn().mockImplementation(() => ({
    getSummary,
    listBlocks,
    listHistory,
  })),
}));

const { registerMiningRoutes } = await import(
  '../../../src/modules/mining/mining.routes.js'
);

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify();
  // minimal prisma stub
  (app as any).prisma = {};
  // inject fake auth: every request gets a user
  app.addHook('preHandler', async (req) => {
    (req as any).user = { id: 'u1' };
  });
  await app.register(registerMiningRoutes, { prefix: '/api/mining' });
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('mining routes', () => {
  it('GET /me delegates to service.getSummary', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/mining/me' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(summary);
    expect(getSummary).toHaveBeenCalledWith('u1');
    await app.close();
  });

  it('GET /blocks parses limit query', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/mining/blocks?limit=7' });
    expect(res.statusCode).toBe(200);
    expect(listBlocks).toHaveBeenCalledWith(7);
    expect(res.json().blocks).toHaveLength(1);
    await app.close();
  });

  it('GET /blocks defaults to 20 when limit missing', async () => {
    const app = await buildApp();
    await app.inject({ method: 'GET', url: '/api/mining/blocks' });
    expect(listBlocks).toHaveBeenCalledWith(20);
    await app.close();
  });

  it('GET /history calls listHistory with userId', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/mining/history?limit=3' });
    expect(res.statusCode).toBe(200);
    expect(listHistory).toHaveBeenCalledWith('u1', 3);
    expect(res.json().rewards).toEqual([{ id: 'r1' }]);
    await app.close();
  });
});
