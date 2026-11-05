import { Prisma } from '@prisma/client';
import { config } from '../../config/env.js';

const LEDGER_SCALE = new Prisma.Decimal('100000000');

export class SatspayError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'SatspayError';
  }
}

/** 1.00 USDT -> "100000000" (SatsPay ledger, 8 casas, sem float). */
export function usdtToSatspayUnits(amount: string | number): string {
  const units = new Prisma.Decimal(amount).mul(LEDGER_SCALE).toDecimalPlaces(0, Prisma.Decimal.ROUND_DOWN);
  if (!units.isFinite() || units.lte(0)) {
    throw new SatspayError('INVALID_AMOUNT', 'Valor líquido inválido para a SatsPay', 400);
  }
  return units.toFixed(0);
}

export function satspayUnitsToUsdt(units: string): string {
  return new Prisma.Decimal(units).div(LEDGER_SCALE).toFixed(8);
}

function baseUrl(): string {
  return config.SATSPAY_API_BASE.replace(/\/$/, '');
}

function apiKey(): string {
  const key = config.SATSPAY_API_KEY.trim();
  if (!key) {
    throw new SatspayError('NOT_CONFIGURED', 'SATSPAY_API_KEY não configurada', 503);
  }
  return key;
}

async function satspayFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set('x-api-key', apiKey());
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  try {
    return await fetch(`${baseUrl()}${path}`, {
      ...init,
      headers,
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'network';
    throw new SatspayError('NETWORK', message, 502);
  }
}

async function readBody(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return { error: text.slice(0, 300) };
  }
}

function fail(res: Response, body: Record<string, unknown>): SatspayError {
  const code = typeof body.code === 'string' && body.code ? body.code : `HTTP_${res.status}`;
  const message = typeof body.error === 'string' && body.error
    ? body.error
    : typeof body.message === 'string' && body.message
      ? body.message
      : code;
  return new SatspayError(code, message, res.status);
}

/** Saldo USDT da tesouraria, em unidades humanas. Null se a chave não está configurada. */
export async function getSatspayUsdtBalance(): Promise<{ configured: boolean; usdt: string | null }> {
  if (!config.SATSPAY_API_KEY.trim()) return { configured: false, usdt: null };
  const res = await satspayFetch('/v1/public/balance');
  const body = await readBody(res);
  if (!res.ok) throw fail(res, body);
  const raw = body.USDT;
  if (typeof raw !== 'string' && typeof raw !== 'number') return { configured: true, usdt: null };
  return { configured: true, usdt: satspayUnitsToUsdt(String(raw)) };
}

export async function findSatspaySend(
  idempotencyKey: string,
): Promise<{ referenceId: string } | null> {
  const query = new URLSearchParams({ idempotencyKey });
  const res = await satspayFetch(`/v1/public/sends?${query.toString()}`);
  const body = await readBody(res);
  if (!res.ok) throw fail(res, body);
  const items = Array.isArray(body.items) ? body.items : [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const row = item as { status?: unknown; id?: unknown; referenceId?: unknown };
    if (row.status !== 'COMPLETED') continue;
    const referenceId = typeof row.referenceId === 'string' && row.referenceId
      ? row.referenceId
      : typeof row.id === 'string' && row.id
        ? row.id
        : null;
    if (referenceId) return { referenceId };
  }
  return null;
}

export async function sendSatspayUsdt(input: {
  toEmail: string;
  amountUnits: string;
  idempotencyKey: string;
}): Promise<string> {
  const res = await satspayFetch('/v1/public/send', {
    method: 'POST',
    body: JSON.stringify({
      coin: 'USDT',
      toEmail: input.toEmail,
      amount: input.amountUnits,
      idempotencyKey: input.idempotencyKey,
    }),
  });
  const body = await readBody(res);
  if (typeof body.referenceId === 'string' && body.referenceId && (res.ok || res.status === 409)) {
    return body.referenceId;
  }
  if (!res.ok) {
    const existing = await findSatspaySend(input.idempotencyKey).catch(() => null);
    if (existing) return existing.referenceId;
    throw fail(res, body);
  }
  throw new SatspayError('SEND_FAILED', 'SatsPay não devolveu referenceId', res.status);
}
