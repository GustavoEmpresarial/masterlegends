import { describe, it, expect, vi } from 'vitest';
import { AuditService, AuditAction } from '../../../src/common/lib/audit.js';

describe('AuditService', () => {
  it('persists audit row and logs', async () => {
    const prisma = {
      auditLog: { create: vi.fn().mockResolvedValue({ id: 'a1' }) },
    } as any;
    const service = new AuditService(prisma);
    await service.record({ userId: 'u1', action: AuditAction.LOGIN_SUCCESS, ip: '127.0.0.1' });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'login_success', userId: 'u1' }),
      }),
    );
  });

  it('swallows prisma errors', async () => {
    const prisma = {
      auditLog: { create: vi.fn().mockRejectedValue(new Error('db down')) },
    } as any;
    const service = new AuditService(prisma);
    await expect(
      service.record({ action: AuditAction.LOGIN_FAILED }),
    ).resolves.toBeUndefined();
  });
});
