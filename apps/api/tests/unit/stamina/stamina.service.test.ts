import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StaminaService } from '../../../src/modules/stamina/stamina.service.js';
import { applyStaminaDrift } from '../../../src/common/lib/stamina.js';
import { ErrorCode } from '@mll/shared';

function mockPrisma() {
  return {
    basePlayer: {
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
    },
    playerCache: {
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
    },
    affliction: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn({})),
  };
}

function mockClubRepo() {
  return {
    findByUserId: vi.fn().mockResolvedValue({
      id: 'c1',
      userId: 'u1',
      user: { wallet: null },
    }),
    restoreAllStamina: vi.fn(),
  };
}

function mockStadiumRepo() {
  return {
    findLineupByClubId: vi.fn().mockResolvedValue({
      assignments: {
        s1: { playerId: 'p1', kind: 'base' },
        s2: { playerId: 'p2', kind: 'base' },
      },
    }),
    upsertLineup: vi.fn().mockResolvedValue({}),
  };
}

const VESTIARIO_SLOTS = Array.from({ length: 11 }, (_, i) => ({
  id: `s${i + 1}`,
  label: `SLOT-${i + 1}`,
  xPct: 50,
  yPct: 50,
  role: i === 0 ? 'GK' : 'MID',
  zIndex: i + 1,
}));

function mockVestiarioTemplateRepo() {
  return {
    getDefault: vi.fn().mockResolvedValue({ slots: VESTIARIO_SLOTS }),
  };
}

describe('StaminaService', () => {
  let prisma: ReturnType<typeof mockPrisma>;
  let clubRepo: ReturnType<typeof mockClubRepo>;
  let stadiumRepo: ReturnType<typeof mockStadiumRepo>;
  let vestiarioTemplateRepo: ReturnType<typeof mockVestiarioTemplateRepo>;
  let service: StaminaService;

  beforeEach(() => {
    prisma = mockPrisma();
    clubRepo = mockClubRepo();
    stadiumRepo = mockStadiumRepo();
    vestiarioTemplateRepo = mockVestiarioTemplateRepo();
    service = new StaminaService(
      prisma as never,
      clubRepo as never,
      stadiumRepo as never,
      vestiarioTemplateRepo as never,
    );
  });

  it('clampStamina bounds values 0-100', () => {
    expect(service.clampStamina(150)).toBe(100);
    expect(service.clampStamina(-5)).toBe(0);
    expect(service.clampStamina(42)).toBe(42);
  });

  it('validateLineupForAction rejects incomplete lineup', async () => {
    stadiumRepo.findLineupByClubId.mockResolvedValue({
      assignments: { s1: { playerId: 'p1', kind: 'base' } },
    });
    prisma.basePlayer.findFirst.mockResolvedValue({ stamina: 50 });

    await expect(service.validateLineupForAction('u1', 20)).rejects.toMatchObject({
      code: ErrorCode.LINEUP_INCOMPLETE,
    });
  });

  it('validateLineupForAction rejects low stamina', async () => {
    const assignments: Record<string, { playerId: string; kind: 'base' }> = {};
    for (let i = 0; i < 11; i++) {
      assignments[`s${i}`] = { playerId: `p${i}`, kind: 'base' };
    }
    stadiumRepo.findLineupByClubId.mockResolvedValue({ assignments });
    prisma.basePlayer.findFirst.mockResolvedValue({ stamina: 10 });

    await expect(service.validateLineupForAction('u1', 20)).rejects.toMatchObject({
      code: ErrorCode.INSUFFICIENT_STAMINA,
    });
  });

  it('restoreSquad delegates to club repository', async () => {
    await service.restoreSquad('u1', null, 'c1', new Date());
    expect(clubRepo.restoreAllStamina).toHaveBeenCalledWith('u1', null, 'c1', expect.any(Date), 100);
  });
});

describe('applyStaminaDrift onField rule', () => {
  const past = new Date(Date.now() - 60 * 60_000);
  const now = new Date();

  it('player off field with coach recovers stamina', () => {
    const next = applyStaminaDrift(50, past, now, true, 24, false);
    expect(next).toBeGreaterThan(50);
  });

  it('player on field with coach drains by rarity rate only', () => {
    const next = applyStaminaDrift(50, past, now, true, 24, true, 20);
    expect(next).toBe(30);
  });

  it('no coach on bench: stamina unchanged', () => {
    const a = applyStaminaDrift(50, past, now, false, 24, true, 10);
    const b = applyStaminaDrift(50, past, now, false, 24, false);
    expect(a).toBe(40);
    expect(b).toBe(50);
  });

  it('clamps at 0 on field', () => {
    const old = new Date(Date.now() - 48 * 60 * 60_000);
    expect(applyStaminaDrift(10, old, now, true, 24, true, 20)).toBe(0);
  });
});

describe('StaminaService.syncDrift benches starters that reached 0', () => {
  it('removes from lineup when starter stamina hits 0 and persists trimmed assignments', async () => {
    const prisma = {
      basePlayer: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'p1',
            rarity: 4,
            stamina: 10,
            staminaUpdatedAt: new Date(Date.now() - 6 * 60 * 60_000),
          },
          { id: 'p2', rarity: 0, stamina: 80, staminaUpdatedAt: new Date(Date.now() - 60_000) },
        ]),
        update: vi.fn().mockResolvedValue({}),
      },
      playerCache: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
      affliction: { findFirst: vi.fn().mockResolvedValue(null) },
      platformConfig: { findUnique: vi.fn().mockResolvedValue({ coachStaminaRecoveryPerHour: 24 }) },
      playerStake: { findMany: vi.fn().mockResolvedValue([]) },
      $executeRaw: vi.fn().mockResolvedValue(0),
    };
    const clubRepo = {
      findByUserId: vi.fn().mockResolvedValue({
        id: 'c1',
        userId: 'u1',
        coachHiredAt: new Date(),
        user: { wallet: null },
      }),
    };
    const stadiumRepo = {
      findLineupByClubId: vi.fn().mockResolvedValue({
        stadiumTemplateId: 't1',
        assignments: {
          s1: { playerId: 'p1', kind: 'base' },
          s2: { playerId: 'p2', kind: 'base' },
        },
      }),
      upsertLineup: vi.fn().mockResolvedValue({}),
    };
    const svc = new StaminaService(
      prisma as never,
      clubRepo as never,
      stadiumRepo as never,
      mockVestiarioTemplateRepo() as never,
    );
    await svc.syncDrift('u1');
    expect(stadiumRepo.upsertLineup).toHaveBeenCalledOnce();
    const args = stadiumRepo.upsertLineup.mock.calls[0];
    expect(args[0]).toBe('c1');
    expect(args[1]).toBe('t1');
    expect(args[2]).toEqual({ s2: { playerId: 'p2', kind: 'base' } });
  });

  it('does not touch lineup when no starter zeroed', async () => {
    const prisma = {
      basePlayer: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'p1', rarity: 0, stamina: 80, staminaUpdatedAt: new Date(Date.now() - 60_000) },
        ]),
        update: vi.fn().mockResolvedValue({}),
      },
      playerCache: { findMany: vi.fn().mockResolvedValue([]) },
      affliction: { findFirst: vi.fn().mockResolvedValue(null) },
      platformConfig: { findUnique: vi.fn().mockResolvedValue({ coachStaminaRecoveryPerHour: 24 }) },
      playerStake: { findMany: vi.fn().mockResolvedValue([]) },
      $executeRaw: vi.fn().mockResolvedValue(0),
    };
    const clubRepo = {
      findByUserId: vi.fn().mockResolvedValue({
        id: 'c1',
        userId: 'u1',
        coachHiredAt: new Date(),
        user: { wallet: null },
      }),
    };
    const stadiumRepo = {
      findLineupByClubId: vi.fn().mockResolvedValue({
        stadiumTemplateId: 't1',
        assignments: { s1: { playerId: 'p1', kind: 'base' } },
      }),
      upsertLineup: vi.fn(),
    };
    const svc = new StaminaService(
      prisma as never,
      clubRepo as never,
      stadiumRepo as never,
      mockVestiarioTemplateRepo() as never,
    );
    await svc.syncDrift('u1');
    expect(stadiumRepo.upsertLineup).not.toHaveBeenCalled();
  });

  it('auto-fills an empty slot with the strongest recovered off-field player', async () => {
    const prisma = {
      basePlayer: {
        findMany: vi.fn().mockResolvedValue([
          // p1 stays on field, full stamina, nothing to bench.
          { id: 'p1', rarity: 0, position: 'GK', overwall: 60, stamina: 100, staminaUpdatedAt: new Date(), retiredAt: null, listed: false },
          // Off-field, staked, full stamina, MID — fills the empty MID slot s2.
          { id: 'p2', rarity: 0, position: 'MID', overwall: 70, stamina: 100, staminaUpdatedAt: new Date(), retiredAt: null, listed: false },
          // Off-field but not recovered enough (< MIN_STAMINA_AUTO_FIELD) — must stay benched.
          { id: 'p3', rarity: 0, position: 'MID', overwall: 90, stamina: 40, staminaUpdatedAt: new Date(), retiredAt: null, listed: false },
          // Full stamina but the wrong position for the empty MID slots.
          { id: 'p4', rarity: 0, position: 'FW', overwall: 99, stamina: 100, staminaUpdatedAt: new Date(), retiredAt: null, listed: false },
        ]),
        update: vi.fn().mockResolvedValue({}),
      },
      playerCache: { findMany: vi.fn().mockResolvedValue([]) },
      affliction: { findFirst: vi.fn().mockResolvedValue(null) },
      platformConfig: { findUnique: vi.fn().mockResolvedValue({ coachStaminaRecoveryPerHour: 24 }) },
      playerStake: {
        findMany: vi.fn().mockResolvedValue([
          { kind: 'base', playerId: 'p2' },
          { kind: 'base', playerId: 'p4' },
        ]),
      },
      $executeRaw: vi.fn().mockResolvedValue(0),
    };
    const clubRepo = {
      findByUserId: vi.fn().mockResolvedValue({
        id: 'c1',
        userId: 'u1',
        coachHiredAt: new Date(),
        user: { wallet: null },
      }),
    };
    const stadiumRepo = {
      findLineupByClubId: vi.fn().mockResolvedValue({
        stadiumTemplateId: 't1',
        assignments: { s1: { playerId: 'p1', kind: 'base' } },
      }),
      upsertLineup: vi.fn().mockResolvedValue({}),
    };
    const svc = new StaminaService(
      prisma as never,
      clubRepo as never,
      stadiumRepo as never,
      mockVestiarioTemplateRepo() as never,
    );
    await svc.syncDrift('u1');
    expect(stadiumRepo.upsertLineup).toHaveBeenCalledOnce();
    const nextAssignments = stadiumRepo.upsertLineup.mock.calls[0][2];
    expect(nextAssignments.s1).toEqual({ playerId: 'p1', kind: 'base' });
    expect(nextAssignments.s2).toEqual({ playerId: 'p2', kind: 'base' });
    expect(Object.values(nextAssignments)).not.toContainEqual({ playerId: 'p3', kind: 'base' });
    expect(Object.values(nextAssignments)).not.toContainEqual({ playerId: 'p4', kind: 'base' });
  });

  it('does not touch the lineup when there are no empty slots to fill', async () => {
    const fullAssignments: Record<string, { playerId: string; kind: 'base' }> = {};
    for (let i = 1; i <= 11; i++) fullAssignments[`s${i}`] = { playerId: `p${i}`, kind: 'base' };

    const prisma = {
      basePlayer: {
        findMany: vi.fn().mockResolvedValue([
          ...Array.from({ length: 11 }, (_, i) => ({
            id: `p${i + 1}`,
            rarity: 0,
            overwall: 60,
            stamina: 90,
            staminaUpdatedAt: new Date(),
            retiredAt: null,
            listed: false,
          })),
          {
            id: 'bench1',
            rarity: 0,
            overwall: 99,
            stamina: 100,
            staminaUpdatedAt: new Date(),
            retiredAt: null,
            listed: false,
          },
        ]),
        update: vi.fn().mockResolvedValue({}),
      },
      playerCache: { findMany: vi.fn().mockResolvedValue([]) },
      affliction: { findFirst: vi.fn().mockResolvedValue(null) },
      platformConfig: { findUnique: vi.fn().mockResolvedValue({ coachStaminaRecoveryPerHour: 24 }) },
      $executeRaw: vi.fn().mockResolvedValue(0),
    };
    const clubRepo = {
      findByUserId: vi.fn().mockResolvedValue({
        id: 'c1',
        userId: 'u1',
        coachHiredAt: null,
        user: { wallet: null },
      }),
    };
    const stadiumRepo = {
      findLineupByClubId: vi.fn().mockResolvedValue({
        stadiumTemplateId: 't1',
        assignments: fullAssignments,
      }),
      upsertLineup: vi.fn(),
    };
    const svc = new StaminaService(
      prisma as never,
      clubRepo as never,
      stadiumRepo as never,
      mockVestiarioTemplateRepo() as never,
    );
    await svc.syncDrift('u1');
    // 11/11 slots already full — the strong bench1 candidate has nowhere to go, no swap logic here.
    expect(stadiumRepo.upsertLineup).not.toHaveBeenCalled();
  });
});
