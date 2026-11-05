import { splitFeeRate } from './money.js';

/** Gross USDT requested → fee ROUND_DOWN, net = gross − fee. */
export function calcWithdrawAmounts(grossUsdc: number, feePct: number): { fee: number; net: number } {
  const split = splitFeeRate('usdt', grossUsdc, feePct);
  return { fee: Number(split.fee), net: Number(split.net) };
}
