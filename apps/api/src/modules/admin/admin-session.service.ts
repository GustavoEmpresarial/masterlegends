import crypto from 'node:crypto';
import type Redis from 'ioredis';
import type { FastifyInstance } from 'fastify';
import { AppError, ErrorCode } from '../../common/lib/errors.js';
import { config } from '../../config/env.js';
import { getAdminJwt } from './admin-jwt.js';

const KEY_JTI = (jti: string) => `admin:rt:jti:${jti}`;
const KEY_FAMILY = (familyId: string) => `admin:rt:family:${familyId}`;
const KEY_FAMILY_REVOKED = (familyId: string) => `admin:rt:revoked-family:${familyId}`;
const KEY_ADMIN_FAMILIES = (adminId: string) => `admin:rt:admin:${adminId}:families`;

export interface AdminRefreshClaims {
  sub: string;
  type: 'admin-refresh';
  jti: string;
  familyId: string;
}

export interface AdminIssueResult {
  token: string;
  jti: string;
  familyId: string;
  expiresInSec: number;
}

export class AdminSessionService {
  constructor(
    private readonly app: FastifyInstance,
    private readonly redis: Redis,
  ) {}

  private randomId(bytes = 32): string {
    return crypto.randomBytes(bytes).toString('hex');
  }

  async issue(adminId: string, familyId?: string): Promise<AdminIssueResult> {
    const jti = this.randomId();
    const family = familyId ?? this.randomId(16);
    const ttl = config.ADMIN_REFRESH_MAX_AGE_SECONDS;

    const claims: AdminRefreshClaims = {
      sub: adminId,
      type: 'admin-refresh',
      jti,
      familyId: family,
    };

    const token = getAdminJwt(this.app).sign(claims, { expiresIn: `${ttl}s` });

    const pipeline = this.redis.pipeline();
    pipeline.set(
      KEY_JTI(jti),
      JSON.stringify({ adminId, familyId: family, used: 0 }),
      'EX',
      ttl,
    );
    pipeline.sadd(KEY_FAMILY(family), jti);
    pipeline.expire(KEY_FAMILY(family), ttl);
    pipeline.sadd(KEY_ADMIN_FAMILIES(adminId), family);
    pipeline.expire(KEY_ADMIN_FAMILIES(adminId), ttl);
    await pipeline.exec();

    return { token, jti, familyId: family, expiresInSec: ttl };
  }

  async rotate(rawToken: string): Promise<{ result: AdminIssueResult; adminId: string }> {
    let claims: AdminRefreshClaims;
    try {
      claims = getAdminJwt(this.app).verify<AdminRefreshClaims>(rawToken);
    } catch {
      throw new AppError(ErrorCode.AUTH_INVALID_REFRESH_TOKEN, 401);
    }

    if (claims.type !== 'admin-refresh') {
      throw new AppError(ErrorCode.AUTH_INVALID_TOKEN_TYPE, 401);
    }

    const familyRevoked = await this.redis.exists(KEY_FAMILY_REVOKED(claims.familyId));
    if (familyRevoked) {
      throw new AppError(ErrorCode.AUTH_REFRESH_REUSED, 401);
    }

    const raw = await this.redis.get(KEY_JTI(claims.jti));
    if (!raw) {
      throw new AppError(ErrorCode.AUTH_INVALID_REFRESH_TOKEN, 401);
    }

    const stored = JSON.parse(raw) as { adminId: string; familyId: string; used: number };
    if (stored.adminId !== claims.sub || stored.familyId !== claims.familyId) {
      await this.revokeFamily(claims.familyId);
      throw new AppError(ErrorCode.AUTH_REFRESH_REUSED, 401);
    }

    if (stored.used === 1) {
      await this.revokeFamily(claims.familyId, stored.adminId);
      throw new AppError(ErrorCode.AUTH_REFRESH_REUSED, 401);
    }

    const setUsed = await this.redis.set(
      KEY_JTI(claims.jti),
      JSON.stringify({ ...stored, used: 1 }),
      'KEEPTTL',
      'XX',
    );
    if (setUsed !== 'OK') {
      throw new AppError(ErrorCode.AUTH_INVALID_REFRESH_TOKEN, 401);
    }

    const result = await this.issue(claims.sub, claims.familyId);
    return { result, adminId: claims.sub };
  }

  async revokeFamily(familyId: string, adminId?: string): Promise<void> {
    const ttl = config.ADMIN_REFRESH_MAX_AGE_SECONDS;
    const pipeline = this.redis.pipeline();
    pipeline.set(KEY_FAMILY_REVOKED(familyId), '1', 'EX', ttl);
    pipeline.smembers(KEY_FAMILY(familyId));
    const results = await pipeline.exec();
    const jtis = (results?.[1]?.[1] as string[] | undefined) ?? [];

    if (jtis.length) {
      const del = this.redis.pipeline();
      jtis.forEach((jti) => del.del(KEY_JTI(jti)));
      del.del(KEY_FAMILY(familyId));
      if (adminId) del.srem(KEY_ADMIN_FAMILIES(adminId), familyId);
      await del.exec();
    }
  }

  async revokeFromToken(rawToken: string): Promise<void> {
    try {
      const claims = getAdminJwt(this.app).verify<AdminRefreshClaims>(rawToken);
      if (claims.type === 'admin-refresh') {
        await this.revokeFamily(claims.familyId, claims.sub);
      }
    } catch {
      /* ignore invalid token on logout */
    }
  }
}
