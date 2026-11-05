import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MinigamesService } from '../../../src/modules/minigames/minigames.service.js';
import { ErrorCode } from '@mll/shared';

function mockPrisma() {
  return {
    minigamePlay: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
    },
    $executeRaw: vi.fn().mockResolvedValue(0),
    basePlayer: { findFirst: vi.fn().mockResolvedValue(null) },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        minigamePlay: {
          create: vi.fn(),
        },
      }),
    ),
  };
}

function mockRedis() {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    del: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    _store: store,
  };
}

function mockClubRepo() {
  return {
    findByUserId: vi.fn().mockResolvedValue({
      id: 'c1',
      userId: 'u1',
      user: { wallet: null },
    }),
  };
}

function mockStaminaService() {
  return {
    applyDeltaInTx: vi.fn().mockResolvedValue({ staminaBefore: 40, staminaAfter: 55 }),
    applyDelta: vi.fn().mockResolvedValue({ staminaBefore: 40, staminaAfter: 32 }),
    readStamina: vi.fn().mockResolvedValue(32),
  };
}

describe('MinigamesService', () => {
  let prisma: ReturnType<typeof mockPrisma>;
  let redis: ReturnType<typeof mockRedis>;
  let txCreate: ReturnType<typeof vi.fn>;
  let service: MinigamesService;

  beforeEach(() => {
    prisma = mockPrisma();
    redis = mockRedis();
    txCreate = vi.fn();
    prisma.$transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        minigamePlay: { create: txCreate },
      }),
    );
    service = new MinigamesService(
      prisma as never,
      mockClubRepo() as never,
      mockStaminaService() as never,
      redis as never,
    );
  });

  it('getCatalog returns recovery games', async () => {
    const catalog = await service.getCatalog('u1');
    expect(catalog.games).toHaveLength(1);
    expect(catalog.games[0].staminaReward).toBe(0);
    expect(catalog.games[0].staminaCost).toBe(8);
  });

  it('play rejects unknown minigame', async () => {
    await expect(
      service.play('u1', 'unknown_game', {
        kind: 'base',
        playerId: 'p1',
        sessionId: '00000000-0000-4000-8000-000000000001',
      }),
    ).rejects.toMatchObject({ code: ErrorCode.MINIGAME_NOT_FOUND });
  });

  it('play rejects when already played today', async () => {
    prisma.minigamePlay.findFirst.mockResolvedValue({ id: 'play1' });
    const sessionId = '00000000-0000-4000-8000-000000000001';
    redis._store.set(
      `mll:minigame:penalty:${sessionId}`,
      JSON.stringify({
        userId: 'u1',
        playerId: 'p1',
        kind: 'base',
        attemptsLeft: 0,
        goals: 1,
        finished: true,
        claimed: true,
      }),
    );
    await expect(
      service.play('u1', 'recovery_penalty', {
        kind: 'base',
        playerId: 'p1',
        sessionId,
      }),
    ).rejects.toMatchObject({ code: ErrorCode.MINIGAME_ALREADY_PLAYED });
  });

  it('play rejects without a winning finished session', async () => {
    const { sessionId } = await service.startPenalty('u1', { kind: 'base', playerId: 'p1' });
    await expect(
      service.play('u1', 'recovery_penalty', {
        kind: 'base',
        playerId: 'p1',
        sessionId,
      }),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
  });

  it('play records the session without restoring stamina', async () => {
    const { sessionId } = await service.startPenalty('u1', { kind: 'base', playerId: 'p1' });
    const key = `mll:minigame:penalty:${sessionId}`;
    redis._store.set(
      key,
      JSON.stringify({
        userId: 'u1',
        playerId: 'p1',
        kind: 'base',
        attemptsLeft: 0,
        goals: 1,
        finished: true,
        claimed: false,
      }),
    );

    const result = await service.play('u1', 'recovery_penalty', {
      kind: 'base',
      playerId: 'p1',
      sessionId,
    });

    expect(result.staminaAfter).toBe(32);
    expect(result.staminaBefore).toBe(32);
    expect(prisma.minigamePlay.create).toHaveBeenCalled();
    expect(redis.del).toHaveBeenCalledWith(key);
  });

  it('shootPenalty resolves shots server-side', async () => {
    const { sessionId } = await service.startPenalty('u1', { kind: 'base', playerId: 'p1' });
    const shot = await service.shootPenalty('u1', { sessionId, nx: 0.5, ny: 0.15 });
    expect(typeof shot.scored).toBe('boolean');
    expect(shot.attemptsLeft).toBe(2);
  });
});
