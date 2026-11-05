import { buildRivalSlots, type LineupPlayerDTO, type StadiumSlot } from '@mll/shared';
import { StadiumMatchCanvas } from '../stadium/StadiumMatchCanvas';

// The redesigned arena keeps the match geometry used by the generated card sprites.
// A 4–3–3 on each half keeps the demo spread across the grass as players move.
const DEMO_ROSTER: Array<{ card: string; role: NonNullable<StadiumSlot['role']> }> = [
  { card: 'comum-14', role: 'GK' },
  { card: 'comum-04', role: 'LAT' },
  { card: 'comum-01', role: 'DEF' },
  { card: 'comum-05', role: 'DEF' },
  { card: 'comum-08', role: 'LAT' },
  { card: 'comum-02', role: 'MID' },
  { card: 'comum-06', role: 'MID' },
  { card: 'comum-10', role: 'MID' },
  { card: 'comum-03', role: 'FW' },
  { card: 'comum-07', role: 'FW' },
  { card: 'comum-11', role: 'FW' },
];

const HOME_SLOTS = DEMO_ROSTER.map(({ card, role }) => {
  const slot: StadiumSlot = { id: `landing-${card}`, role, xPct: 50, yPct: 68, label: role };
  const player: LineupPlayerDTO = {
    id: `landing-${card}`,
    kind: 'base',
    imageUrl: `/uploads/items/catalog/${card}.png`,
    rarity: 'common',
    position: role,
    name: `Comum #${card.slice(-2)}`,
    overwall: 5,
    stamina: 100,
  };
  return { slot, player };
});
const AWAY_SLOTS = buildRivalSlots();

export function LandingFieldAnimation() {
  return (
    <div
      className="landing-field-animation relative mx-auto w-full max-w-4xl overflow-hidden rounded-xl border border-slate-500/50"
    >
      <StadiumMatchCanvas
        imageUrl="/ui/stadiums/arena-overcast-v1.webp"
        animatedBackdrop
        slots={HOME_SLOTS}
        opponents={AWAY_SLOTS}
        labels={false}
      />
    </div>
  );
}
