const USDC_LOCALE_OPTS = { useGrouping: true } as const;

/** USDC display — up to 8 decimal places, dot separator (e.g. 0.00001234). */
export function formatUsdcAmount(value: number, maxDecimals = 8): string {
  const abs = Math.abs(value);
  if (!Number.isFinite(abs)) return '0';
  return abs.toLocaleString('en-US', {
    ...USDC_LOCALE_OPTS,
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  });
}

/** Fixed-decimal USDC (e.g. 0.00000007) — for micro rewards like sponsorship blocks. */
export function formatUsdcAmountFixed(value: number, decimals = 8): string {
  const abs = Math.abs(value);
  if (!Number.isFinite(abs)) {
    return (0).toLocaleString('en-US', {
      ...USDC_LOCALE_OPTS,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }
  return abs.toLocaleString('en-US', {
    ...USDC_LOCALE_OPTS,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** GMT de operação: 8 casas. */
export function formatGmtAmount(value: number): string {
  return formatUsdcAmountFixed(value, 8);
}

/** USDC e USDT: 6 casas, a escala do token. */
export function formatStableAmount(value: number): string {
  return formatUsdcAmountFixed(value, 6);
}

export function formatWalletUsdcAmount(type: string, amount: number, currency?: string): string {
  const code = (currency ?? (type === 'mining_claim' || type === 'usdt_withdraw' || type === 'coach_fee' ? 'usdt' : 'gmt')).toLowerCase();
  if (code === 'usdc' || code === 'usdt') {
    const abs = Math.abs(amount);
    if (Number.isFinite(abs) && abs > 0 && abs < 0.0001) return formatUsdcAmountFixed(amount, 8);
    return formatStableAmount(amount);
  }
  return formatGmtAmount(amount);
}
