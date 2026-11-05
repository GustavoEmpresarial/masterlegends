import { describe, it, expect, beforeEach } from 'vitest';
import { getAccessToken, setAccessToken, clearAccessToken } from '../../../src/lib/auth/storage';

describe('auth storage', () => {
  beforeEach(() => {
    clearAccessToken();
    localStorage.clear();
  });

  it('stores and reads token in memory only', () => {
    setAccessToken('tok');
    expect(getAccessToken()).toBe('tok');
    expect(localStorage.getItem('mll.accessToken')).toBeNull();
  });

  it('clears memory token and legacy localStorage keys', () => {
    setAccessToken('tok');
    localStorage.setItem('mll.accessToken', 'legacy');
    localStorage.setItem('accessToken', 'legacy2');
    clearAccessToken();
    expect(getAccessToken()).toBeNull();
    expect(localStorage.getItem('mll.accessToken')).toBeNull();
    expect(localStorage.getItem('accessToken')).toBeNull();
  });
});
