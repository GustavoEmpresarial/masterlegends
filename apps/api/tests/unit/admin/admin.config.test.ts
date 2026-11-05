import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../src/config/env.js', () => ({
  config: {
    ADMIN_USERS: [
      {
        id: 'admin-1',
        login: 'superadmin',
        password: 'plaintext-pass',
        email: 'super@test.local',
        role: 'super',
      },
    ],
    ADMIN_ALLOW_PLAINTEXT_PASSWORDS: false,
    isProduction: false,
  },
}));

// Import after mock is set up
const { findAdminByLogin, findAdminById, verifyAdminPassword } = await import(
  '../../../src/modules/admin/admin.config.js'
);

describe('admin.config', () => {
  describe('findAdminByLogin', () => {
    it('finds admin by exact login', () => {
      expect(findAdminByLogin('superadmin')?.id).toBe('admin-1');
    });

    it('is case-insensitive', () => {
      expect(findAdminByLogin('SuperAdmin')?.id).toBe('admin-1');
    });

    it('finds admin by email', () => {
      expect(findAdminByLogin('super@test.local')?.id).toBe('admin-1');
    });

    it('returns undefined for unknown login', () => {
      expect(findAdminByLogin('unknown')).toBeUndefined();
    });
  });

  describe('findAdminById', () => {
    it('finds admin by id', () => {
      expect(findAdminById('admin-1')?.login).toBe('superadmin');
    });

    it('returns undefined for unknown id', () => {
      expect(findAdminById('ghost')).toBeUndefined();
    });
  });

  describe('verifyAdminPassword', () => {
    it('compares bcrypt hash correctly', async () => {
      const bcrypt = await import('bcryptjs');
      const hash = await bcrypt.hash('secret', 4);
      expect(await verifyAdminPassword('secret', hash)).toBe(true);
      expect(await verifyAdminPassword('wrong', hash)).toBe(false);
    });

    it('compares plaintext in non-production when no bcrypt prefix', async () => {
      expect(await verifyAdminPassword('plaintext-pass', 'plaintext-pass')).toBe(true);
      expect(await verifyAdminPassword('wrong', 'plaintext-pass')).toBe(false);
    });
  });
});
