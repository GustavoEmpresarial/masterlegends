import crypto from 'node:crypto';

export function hashToken(plaintext: string): string {
  return crypto.createHash('sha256').update(plaintext).digest('hex');
}

export function generatePlainToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}
