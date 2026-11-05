import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadLineupPowerByUser } from '../../../src/lib/lineup-power.js';

function makePrisma(opts: {
  lineups?: Array<{ assignments: unknown; club: { userId: string; user: { wallet: string | null } | null } }>;
  basePlayers?: Array<{ id: string; userId: string; overwall: number }>;
  checkInGrants?: Array<{ userId: string; amount: number; expiresAt: Date }>;
  eventOverwallGrants?: Array<{ userId: string; amount: number; expiresAt: Date }>;
  gearEquips?: Array<{
    userId: string;
    playerId: string;
    playerKind: string;
    owBonus: number;
  }>;
}) {
  const now = new Date();
  const grants = opts.checkInGrants ?? [];
  const eventGrants = opts.eventOverwallGrants ?? [];
  return {
    clubLineup: {
      findMany: vi.fn().mockResolvedValue(opts.lineups ?? []),
    },
    vestiarioTemplate: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    basePlayer: {
      findMany: vi.fn().mockResolvedValue(opts.basePlayers ?? []),
    },
    playerCache: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    checkInGrant: {
      findMany: vi.fn().mockImplementation(({ where }: { where?: { expiresAt?: { gt: Date } } }) => {
        const cutoff = where?.expiresAt?.gt ?? now;
        return Promise.resolve(
          grants.filter((g) => g.expiresAt > cutoff).map((g) => ({
            userId: g.userId,
            amount: g.amount,
            expiresAt: g.expiresAt,
          })),
        );
      }),
    },
    eventOverwallGrant: {
      findMany: vi.fn().mockImplementation(({ where }: { where?: { expiresAt?: { gt: Date } } }) => {
        const cutoff = where?.expiresAt?.gt ?? now;
        return Promise.resolve(
          eventGrants.filter((g) => g.expiresAt > cutoff).map((g) => ({
            userId: g.userId,
            amount: g.amount,
            expiresAt: g.expiresAt,
          })),
        );
      }),
    },
    playerGearEquip: {
      findMany: vi.fn().mockResolvedValue(
        (opts.gearEquips ?? []).map((g) => ({
          userId: g.userId,
          playerId: g.playerId,
          playerKind: g.playerKind,
          userGear: { catalogItem: { owBonus: g.owBonus } },
        })),
      ),
    },
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('loadLineupPowerByUser', () => {
  it('sums stadium lineup overwall and active presença bonus for mining', async () => {
    const prisma = makePrisma({
      lineups: [
        {
          assignments: { s1: { kind: 'base', playerId: 'p1' } },
          club: { userId: 'u1', user: { wallet: null } },
        },
      ],
      basePlayers: [{ id: 'p1', userId: 'u1', overwall: 350 }],
      checkInGrants: [
        {
          userId: 'u1',
          amount: 100,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      ],
    });

    const power = await loadLineupPowerByUser(prisma);
    expect(power.get('u1')).toBe(450);
  });

  it('adds equipped gear as a percent of that player overwall', async () => {
    const prisma = makePrisma({
      lineups: [
        {
          assignments: { s1: { kind: 'base', playerId: 'p1' } },
          club: { userId: 'u1', user: { wallet: null } },
        },
      ],
      basePlayers: [{ id: 'p1', userId: 'u1', overwall: 350 }],
      gearEquips: [
        { userId: 'u1', playerId: 'p1', playerKind: 'base', owBonus: 30 },
        // Bench gear must not count
        { userId: 'u1', playerId: 'bench', playerKind: 'base', owBonus: 999 },
      ],
    });

    const power = await loadLineupPowerByUser(prisma);
    expect(power.get('u1')).toBe(455);
  });

  it('includes presença-only users without stadium lineup', async () => {
    const prisma = makePrisma({
      lineups: [],
      checkInGrants: [
        {
          userId: 'u2',
          amount: 100,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      ],
    });

    const power = await loadLineupPowerByUser(prisma);
    expect(power.get('u2')).toBe(100);
  });

  it('sums quest EventOverwallGrant into mining power', async () => {
    const prisma = makePrisma({
      lineups: [
        {
          assignments: { s1: { kind: 'base', playerId: 'p1' } },
          club: { userId: 'u1', user: { wallet: null } },
        },
      ],
      basePlayers: [{ id: 'p1', userId: 'u1', overwall: 350 }],
      checkInGrants: [
        {
          userId: 'u1',
          amount: 200,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      ],
      eventOverwallGrants: [
        {
          userId: 'u1',
          amount: 500,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      ],
    });

    const power = await loadLineupPowerByUser(prisma);
    expect(power.get('u1')).toBe(1050);
  });
});
