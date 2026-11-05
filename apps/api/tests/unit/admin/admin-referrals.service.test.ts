import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { AdminReferralsService } from '../../../src/modules/admin/admin-referrals.service.js';

function makePrisma() {
  return {
    referral: {
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    user: { findMany: vi.fn() },
  } as any;
}

beforeEach(() => vi.clearAllMocks());

describe('AdminReferralsService.overview', () => {
  it('returns totals and joins top referrers with user info', async () => {
    const prisma = makePrisma();
    prisma.referral.count.mockResolvedValue(42);
    prisma.referral.aggregate.mockResolvedValue({
      _sum: { totalEarnedMGT: new Prisma.Decimal('123.45') },
    });
    prisma.referral.groupBy.mockResolvedValue([
      {
        referrerId: 'u1',
        _count: { referrerId: 7 },
        _sum: { totalEarnedMGT: new Prisma.Decimal('100') },
      },
      {
        referrerId: 'u2',
        _count: { referrerId: 3 },
        _sum: { totalEarnedMGT: new Prisma.Decimal('23.45') },
      },
    ]);
    prisma.user.findMany.mockResolvedValue([
      { id: 'u1', email: 'a@a.com', username: 'alice', referralCode: 'AAA111' },
      { id: 'u2', email: 'b@b.com', username: null, referralCode: 'BBB222' },
    ]);

    const svc = new AdminReferralsService(prisma);
    const out = await svc.overview();

    expect(out.totals).toEqual({ totalReferrals: 42, totalEarnedMgt: 123.45 });
    expect(out.topReferrers).toHaveLength(2);
    expect(out.topReferrers[0]).toMatchObject({
      referrerId: 'u1',
      username: 'alice',
      referralCode: 'AAA111',
      referralsCount: 7,
      totalEarnedMgt: 100,
    });
    expect(out.topReferrers[1].email).toBe('b@b.com');
  });

  it('handles empty data', async () => {
    const prisma = makePrisma();
    prisma.referral.count.mockResolvedValue(0);
    prisma.referral.aggregate.mockResolvedValue({ _sum: { totalEarnedMGT: null } });
    prisma.referral.groupBy.mockResolvedValue([]);

    const svc = new AdminReferralsService(prisma);
    const out = await svc.overview();
    expect(out.totals.totalReferrals).toBe(0);
    expect(out.totals.totalEarnedMgt).toBe(0);
    expect(out.topReferrers).toEqual([]);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });
});

describe('AdminReferralsService.list', () => {
  it('paginates with nextCursor when more rows exist', async () => {
    const prisma = makePrisma();
    // limit=2 → service requests 3, gets 3 → hasMore
    prisma.referral.findMany.mockResolvedValue([
      {
        referrerId: 'u1',
        referredId: 'r1',
        totalEarnedMGT: new Prisma.Decimal('5'),
        createdAt: new Date('2026-06-01'),
        referrer: { username: 'alice', email: 'a@a.com', referralCode: 'AAA' },
        referred: { username: null, email: 'r1@x.com' },
      },
      {
        referrerId: 'u2',
        referredId: 'r2',
        totalEarnedMGT: new Prisma.Decimal('2'),
        createdAt: new Date('2026-05-01'),
        referrer: { username: 'bob', email: 'b@b.com', referralCode: 'BBB' },
        referred: { username: 'carol', email: 'c@c.com' },
      },
      {
        referrerId: 'u3',
        referredId: 'r3',
        totalEarnedMGT: new Prisma.Decimal('1'),
        createdAt: new Date('2026-04-01'),
        referrer: { username: 'd', email: 'd@d.com', referralCode: 'DDD' },
        referred: { username: 'e', email: 'e@e.com' },
      },
    ]);

    const svc = new AdminReferralsService(prisma);
    const out = await svc.list({ limit: 2 });
    expect(out.items).toHaveLength(2);
    expect(out.nextCursor).toBe('r2');
  });

  it('returns nextCursor=null when no more rows', async () => {
    const prisma = makePrisma();
    prisma.referral.findMany.mockResolvedValue([
      {
        referrerId: 'u1',
        referredId: 'r1',
        totalEarnedMGT: new Prisma.Decimal('5'),
        createdAt: new Date(),
        referrer: { username: 'alice', email: 'a@a.com', referralCode: 'AAA' },
        referred: { username: 'r1', email: 'r1@x.com' },
      },
    ]);
    const svc = new AdminReferralsService(prisma);
    const out = await svc.list({ limit: 50 });
    expect(out.nextCursor).toBeNull();
    expect(out.items[0].referrerLabel).toBe('alice');
  });

  it('applies search OR across referrer/referred fields', async () => {
    const prisma = makePrisma();
    prisma.referral.findMany.mockResolvedValue([]);
    const svc = new AdminReferralsService(prisma);
    await svc.list({ search: 'gustavo' });
    expect(prisma.referral.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: expect.any(Array) }),
      }),
    );
  });
});
