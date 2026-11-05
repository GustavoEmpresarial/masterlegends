import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../src/hooks/useAuth';

const apiGet = vi.fn();
const apiPost = vi.fn();

const clientMocks = vi.hoisted(() => ({
  primeCsrf: vi.fn().mockResolvedValue(undefined),
  refreshAccessToken: vi.fn(),
}));

vi.mock('../../src/lib/api/client', () => ({
  apiClient: {
    get: (...args: unknown[]) => apiGet(...args),
    post: (...args: unknown[]) => apiPost(...args),
  },
  LOGOUT_EVENT: 'mll:logout',
  primeCsrf: clientMocks.primeCsrf,
  refreshAccessToken: clientMocks.refreshAccessToken,
}));

const storage = vi.hoisted(() => ({
  getAccessToken: vi.fn(() => null as string | null),
  setAccessToken: vi.fn(),
  clearAccessToken: vi.fn(),
}));

vi.mock('../../src/lib/auth/storage', () => storage);

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.getAccessToken.mockReturnValue(null);
    // Default: refresh fails (no active session)
    clientMocks.refreshAccessToken.mockRejectedValue(new Error('no session'));
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: '' },
    });
  });

  it('starts as guest when no token and refresh fails', async () => {
    // refreshAccessToken is already mocked to reject in beforeEach
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('restores session via refresh when memory token is empty', async () => {
    clientMocks.refreshAccessToken.mockResolvedValueOnce('refreshed');
    apiGet.mockResolvedValueOnce({
      data: { id: 'u1', email: 'a@b.com', username: 'alice', hasClub: false },
    });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(storage.setAccessToken).toHaveBeenCalledWith('refreshed');
  });

  it('loads user when token present', async () => {
    storage.getAccessToken.mockReturnValue('tok');
    apiGet.mockResolvedValueOnce({
      data: { id: 'u1', email: 'a@b.com', username: 'alice', hasClub: false },
    });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(result.current.user?.username).toBe('alice');
    expect(apiPost).not.toHaveBeenCalled();
  });

  it('login stores token and user', async () => {
    apiPost.mockResolvedValueOnce({
      data: {
        accessToken: 'at',
        user: { id: 'u1', email: 'a@b.com', username: 'alice', hasClub: false },
      },
    });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.login('a@b.com', 'pass');
    });
    expect(result.current.isAuthenticated).toBe(true);
    expect(storage.setAccessToken).toHaveBeenCalledWith('at');
  });

  it('register does not start a session (email verification required)', async () => {
    apiPost.mockResolvedValue({ data: { ok: true } });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.register('a@b.com', 'user', 'pass');
    });
    expect(result.current.isAuthenticated).toBe(false);
    expect(storage.clearAccessToken).toHaveBeenCalled();
  });

  it('logout clears session', async () => {
    apiPost.mockResolvedValueOnce({});
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.logout();
    });
    expect(storage.clearAccessToken).toHaveBeenCalled();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('maps login errors', async () => {
    apiPost.mockRejectedValueOnce({
      response: { data: { error: { code: 'AUTH_INVALID_CREDENTIALS' } } },
    });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await expect(
      act(async () => {
        await result.current.login('a@b.com', 'bad');
      }),
    ).rejects.toThrow('AUTH_INVALID_CREDENTIALS');
  });

  it('throws outside provider', () => {
    expect(() => renderHook(() => useAuth())).toThrow('useAuth must be used within AuthProvider');
  });
});
