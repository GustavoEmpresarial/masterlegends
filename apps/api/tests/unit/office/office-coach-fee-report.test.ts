import { describe, it, expect, vi } from 'vitest';
import { MgtTxType } from '@mll/shared';
import { OfficeService } from '../../../src/modules/office/office.service.js';

describe('OfficeService.getCoachFeeReport', () => {
  it('aggregates coach_fee txs as absolute fees', async () => {
    const prisma = {
      mGTTransaction: {
        aggregate: vi.fn().mockResolvedValue({
          _sum: { amount: -0.05 },
          _count: { _all: 2 },
          _max: { createdAt: new Date('2026-07-20T12:00:00.000Z') },
        }),
        findMany: vi.fn().mockResolvedValue([
          {
            id: 't1',
            amount: -0.03,
            createdAt: new Date('2026-07-20T12:00:00.000Z'),
            meta: { blockNumber: 42, gross: 1.5, feePct: 0.02 },
          },
          {
            id: 't2',
            amount: -0.02,
            createdAt: new Date('2026-07-19T12:00:00.000Z'),
            meta: { blockNumber: '41', gross: 1, feePct: 0.02 },
          },
        ]),
      },
    };

    const service = new OfficeService(prisma as any);
    const report = await service.getCoachFeeReport('user-1');

    expect(prisma.mGTTransaction.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', type: MgtTxType.COACH_FEE },
      }),
    );
    expect(report.totalFees).toBeCloseTo(0.05, 8);
    expect(report.txCount).toBe(2);
    expect(report.lastAt).toBe('2026-07-20T12:00:00.000Z');
    expect(report.recent[0]).toMatchObject({
      id: 't1',
      amount: 0.03,
      blockNumber: 42,
      gross: 1.5,
      feePct: 0.02,
    });
    expect(report.recent[1].blockNumber).toBe(41);
  });
});
