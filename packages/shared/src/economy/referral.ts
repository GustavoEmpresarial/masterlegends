import { isBelowMinimum, splitFeeRate } from './money.js';

export type ReferralRejectReason = 'self' | 'duplicate_ip' | 'loop' | 'banned' | 'below_minimum';

export interface ReferralParty {
  id: string;
  email?: string | null;
  wallet?: string | null;
  bannedAt?: Date | string | null;
}

export function referralSelfReason(referrer: ReferralParty, referred: ReferralParty): 'self' | null {
  if (referrer.id === referred.id) return 'self';
  const referrerEmail = referrer.email?.trim().toLowerCase();
  const referredEmail = referred.email?.trim().toLowerCase();
  if (referrerEmail && referredEmail && referrerEmail === referredEmail) return 'self';
  const referrerWallet = referrer.wallet?.trim().toLowerCase();
  const referredWallet = referred.wallet?.trim().toLowerCase();
  if (referrerWallet && referredWallet && referrerWallet === referredWallet) return 'self';
  return null;
}

export function referralLoopReason(ancestorIds: readonly string[], referredId: string): 'loop' | null {
  return ancestorIds.includes(referredId) ? 'loop' : null;
}

export function sharesRegistrationIp(referrerIps: readonly string[], signupIp: string | null | undefined): boolean {
  const ip = signupIp?.trim();
  if (!ip) return false;
  return referrerIps.some((row) => row === ip);
}

export function partyIsBanned(party: ReferralParty): boolean {
  return party.bannedAt != null && party.bannedAt !== '';
}

/** 5% do depósito USDC, pago em USDT sacável, cortado para baixo. */
export function depositCommission(gross: number | string, rate: number | string): {
  gross: string;
  commission: string;
  belowMinimum: boolean;
} {
  const split = splitFeeRate('usdt', gross, rate);
  return {
    gross: split.gross,
    commission: split.fee,
    belowMinimum: isBelowMinimum('usdt', split.fee),
  };
}

/** Sobe a cadeia do indicador. Para se repetir alguém ou passar do limite. */
export async function collectReferrerAncestors(
  startReferrerId: string,
  loadParent: (userId: string) => Promise<string | null>,
  max = 32,
): Promise<string[]> {
  const ids: string[] = [];
  const seen = new Set<string>();
  let current: string | null = startReferrerId;
  while (current && ids.length < max) {
    if (seen.has(current)) break;
    seen.add(current);
    const parent = await loadParent(current);
    if (!parent) break;
    ids.push(parent);
    current = parent;
  }
  return ids;
}
