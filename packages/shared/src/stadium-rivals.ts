import type { LineupPlayerDTO, StadiumSlot, StadiumSlotViewDTO } from './schemas/stadium.js';

export const RIVAL_CLUB_NAME = 'Rival FC';

const RIVAL_XI: Array<{
  id: string;
  name: string;
  position: 'GK' | 'DEF' | 'LAT' | 'MID' | 'FW';
  rarity: string;
  overwall: number;
  label: string;
  xPct: number;
  yPct: number;
}> = [
  { id: 'rival-gk', name: 'Kovač', position: 'GK', rarity: 'epic', overwall: 81, label: 'GOL', xPct: 88, yPct: 64 },
  { id: 'rival-d1', name: 'Richter', position: 'LAT', rarity: 'rare', overwall: 74, label: 'LAT-1', xPct: 78, yPct: 48 },
  { id: 'rival-d2', name: 'Novak', position: 'DEF', rarity: 'rare', overwall: 76, label: 'ZAG-2', xPct: 80, yPct: 58 },
  { id: 'rival-d3', name: 'Bianchi', position: 'DEF', rarity: 'super-rare', overwall: 78, label: 'ZAG-3', xPct: 80, yPct: 72 },
  { id: 'rival-d4', name: 'Petrov', position: 'LAT', rarity: 'rare', overwall: 73, label: 'LAT-2', xPct: 78, yPct: 82 },
  { id: 'rival-m1', name: 'Ortega', position: 'MID', rarity: 'epic', overwall: 80, label: 'MEI-1', xPct: 68, yPct: 50 },
  { id: 'rival-m2', name: 'Müller', position: 'MID', rarity: 'legendary', overwall: 84, label: 'MEI-2', xPct: 66, yPct: 64 },
  { id: 'rival-m3', name: 'Chen', position: 'MID', rarity: 'super-rare', overwall: 77, label: 'MEI-3', xPct: 68, yPct: 78 },
  { id: 'rival-f1', name: 'Vargas', position: 'FW', rarity: 'epic', overwall: 82, label: 'ATA-1', xPct: 58, yPct: 52 },
  { id: 'rival-f2', name: 'Okonkwo', position: 'FW', rarity: 'legendary', overwall: 86, label: 'ATA-2', xPct: 56, yPct: 64 },
  { id: 'rival-f3', name: 'Rossi', position: 'FW', rarity: 'epic', overwall: 81, label: 'ATA-3', xPct: 58, yPct: 76 },
];

export function isAwaySlot(slot: { id: string; side?: string | null }): boolean {
  return slot.side === 'away' || slot.id.startsWith('rival-');
}

/** Posição inicial do adversário. O editor grava esses ids no estádio. */
export function defaultRivalSlots(): StadiumSlot[] {
  return RIVAL_XI.map((p, i) => ({
    id: p.id,
    label: p.label,
    xPct: p.xPct,
    yPct: p.yPct,
    role: p.position,
    side: 'away' as const,
    zIndex: 20 + i,
  }));
}

export function buildRivalSlots(placed: StadiumSlot[] = []): StadiumSlotViewDTO[] {
  const byId = new Map(placed.filter(isAwaySlot).map((slot) => [slot.id, slot]));
  return RIVAL_XI.map((p, i) => {
    const custom = byId.get(p.id);
    const player: LineupPlayerDTO = {
      id: p.id,
      kind: 'base',
      rarity: p.rarity,
      overwall: p.overwall,
      position: p.position,
      name: p.name,
      stamina: 100,
      staminaMax: 100,
    };
    return {
      slot: {
        id: p.id,
        label: custom?.label || p.label,
        xPct: custom?.xPct ?? p.xPct,
        yPct: custom?.yPct ?? p.yPct,
        role: p.position,
        side: 'away',
        zIndex: custom?.zIndex ?? 20 + i,
      },
      player,
    };
  });
}
