import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorCode } from '@mll/shared';

function mockReply() {
  const reply = { status: vi.fn().mockReturnThis(), send: vi.fn() };
  return reply as any;
}

beforeEach(() => {
  vi.resetModules();
});

describe('maintenanceGuard', () => {
  it('allows /health through without touching the DB', async () => {
    const { maintenanceGuard } = await import('../../../src/common/guards/maintenance.guard.js');
    const findUnique = vi.fn();
    const request = { url: '/health', server: { prisma: { platformConfig: { findUnique } } } } as any;
    const reply = mockReply();
    await maintenanceGuard(request, reply);
    expect(findUnique).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
  });

  it('allows /uploads/* through without touching the DB, so stadium images load during maintenance', async () => {
    const { maintenanceGuard } = await import('../../../src/common/guards/maintenance.guard.js');
    const findUnique = vi.fn();
    const request = {
      url: '/uploads/stadiums/campo.png',
      hostname: 'masterlegends.online',
      server: { prisma: { platformConfig: { findUnique } } },
    } as any;
    const reply = mockReply();
    await maintenanceGuard(request, reply);
    expect(findUnique).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
  });

  it('allows /admin/api/* through without touching the DB, regardless of hostname', async () => {
    const { maintenanceGuard } = await import('../../../src/common/guards/maintenance.guard.js');
    const findUnique = vi.fn();
    const request = {
      url: '/admin/api/wallet-config',
      hostname: 'dev.masterlegends.online',
      server: { prisma: { platformConfig: { findUnique } } },
    } as any;
    const reply = mockReply();
    await maintenanceGuard(request, reply);
    expect(findUnique).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
  });

  it('passes through when maintenanceMode is false', async () => {
    const { maintenanceGuard } = await import('../../../src/common/guards/maintenance.guard.js');
    const findUnique = vi.fn().mockResolvedValue({ maintenanceMode: false, maintenanceMessage: null });
    const request = {
      url: '/api/club/me',
      hostname: 'masterlegends.online',
      server: { prisma: { platformConfig: { findUnique } } },
    } as any;
    const reply = mockReply();
    await maintenanceGuard(request, reply);
    expect(reply.send).not.toHaveBeenCalled();
  });

  it('lets the stadium live widget read the pitch during maintenance', async () => {
    const { maintenanceGuard } = await import('../../../src/common/guards/maintenance.guard.js');
    const findUnique = vi.fn();
    const request = {
      url: '/api/stadium/view',
      hostname: 'masterlegends.online',
      server: { prisma: { platformConfig: { findUnique } } },
    } as any;
    const reply = mockReply();
    await maintenanceGuard(request, reply);
    expect(findUnique).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
  });

  it('blocks with 503 + MAINTENANCE_MODE using the custom message when maintenanceMode is true', async () => {
    const { maintenanceGuard } = await import('../../../src/common/guards/maintenance.guard.js');
    const findUnique = vi
      .fn()
      .mockResolvedValue({ maintenanceMode: true, maintenanceMessage: 'Voltamos às 22h.' });
    const request = {
      url: '/api/club/me',
      hostname: 'masterlegends.online',
      server: { prisma: { platformConfig: { findUnique } } },
    } as any;
    const reply = mockReply();
    await maintenanceGuard(request, reply);
    expect(reply.status).toHaveBeenCalledWith(503);
    expect(reply.send.mock.calls[0][0].error.code).toBe(ErrorCode.MAINTENANCE_MODE);
    expect(reply.send.mock.calls[0][0].error.details.message).toBe('Voltamos às 22h.');
  });

  it('still enforces on the www subdomain of the main domain (www.masterlegends.online)', async () => {
    const { maintenanceGuard } = await import('../../../src/common/guards/maintenance.guard.js');
    const findUnique = vi.fn().mockResolvedValue({ maintenanceMode: true, maintenanceMessage: null });
    const request = {
      url: '/api/club/me',
      hostname: 'www.masterlegends.online',
      server: { prisma: { platformConfig: { findUnique } } },
    } as any;
    const reply = mockReply();
    await maintenanceGuard(request, reply);
    expect(reply.status).toHaveBeenCalledWith(503);
    expect(reply.send.mock.calls[0][0].error.code).toBe(ErrorCode.MAINTENANCE_MODE);
  });

  it('bypasses without touching the DB when hostname is the dev subdomain, even if maintenanceMode is true', async () => {
    const { maintenanceGuard } = await import('../../../src/common/guards/maintenance.guard.js');
    const findUnique = vi.fn().mockResolvedValue({ maintenanceMode: true, maintenanceMessage: 'x' });
    const request = {
      url: '/api/club/me',
      hostname: 'dev.masterlegends.online',
      server: { prisma: { platformConfig: { findUnique } } },
    } as any;
    const reply = mockReply();
    await maintenanceGuard(request, reply);
    expect(findUnique).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
  });

  it('bypasses for localhost regardless of maintenanceMode', async () => {
    const { maintenanceGuard } = await import('../../../src/common/guards/maintenance.guard.js');
    const findUnique = vi.fn();
    const request = {
      url: '/api/club/me',
      hostname: 'localhost',
      server: { prisma: { platformConfig: { findUnique } } },
    } as any;
    const reply = mockReply();
    await maintenanceGuard(request, reply);
    expect(findUnique).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
  });

  it('fails open (does not 500 the whole site) when the DB read throws', async () => {
    const { maintenanceGuard } = await import('../../../src/common/guards/maintenance.guard.js');
    const findUnique = vi.fn().mockRejectedValue(new Error('PrismaContextError: blocked scope'));
    const request = {
      url: '/api/club/me',
      hostname: 'masterlegends.online',
      server: { prisma: { platformConfig: { findUnique } } },
      log: { error: vi.fn() },
    } as any;
    const reply = mockReply();
    await expect(maintenanceGuard(request, reply)).resolves.toBeUndefined();
    expect(reply.status).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
  });

  it('caches the DB read across requests within the TTL window', async () => {
    const { maintenanceGuard } = await import('../../../src/common/guards/maintenance.guard.js');
    const findUnique = vi.fn().mockResolvedValue({ maintenanceMode: false, maintenanceMessage: null });
    const server = { prisma: { platformConfig: { findUnique } } };
    await maintenanceGuard({ url: '/api/club/me', hostname: 'masterlegends.online', server } as any, mockReply());
    await maintenanceGuard({ url: '/api/wallet/status', hostname: 'masterlegends.online', server } as any, mockReply());
    expect(findUnique).toHaveBeenCalledTimes(1);
  });
});
