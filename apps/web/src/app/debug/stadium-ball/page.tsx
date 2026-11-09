'use client';

import { useMemo } from 'react';
import type { LineupPlayerDTO, StadiumSlot } from '@mll/shared';
import { StadiumPlayfieldLayer } from '../../../components/stadium/StadiumPlayfieldLayer';

const ROLES: Array<StadiumSlot['role']> = [
  'GK', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'FW', 'FW', 'FW',
];
const POS = [
  { x: 12, y: 55 }, { x: 28, y: 28 }, { x: 28, y: 45 }, { x: 28, y: 65 }, { x: 28, y: 82 },
  { x: 50, y: 35 }, { x: 50, y: 55 }, { x: 50, y: 75 },
  { x: 72, y: 30 }, { x: 72, y: 55 }, { x: 72, y: 80 },
];

/** Public runtime harness for ball circulation (no auth).
 *  ?n=1 → single starter (ghost partners). ?n=11 → full XI.
 */
export function DebugStadiumBallPage() {
  const n = (() => {
    try {
      const raw = new URLSearchParams(window.location.search).get('n');
      const v = raw ? Number(raw) : 11;
      return Number.isFinite(v) ? Math.max(1, Math.min(11, Math.floor(v))) : 11;
    } catch {
      return 11;
    }
  })();

  const slots = useMemo(
    () =>
      ROLES.map((role, i) => {
        const pos = POS[i]!;
        const slot: StadiumSlot = {
          id: `dbg-${i}`,
          role,
          xPct: pos.x,
          yPct: pos.y,
          label: role ?? 'FW',
        };
        if (i >= n) return { slot, player: null as LineupPlayerDTO | null };
        const player: LineupPlayerDTO = {
          id: `dbg-player-${i}`,
          kind: 'base',
          rarity: 'common',
          overwall: 350 + i * 50,
          position: role ?? 'FW',
          name: `${role}-${i}`,
          age: 18,
        };
        return { slot, player };
      }),
    [n],
  );

  return (
    <div className="min-h-screen bg-black p-4">
      <p className="retro-text text-sm mb-2 text-center" style={{ color: '#aaa' }}>
        debug stadium-ball · starters={n} · use ?n=1 for thin lineup
      </p>
      <div
        className="relative w-full max-w-4xl mx-auto overflow-hidden"
        style={{ aspectRatio: '16 / 10', background: '#5a4632' }}
      >
        <StadiumPlayfieldLayer slots={slots} livePlay />
      </div>
    </div>
  );
}
