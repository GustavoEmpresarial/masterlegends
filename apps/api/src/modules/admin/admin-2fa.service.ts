import crypto from 'node:crypto';
import type Redis from 'ioredis';
import { AppError, ErrorCode } from '../../common/lib/errors.js';
import { config } from '../../config/env.js';
import type { AdminConfigUser } from './admin.config.js';

const KEY_CHALLENGE = (id: string) => `admin:2fa:${id}`;
const MAX_ATTEMPTS = 5;

interface ChallengePayload {
  adminId: string;
  codeHash: string;
  attempts: number;
}

export class Admin2faService {
  constructor(private readonly redis: Redis) {}

  private hashCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  private generateCode(): string {
    const max = 10 ** config.ADMIN_2FA_CODE_LENGTH;
    const num = crypto.randomInt(0, max);
    return num.toString().padStart(config.ADMIN_2FA_CODE_LENGTH, '0');
  }

  async createChallenge(admin: AdminConfigUser): Promise<{ challengeId: string; code: string; expiresIn: number }> {
    const challengeId = crypto.randomUUID();
    const code = this.generateCode();
    const payload: ChallengePayload = {
      adminId: admin.id,
      codeHash: this.hashCode(code),
      attempts: 0,
    };

    await this.redis.set(
      KEY_CHALLENGE(challengeId),
      JSON.stringify(payload),
      'EX',
      config.ADMIN_2FA_TTL_SECONDS,
    );

    return { challengeId, code, expiresIn: config.ADMIN_2FA_TTL_SECONDS };
  }

  async verify(challengeId: string, code: string): Promise<{ adminId: string }> {
    const raw = await this.redis.get(KEY_CHALLENGE(challengeId));
    if (!raw) {
      throw new AppError(ErrorCode.ADMIN_2FA_EXPIRED, 401);
    }

    const payload = JSON.parse(raw) as ChallengePayload;
    if (payload.codeHash !== this.hashCode(code)) {
      payload.attempts += 1;
      if (payload.attempts >= MAX_ATTEMPTS) {
        await this.redis.del(KEY_CHALLENGE(challengeId));
        throw new AppError(ErrorCode.ADMIN_2FA_INVALID, 401, { reason: 'max_attempts' });
      }
      const ttl = await this.redis.ttl(KEY_CHALLENGE(challengeId));
      if (ttl > 0) {
        await this.redis.set(KEY_CHALLENGE(challengeId), JSON.stringify(payload), 'EX', ttl);
      }
      throw new AppError(ErrorCode.ADMIN_2FA_INVALID, 401);
    }

    await this.redis.del(KEY_CHALLENGE(challengeId));
    return { adminId: payload.adminId };
  }
}
