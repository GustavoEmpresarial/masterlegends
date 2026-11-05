import { describe, it, expect, vi } from 'vitest';
import { SocketEvent } from '@mll/shared';

vi.mock('../../../src/modules/stamina/stamina.service.js', () => ({
  StaminaService: vi.fn().mockImplementation(() => ({
    validateLineupForAction: vi.fn().mockResolvedValue(undefined),
    consumeLineup: vi.fn().mockResolvedValue(undefined),
    consumeLineupFarmInTx: vi.fn().mockResolvedValue(undefined),
  })),
}));

const { setupPvpRoom } = await import('../../../src/gateway/rooms/pvp.room.js');

const prismaStub = {} as any;

function createIo(emit: ReturnType<typeof vi.fn>) {
  const socket = {
    id: 'sock-b',
    data: { user: { id: 'user-b' } },
    on: vi.fn(),
    join: vi.fn().mockResolvedValue(undefined),
    emit: vi.fn(),
  };

  const io = {
    on: vi.fn((_ev: string, fn: (s: unknown) => void) => fn(socket)),
    in: vi.fn(() => ({ socketsJoin: vi.fn().mockResolvedValue(undefined) })),
    to: vi.fn(() => ({ emit })),
  };

  return { io, socket };
}

describe('setupPvpRoom', () => {
  it('enqueues first player when queue is empty', async () => {
    const redis = {
      lpop: vi.fn().mockResolvedValue(null),
      rpush: vi.fn().mockResolvedValue(1),
      lrange: vi.fn().mockResolvedValue([]),
      lrem: vi.fn(),
      set: vi.fn().mockResolvedValue('OK'),
      get: vi.fn().mockResolvedValue(null),
      expire: vi.fn().mockResolvedValue(1),
      del: vi.fn().mockResolvedValue(1),
    };
    const emit = vi.fn();
    const { io, socket } = createIo(emit);
    setupPvpRoom(io as any, redis as any, prismaStub);

    const queueHandler = socket.on.mock.calls.find(([e]) => e === SocketEvent.PVP_QUEUE)?.[1];
    await queueHandler?.();

    expect(redis.rpush).toHaveBeenCalledWith(
      'pvp:queue',
      expect.stringContaining('user-b'),
    );
    expect(emit).not.toHaveBeenCalled();
  });

  it('matches two players', async () => {
    const opponent = { userId: 'user-a', socketId: 'sock-a', enqueuedAt: Date.now() };
    const redis = {
      lpop: vi.fn().mockResolvedValue(JSON.stringify(opponent)),
      rpush: vi.fn(),
      lrange: vi.fn().mockResolvedValue([]),
      lrem: vi.fn(),
      set: vi.fn().mockResolvedValue('OK'),
      get: vi.fn().mockResolvedValue(null),
      expire: vi.fn().mockResolvedValue(1),
      del: vi.fn().mockResolvedValue(1),
    };
    const emit = vi.fn();
    const { io, socket } = createIo(emit);
    setupPvpRoom(io as any, redis as any, prismaStub);

    const queueHandler = socket.on.mock.calls.find(([e]) => e === SocketEvent.PVP_QUEUE)?.[1];
    await queueHandler?.();

    expect(emit).toHaveBeenCalledWith(
      SocketEvent.PVP_MATCHED,
      expect.objectContaining({ playerA: 'user-b', playerB: 'user-a' }),
    );
  });
});
