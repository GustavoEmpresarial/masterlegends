import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SocketEvent } from '@mll/shared';

type Handler = (payload: unknown) => void;

const socketHandlers = new Map<string, Set<Handler>>();
const fakeSocket = {
  on(event: string, handler: Handler) {
    if (!socketHandlers.has(event)) socketHandlers.set(event, new Set());
    socketHandlers.get(event)!.add(handler);
  },
  off(event: string, handler: Handler) {
    socketHandlers.get(event)?.delete(handler);
  },
  emit(event: string, payload: unknown) {
    socketHandlers.get(event)?.forEach((h) => h(payload));
  },
};

vi.mock('../../src/hooks/useSocket', () => ({ useSocket: () => fakeSocket }));
vi.mock('../../src/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));

import { useCtRealtime } from '../../src/hooks/useCtRealtime';

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useCtRealtime', () => {
  beforeEach(() => {
    socketHandlers.clear();
  });

  it('invalidates ct/vestiario/club/stadium-view on CT_VIEW_INVALIDATE', () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    renderHook(() => useCtRealtime(), { wrapper: wrapper(client) });

    fakeSocket.emit(SocketEvent.CT_VIEW_INVALIDATE, { reason: 'daily-rest' });

    const keys = invalidate.mock.calls.map((c) => (c[0] as { queryKey: unknown[] }).queryKey);
    expect(keys).toEqual(
      expect.arrayContaining([
        ['ct', 'user-1'],
        ['vestiario', 'user-1'],
        ['club', 'user-1'],
        ['stadium-view', 'user-1'],
      ]),
    );
  });

  it('invalidates only ct/vestiario on CT_STAMINA_UPDATE', () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    renderHook(() => useCtRealtime(), { wrapper: wrapper(client) });

    fakeSocket.emit(SocketEvent.CT_STAMINA_UPDATE, { playerId: 'p1' });

    const keys = invalidate.mock.calls.map((c) => (c[0] as { queryKey: unknown[] }).queryKey);
    expect(keys).toEqual(
      expect.arrayContaining([
        ['ct', 'user-1'],
        ['vestiario', 'user-1'],
      ]),
    );
    expect(keys).not.toEqual(expect.arrayContaining([['club', 'user-1']]));
  });

  it('unsubscribes on unmount', () => {
    const client = new QueryClient();
    const { unmount } = renderHook(() => useCtRealtime(), { wrapper: wrapper(client) });
    expect(socketHandlers.get(SocketEvent.CT_VIEW_INVALIDATE)?.size).toBe(1);
    unmount();
    expect(socketHandlers.get(SocketEvent.CT_VIEW_INVALIDATE)?.size ?? 0).toBe(0);
  });
});
