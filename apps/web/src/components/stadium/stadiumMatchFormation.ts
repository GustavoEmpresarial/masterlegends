import type { LineupPlayerDTO, StadiumSlot } from '@mll/shared';
import type { PlayfieldActor } from './stadiumPlayfieldDraw';

export interface MatchSlotView { slot: StadiumSlot; player: LineupPlayerDTO | null }

/** Place the real lineup on the grass, keeping missing slots empty. */
export function buildMatchActors(home: MatchSlotView[], away: MatchSlotView[] = []): PlayfieldActor[] {
  const actors: PlayfieldActor[] = [];
  for (const [rows, side] of [[home, 'home'], [away, 'away']] as const) {
    const groups: Record<'GK' | 'DEF' | 'MID' | 'FW', MatchSlotView[]> = { GK: [], DEF: [], MID: [], FW: [] };
    for (const row of rows) {
      if (!row.player || row.slot.role === 'DECOR') continue;
      const role = String(row.slot.role || row.player.position || 'MID').toUpperCase();
      const group = role === 'GK' || role === 'GOL' ? 'GK' : ['DEF', 'LAT', 'ZAG'].includes(role) ? 'DEF' : ['FW', 'ATA'].includes(role) ? 'FW' : 'MID';
      groups[group].push(row);
    }
    for (const role of ['GK', 'DEF', 'MID', 'FW'] as const) {
      const group = groups[role];
      group.forEach(({ slot, player }, i) => {
        const x = role === 'GK' ? 8 : role === 'DEF' ? (i === 0 || i === group.length - 1 ? 22 : 24) : role === 'MID' ? 35 : 45;
        const top = role === 'DEF' ? 51 : role === 'MID' ? 53 : 55;
        const bottom = role === 'DEF' ? 86 : role === 'MID' ? 83 : 81;
        const y = role === 'GK' || group.length === 1 ? 68 : top + i * (bottom - top) / (group.length - 1);
        actors.push({
          slotId: slot.id, xPct: side === 'away' ? 100 - x : x, yPct: y,
          name: player!.name || player!.position || 'Jogador', position: player!.position,
          slotRole: slot.role, imageUrl: side === 'home' ? player!.imageUrl : null,
          rarity: player!.rarity ?? 'common', overwall: player!.overwall,
          age: player!.age, seed: player!.id, index: actors.length, side,
        });
      });
    }
  }
  return actors;
}
