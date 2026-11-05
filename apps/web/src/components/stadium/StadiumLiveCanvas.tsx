import type { LineupPlayerDTO, StadiumSlot } from '@mll/shared';
import { StadiumBackgroundMedia } from './StadiumBackgroundMedia';
import { StadiumPlayfieldLayer } from './StadiumPlayfieldLayer';

export interface StadiumLiveSlotView {
  slot: StadiumSlot;
  player: LineupPlayerDTO | null;
}

interface StadiumLiveCanvasProps {
  imageUrl: string;
  backgroundType?: 'image' | 'video';
  slots: StadiumLiveSlotView[];
  className?: string;
}

/** Campo ao vivo — só gramado + titulares animados (sem slots/UI de edição). */
export function StadiumLiveCanvas({
  imageUrl,
  backgroundType,
  slots,
  className = '',
}: StadiumLiveCanvasProps) {
  const hasPlayers = slots.some((s) => s.player && s.slot.role !== 'DECOR');

  return (
    <div
      className={`stadium-live-canvas stadium-field-live relative w-full h-full overflow-hidden ${className}`.trim()}
      style={{ borderColor: 'var(--green)' }}
    >
      {imageUrl ? (
        <StadiumBackgroundMedia
          url={imageUrl}
          backgroundType={backgroundType}
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
          aria-hidden
        />
      )}

      {hasPlayers && (
        <StadiumPlayfieldLayer slots={slots} livePlay useGivenPositions nameplates={false} staminaBars />
      )}
    </div>
  );
}
