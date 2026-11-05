import bcrypt from 'bcryptjs';
import { adminRoleSchema } from '@mll/shared';
import { z } from 'zod';
import { config } from '../../config/env.js';

const adminUserSchema = z.object({
  id: z.string().min(1).max(64),
  login: z.string().min(1).max(64),
  password: z.string().min(1).max(256),
  email: z.string().email(),
  role: adminRoleSchema,
});

export type AdminConfigUser = z.infer<typeof adminUserSchema>;

let cachedUsers: AdminConfigUser[] | null = null;

export function getAdminUsers(): AdminConfigUser[] {
  if (!cachedUsers) {
    cachedUsers = config.ADMIN_USERS;
  }
  return cachedUsers;
}

export function findAdminByLogin(login: string): AdminConfigUser | undefined {
  const normalized = login.trim().toLowerCase();
  return getAdminUsers().find(
    (u) => u.login.toLowerCase() === normalized || u.email.toLowerCase() === normalized,
  );
}

export function findAdminById(id: string): AdminConfigUser | undefined {
  return getAdminUsers().find((u) => u.id === id);
}

export async function verifyAdminPassword(plain: string, stored: string): Promise<boolean> {
  if (stored.startsWith('$2')) {
    return bcrypt.compare(plain, stored);
  }
  if (config.ADMIN_ALLOW_PLAINTEXT_PASSWORDS || !config.isProduction) {
    return plain === stored;
  }
  return false;
}
