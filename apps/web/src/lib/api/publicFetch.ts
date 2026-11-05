import { resolveApiUrl } from './baseUrl';

export async function fetchPublicJson<T>(path: string): Promise<T> {
  const base = resolveApiUrl();
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load ${path} (${res.status})`);
  }
  return res.json() as Promise<T>;
}
