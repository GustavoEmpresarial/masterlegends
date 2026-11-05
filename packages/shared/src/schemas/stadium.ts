import { z } from 'zod';
import type { PlayerAttributes } from '../economy/attributes.js';

export const STADIUM_SLOT_ROLES = ['GK', 'DEF', 'LAT', 'MID', 'FW', 'DECOR'] as const;
export type StadiumSlotRole = (typeof STADIUM_SLOT_ROLES)[number];

export const MAX_STADIUM_SLOTS = 30;

export const stadiumSlotSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(32),
  xPct: z.number().min(0).max(100),
  yPct: z.number().min(0).max(100),
  role: z.enum(STADIUM_SLOT_ROLES).optional(),
  /** home = seu time. away = marcador do adversário, não entra na escalação. */
  side: z.enum(['home', 'away']).optional(),
  zIndex: z.number().int().min(0).max(999).optional(),
});

export type StadiumSlot = z.infer<typeof stadiumSlotSchema>;

export const stadiumSlotsSchema = z
  .array(stadiumSlotSchema)
  .max(MAX_STADIUM_SLOTS, { message: `max_${MAX_STADIUM_SLOTS}_slots` });

export const stadiumTemplateCreateSchema = z.object({
  name: z.string().min(1).max(64),
  slots: stadiumSlotsSchema,
  priceUsdc: z.number().nonnegative().nullable().optional(),
  active: z.boolean().default(false),
  isDefault: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  farmBonusPct: z.number().min(0).max(10).optional(),
  requireRareStarters: z.number().int().min(0).max(50).optional(),
  requireMinOverwall: z.number().int().min(0).max(1_000_000).optional(),
  requireOwnedTemplateId: z.string().uuid().nullable().optional(),
  requirementNote: z.string().max(280).nullable().optional(),
});

export const stadiumTemplatePatchSchema = stadiumTemplateCreateSchema.partial();

export const stadiumTemplateActiveSchema = z.object({
  active: z.boolean(),
});

export interface StadiumTemplateDTO {
  id: string;
  name: string;
  imageUrl: string;
  slots: StadiumSlot[];
  priceUsdc: number | null;
  active: boolean;
  isDefault: boolean;
  sortOrder: number;
  farmBonusPct: number;
  requireRareStarters: number;
  requireMinOverwall: number;
  requireOwnedTemplateId: string | null;
  requirementNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export function parseStadiumSlotsJson(raw: string): StadiumSlot[] {
  const parsed = JSON.parse(raw) as unknown;
  return stadiumSlotsSchema.parse(parsed);
}

export const MAX_LINEUP_STARTERS = 11;

export const lineupAssignmentSchema = z.object({
  playerId: z.string().min(1).max(64),
  kind: z.enum(['base', 'nft']),
});

export type LineupAssignment = z.infer<typeof lineupAssignmentSchema>;

export const lineupPatchSchema = z.object({
  assignments: z.record(z.string(), lineupAssignmentSchema),
});

export interface StadiumTemplatePublicDTO {
  id: string;
  name: string;
  imageUrl: string;
  /** Vestiário: imagem estática ou vídeo em loop */
  backgroundType?: 'image' | 'video';
  slots: StadiumSlot[];
}

export interface LineupPlayerDTO {
  id: string;
  kind: 'base' | 'nft';
  rarity: string;
  overwall: number;
  position: string;
  name?: string | null;
  imageUrl?: string | null;
  tokenId?: string;
  stamina?: number;
  staminaMax?: number;
  source?: string | null;
  expiresAt?: string | null;
  /** Acquisition cost (USDC-eq). 0 / missing = no ROI career. */
  costBasisUsdc?: number;
  lifetimeEarnedUsdc?: number;
  /** Career age 18–40 from ROI. */
  age?: number;
  retireAge?: number;
  roiPct?: number;
  createdAt?: string | null;
  listed?: boolean;
  inLineup?: boolean;
  ownerName?: string | null;
  attributes?: PlayerAttributes | null;
  positionPower?: number;
  /** True when GMT is locked so this player can enter the XI. */
  staked?: boolean;
  /** GMT required / locked for this rarity. */
  stakeGmt?: number;
  /** When the active stake started. */
  stakedAt?: string | null;
  /** Unstaked pitch window: 5 minutes, then locked until 24 hours from the start. */
  freeField?: import('../economy/free-field.js').FreeFieldWindowDTO;
}

export const STAMINA_MAX = 100;


export interface StadiumSlotViewDTO {
  slot: StadiumSlot;
  player: LineupPlayerDTO | null;
}

export interface StadiumViewDTO {
  template: StadiumTemplatePublicDTO;
  assignments: Record<string, LineupAssignment>;
  slots: StadiumSlotViewDTO[];
  stadiumLvl: number;
  /** Visual away XI on the same pitch (not part of the club lineup). */
  opponents?: StadiumSlotViewDTO[];
  opponentClubName?: string;
}

export function parseLineupAssignments(raw: unknown): Record<string, LineupAssignment> {
  if (raw === null || raw === undefined) return {};
  const parsed = z.record(z.string(), lineupAssignmentSchema).parse(raw);
  return parsed;
}

/**
 * Lineup is stored with vestiário slot IDs; stadium templates may use different IDs.
 * Remap by role order (GK/DEF/LAT/MID/FW) so the XI survives stadium switches.
 */
export function remapAssignmentsToDisplaySlots(
  sourceSlots: StadiumSlot[],
  displaySlots: StadiumSlot[],
  assignments: Record<string, LineupAssignment>,
): Record<string, LineupAssignment> {
  const displayIds = new Set(displaySlots.map((s) => s.id));
  const sourceIds = Object.keys(assignments);
  if (sourceIds.length > 0 && sourceIds.every((id) => displayIds.has(id))) {
    return assignments;
  }

  const byRole: Record<string, LineupAssignment[]> = { GK: [], DEF: [], LAT: [], MID: [], FW: [] };
  for (const slot of sourceSlots) {
    if (!slot.role || slot.role === 'DECOR') continue;
    const assignment = assignments[slot.id];
    if (!assignment) continue;
    (byRole[slot.role] ??= []).push(assignment);
  }

  const roleIdx: Record<string, number> = { GK: 0, DEF: 0, LAT: 0, MID: 0, FW: 0 };
  const mapped: Record<string, LineupAssignment> = {};
  for (const slot of displaySlots) {
    if (!slot.role || slot.role === 'DECOR') continue;
    const idx = roleIdx[slot.role] ?? 0;
    roleIdx[slot.role] = idx + 1;
    const assignment = byRole[slot.role]?.[idx];
    if (assignment) mapped[slot.id] = assignment;
  }
  return mapped;
}
