import { randomInt } from 'node:crypto';

/** Cryptographically secure float in [0, 1). */
export function secureRandom(): number {
  const max = 0x1_0000_0000;
  return randomInt(0, max) / max;
}
