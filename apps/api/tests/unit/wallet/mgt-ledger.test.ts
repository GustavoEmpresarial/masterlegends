import { describe, expect, it, vi } from 'vitest';
import { MgtTxType } from '@mll/shared';
import { lockGmt, releaseGmt, settleLockedGmt } from '../../../src/modules/wallet/mgt-ledger.js';

function txWith(row: { amount: string; lockedAmount: string }) {
  const updated = {
    amount: row.amount,
    lockedAmount: row.lockedAmount,
    usdtAmount: 0,
    usdtLockedAmount: 0,
  };
  return {
    mGTBalance: {
      upsert: vi.fn(),
      update: vi.fn().mockImplementation(async ({ data }: { data: Record<string, { increment?: { toString(): string }; decrement?: { toString(): string } } | undefined> }) => {
        let amount = Number(row.amount);
        let locked = Number(row.lockedAmount);
        const amountOp = data.amount;
        const lockedOp = data.lockedAmount;
        if (amountOp && typeof amountOp === 'object') {
          if (amountOp.decrement) amount -= Number(amountOp.decrement.toString());
          if (amountOp.increment) amount += Number(amountOp.increment.toString());
        }
        if (lockedOp && typeof lockedOp === 'object') {
          if (lockedOp.decrement) locked -= Number(lockedOp.decrement.toString());
          if (lockedOp.increment) locked += Number(lockedOp.increment.toString());
        }
        updated.amount = amount;
        updated.lockedAmount = locked;
        return { amount, lockedAmount: locked, usdtAmount: 0, usdtLockedAmount: 0 };
      }),
    },
    mGTTransaction: { create: vi.fn().mockResolvedValue({ id: 'tx-1' }) },
    $queryRaw: vi.fn().mockResolvedValue([{
      amount: row.amount,
      lockedAmount: row.lockedAmount,
      usdcAmount: '0',
      usdtAmount: '0',
      usdtLockedAmount: '0',
    }]),
  };
}

describe('GMT lock', () => {
  it('moves available GMT into the locked bucket and records the hold', async () => {
    const tx = txWith({ amount: '50', lockedAmount: '0' });
    const result = await lockGmt(tx as never, 'u1', 10, MgtTxType.SCOUT, { destination: 'scout' });
    expect(result).toEqual({ balanceAfter: 40, lockedAfter: 10 });
    expect(tx.mGTTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        amount: expect.anything(),
        meta: expect.objectContaining({ movement: 'lock', destination: 'scout', currency: 'gmt' }),
      }),
    }));
  });

  it('returns locked GMT on release and spends it on settle', async () => {
    const tx = txWith({ amount: '40', lockedAmount: '10' });
    await releaseGmt(tx as never, 'u1', 10, MgtTxType.SCOUT);
    expect(tx.mGTTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        meta: expect.objectContaining({ movement: 'release', origin: 'scout' }),
      }),
    }));

    const settled = txWith({ amount: '40', lockedAmount: '10' });
    const result = await settleLockedGmt(settled as never, 'u1', 10, MgtTxType.SCOUT);
    expect(result.balanceAfter).toBe(40);
    expect(result.lockedAfter).toBe(0);
    expect(settled.mGTTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        meta: expect.objectContaining({ movement: 'settle', destination: 'scout' }),
      }),
    }));
  });
});
