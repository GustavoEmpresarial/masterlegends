import { describe, it, expect, vi } from 'vitest';
import { SocketEvent } from '@mll/shared';
import { setupPresence } from '../../../src/gateway/presence.js';

describe('setupPresence', () => {
  it('marks user online on connection', async () => {
    const emit = vi.fn();
    const handlers: Record<string, (...args: unknown[]) => unknown> = {};
    const socket = {
      id: 's1',
      data: { user: { id: 'u1' } },
      join: vi.fn().mockResolvedValue(undefined),
      on: (event: string, fn: (...args: unknown[]) => unknown) => {
        handlers[event] = fn;
      },
    };
    const redis = {
      multi: vi.fn(() => ({
        sadd: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      })),
      set: vi.fn().mockResolvedValue('OK'),
    };
    const io = {
      on: vi.fn((_ev: string, fn: (s: unknown) => void) => fn(socket)),
      to: vi.fn(() => ({ emit })),
      in: vi.fn(() => ({ fetchSockets: vi.fn().mockResolvedValue([]) })),
    };

    setupPresence(io as any, redis as any);
    await new Promise((r) => setTimeout(r, 0));

    expect(socket.join).toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith(SocketEvent.PRESENCE_UPDATE, { userId: 'u1', online: true });

    await handlers[SocketEvent.PRESENCE_HEARTBEAT]?.();
    expect(redis.set).toHaveBeenCalledWith('online:user:u1', '1', 'EX', 60);
  });
});
