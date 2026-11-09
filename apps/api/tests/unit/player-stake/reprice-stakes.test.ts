import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { repriceActivePlayerStakes } from '../../../src/modules/player-stake/player-stake.service.js';

vi.mock('../../../src/modules/wallet/mgt-ledger.js', () => ({
  lockGmt: vi.fn(),
  releaseGmt: vi.fn(),
  settleLockedGmt: vi.fn(),
}));

import { lockGmt, releaseGmt } from '../../../src/modules/wallet/mgt-ledger.js';

function prismaFor(opts: {
  stakes: Array<{ id: string; userId: string; kind: string; playerId: string; amount: string }>;
  bases?: Array<{ id: string; rarity: number }>;
  available?: string;
  locked?: string;
}) {
  const updateMany = vi.fn().mockResolvedValue({ count: 1 });
  const tx = {
    playerStake: { updateMany },
    mGTBalance: {
      findUnique: vi.fn().mockResolvedValue({
        amount: new Prisma.Decimal(opts.available ?? '1000'),
        lockedAmount: new Prisma.Decimal(opts.locked ?? '1000'),
      }),
    },
  };
  return {
    tx,
    updateMany,
    prisma: {
      playerStake: {
        findMany: vi.fn().mockResolvedValue(
          opts.stakes.map((row) => ({ ...row, amount: new Prisma.Decimal(row.amount) })),
        ),
      },
      basePlayer: {
        findMany: vi.fn().mockResolvedValue(opts.bases ?? []),
      },
      playerCache: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('repriceActivePlayerStakes', () => {
  it('locks the missing GMT when an active stake is below the current table', async () => {
    const { prisma, updateMany } = prismaFor({
      stakes: [{ id: 's1', userId: 'u1', kind: 'base', playerId: 'p1', amount: '50' }],
      bases: [{ id: 'p1', rarity: 4 }],
    });

    const result = await repriceActivePlayerStakes(prisma as never);

    expect(result).toEqual({ updated: 1, shortUsers: 0 });
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { amount: new Prisma.Decimal('78.125') } }),
    );
    expect(lockGmt).toHaveBeenCalledWith(
      expect.anything(),
      'u1',
      '28.12500000',
      'player_stake',
      { repair: 'stake-reprice' },
    );
    expect(releaseGmt).not.toHaveBeenCalled();
  });

  it('returns GMT when an active stake is above the current table', async () => {
    const { prisma } = prismaFor({
      stakes: [{ id: 's1', userId: 'u1', kind: 'base', playerId: 'p1', amount: '62.5' }],
      bases: [{ id: 'p1', rarity: 3 }],
      locked: '62.5',
    });

    const result = await repriceActivePlayerStakes(prisma as never);

    expect(result.updated).toBe(1);
    expect(releaseGmt).toHaveBeenCalledWith(
      expect.anything(),
      'u1',
      '46.87500000',
      'player_unstake',
      { repair: 'stake-reprice' },
    );
    expect(lockGmt).not.toHaveBeenCalled();
  });

  it('leaves a stake that already matches the table', async () => {
    const { prisma, updateMany } = prismaFor({
      stakes: [{ id: 's1', userId: 'u1', kind: 'base', playerId: 'p1', amount: '0.125' }],
      bases: [{ id: 'p1', rarity: 0 }],
    });

    const result = await repriceActivePlayerStakes(prisma as never);

    expect(result).toEqual({ updated: 0, shortUsers: 0 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('still writes the new amount when the available balance cannot cover the increase', async () => {
    const { prisma, updateMany } = prismaFor({
      stakes: [{ id: 's1', userId: 'u1', kind: 'base', playerId: 'p1', amount: '50' }],
      bases: [{ id: 'p1', rarity: 4 }],
      available: '10',
    });

    const result = await repriceActivePlayerStakes(prisma as never);

    expect(result).toEqual({ updated: 1, shortUsers: 1 });
    expect(updateMany).toHaveBeenCalled();
    expect(lockGmt).toHaveBeenCalledWith(
      expect.anything(),
      'u1',
      '10.00000000',
      'player_stake',
      { repair: 'stake-reprice' },
    );
  });
});
