import { z } from 'zod';

export const officeStaffPerkSchema = z.object({
  icon: z.string().max(8),
  text: z.string().max(500),
});

export type OfficeStaffPerkDTO = z.infer<typeof officeStaffPerkSchema>;

export const officeStaffRolePatchSchema = z.object({
  enabled: z.boolean().optional(),
  name: z.string().min(1).max(64).optional(),
  roleLabel: z.string().min(1).max(128).optional(),
  avatar: z.string().min(1).max(512).optional(),
  accent: z.string().min(1).max(32).optional(),
  perks: z.array(officeStaffPerkSchema).min(1).max(8).optional(),
  weeklyUsdc: z.number().min(0).optional(),
});

export const coachStaffRolePatchSchema = officeStaffRolePatchSchema.extend({
  miningFeePct: z.number().min(0).max(1).optional(),
  staminaRecoveryPerHour: z.number().int().min(0).max(200).optional(),
  dailyRestStamina: z.number().int().min(0).max(100).optional(),
  matchStaminaCost: z.number().int().min(0).max(100).optional(),
  matchCooldownSec: z.number().int().min(0).max(86400).optional(),
  trainingStaminaCost: z.number().int().min(0).max(100).optional(),
  specialStaminaCost: z.number().int().min(0).max(100).optional(),
});

export const officeStaffConfigPatchSchema = z.object({
  treasurer: officeStaffRolePatchSchema.optional(),
  coach: coachStaffRolePatchSchema.optional(),
});

export const officeStaffAvatarRoleSchema = z.enum(['treasurer', 'coach']);

export type OfficeStaffAvatarRole = z.infer<typeof officeStaffAvatarRoleSchema>;

export interface OfficeStaffRoleConfigDTO {
  enabled: boolean;
  name: string;
  roleLabel: string;
  avatar: string;
  accent: string;
  perks: OfficeStaffPerkDTO[];
  weeklyUsdc: number;
}

export interface CoachStaffRoleConfigDTO extends OfficeStaffRoleConfigDTO {
  miningFeePct: number;
  staminaRecoveryPerHour: number;
  dailyRestStamina: number;
  matchStaminaCost: number;
  matchCooldownSec: number;
  trainingStaminaCost: number;
  specialStaminaCost: number;
}

export interface OfficeStaffConfigDTO {
  treasurer: OfficeStaffRoleConfigDTO;
  coach: CoachStaffRoleConfigDTO;
  updatedBy: string | null;
  updatedAt: string;
}

export const DEFAULT_TREASURER_PERKS: OfficeStaffPerkDTO[] = [
  { icon: '◆', text: 'Cargo simbólico — funções financeiras serão liberadas em breve.' },
  { icon: '◆', text: 'Mantenha contratado para garantir o cargo antes dos benefícios chegarem.' },
];

export const DEFAULT_COACH_PERKS: OfficeStaffPerkDTO[] = [
  { icon: '⚡', text: 'Ativa a recuperação passiva de stamina no CT ({recoveryPerHour}+ por hora).' },
  { icon: '⚠', text: 'Cobra {miningFeePct}% sobre cada cota de patrocínio/receita do elenco enquanto contratado.' },
];

/** Avatar armazenado como URL de upload ou caminho /uploads/... */
export function isOfficeStaffImageAvatar(avatar: string): boolean {
  return avatar.startsWith('/uploads/') || avatar.startsWith('http://') || avatar.startsWith('https://');
}
