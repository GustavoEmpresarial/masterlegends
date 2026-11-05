import type { PlatformConfig, PrismaClient } from '@prisma/client';
import type {
  CoachStaffRoleConfigDTO,
  OfficeStaffConfigDTO,
  OfficeStaffPerkDTO,
  OfficeStaffRoleConfigDTO,
} from '@mll/shared';
import {
  DEFAULT_COACH_PERKS,
  DEFAULT_TREASURER_PERKS,
  officeStaffPerkSchema,
} from '@mll/shared';

function parsePerks(raw: unknown, fallback: OfficeStaffPerkDTO[]): OfficeStaffPerkDTO[] {
  if (!Array.isArray(raw)) return fallback;
  const perks: OfficeStaffPerkDTO[] = [];
  for (const item of raw) {
    const parsed = officeStaffPerkSchema.safeParse(item);
    if (parsed.success) perks.push(parsed.data);
  }
  return perks.length > 0 ? perks : fallback;
}

export function interpolatePerkText(
  text: string,
  vars: { recoveryPerHour?: number; miningFeePct?: number },
): string {
  return text
    .replace(/\{recoveryPerHour\}/g, String(vars.recoveryPerHour ?? 0))
    .replace(/\{miningFeePct\}/g, ((vars.miningFeePct ?? 0) * 100).toFixed(1));
}

export async function getCoachStaminaRecoveryPerHour(prisma: PrismaClient): Promise<number> {
  const row = await prisma.platformConfig.findUnique({ where: { id: 'default' } });
  return row?.coachStaminaRecoveryPerHour ?? 24;
}

export function mapOfficeStaffConfig(row: PlatformConfig): OfficeStaffConfigDTO {
  const miningFeePct = Number(row.coachMiningFeePct);
  const staminaRecoveryPerHour = row.coachStaminaRecoveryPerHour;
  const extra = row as typeof row & {
    dailyRestStamina?: number;
    matchStaminaCost?: number;
    matchCooldownSec?: number;
    trainingStaminaCost?: number;
    specialStaminaCost?: number;
  };

  const treasurerPerks = parsePerks(row.treasurerPerks, DEFAULT_TREASURER_PERKS);
  const coachPerksRaw = parsePerks(row.coachPerks, DEFAULT_COACH_PERKS);
  const coachPerks = coachPerksRaw.map((p) => ({
    icon: p.icon,
    text: interpolatePerkText(p.text, { recoveryPerHour: staminaRecoveryPerHour, miningFeePct }),
  }));

  const treasurer: OfficeStaffRoleConfigDTO = {
    enabled: row.treasurerEnabled,
    name: row.treasurerName,
    roleLabel: row.treasurerRoleLabel,
    avatar: row.treasurerAvatar,
    accent: row.treasurerAccent,
    perks: treasurerPerks,
    weeklyUsdc: Number(row.treasurerWeeklyUsdc),
  };

  const coach: CoachStaffRoleConfigDTO = {
    enabled: row.coachEnabled,
    name: row.coachName,
    roleLabel: row.coachRoleLabel,
    avatar: row.coachAvatar,
    accent: row.coachAccent,
    perks: coachPerks,
    weeklyUsdc: Number(row.coachWeeklyUsdc),
    miningFeePct,
    staminaRecoveryPerHour,
    dailyRestStamina: extra.dailyRestStamina ?? 100,
    matchStaminaCost: extra.matchStaminaCost ?? 20,
    matchCooldownSec: extra.matchCooldownSec ?? 60,
    trainingStaminaCost: extra.trainingStaminaCost ?? 8,
    specialStaminaCost: extra.specialStaminaCost ?? 5,
  };

  return {
    treasurer,
    coach,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt.toISOString(),
  };
}
