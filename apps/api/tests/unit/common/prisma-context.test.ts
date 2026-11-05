import { describe, it, expect, afterEach } from 'vitest';
import {
  PrismaContextError,
  authorizeAdmin,
  authorizePlayer,
  initRequestContext,
  isPrismaAccessAllowed,
  resolveScopeFromPath,
  runWithSystemContext,
} from '../../../src/common/lib/prisma-context.js';
import { createPrismaClient } from '../../../src/common/lib/create-prisma-client.js';

describe('prisma-context', () => {
  afterEach(() => {
    delete process.env.PRISMA_GUARD_DISABLED;
  });

  describe('resolveScopeFromPath', () => {
    it('maps public and player routes', () => {
      expect(resolveScopeFromPath('/health')).toBe('system');
      expect(resolveScopeFromPath('/auth/login')).toBe('system');
      expect(resolveScopeFromPath('/stats/public')).toBe('system');
      expect(resolveScopeFromPath('/api/club')).toBe('player');
      expect(resolveScopeFromPath('/api/scout/mint')).toBe('player');
    });

    it('maps admin routes (system login vs protected dashboard)', () => {
      expect(resolveScopeFromPath('/admin/api/login')).toBe('system');
      expect(resolveScopeFromPath('/admin/api/verify-2fa')).toBe('system');
      expect(resolveScopeFromPath('/admin/api/dashboard/users')).toBe('admin');
      expect(resolveScopeFromPath('/admin/queues')).toBe('admin');
    });

    it('blocks unknown paths', () => {
      expect(resolveScopeFromPath('/unknown')).toBe('blocked');
    });
  });

  describe('isPrismaAccessAllowed', () => {
    it('denies access without context', () => {
      expect(isPrismaAccessAllowed()).toBe(false);
    });

    it('allows system context', async () => {
      await runWithSystemContext(async () => {
        expect(isPrismaAccessAllowed()).toBe(true);
      });
    });

    it('allows player context only with userId', () => {
      initRequestContext('player');
      expect(isPrismaAccessAllowed()).toBe(false);
      authorizePlayer('user-1');
      expect(isPrismaAccessAllowed()).toBe(true);
    });

    it('allows admin context only with adminId', () => {
      initRequestContext('admin');
      expect(isPrismaAccessAllowed()).toBe(false);
      authorizeAdmin('admin-1');
      expect(isPrismaAccessAllowed()).toBe(true);
    });

    it('denies blocked scope without identity', () => {
      initRequestContext('blocked');
      expect(isPrismaAccessAllowed()).toBe(false);
    });
  });

  describe('createPrismaClient extension', () => {
    it('blocks prisma queries without authorized context', async () => {
      process.env.PRISMA_GUARD_DISABLED = 'false';
      const prisma = createPrismaClient();

      await expect(prisma.user.count()).rejects.toBeInstanceOf(PrismaContextError);
      await prisma.$disconnect();
    });

    it('does not throw PrismaContextError when system context is active', async () => {
      const prisma = createPrismaClient();
      let caught: unknown;

      await runWithSystemContext(async () => {
        try {
          await prisma.user.count();
        } catch (error) {
          caught = error;
        }
      });

      if (caught !== undefined) {
        expect(caught).not.toBeInstanceOf(PrismaContextError);
      }

      await prisma.$disconnect();
    });

    it('runWithSystemContext still unlocks access when nested inside an unauthorized outer scope', async () => {
      // Regression: production bug where `maintenanceGuard` ran runWithSystemContext with a
      // callback that returned the PrismaPromise without an inner `await` — since Prisma uses
      // a custom thenable (not a native Promise), the query only actually executes on `.then()`,
      // by which point storage.run()'s synchronous window had already closed and the ALS context
      // had reverted to the outer (unauthorized) scope, causing a false PrismaContextError.
      const prisma = createPrismaClient();
      initRequestContext('player'); // outer scope: unauthorized (no userId set)
      let caught: unknown;

      await runWithSystemContext(async () => {
        try {
          await prisma.user.count();
        } catch (error) {
          caught = error;
        }
      });

      if (caught !== undefined) {
        expect(caught).not.toBeInstanceOf(PrismaContextError);
      }

      await prisma.$disconnect();
    });

    it('throws PrismaContextError if the runWithSystemContext callback does not await the query internally', async () => {
      // The un-awaited-callback footgun itself: proves the failure mode this suite guards
      // against, so a future refactor that reintroduces it gets caught here too.
      const prisma = createPrismaClient();
      initRequestContext('player');

      await expect(
        runWithSystemContext(() => prisma.user.count()),
      ).rejects.toBeInstanceOf(PrismaContextError);

      await prisma.$disconnect();
    });

    it('bypasses guard when PRISMA_GUARD_DISABLED=true', async () => {
      process.env.PRISMA_GUARD_DISABLED = 'true';
      const prisma = createPrismaClient();
      let caught: unknown;

      try {
        await prisma.user.count();
      } catch (error) {
        caught = error;
      }

      if (caught !== undefined) {
        expect(caught).not.toBeInstanceOf(PrismaContextError);
      }

      await prisma.$disconnect();
    });
  });
});
