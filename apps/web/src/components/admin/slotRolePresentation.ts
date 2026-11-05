import type { StadiumSlot, StadiumSlotRole } from '@mll/shared';

/** Shared by both template editors so every selectable position can also render. */
export const ROLE_EMOJI: Record<StadiumSlotRole, string> = {
  GK: 'bi-hand-index-thumb-fill',
  DEF: 'bi-shield-fill',
  LAT: 'bi-arrow-left-right',
  MID: 'bi-bullseye',
  FW: 'bi-shield-fill',
  DECOR: 'bi-gear-fill',
};

export const ROLE_LABEL: Record<StadiumSlotRole, string> = {
  GK: 'Goleiro', DEF: 'Defesa', LAT: 'Lateral', MID: 'Meio', FW: 'Ataque', DECOR: 'Decorativo',
};

export const ROLE_STYLE: Record<StadiumSlotRole, { ring: string; bg: string; text: string; dot: string }> = {
  GK: { ring: 'ring-amber-400/80', bg: 'bg-amber-500/20 border-amber-400/60', text: 'text-amber-200', dot: 'bg-amber-400' },
  DEF: { ring: 'ring-sky-400/80', bg: 'bg-sky-500/20 border-sky-400/60', text: 'text-sky-200', dot: 'bg-sky-400' },
  LAT: { ring: 'ring-violet-400/80', bg: 'bg-violet-500/20 border-violet-400/60', text: 'text-violet-200', dot: 'bg-violet-400' },
  MID: { ring: 'ring-emerald-400/80', bg: 'bg-emerald-500/20 border-emerald-400/60', text: 'text-emerald-200', dot: 'bg-emerald-400' },
  FW: { ring: 'ring-rose-400/80', bg: 'bg-rose-500/20 border-rose-400/60', text: 'text-rose-200', dot: 'bg-rose-400' },
  DECOR: { ring: 'ring-slate-400/80', bg: 'bg-slate-500/20 border-slate-400/60', text: 'text-slate-200', dot: 'bg-slate-400' },
};

export const ROLE_ORDER: StadiumSlotRole[] = ['GK', 'DEF', 'LAT', 'MID', 'FW', 'DECOR'];

/** Keep older/malformed template data renderable without modifying stored slots. */
export function slotRoleOf(slot: Pick<StadiumSlot, 'role'>): StadiumSlotRole {
  const role = slot.role;
  return typeof role === 'string' && Object.prototype.hasOwnProperty.call(ROLE_STYLE, role) ? role : 'MID';
}
