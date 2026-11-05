import { resolveApiUrl } from './api/baseUrl';

/** Resolves relative upload paths (e.g. /uploads/stadiums/x.png) to the API origin in dev. */
export function resolveUploadUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) {
    return url;
  }
  // Never use admin/API item routes as image src (legacy bad imageUrl values).
  if (/\/items\/[0-9a-f-]{36}/i.test(url) && !url.includes('/uploads/')) {
    return '';
  }
  // Static frontend assets stay on the web origin (check-in reward card, stadiums).
  if (url.startsWith('/ui/')) return url;
  const base = resolveApiUrl();
  if (base) return `${base.replace(/\/$/, '')}${url.startsWith('/') ? url : `/${url}`}`;
  return url;
}

export function pointerToPct(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  snapPct?: number,
): { xPct: number; yPct: number } {
  const rawX = ((clientX - rect.left) / rect.width) * 100;
  const rawY = ((clientY - rect.top) / rect.height) * 100;
  const clamp = (v: number) => Math.min(100, Math.max(0, v));
  let xPct = clamp(rawX);
  let yPct = clamp(rawY);
  if (snapPct && snapPct > 0) {
    xPct = clamp(Math.round(xPct / snapPct) * snapPct);
    yPct = clamp(Math.round(yPct / snapPct) * snapPct);
  }
  return { xPct, yPct };
}
