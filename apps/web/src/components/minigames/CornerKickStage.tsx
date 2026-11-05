import { useEffect, useState } from 'react';
import { StadiumPixelBoneco } from '../stadium/StadiumPixelBoneco';
import type { BonecoPose } from '../stadium/stadiumBonecoTheme';

/** Campo do estádio com um único boneco cobrando escanteio. */
export function CornerKickStage({
  imageUrl,
  rarity,
  position,
  seed,
}: {
  imageUrl?: string | null;
  rarity?: string | null;
  position?: string | null;
  seed?: string;
}) {
  const [pose, setPose] = useState<BonecoPose>('idle');

  useEffect(() => {
    const id = window.setInterval(() => {
      setPose('kick');
      window.setTimeout(() => setPose('idle'), 420);
    }, 1600);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        aspectRatio: '16 / 9',
        border: '3px solid var(--green)',
        borderRadius: 4,
        background: '#0a1a12',
      }}
    >
      <img
        src="/ui/stadiums/arena-vila.png?v=7"
        alt=""
        className="absolute inset-0 h-full w-full object-cover pointer-events-none select-none"
        draggable={false}
      />
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.05) 55%, rgba(0,0,0,0.35) 100%)',
        }}
      />

      {/* Bandeirinha do escanteio */}
      <div
        className="absolute"
        style={{ left: '11%', bottom: '16%', width: 2, height: 42, background: '#f8fafc' }}
        aria-hidden
      >
        <span
          style={{
            position: 'absolute',
            top: 0,
            left: 2,
            width: 16,
            height: 10,
            background: '#ef4444',
            clipPath: 'polygon(0 0, 100% 50%, 0 100%)',
          }}
        />
      </div>

      {/* Bola */}
      <div
        aria-hidden
        className="absolute rounded-full"
        style={{
          left: pose === 'kick' ? '18%' : '16%',
          bottom: pose === 'kick' ? '28%' : '22%',
          width: 14,
          height: 14,
          background: 'radial-gradient(circle at 35% 35%, #fff, #d4d4d4 55%, #111 56%)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.45)',
          transition: 'left 0.25s ease, bottom 0.25s ease',
        }}
      />

      <div className="absolute" style={{ left: '8%', bottom: '18%' }}>
        <StadiumPixelBoneco
          rarity={rarity ?? 'legendary'}
          position={(position as 'FW') || 'FW'}
          pose={pose}
          facing={1}
          size={96}
          imageUrl={imageUrl}
          seed={seed ?? 'corner'}
        />
      </div>

      <span
        className="absolute retro-text text-[11px] px-2 py-1"
        style={{
          right: 10,
          bottom: 10,
          color: '#fff',
          background: 'rgba(0,0,0,0.65)',
          border: '1px solid rgba(255,255,255,0.25)',
        }}
      >
        ESCANTEIO
      </span>
    </div>
  );
}
