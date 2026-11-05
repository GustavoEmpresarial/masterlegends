import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MissionProgressService,
  currentDailyPeriod,
  currentWeeklyPeriod,
  dailyExpiresAt,
  weeklyExpiresAt,
} from '../../../src/modules/pass/mission-progress.service.js';

vi.mock('../../../src/modules/pass/pass-season.service.js', () => ({
  findConfiguredPassSeason: vi.fn(),
  findConfiguredPassSeasons: vi.fn(),
  passLevelFromConfiguredXp: vi.fn(),
}));

const { findConfiguredPassSeason, findConfiguredPassSeasons } = await import(
  '../../../src/modules/pass/pass-season.service.js'
);

function mkSeason(missions: Array<Partial<import('@mll/shared').PassMissionConfigDTO>>) {
  return {
    id: 1,
    name: 'S1',
    startsAt: new Date(),
    endsAt: new Date(Date.now() + 86400_000),
    premiumPriceUsdc: 100,
    levels: [{ level: 1, xpRequired: 0, rewardType: 'usdc' as const, rewardLabel: '' }],
    missions: missions.map((m, i) => ({
      id: m.id ?? `m${i}`,
      label: m.label ?? 'lbl',
      xp: m.xp ?? 10,
      target: m.target ?? 1,
      category: m.category ?? ('daily' as const),
      difficulty: m.difficulty ?? ('easy' as const),
      eventType: m.eventType ?? ('login' as const),
    })),
    rewardBlocks: [],
  };
}

function mkPrisma() {
  return {
    missionProgress: {
      upsert: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
  } as any;
}

describe('period helpers', () => {
  it('daily period uses YYYY-MM-DD UTC', () => {
    const d = new Date(Date.UTC(2026, 5, 18, 14, 30));
    expect(currentDailyPeriod(d)).toBe('daily:2026-06-18');
  });

  it('daily expires at next UTC midnight', () => {
    const d = new Date(Date.UTC(2026, 5, 18, 14, 30));
    expect(dailyExpiresAt(d).toISOString()).toBe('2026-06-19T00:00:00.000Z');
  });

  it('weekly period uses ISO week', () => {
    // 2026-06-18 is a Thursday → ISO week 25
    const d = new Date(Date.UTC(2026, 5, 18, 14, 30));
    expect(currentWeeklyPeriod(d)).toMatch(/^weekly:2026-W\d{2}$/);
  });

  it('weekly expires at the next ISO Monday', () => {
    const d = new Date(Date.UTC(2026, 5, 18, 14, 30)); // Thursday
    const exp = weeklyExpiresAt(d);
    expect(exp.getUTCDay()).toBe(1); // Monday
    expect(exp.getTime()).toBeGreaterThan(d.getTime());
  });
});

describe('MissionProgressService.incrementEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findConfiguredPassSeasons).mockImplementation(async () => {
      const season = await vi.mocked(findConfiguredPassSeason)();
      return season ? [season] : [];
    });
  });

  it('no-op when no active season', async () => {
    vi.mocked(findConfiguredPassSeason).mockResolvedValue(null);
    const prisma = mkPrisma();
    const svc = new MissionProgressService(prisma);
    await svc.incrementEvent('u1', 'login', 1);
    expect(prisma.missionProgress.upsert).not.toHaveBeenCalled();
  });

  it('advances matching missions and triggers callback on completion', async () => {
    vi.mocked(findConfiguredPassSeason).mockResolvedValue(
      mkSeason([{ id: 'd_login', target: 1, eventType: 'login', xp: 10 }]) as never,
    );
    const prisma = mkPrisma();
    prisma.missionProgress.upsert.mockResolvedValue({
      id: 'mp1',
      count: 1,
      claimedAt: null,
    });
    prisma.missionProgress.update.mockResolvedValue({});
    const onComplete = vi.fn().mockResolvedValue(undefined);
    const svc = new MissionProgressService(prisma, onComplete);

    await svc.incrementEvent('u1', 'login', 1);

    expect(prisma.missionProgress.upsert).toHaveBeenCalledOnce();
    expect(prisma.missionProgress.update).toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledOnce();
    const [uid, mission] = onComplete.mock.calls[0];
    expect(uid).toBe('u1');
    expect(mission.id).toBe('d_login');
  });

  it('does not re-fire callback when already claimed', async () => {
    vi.mocked(findConfiguredPassSeason).mockResolvedValue(
      mkSeason([{ id: 'd_login', target: 1, eventType: 'login', xp: 10 }]) as never,
    );
    const prisma = mkPrisma();
    prisma.missionProgress.upsert.mockResolvedValue({
      id: 'mp1',
      count: 1,
      claimedAt: new Date(),
    });
    const onComplete = vi.fn();
    const svc = new MissionProgressService(prisma, onComplete);

    await svc.incrementEvent('u1', 'login', 1);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('ignores missions of unrelated eventType', async () => {
    vi.mocked(findConfiguredPassSeason).mockResolvedValue(
      mkSeason([
        { id: 'd_login', eventType: 'login' },
        { id: 'd_train', eventType: 'training' },
      ]) as never,
    );
    const prisma = mkPrisma();
    prisma.missionProgress.upsert.mockResolvedValue({ id: 'mp', count: 1, claimedAt: null });
    const svc = new MissionProgressService(prisma);

    await svc.incrementEvent('u1', 'login', 1);
    expect(prisma.missionProgress.upsert).toHaveBeenCalledOnce();
    const where = prisma.missionProgress.upsert.mock.calls[0][0].where.userId_seasonId_missionId_period;
    expect(where.missionId).toBe('d_login');
  });

  it('weekly mission uses weekly period key', async () => {
    vi.mocked(findConfiguredPassSeason).mockResolvedValue(
      mkSeason([{ id: 'w_play10', target: 10, eventType: 'pvp_match_played', category: 'weekly' }]) as never,
    );
    const prisma = mkPrisma();
    prisma.missionProgress.upsert.mockResolvedValue({ id: 'x', count: 1, claimedAt: null });
    const svc = new MissionProgressService(prisma);
    await svc.incrementEvent('u1', 'pvp_match_played', 1);
    const where = prisma.missionProgress.upsert.mock.calls[0][0].where.userId_seasonId_missionId_period;
    expect(where.period).toMatch(/^weekly:/);
  });

  it('swallows errors so callsite is never broken', async () => {
    vi.mocked(findConfiguredPassSeason).mockRejectedValue(new Error('db down'));
    const prisma = mkPrisma();
    const svc = new MissionProgressService(prisma);
    await expect(svc.incrementEvent('u1', 'login', 1)).resolves.toBeUndefined();
  });
});
