import type { Prisma, PrismaClient } from '@prisma/client';
import type { OfficeStaffAvatarRole, OfficeStaffConfigDTO } from '@mll/shared';
import {
  isOfficeStaffImageAvatar,
  officeStaffAvatarRoleSchema,
  officeStaffConfigPatchSchema,
} from '@mll/shared';
import type { z } from 'zod';
import { AppError, ErrorCode } from '../../common/lib/errors.js';
import { deleteOfficeStaffImage, saveOfficeStaffImage } from '../../common/lib/uploads.js';
import { PlatformConfigService } from '../platform/platform-config.service.js';
import { mapOfficeStaffConfig } from './office-config.js';

type OfficeStaffPatch = z.infer<typeof officeStaffConfigPatchSchema>;

export class OfficeStaffConfigService {
  private readonly platform: PlatformConfigService;

  constructor(private readonly prisma: PrismaClient) {
    this.platform = new PlatformConfigService(prisma);
  }

  async get(): Promise<OfficeStaffConfigDTO> {
    await this.platform.ensureDefault();
    const row = await this.prisma.platformConfig.findUniqueOrThrow({ where: { id: 'default' } });
    return mapOfficeStaffConfig(row);
  }

  async update(patch: OfficeStaffPatch, adminLogin: string): Promise<OfficeStaffConfigDTO> {
    const body = officeStaffConfigPatchSchema.parse(patch);
    await this.platform.ensureDefault();

    const t = body.treasurer;
    const c = body.coach;

    await this.prisma.platformConfig.update({
      where: { id: 'default' },
      data: {
        ...(t?.enabled !== undefined ? { treasurerEnabled: t.enabled } : {}),
        ...(t?.name !== undefined ? { treasurerName: t.name } : {}),
        ...(t?.roleLabel !== undefined ? { treasurerRoleLabel: t.roleLabel } : {}),
        ...(t?.avatar !== undefined ? { treasurerAvatar: t.avatar } : {}),
        ...(t?.accent !== undefined ? { treasurerAccent: t.accent } : {}),
        ...(t?.perks !== undefined ? { treasurerPerks: t.perks } : {}),
        ...(t?.weeklyUsdc !== undefined ? { treasurerWeeklyUsdc: t.weeklyUsdc } : {}),
        ...(c?.enabled !== undefined ? { coachEnabled: c.enabled } : {}),
        ...(c?.name !== undefined ? { coachName: c.name } : {}),
        ...(c?.roleLabel !== undefined ? { coachRoleLabel: c.roleLabel } : {}),
        ...(c?.avatar !== undefined ? { coachAvatar: c.avatar } : {}),
        ...(c?.accent !== undefined ? { coachAccent: c.accent } : {}),
        ...(c?.perks !== undefined ? { coachPerks: c.perks } : {}),
        ...(c?.weeklyUsdc !== undefined ? { coachWeeklyUsdc: c.weeklyUsdc } : {}),
        ...(c?.miningFeePct !== undefined ? { coachMiningFeePct: c.miningFeePct } : {}),
        ...(c?.staminaRecoveryPerHour !== undefined
          ? { coachStaminaRecoveryPerHour: c.staminaRecoveryPerHour }
          : {}),
        ...(c?.dailyRestStamina !== undefined ? { dailyRestStamina: c.dailyRestStamina } : {}),
        ...(c?.matchStaminaCost !== undefined ? { matchStaminaCost: c.matchStaminaCost } : {}),
        ...(c?.matchCooldownSec !== undefined ? { matchCooldownSec: c.matchCooldownSec } : {}),
        ...(c?.trainingStaminaCost !== undefined ? { trainingStaminaCost: c.trainingStaminaCost } : {}),
        ...(c?.specialStaminaCost !== undefined ? { specialStaminaCost: c.specialStaminaCost } : {}),
        updatedBy: adminLogin,
      } as Prisma.PlatformConfigUpdateInput,
    });

    return this.get();
  }

  async uploadAvatar(
    role: OfficeStaffAvatarRole,
    buffer: Buffer,
    mime: string,
    adminLogin: string,
  ): Promise<OfficeStaffConfigDTO> {
    const parsedRole = officeStaffAvatarRoleSchema.parse(role);
    await this.platform.ensureDefault();

    const row = await this.prisma.platformConfig.findUniqueOrThrow({ where: { id: 'default' } });
    const saved = await saveOfficeStaffImage(buffer, mime);
    const oldAvatar = parsedRole === 'treasurer' ? row.treasurerAvatar : row.coachAvatar;

    if (isOfficeStaffImageAvatar(oldAvatar)) {
      await deleteOfficeStaffImage(oldAvatar);
    }

    await this.prisma.platformConfig.update({
      where: { id: 'default' },
      data:
        parsedRole === 'treasurer'
          ? { treasurerAvatar: saved.url, updatedBy: adminLogin }
          : { coachAvatar: saved.url, updatedBy: adminLogin },
    });

    return this.get();
  }

  async clearAvatar(role: OfficeStaffAvatarRole, adminLogin: string): Promise<OfficeStaffConfigDTO> {
    const parsedRole = officeStaffAvatarRoleSchema.parse(role);
    await this.platform.ensureDefault();

    const row = await this.prisma.platformConfig.findUniqueOrThrow({ where: { id: 'default' } });
    const oldAvatar = parsedRole === 'treasurer' ? row.treasurerAvatar : row.coachAvatar;
    const fallback = parsedRole === 'treasurer' ? '💼' : '🎽';

    if (isOfficeStaffImageAvatar(oldAvatar)) {
      await deleteOfficeStaffImage(oldAvatar);
    }

    await this.prisma.platformConfig.update({
      where: { id: 'default' },
      data:
        parsedRole === 'treasurer'
          ? { treasurerAvatar: fallback, updatedBy: adminLogin }
          : { coachAvatar: fallback, updatedBy: adminLogin },
    });

    return this.get();
  }
}
