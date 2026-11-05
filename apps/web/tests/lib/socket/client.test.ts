import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSocket = {
  connected: false,
  connect: vi.fn(),
  disconnect: vi.fn(),
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}));

vi.mock('../../../src/lib/auth/storage', () => ({
  getAccessToken: vi.fn(() => 'tok'),
}));

import { getSocket, connectSocket, disconnectSocket, refreshSocketAuth } from '../../../src/lib/socket/client';

describe('socket client', () => {
  beforeEach(() => {
    mockSocket.connected = false;
    vi.clearAllMocks();
  });

  it('creates singleton socket', () => {
    const a = getSocket();
    const b = getSocket();
    expect(a).toBe(b);
  });

  it('connects when not connected', () => {
    connectSocket();
    expect(mockSocket.connect).toHaveBeenCalled();
  });

  it('disconnects active socket', () => {
    mockSocket.connected = true;
    disconnectSocket();
    expect(mockSocket.disconnect).toHaveBeenCalled();
  });

  it('refreshes auth by reconnecting', () => {
    mockSocket.connected = true;
    refreshSocketAuth();
    expect(mockSocket.disconnect).toHaveBeenCalled();
    expect(mockSocket.connect).toHaveBeenCalled();
  });
});
