import { useEffect, useRef } from 'react';
import type { PlayfieldActor } from '../stadium/stadiumPlayfieldDraw';
import { drawPlayfieldPlayer } from '../stadium/stadiumPlayfieldDraw';

/** Pixel footballer used when a card has no photo. Never a shield. */
export function PlayerPixelPortrait({
  rarity,
  position,
  name,
  overwall,
  seed,
  className = '',
}: {
  rarity: string;
  position: string;
  name?: string | null;
  overwall: number;
  seed: string;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    const actor: PlayfieldActor = {
      slotId: seed,
      xPct: 0,
      yPct: 0,
      rarity: rarity || 'common',
      position: position || 'MID',
      slotRole: position || 'MID',
      name: name?.trim() || position || 'Jogador',
      overwall,
      seed,
      index: 0,
      side: 'home',
    };
    drawPlayfieldPlayer(ctx, actor, canvas.width / 2, 168, 0, 'idle', 1, 5.2, undefined, { ground: false });
  }, [rarity, position, name, overwall, seed]);

  return (
    <canvas
      ref={ref}
      width={180}
      height={210}
      className={className}
      aria-hidden
    />
  );
}
