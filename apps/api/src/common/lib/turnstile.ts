import { config } from '../../config/env.js';
import { logger } from './logger.js';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

interface SiteverifyResponse {
  success: boolean;
  'error-codes'?: string[];
}

function isPrivateOrLocalIp(ip: string): boolean {
  const v = ip.trim().toLowerCase();
  if (!v || v === '127.0.0.1' || v === '::1' || v === 'localhost') return true;
  if (v.startsWith('10.') || v.startsWith('192.168.') || v.startsWith('169.254.')) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(v)) return true;
  if (v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80:')) return true;
  return false;
}

export function isTurnstileEnabled(): boolean {
  return Boolean(config.TURNSTILE_SECRET_KEY);
}

export async function verifyTurnstileToken(
  token: string | undefined,
  remoteIp?: string,
): Promise<boolean> {
  if (!isTurnstileEnabled()) return true;
  if (!token) return false;

  try {
    const body = new URLSearchParams({
      secret: config.TURNSTILE_SECRET_KEY!,
      response: token,
    });
    // Só manda remoteip se for IP público. Atrás de nginx/docker o request.ip
    // vira 172.x e o Cloudflare rejeita o token (timeout-or-duplicate / invalid).
    if (remoteIp && !isPrivateOrLocalIp(remoteIp)) {
      body.set('remoteip', remoteIp);
    }

    const res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, 'Turnstile siteverify HTTP error');
      return false;
    }

    const data = (await res.json()) as SiteverifyResponse;
    if (!data.success) {
      logger.warn({ errors: data['error-codes'] }, 'Turnstile verification failed');
    }
    return data.success;
  } catch (err) {
    logger.error({ err }, 'Turnstile siteverify request failed');
    return false;
  }
}
