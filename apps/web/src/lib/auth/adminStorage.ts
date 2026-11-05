const ADMIN_TOKEN_KEY = 'mll_admin_token';

let memoryToken: string | null = null;

export function getAdminAccessToken(): string | null {
  if (memoryToken) return memoryToken;
  if (typeof window === 'undefined') return null;
  memoryToken = window.sessionStorage.getItem(ADMIN_TOKEN_KEY);
  return memoryToken;
}

export function setAdminAccessToken(token: string): void {
  memoryToken = token;
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearAdminAccessToken(): void {
  memoryToken = null;
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  window.localStorage.removeItem(ADMIN_TOKEN_KEY);
}
