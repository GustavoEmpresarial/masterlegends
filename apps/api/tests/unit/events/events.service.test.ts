import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QuestKind, QuestPeriod } from '@mll/shared';
import { EventsService } from '../../../src/modules/events/events.service.js';

const campaignId = 'camp-1';
const questId = 'quest-1';

function makePrisma(overrides: {
  campaigns?: unknown[];
  quests?: unknown[];
  progress?: unknown[];
  claims?: unknown[];
  badges?: unknown[];
  userBadges?: unknown[];
} = {}) {
  return {
    eventCampaign: {
      findMany: vi.fn().mockResolvedValue(overrides.campaigns ?? []),
    },
    questDefinition: {
      findMany: vi.fn().mockResolvedValue(overrides.quests ?? []),
    },
    questProgress: {
      findMany: vi.fn().mockResolvedValue(overrides.progress ?? []),
    },
    questClaim: {
      findMany: vi.fn().mockResolvedValue(overrides.claims ?? []),
    },
    eventBadge: {
      findMany: vi.fn().mockResolvedValue(overrides.badges ?? []),
    },
    userBadge: {
      findMany: vi.fn().mockResolvedValue(overrides.userBadges ?? []),
    },
  } as any;
}

describe('EventsService.getPlayerBoard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-18T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('filters out quests outside window and inactive campaigns', async () => {
    const prisma = makePrisma({
      campaigns: [
        {
          id: campaignId,
          slug: 'live',
          title: 'Live',
          body: 'b',
          imageUrl: null,
          active: true,
          startsAt: new Date('2026-07-01'),
          endsAt: new Date('2026-08-01'),
          sortOrder: 0,
        },
      ],
      quests: [
        {
          id: questId,
          kind: QuestKind.EVENT_TASK,
          campaignId,
          title: 'Live quest',
          description: 'd',
          trigger: 'login',
          target: 1,
          period: QuestPeriod.NONE,
          rewards: [{ type: 'gmt', amount: 5 }],
          maxClaimsPerUser: 1,
          startsAt: new Date('2026-07-01'),
          endsAt: new Date('2026-08-01'),
          sortOrder: 0,
        },
        {
          id: 'quest-expired',
          kind: QuestKind.EVENT_TASK,
          campaignId: null,
          title: 'Expired',
          description: 'd',
          trigger: 'login',
          target: 1,
          period: QuestPeriod.NONE,
          rewards: [{ type: 'gmt', amount: 1 }],
          maxClaimsPerUser: 1,
          startsAt: new Date('2020-01-01'),
          endsAt: new Date('2020-02-01'),
          sortOrder: 1,
        },
      ],
    });

    const board = await new EventsService(prisma).getPlayerBoard('u1');
    expect(board.campaigns).toHaveLength(1);
    expect(board.campaigns[0].quests).toHaveLength(1);
    expect(board.eventTasks).toHaveLength(0);
  });

  it('marks canClaim when progress ready and not claimed', async () => {
    const prisma = makePrisma({
      quests: [
        {
          id: questId,
          kind: QuestKind.DAILY_TASK,
          campaignId: null,
          title: 'Daily',
          description: 'd',
          trigger: 'login',
          target: 2,
          period: QuestPeriod.DAILY,
          rewards: [{ type: 'gmt', amount: 3 }],
          maxClaimsPerUser: 1,
          startsAt: null,
          endsAt: null,
          sortOrder: 0,
        },
      ],
      progress: [{ questId, periodKey: '2026-07-18', count: 2 }],
      claims: [],
    });

    const board = await new EventsService(prisma).getPlayerBoard('u1');
    expect(board.tasks).toHaveLength(1);
    expect(board.tasks[0].canClaim).toBe(true);
    expect(board.tasks[0].completed).toBe(true);
    expect(board.tasks[0].claimed).toBe(false);
  });

  it('exposes badge unlock state', async () => {
    const prisma = makePrisma({
      badges: [{ id: 'b1', code: 'first', title: 'First', iconUrl: null }],
      userBadges: [{ badgeId: 'b1', unlockedAt: new Date('2026-07-10T00:00:00.000Z') }],
    });

    const board = await new EventsService(prisma).getPlayerBoard('u1');
    expect(board.badges[0].unlocked).toBe(true);
    expect(board.badges[0].unlockedAt).toBe('2026-07-10T00:00:00.000Z');
  });
});
