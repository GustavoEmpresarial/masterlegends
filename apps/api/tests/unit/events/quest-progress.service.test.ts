import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QuestTrigger, QuestPeriod } from '@mll/shared';
import { QuestProgressService } from '../../../src/modules/events/quest-progress.service.js';

function makePrisma() {
  return {
    eventTriggerCooldown: {
      create: vi.fn(),
    },
    questDefinition: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    $executeRaw: vi.fn().mockResolvedValue(1),
  } as any;
}

describe('QuestProgressService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-18T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('market_visit skips progress when cooldown already exists', async () => {
    const prisma = makePrisma();
    prisma.eventTriggerCooldown.create.mockRejectedValue(new Error('unique'));
    const service = new QuestProgressService(prisma);

    await service.incrementTrigger('u1', QuestTrigger.MARKET_VISIT, 1);

    expect(prisma.questDefinition.findMany).not.toHaveBeenCalled();
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('market_visit advances once when cooldown create succeeds', async () => {
    const prisma = makePrisma();
    prisma.eventTriggerCooldown.create.mockResolvedValue({ id: 'cd-1' });
    prisma.questDefinition.findMany.mockResolvedValue([
      {
        id: 'q1',
        active: true,
        trigger: QuestTrigger.MARKET_VISIT,
        target: 1,
        period: QuestPeriod.NONE,
        startsAt: new Date('2020-01-01'),
        endsAt: new Date('2030-01-01'),
        campaignId: null,
        campaign: null,
      },
    ]);
    const service = new QuestProgressService(prisma);

    await service.incrementTrigger('u1', QuestTrigger.MARKET_VISIT, 1);

    expect(prisma.eventTriggerCooldown.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'u1',
          trigger: QuestTrigger.MARKET_VISIT,
          dayKey: '2026-07-18',
        }),
      }),
    );
    expect(prisma.$executeRaw).toHaveBeenCalled();
  });

  it('login trigger uses atomic SQL increment without cooldown', async () => {
    const prisma = makePrisma();
    prisma.questDefinition.findMany.mockResolvedValue([
      {
        id: 'q2',
        active: true,
        trigger: QuestTrigger.LOGIN,
        target: 3,
        period: QuestPeriod.DAILY,
        startsAt: null,
        endsAt: null,
        campaignId: null,
        campaign: null,
      },
    ]);
    const service = new QuestProgressService(prisma);

    await service.incrementTrigger('u1', QuestTrigger.LOGIN, 2);

    expect(prisma.eventTriggerCooldown.create).not.toHaveBeenCalled();
    expect(prisma.$executeRaw).toHaveBeenCalled();
  });

  it('ignores non-positive amount', async () => {
    const prisma = makePrisma();
    const service = new QuestProgressService(prisma);
    await service.incrementTrigger('u1', QuestTrigger.LOGIN, 0);
    expect(prisma.questDefinition.findMany).not.toHaveBeenCalled();
  });
});
