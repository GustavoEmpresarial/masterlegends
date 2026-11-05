import type { PrismaClient } from '@prisma/client';
import { STAMINA_MAX } from '../../common/lib/stamina.js';

export interface StaminaRules {
  max: number;
  recoveryPerHour: number;
  dailyRestStamina: number;
  matchStaminaCost: number;
  matchCooldownSec: number;
  trainingStaminaCost: number;
  specialStaminaCost: number;
}

export const DEFAULT_STAMINA_RULES: StaminaRules = {
  max: STAMINA_MAX,
  recoveryPerHour: 24,
  dailyRestStamina: 100,
  matchStaminaCost: 20,
  matchCooldownSec: 60,
  trainingStaminaCost: 8,
  specialStaminaCost: 5,
};

type RulesRow = {
  coachStaminaRecoveryPerHour?: number | null;
  dailyRestStamina?: number | null;
  matchStaminaCost?: number | null;
  matchCooldownSec?: number | null;
  trainingStaminaCost?: number | null;
  specialStaminaCost?: number | null;
};

export async function getStaminaRules(prisma: PrismaClient): Promise<StaminaRules> {
  const store = prisma.platformConfig as { findUnique?: PrismaClient['platformConfig']['findUnique'] } | undefined;
  if (!store?.findUnique) return DEFAULT_STAMINA_RULES;

  const row = (await store.findUnique({ where: { id: 'default' } })) as RulesRow | null;
  if (!row) return DEFAULT_STAMINA_RULES;

  return {
    max: STAMINA_MAX,
    recoveryPerHour: row.coachStaminaRecoveryPerHour ?? DEFAULT_STAMINA_RULES.recoveryPerHour,
    dailyRestStamina: row.dailyRestStamina ?? DEFAULT_STAMINA_RULES.dailyRestStamina,
    matchStaminaCost: row.matchStaminaCost ?? DEFAULT_STAMINA_RULES.matchStaminaCost,
    matchCooldownSec: row.matchCooldownSec ?? DEFAULT_STAMINA_RULES.matchCooldownSec,
    trainingStaminaCost: row.trainingStaminaCost ?? DEFAULT_STAMINA_RULES.trainingStaminaCost,
    specialStaminaCost: row.specialStaminaCost ?? DEFAULT_STAMINA_RULES.specialStaminaCost,
  };
}
