/**
 * Dev talks to the Vite proxy (same origin). A baked http://localhost:3001
 * is cross-origin and the API only allows the docker web origin, so the
 * browser reports a network error on login.
 * Production uses the nginx proxy and also ignores a localhost URL.
 */
export function resolveApiUrl(): string {
  const env = import.meta.env.VITE_API_URL?.trim();
  if (env && !env.includes('localhost') && !env.includes('127.0.0.1')) {
    return env;
  }
  return '';
}

export function resolveAdminApiUrl(): string {
  const base = resolveApiUrl();
  if (base) return `${base.replace(/\/$/, '')}/admin/api`;
  return '/admin/api';
}
