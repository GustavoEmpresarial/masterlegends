import type { ClubRankingFieldSlotDTO, LineupPlayerDTO, StadiumSlot } from '@mll/shared';
import { StadiumBackgroundMedia } from '../stadium/StadiumBackgroundMedia';
import { StadiumPlayfieldLayer } from '../stadium/StadiumPlayfieldLayer';

interface RankingFieldCanvasProps {
  imageUrl: string;
  slots: ClubRankingFieldSlotDTO[];
}

function toStadiumSlots(
  slots: ClubRankingFieldSlotDTO[],
): Array<{ slot: StadiumSlot; player: LineupPlayerDTO | null }> {
  return slots.map(({ slot, player }) => ({
    slot: {
      id: slot.id,
      label: slot.label,
      xPct: slot.xPct,
      yPct: slot.yPct,
      role: slot.role as StadiumSlot['role'],
      zIndex: slot.zIndex,
    },
    player: player
      ? {
          id: player.id,
          kind: player.kind,
          rarity: player.rarity,
          overwall: player.overwall,
          position: player.position,
          name: player.name,
          imageUrl: player.imageUrl,
        }
      : null,
  }));
}

/** Same coded pixel playfield as Estádio — used in ranking club modal. */
export function RankingFieldCanvas({ imageUrl, slots }: RankingFieldCanvasProps) {
  const mapped = toStadiumSlots(slots);
  const hasPlayers = mapped.some((s) => s.player && s.slot.role !== 'DECOR');

  return (
    <div
      className="ranking-field stadium-field-live relative w-full mx-auto rounded pixel-box overflow-hidden"
      style={{ aspectRatio: '16 / 10', borderColor: 'var(--green)' }}
    >
      {imageUrl ? (
        <StadiumBackgroundMedia
          url={imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover pointer-events-none select-none"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background:
              'repeating-linear-gradient(0deg, #14532d 0px, #14532d 28px, #166534 28px, #166534 56px)',
          }}
        />
      )}

      {hasPlayers && <StadiumPlayfieldLayer slots={mapped} livePlay />}
    </div>
  );
}
