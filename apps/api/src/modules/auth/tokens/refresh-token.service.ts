import crypto from 'node:crypto';
import type Redis from 'ioredis';
import type { FastifyInstance } from 'fastify';
import { AppError, ErrorCode } from '../../../common/lib/errors.js';
import { config } from '../../../config/env.js';

// Janela de graça pra reuso do refresh token: duas abas/dispositivos do mesmo usuário podem
// ter o access token expirando quase junto (TTL curto de 15min) e disparar /auth/refresh em
// paralelo. A primeira rotaciona e "queima" o jti; a segunda chega com o token já usado
// alguns segundos depois — isso NÃO é roubo, é corrida legítima. Só tratamos como reuso
// malicioso (revoga a família toda) se vier depois dessa janela.
const REUSE_GRACE_MS = 15_000;

const KEY_JTI = (jti: string) => `rt:jti:${jti}`;
const KEY_FAMILY = (familyId: string) => `rt:family:${familyId}`;
const KEY_FAMILY_REVOKED = (familyId: string) => `rt:revoked-family:${familyId}`;
const KEY_USER_FAMILIES = (userId: string) => `rt:user:${userId}:families`;

export interface RefreshTokenClaims {
  sub: string;
  type: 'refresh';
  jti: string;
  familyId: string;
}

export interface IssueResult {
  token: string;
  jti: string;
  familyId: string;
  expiresInSec: number;
}

export class RefreshTokenService {
  constructor(
    private readonly app: FastifyInstance,
    private readonly redis: Redis,
  ) {}

  private randomId(bytes = 32): string {
    return crypto.randomBytes(bytes).toString('hex');
  }

  async issue(userId: string, familyId?: string): Promise<IssueResult> {
    const jti = this.randomId();
    const family = familyId ?? this.randomId(16);
    const ttl = config.REFRESH_TOKEN_MAX_AGE_SECONDS;

    const claims: RefreshTokenClaims = {
      sub: userId,
      type: 'refresh',
      jti,
      familyId: family,
    };

    const token = this.app.jwt.sign(claims, { expiresIn: config.REFRESH_TOKEN_EXPIRY });

    const pipeline = this.redis.pipeline();
    pipeline.set(
      KEY_JTI(jti),
      JSON.stringify({ userId, familyId: family, used: 0 }),
      'EX',
      ttl,
    );
    pipeline.sadd(KEY_FAMILY(family), jti);
    pipeline.expire(KEY_FAMILY(family), ttl);
    pipeline.sadd(KEY_USER_FAMILIES(userId), family);
    pipeline.expire(KEY_USER_FAMILIES(userId), ttl);
    await pipeline.exec();

    return { token, jti, familyId: family, expiresInSec: ttl };
  }

  async rotate(rawToken: string): Promise<{ result: IssueResult; userId: string }> {
    let claims: RefreshTokenClaims;
    try {
      claims = this.app.jwt.verify<RefreshTokenClaims>(rawToken);
    } catch {
      throw new AppError(ErrorCode.AUTH_INVALID_REFRESH_TOKEN, 401);
    }

    if (claims.type !== 'refresh') {
      throw new AppError(ErrorCode.AUTH_INVALID_TOKEN_TYPE, 401);
    }

    const familyRevoked = await this.redis.exists(KEY_FAMILY_REVOKED(claims.familyId));
    if (familyRevoked) {
      throw new AppError(ErrorCode.AUTH_REFRESH_REUSED, 401);
    }

    const raw = await this.redis.get(KEY_JTI(claims.jti));
    if (!raw) {
      // Token unknown (expired or never issued by us). Treat as invalid.
      throw new AppError(ErrorCode.AUTH_INVALID_REFRESH_TOKEN, 401);
    }

    const stored = JSON.parse(raw) as {
      userId: string;
      familyId: string;
      used: number;
      usedAt?: number;
      succ?: IssueResult;
    };
    if (stored.userId !== claims.sub || stored.familyId !== claims.familyId) {
      // Tampered — revoke aggressively.
      await this.revokeFamily(claims.familyId);
      throw new AppError(ErrorCode.AUTH_REFRESH_REUSED, 401);
    }

    if (stored.used === 1) {
      const withinGrace =
        typeof stored.usedAt === 'number' && Date.now() - stored.usedAt < REUSE_GRACE_MS;
      if (withinGrace && stored.succ) {
        // Corrida legítima entre abas/dispositivos: devolve o mesmo par já emitido pela
        // rotação original em vez de tratar como token roubado.
        return { result: stored.succ, userId: claims.sub };
      }
      // Reuse detected outside the grace window: the legitimate user already rotated this
      // token a while ago. The attacker (or a stale device) is presenting it now → nuke
      // the whole family.
      await this.revokeFamily(claims.familyId, stored.userId);
      throw new AppError(ErrorCode.AUTH_REFRESH_REUSED, 401);
    }

    const result = await this.issue(claims.sub, claims.familyId);

    // Mark used (single-shot) and record the successor so a racing duplicate request within
    // the grace window can be served transparently. If concurrent rotations race on this
    // very SET, only one wins — the loser's `issue()` above still leaves valid tokens in
    // Redis, so nothing is lost either way.
    const setUsed = await this.redis.set(
      KEY_JTI(claims.jti),
      JSON.stringify({ ...stored, used: 1, usedAt: Date.now(), succ: result }),
      'KEEPTTL',
      'XX',
    );
    if (setUsed !== 'OK') {
      throw new AppError(ErrorCode.AUTH_INVALID_REFRESH_TOKEN, 401);
    }

    return { result, userId: claims.sub };
  }

  async revokeFamily(familyId: string, userId?: string): Promise<void> {
    const ttl = config.REFRESH_TOKEN_MAX_AGE_SECONDS;
    const pipeline = this.redis.pipeline();
    pipeline.set(KEY_FAMILY_REVOKED(familyId), '1', 'EX', ttl);
    pipeline.smembers(KEY_FAMILY(familyId));
    const results = await pipeline.exec();
    const jtis = (results?.[1]?.[1] as string[] | undefined) ?? [];

    if (jtis.length) {
      const del = this.redis.pipeline();
      jtis.forEach((jti) => del.del(KEY_JTI(jti)));
      del.del(KEY_FAMILY(familyId));
      if (userId) del.srem(KEY_USER_FAMILIES(userId), familyId);
      await del.exec();
    }
  }

  async revokeAllForUser(userId: string): Promise<void> {
    const families = await this.redis.smembers(KEY_USER_FAMILIES(userId));
    for (const family of families) {
      await this.revokeFamily(family, userId);
    }
    await this.redis.del(KEY_USER_FAMILIES(userId));
  }
}
