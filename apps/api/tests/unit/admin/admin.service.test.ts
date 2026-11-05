import { describe, it, expect, vi, beforeEach } from 'vitest';
import Redis from 'ioredis-mock';
import { Admin2faService } from '../../../src/modules/admin/admin-2fa.service.js';
import { AdminService } from '../../../src/modules/admin/admin.service.js';
import { AppError } from '../../../src/common/lib/errors.js';
import { ErrorCode } from '@mll/shared';

vi.mock('../../../src/modules/admin/admin.config.js', () => ({
  findAdminByLogin: vi.fn((login: string) => {
    if (login === 'alice') {
      return {
        id: 'admin-a',
        login: 'alice',
        password: 'secret',
        email: 'alice@test.local',
        role: 'super',
      };
    }
    return undefined;
  }),
  findAdminById: vi.fn((id: string) =>
    id === 'admin-a'
      ? {
          id: 'admin-a',
          login: 'alice',
          password: 'secret',
          email: 'alice@test.local',
          role: 'super',
        }
      : undefined,
  ),
  verifyAdminPassword: vi.fn(async (plain: string, stored: string) => plain === stored),
}));

describe('AdminService', () => {
  const redis = new Redis();
  const twoFa = new Admin2faService(redis);
  const service = new AdminService(twoFa);

  beforeEach(async () => {
    await redis.flushall();
  });

  it('startLogin returns challenge for valid credentials', async () => {
    const result = await service.startLogin('alice', 'secret');
    expect(result.challengeId).toBeTruthy();
    expect(result.code).toMatch(/^\d{6}$/);
    expect(result.expiresIn).toBeGreaterThan(0);
  });

  it('startLogin rejects invalid credentials', async () => {
    await expect(service.startLogin('alice', 'wrong')).rejects.toMatchObject({
      code: ErrorCode.ADMIN_INVALID_CREDENTIALS,
    });
  });

  it('complete2fa accepts valid code', async () => {
    const { challengeId, code } = await service.startLogin('alice', 'secret');
    const admin = await service.complete2fa(challengeId, code);
    expect(admin.login).toBe('alice');
  });

  it('complete2fa rejects wrong code', async () => {
    const { challengeId } = await service.startLogin('alice', 'secret');
    await expect(service.complete2fa(challengeId, '000000')).rejects.toBeInstanceOf(AppError);
  });
});
