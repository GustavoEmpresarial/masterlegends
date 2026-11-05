import { describe, expect, it, vi } from 'vitest';
import { attributeMiningRoiAndRetire } from '../src/lib/player-roi.js';

function makeTx(state: {
  players: Array<{
    id: string;
    overwall: number;
    costBasisUsdc: number;
    lifetimeEarnedUsdc: number;
  }>;
  assignments: Record<string, { kind: 'base' | 'nft'; playerId: string }>;
}) {
  const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
  let lineupAssignments = { ...state.assignments };

  const tx: any = {
    club: {
      findUnique: vi.fn().mockResolvedValue({ id: 'club-1' }),
    },
    clubLineup: {
      findUnique: vi.fn().mockResolvedValue({ assignments: state.assignments }),
      update: vi.fn(async ({ data }: any) => {
        lineupAssignments = data.assignments;
        return { ok: true };
      }),
    },
    basePlayer: {
      findMany: vi.fn().mockResolvedValue(
        state.players.map((p) => ({
          id: p.id,
          overwall: p.overwall,
          costBasisUsdc: p.costBasisUsdc,
          lifetimeEarnedUsdc: p.lifetimeEarnedUsdc,
        })),
      ),
      update: vi.fn(async ({ where, data }: any) => {
        updates.push({ id: where.id, data });
        return { id: where.id, ...data };
      }),
    },
  };

  return { tx, updates, getLineup: () => lineupAssignments };
}

describe('attributeMiningRoiAndRetire', () => {
  it('credits share by overwall and retires at 200% ROI', async () => {
    const { tx, updates, getLineup } = makeTx({
      players: [
        { id: 'p1', overwall: 100, costBasisUsdc: 2, lifetimeEarnedUsdc: 3.5 },
      ],
      assignments: {
        s1: { kind: 'base', playerId: 'p1' },
      },
    });

    // net 0.6 with full power 100 → delta 0.6 → earned 4.1 >= 4 → retire
    await attributeMiningRoiAndRetire(tx, 'user-1', 0.6, 100);

    expect(updates).toHaveLength(1);
    expect(updates[0]!.data.lifetimeEarnedUsdc).toBeCloseTo(4.1, 5);
    expect(updates[0]!.data.retiredAt).toBeInstanceOf(Date);
    expect(getLineup()).toEqual({});
  });

  it('does not retire before threshold', async () => {
    const { tx, updates, getLineup } = makeTx({
      players: [
        { id: 'p1', overwall: 50, costBasisUsdc: 2, lifetimeEarnedUsdc: 0 },
      ],
      assignments: {
        s1: { kind: 'base', playerId: 'p1' },
      },
    });

    await attributeMiningRoiAndRetire(tx, 'user-1', 1, 100);

    expect(updates[0]!.data.lifetimeEarnedUsdc).toBeCloseTo(0.5, 5);
    expect(updates[0]!.data.retiredAt).toBeUndefined();
    expect(getLineup()).toEqual({ s1: { kind: 'base', playerId: 'p1' } });
  });
});
