const TOKEN_KEY = 'mll.accessToken';

let memoryToken: string | null = null;

export function getAccessToken(): string | null {
  return memoryToken;
}

export function setAccessToken(token: string): void {
  memoryToken = token;
}

export function clearAccessToken(): void {
  memoryToken = null;
  if (typeof window === 'undefined') return;
  // Purge legacy persisted tokens from older builds.
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem('accessToken');
  window.localStorage.removeItem('access_token');
}
