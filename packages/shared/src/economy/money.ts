export type MoneyAsset = 'gmt' | 'usdc' | 'usdt';

/** Casas usadas na operação. O saldo continua em Decimal(36, 18). */
export const MONEY_SCALE: Record<MoneyAsset, number> = {
  gmt: 8,
  usdc: 6,
  usdt: 6,
};

/** Menor lançamento que vira linha. Abaixo disto é poeira. */
export const MONEY_MIN: Record<MoneyAsset, string> = {
  gmt: '0.00000001',
  usdc: '0.000001',
  usdt: '0.000001',
};

function expandDecimal(raw: string): string {
  const match = /^([+-]?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(raw.trim());
  if (!match) return '0';
  const sign = match[1] === '-' ? '-' : '';
  let digits = `${match[2] ?? '0'}${match[3] ?? ''}`;
  let point = (match[2] ?? '0').length;
  if (match[4]) point += Number(match[4]);
  if (point <= 0) {
    digits = `${'0'.repeat(-point)}${digits}`;
    point = 0;
  } else if (point > digits.length) {
    digits = `${digits}${'0'.repeat(point - digits.length)}`;
  }
  const intPart = digits.slice(0, point).replace(/^0+(?=\d)/, '') || '0';
  const frac = digits.slice(point);
  return frac ? `${sign}${intPart}.${frac}` : `${sign}${intPart}`;
}

function toUnits(value: number | string, scale: number): bigint {
  if (typeof value === 'number' && !Number.isFinite(value)) return 0n;
  const expanded = expandDecimal(typeof value === 'number' ? value.toString() : value);
  const neg = expanded.startsWith('-');
  const body = neg ? expanded.slice(1) : expanded;
  const [intPart = '0', frac = ''] = body.split('.');
  const fracCut = frac.slice(0, scale).padEnd(scale, '0');
  const units = BigInt(intPart || '0') * 10n ** BigInt(scale) + BigInt(fracCut || '0');
  return neg ? -units : units;
}

function fromUnits(units: bigint, scale: number): string {
  const neg = units < 0n;
  const abs = neg ? -units : units;
  const base = 10n ** BigInt(scale);
  const intPart = abs / base;
  const frac = (abs % base).toString().padStart(scale, '0');
  const body = scale === 0 ? intPart.toString() : `${intPart}.${frac}`;
  return neg ? `-${body}` : body;
}

/** Corta o excedente (ROUND_DOWN). Não arredonda para cima. */
export function quantizeMoney(asset: MoneyAsset, value: number | string): string {
  return fromUnits(toUnits(value, MONEY_SCALE[asset]), MONEY_SCALE[asset]);
}

export function isBelowMinimum(asset: MoneyAsset, quantized: string): boolean {
  return toUnits(quantized, MONEY_SCALE[asset]) < toUnits(MONEY_MIN[asset], MONEY_SCALE[asset]);
}

/** Taxa ROUND_DOWN. Líquido = bruto quantizado − taxa, então os dois fecham. */
export function splitFeeRate(
  asset: MoneyAsset,
  gross: number | string,
  rate: number | string,
): { gross: string; fee: string; net: string } {
  const scale = MONEY_SCALE[asset];
  const grossUnits = toUnits(quantizeMoney(asset, gross), scale);
  const rateUnits = toUnits(typeof rate === 'number' ? rate.toString() : rate, 12);
  const feeUnits = (grossUnits * rateUnits) / 10n ** 12n;
  return {
    gross: fromUnits(grossUnits, scale),
    fee: fromUnits(feeUnits, scale),
    net: fromUnits(grossUnits - feeUnits, scale),
  };
}

/** Taxa em basis points (1000 = 10%). ROUND_DOWN. Líquido = bruto − taxa. */
export function splitFeeBps(
  asset: MoneyAsset,
  gross: number | string,
  bps: number,
): { gross: string; fee: string; net: string } {
  const scale = MONEY_SCALE[asset];
  const grossUnits = toUnits(quantizeMoney(asset, gross), scale);
  const feeUnits = (grossUnits * BigInt(Math.trunc(bps))) / 10_000n;
  return {
    gross: fromUnits(grossUnits, scale),
    fee: fromUnits(feeUnits, scale),
    net: fromUnits(grossUnits - feeUnits, scale),
  };
}

/**
 * Parte o prêmio em cotas ROUND_DOWN. Cota abaixo do mínimo não entra.
 * O que sobra, inclusive essa poeira, é o residual.
 */
export function splitPool(
  asset: MoneyAsset,
  reward: number | string,
  weights: Array<{ key: string; weight: number | string }>,
): { shares: Array<{ key: string; amount: string }>; residual: string } {
  const scale = MONEY_SCALE[asset];
  const pot = toUnits(quantizeMoney(asset, reward), scale);
  const totalWeight = weights.reduce((acc, row) => acc + toUnits(row.weight, 0), 0n);
  if (pot <= 0n || totalWeight <= 0n) {
    return { shares: [], residual: fromUnits(pot > 0n ? pot : 0n, scale) };
  }
  const min = toUnits(MONEY_MIN[asset], scale);
  let distributed = 0n;
  const shares: Array<{ key: string; amount: string }> = [];
  for (const row of weights) {
    const weight = toUnits(row.weight, 0);
    if (weight <= 0n) continue;
    const amount = (pot * weight) / totalWeight;
    if (amount < min) continue;
    distributed += amount;
    shares.push({ key: row.key, amount: fromUnits(amount, scale) });
  }
  return { shares, residual: fromUnits(pot - distributed, scale) };
}
