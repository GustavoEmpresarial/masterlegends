import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { settleDepositReferral } from '../../../src/lib/referral-commission.js';

function makeTx(opts: {
  existing?: boolean;
  link?: boolean;
  banned?: boolean;
  rate?: number;
}) {
  const create = vi.fn().mockResolvedValue({});
  const creditUpdate = vi.fn().mockResolvedValue({ usdcAmount: new Prisma.Decimal(1) });
  const tx = {
    referralCommission: {
      findUnique: vi.fn().mockResolvedValue(opts.existing ? { id: 'already' } : null),
      create,
    },
    referral: {
      findUnique: vi.fn().mockImplementation(async ({ where }: { where: { referredId: string } }) => {
        if (!opts.link) return null;
        if (where.referredId === 'referred') return { referrerId: 'referrer' };
        return null;
      }),
    },
    user: {
      findUnique: vi.fn().mockImplementation(async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        email: `${where.id}@x.com`,
        wallet: `0x${where.id}`,
        bannedAt: opts.banned && where.id === 'referrer' ? new Date() : null,
      })),
    },
    platformConfig: {
      findUnique: vi.fn().mockResolvedValue({ referralBonusPct: new Prisma.Decimal(opts.rate ?? 0.05) }),
    },
    mGTBalance: {
      upsert: vi.fn().mockResolvedValue({}),
      update: creditUpdate,
    },
    mGTTransaction: { create: vi.fn().mockResolvedValue({}) },
  };
  return { tx: tx as any, create, creditUpdate };
}

describe('settleDepositReferral', () => {
  it('credits 0.500000 withdrawable USDT on a 10 USDC deposit', async () => {
    const { tx, create, creditUpdate } = makeTx({ link: true });
    await settleDepositReferral(tx, { referredId: 'referred', gross: 10, txHash: '0xabc' });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'credited',
        purchaseRef: '0xabc',
        commissionAmount: new Prisma.Decimal('0.500000'),
        rate: new Prisma.Decimal(0.05),
        currency: 'usdt',
      }),
    }));
    expect(creditUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: { usdtAmount: { increment: expect.anything() } },
    }));
  });

  it('does not pay the same hash twice', async () => {
    const { tx, create, creditUpdate } = makeTx({ link: true, existing: true });
    await settleDepositReferral(tx, { referredId: 'referred', gross: 10, txHash: '0xabc' });
    expect(create).not.toHaveBeenCalled();
    expect(creditUpdate).not.toHaveBeenCalled();
  });

  it('records a banned referrer as rejected and does not credit', async () => {
    const { tx, create, creditUpdate } = makeTx({ link: true, banned: true });
    await settleDepositReferral(tx, { referredId: 'referred', gross: 10, txHash: '0xban' });
    expect(create.mock.calls[0][0].data.status).toBe('rejected');
    expect(creditUpdate).not.toHaveBeenCalled();
  });

  it('records dust as rejected', async () => {
    const { tx, create, creditUpdate } = makeTx({ link: true });
    await settleDepositReferral(tx, { referredId: 'referred', gross: '0.000010', txHash: '0xdust' });
    expect(create.mock.calls[0][0].data.status).toBe('rejected');
    expect(String(create.mock.calls[0][0].data.commissionAmount)).toBe('0');
    expect(creditUpdate).not.toHaveBeenCalled();
  });
});
