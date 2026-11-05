import { useEffect, useRef, useState } from 'react';
import type { LineupAssignment, LineupPlayerDTO, StadiumSlot } from '@mll/shared';
import {
  DRAG_PLAYER_MIME,
  decodeDragPlayer,
  type DragPlayerPayload,
} from '../../lib/stadiumConstants';
import { playerNickname } from '../../lib/playerNickname';
import { StadiumBackgroundMedia } from './StadiumBackgroundMedia';
import { StadiumAnimatedMarker } from './StadiumAnimatedMarker';
import { StadiumPlayfieldLayer, lockerPace } from './StadiumPlayfieldLayer';

interface SlotView {
  slot: StadiumSlot;
  player: LineupPlayerDTO | null;
}

interface StadiumCanvasProps {
  imageUrl: string;
  backgroundType?: 'image' | 'video';
  slots: SlotView[];
  opponents?: SlotView[];
  onAssign: (slotId: string, payload: DragPlayerPayload) => void;
  onSelectPlayer: (slotId: string) => void;
  onSelectEmptySlot?: (slotId: string) => void;
  highlightSlotId?: string | null;
  showBall?: boolean;
  aspectRatio?: string;
  /** Source image ratio. When the frame is wider, the picture is cropped top and bottom and slots follow. */
  imageAspect?: string;
  /** Stand the lineup on the locker-room floor instead of the pitch plane. */
  plantOnFloor?: boolean;
  /** Fill the parent box. Height stays whatever the parent set; width can grow. */
  fill?: boolean;
  /** Match pitch: stamina bar under each player, no name plate. */
  staminaBars?: boolean;
  /** Locker room keeps the + boxes. The match pitch does not. */
  showEmptySlots?: boolean;
}

function parseAspect(value: string): number {
  const [width, height] = value.split('/').map((part) => Number(part.trim()));
  if (!width || !height) return 16 / 10;
  return width / height;
}

/** Keep a slot on the visible strip when object-cover crops one axis. */
function mapCoverAxis(pct: number, visible: number): number {
  if (visible >= 0.999) return pct;
  const crop = (1 - visible) / 2;
  const mapped = ((pct / 100 - crop) / visible) * 100;
  return Math.min(98, Math.max(2, mapped));
}

export function StadiumCanvas({
  imageUrl,
  backgroundType,
  slots,
  opponents = [],
  onAssign,
  onSelectPlayer,
  onSelectEmptySlot,
  highlightSlotId = null,
  showBall = true,
  aspectRatio = '16 / 10',
  imageAspect,
  plantOnFloor = false,
  fill = false,
  staminaBars = false,
  showEmptySlots = true,
}: StadiumCanvasProps) {
  const slotSize = plantOnFloor ? '42px' : 'clamp(48px, 8vw, 88px)';
  const frameRef = useRef<HTMLDivElement>(null);
  const walkerRefs = useRef(new Map<string, HTMLDivElement>());
  const [mediaAspect, setMediaAspect] = useState<{ url: string; ratio: number } | null>(null);
  const [measuredAspect, setMeasuredAspect] = useState<number | null>(null);

  useEffect(() => {
    if (!fill) return;
    const el = frameRef.current;
    if (!el) return;
    const read = () => {
      const rect = el.getBoundingClientRect();
      if (rect.height > 0) {
        const next = Math.round((rect.width / rect.height) * 1000) / 1000;
        setMeasuredAspect((prev) => (prev != null && Math.abs(prev - next) < 0.002 ? prev : next));
      }
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, [fill]);

  useEffect(() => {
    if (!plantOnFloor) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduce = media.matches;
    const onChange = () => {
      reduce = media.matches;
    };
    media.addEventListener('change', onChange);
    let raf = 0;
    const tick = () => {
      const width = frameRef.current?.clientWidth ?? 0;
      const timeSec = performance.now() / 1000;
      walkerRefs.current.forEach((el) => {
        if (reduce || width < 2) {
          el.style.transform = '';
          return;
        }
        const home = Number(el.dataset.homeX || 50);
        const pace = lockerPace(el.dataset.walkSeed || 'p', Number(el.dataset.walkIndex || 0), timeSec, home);
        const dx = ((pace.xPct - home) / 100) * width;
        el.style.transform = `translate(-50%, -50%) translateX(${dx}px)`;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      media.removeEventListener('change', onChange);
    };
  }, [plantOnFloor]);

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(DRAG_PLAYER_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDrop = (e: React.DragEvent, slotId: string, role?: string) => {
    e.preventDefault();
    if (role === 'DECOR') return;
    const raw = e.dataTransfer.getData(DRAG_PLAYER_MIME);
    const payload = decodeDragPlayer(raw);
    if (payload) onAssign(slotId, payload);
  };

  const fieldSlots = plantOnFloor ? slots : [...slots, ...opponents];
  const sourceAspect = imageAspect ? parseAspect(imageAspect)
    : mediaAspect?.url === imageUrl ? mediaAspect.ratio : parseAspect(aspectRatio);
  const frameAspect = fill ? (measuredAspect ?? sourceAspect) : parseAspect(aspectRatio);
  const coverY = frameAspect > sourceAspect + 0.01;
  const coverX = frameAspect + 0.01 < sourceAspect;
  const cover = coverX || coverY;
  const placedSlots = fieldSlots.map(({ slot, player }) => {
    const isAway = String(slot.id).startsWith('rival-');
    // Locker slots are authored on this exact image in the admin editor.
    let x = plantOnFloor ? slot.xPct : (isAway ? Math.max(slot.xPct, 52) : Math.min(slot.xPct, 48));
    let y = slot.yPct;
    if (coverY) y = mapCoverAxis(y, sourceAspect / frameAspect);
    if (coverX) x = mapCoverAxis(x, frameAspect / sourceAspect);
    const placed = { xPct: x, yPct: y };
    return { slot: { ...slot, xPct: placed.xPct, yPct: placed.yPct }, player };
  });
  const hasAnyPlayer = placedSlots.some((s) => s.player && s.slot.role !== 'DECOR');

  return (
    <div
      ref={frameRef}
      className="relative w-full mx-auto rounded overflow-hidden pixel-box stadium-field-live"
      style={fill ? { height: '100%', borderColor: 'var(--green)' } : { aspectRatio, borderColor: 'var(--green)' }}
    >
      <StadiumBackgroundMedia
        url={imageUrl}
        onAspectRatioChange={(ratio) => setMediaAspect({ url: imageUrl, ratio })}
        backgroundType={backgroundType}
        alt="Estádio"
        className={`absolute inset-0 h-full w-full ${cover ? 'object-cover' : 'object-contain'} pointer-events-none select-none`}
      />

      {/* Canvas sprites — only when there are starters */}
      {hasAnyPlayer && (
        <StadiumPlayfieldLayer
          slots={placedSlots}
          livePlay={showBall && !plantOnFloor}
          plantOnFloor={plantOnFloor}
          useGivenPositions
          staminaBars={staminaBars}
        />
      )}

      {/* Hit targets + empty slots */}
      {placedSlots.map(({ slot, player }, idx) => {
        const isDecor = slot.role === 'DECOR';
        const isAway = String(slot.id).startsWith('rival-');
        if (isDecor && !player) return null;
        if (!showEmptySlots && !player) return null;
        const isHighlighted = highlightSlotId === slot.id;
        const canPick = !player && !isDecor && !isAway && !!onSelectEmptySlot;
        const occupied = !!player && !isDecor;

        return (
          <div
            key={slot.id}
            ref={
              plantOnFloor && occupied
                ? (node) => {
                    if (node) walkerRefs.current.set(slot.id, node);
                    else walkerRefs.current.delete(slot.id);
                  }
                : undefined
            }
            data-walk-seed={player?.id ?? ''}
            data-walk-index={idx}
            data-home-x={slot.xPct}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${slot.xPct}%`,
              top: `${slot.yPct}%`,
              zIndex: isHighlighted ? 40 : occupied ? 30 : 25,
            }}
            onDragOver={isDecor || isAway ? undefined : handleDragOver}
            onDrop={isDecor || isAway ? undefined : (e) => handleDrop(e, slot.id, slot.role)}
          >
            <button
              type="button"
              onClick={() => {
                if (isDecor || isAway) return;
                if (player) onSelectPlayer(slot.id);
                else onSelectEmptySlot?.(slot.id);
              }}
              className={`flex flex-col items-center justify-center touch-manipulation ${
                isAway
                  ? 'w-16 h-20 bg-transparent border-0 p-0 pointer-events-none'
                  : occupied
                    ? 'w-16 h-20 bg-transparent border-0 p-0 cursor-pointer'
                    : canPick
                      ? 'min-w-[52px] min-h-[64px] cursor-pointer'
                      : 'min-w-[52px] min-h-[64px] cursor-default'
              }`}
              title={
                player
                  ? `${playerNickname(player.name, player.id, player.position)} · ${player.overwall} · clique para ver`
                  : canPick
                    ? 'Toque para escolher jogador'
                    : 'Posição vazia'
              }
              aria-label={
                player
                  ? `${playerNickname(player.name, player.id, player.position)}, ${player.overwall} OW, ver detalhes`
                  : canPick
                    ? `Adicionar jogador em ${slot.label}`
                    : slot.label
              }
            >
              {occupied ? (
                <span className="sr-only">
                  {playerNickname(player?.name, player?.id, player?.position)}
                </span>
              ) : player && isDecor ? (
                <StadiumAnimatedMarker index={idx} active={false}>
                  <span
                    className="stadium-slot flex items-center justify-center"
                    style={{ width: slotSize, height: slotSize }}
                  >
                    <i className="bi bi-star-fill" aria-hidden />
                  </span>
                </StadiumAnimatedMarker>
              ) : isAway ? null : (
                <span
                  className="stadium-slot stadium-slot--empty flex flex-col items-center justify-center gap-0.5 shadow-lg"
                  style={{
                    width: slotSize,
                    height: slotSize,
                    borderColor: isHighlighted ? 'var(--green)' : undefined,
                    background: isHighlighted ? 'rgba(52,211,153,0.18)' : undefined,
                  }}
                >
                  <span aria-hidden style={{ fontSize: 'clamp(16px, 2.4vw, 22px)', lineHeight: 1 }}>
                    +
                  </span>
                  <span
                    style={{
                      fontSize: 'clamp(8px, 1.4vw, 11px)',
                      letterSpacing: '0.04em',
                      lineHeight: 1.1,
                      maxWidth: '100%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      paddingInline: 2,
                    }}
                  >
                    {slot.label}
                  </span>
                </span>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function assignmentsFromSlots(
  slots: Array<{ slot: StadiumSlot; player: LineupPlayerDTO | null }>,
): Record<string, LineupAssignment> {
  const out: Record<string, LineupAssignment> = {};
  for (const { slot, player } of slots) {
    if (player && slot.role !== 'DECOR') {
      out[slot.id] = { playerId: player.id, kind: player.kind };
    }
  }
  return out;
}
