import type { PrismaClient } from '@prisma/client';
import type { AdminPermissionType } from '@mll/shared';
import { AdminPermission } from '@mll/shared';
import type { AdminPermissionConfigDTO } from '@mll/shared';
import type Redis from 'ioredis';
import { getAdminUsers } from './admin.config.js';

const VALID_PERMISSIONS = new Set<string>(Object.values(AdminPermission));
const CACHE_TTL_S = 60;

function cacheKey(adminId: string) {
  return `admin-perms:${adminId}`;
}

function mapRow(row: { adminId: string; permissions: string[]; updatedBy: string | null; updatedAt: Date }): AdminPermissionConfigDTO {
  return {
    adminId: row.adminId,
    permissions: row.permissions.filter((p) => VALID_PERMISSIONS.has(p)) as AdminPermissionType[],
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class AdminPermissionConfigService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
  ) {}

  async getPermissions(adminId: string): Promise<AdminPermissionType[] | null> {
    const cached = await this.redis.get(cacheKey(adminId));
    if (cached !== null) {
      return JSON.parse(cached) as AdminPermissionType[];
    }

    const row = await this.prisma.adminPermissionConfig.findUnique({ where: { adminId } });
    if (!row) {
      await this.redis.set(cacheKey(adminId), JSON.stringify(null), 'EX', CACHE_TTL_S);
      return null;
    }

    const perms = row.permissions.filter((p: string) => VALID_PERMISSIONS.has(p)) as AdminPermissionType[];
    await this.redis.set(cacheKey(adminId), JSON.stringify(perms), 'EX', CACHE_TTL_S);
    return perms;
  }

  async set(adminId: string, permissions: AdminPermissionType[], updatedBy: string): Promise<AdminPermissionConfigDTO> {
    const valid = permissions.filter((p) => VALID_PERMISSIONS.has(p));
    const row = await this.prisma.adminPermissionConfig.upsert({
      where: { adminId },
      create: { adminId, permissions: valid, updatedBy },
      update: { permissions: valid, updatedBy },
    });
    await this.redis.del(cacheKey(adminId));
    return mapRow(row);
  }

  async list(): Promise<AdminPermissionConfigDTO[]> {
    const rows = await this.prisma.adminPermissionConfig.findMany({
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(mapRow);
  }

  async listAdmins() {
    const allAdmins = getAdminUsers();
    const configs = await this.list();
    const configById = new Map(configs.map((c) => [c.adminId, c]));

    return allAdmins.map((a) => ({
      id: a.id,
      login: a.login,
      email: a.email,
      role: a.role,
      permissionConfig: configById.get(a.id) ?? null,
    }));
  }

  async delete(adminId: string): Promise<void> {
    await this.prisma.adminPermissionConfig.deleteMany({ where: { adminId } });
    await this.redis.del(cacheKey(adminId));
  }
}
