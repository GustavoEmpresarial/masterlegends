import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReferralsService } from '../../../src/modules/referrals/referrals.service.js';
import type { ReferralsRepository } from '../../../src/modules/referrals/referrals.repository.js';

function makeRepo(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    findByReferrerId: vi.fn(),
    ...overrides,
  } as unknown as ReferralsRepository;
}

describe('ReferralsService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns zero stats when user has no referrals', async () => {
    const repo = makeRepo({ findByReferrerId: vi.fn().mockResolvedValue([]) });
    const svc = new ReferralsService(repo);
    const stats = await svc.getStats('user-1');
    expect(stats.totalReferrals).toBe(0);
    expect(stats.totalEarned).toBe(0);
  });

  it('counts total referrals and sums MGT earned', async () => {
    const repo = makeRepo({
      findByReferrerId: vi.fn().mockResolvedValue([
        { totalEarnedMGT: 50 },
        { totalEarnedMGT: 75.5 },
        { totalEarnedMGT: 0 },
      ]),
    });
    const svc = new ReferralsService(repo);
    const stats = await svc.getStats('user-1');
    expect(stats.totalReferrals).toBe(3);
    expect(stats.totalEarned).toBeCloseTo(125.5);
  });

  it('handles Decimal-like objects from Prisma', async () => {
    const repo = makeRepo({
      findByReferrerId: vi.fn().mockResolvedValue([
        { totalEarnedMGT: { valueOf: () => 100 } },
      ]),
    });
    const svc = new ReferralsService(repo);
    const stats = await svc.getStats('user-1');
    expect(stats.totalEarned).toBe(100);
  });

  it('queries by the correct referrerId', async () => {
    const findByReferrerId = vi.fn().mockResolvedValue([]);
    const repo = makeRepo({ findByReferrerId });
    const svc = new ReferralsService(repo);
    await svc.getStats('ref-xyz');
    expect(findByReferrerId).toHaveBeenCalledWith('ref-xyz');
  });
});
