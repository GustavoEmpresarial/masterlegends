import { motion } from 'framer-motion';
import { resolveUploadUrl } from '../../lib/resolveUploadUrl';
import {
  getBonecoKit,
  normalizeBonecoRarity,
  type BonecoPose,
  type BonecoPosition,
} from './stadiumBonecoTheme';

export interface StadiumPixelBonecoProps {
  rarity?: string | null;
  position: BonecoPosition;
  pose?: BonecoPose;
  facing?: 1 | -1;
  size?: number;
  /** Player NFT / item art — preferred over coded fallback. */
  imageUrl?: string | null;
  /** Stable seed for skin/hair variation on fallback. */
  seed?: string;
  className?: string;
}

/** Field puppet: real NFT sprite when available, else dense pixel SVG. */
export function StadiumPixelBoneco({
  rarity,
  position,
  pose = 'idle',
  facing = 1,
  size = 64,
  imageUrl,
  seed = 'p',
  className,
}: StadiumPixelBonecoProps) {
  const kit = getBonecoKit(rarity, position, seed);
  const rarityKey = normalizeBonecoRarity(rarity);
  const resolved = imageUrl ? resolveUploadUrl(imageUrl) : '';
  const showAura = rarityKey !== 'common';
  const showParticles =
    rarityKey === 'epic' || rarityKey === 'legendary' || rarityKey === 'mythic';

  const bodyAnim =
    pose === 'run'
      ? { y: [0, -3, 0, -2, 0], rotate: [0, -2, 0, 2, 0], skewX: [0, -3, 0, 3, 0] }
      : pose === 'kick'
        ? { y: [0, -8, -2], rotate: [0, -12, -6], skewX: [0, 8, 4] }
        : { y: [0, -2, 0, -1, 0], rotate: 0, skewX: 0 };

  const bodyTransition =
    pose === 'run'
      ? { duration: 0.38, repeat: Infinity, ease: 'easeInOut' as const }
      : pose === 'kick'
        ? { duration: 0.28, ease: 'easeOut' as const }
        : { duration: 1.8, repeat: Infinity, ease: 'easeInOut' as const };

  return (
    <div
      className={`stadium-boneco stadium-boneco--${pose} stadium-boneco--${rarityKey} ${className ?? ''}`}
      style={{
        width: size,
        height: Math.round(size * 1.28),
        position: 'relative',
        transform: `scaleX(${facing})`,
        filter: showAura
          ? `drop-shadow(0 0 ${6 + (kit.glow ? 4 : 0)}px ${kit.glow}aa)`
          : 'drop-shadow(0 4px 8px rgba(0,0,0,0.65))',
      }}
      aria-hidden
    >
      {/* Rarity ring */}
      <div
        className="stadium-boneco__ring"
        style={{
          borderColor: `${kit.glow}${rarityKey === 'common' ? '55' : 'cc'}`,
          boxShadow:
            rarityKey === 'common'
              ? 'none'
              : `0 0 ${10 + (showParticles ? 8 : 0)}px ${kit.glow}77, inset 0 0 10px ${kit.glow}33`,
        }}
      />

      {showAura && (
        <div
          className="stadium-boneco__aura"
          style={{
            background: `radial-gradient(ellipse at 50% 70%, ${kit.glow}55 0%, transparent 70%)`,
          }}
        />
      )}

      {showParticles && (
        <div className="stadium-boneco__particles" style={{ color: kit.glow }}>
          <span />
          <span />
          <span />
          <span />
        </div>
      )}

      <motion.div
        className="stadium-boneco__body"
        animate={bodyAnim}
        transition={bodyTransition}
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
        }}
      >
        {resolved ? (
          <img
            src={resolved}
            alt=""
            draggable={false}
            className="stadium-boneco__sprite"
            style={{
              width: '92%',
              height: '92%',
              objectFit: 'contain',
              objectPosition: 'center bottom',
              imageRendering: 'pixelated',
            }}
          />
        ) : (
          <CodedPixelPlayer kit={kit} position={position} pose={pose} rarityKey={rarityKey} />
        )}
      </motion.div>
    </div>
  );
}

type Kit = ReturnType<typeof getBonecoKit>;

/** Dense 32×48 pixel footballer with outline + shading. */
function CodedPixelPlayer({
  kit,
  position,
  pose,
  rarityKey,
}: {
  kit: Kit;
  position: BonecoPosition;
  pose: BonecoPose;
  rarityKey: string;
}) {
  const isGk = position === 'GK' || position === 'GOL';
  const o = kit.outline;

  return (
    <svg
      viewBox="0 0 32 48"
      width="100%"
      height="100%"
      shapeRendering="crispEdges"
      style={{ imageRendering: 'pixelated', display: 'block', overflow: 'visible' }}
    >
      {/* ── Hair ── */}
      <rect x="10" y="2" width="12" height="2" fill={o} />
      <rect x="8" y="4" width="16" height="2" fill={o} />
      <rect x="10" y="3" width="12" height="2" fill={kit.hair} />
      <rect x="9" y="5" width="14" height="2" fill={kit.hair} />
      <rect x="11" y="3" width="4" height="1" fill={kit.hairHighlight} />
      {(rarityKey === 'legendary' || rarityKey === 'mythic') && (
        <rect x="8" y="6" width="2" height="4" fill={kit.hair} />
      )}

      {/* ── Head ── */}
      <rect x="9" y="7" width="14" height="10" fill={o} />
      <rect x="10" y="8" width="12" height="8" fill={kit.skin} />
      <rect x="10" y="8" width="12" height="2" fill={kit.skinHighlight} opacity={0.55} />
      <rect x="10" y="14" width="12" height="2" fill={kit.skinShadow} opacity={0.45} />
      {/* Eyes */}
      <rect x="12" y="10" width="2" height="2" fill="#1a1520" />
      <rect x="18" y="10" width="2" height="2" fill="#1a1520" />
      <rect x="12" y="10" width="1" height="1" fill="#fff" opacity={0.5} />
      <rect x="18" y="10" width="1" height="1" fill="#fff" opacity={0.5} />
      {/* Brows */}
      <rect x="12" y="9" width="2" height="1" fill={kit.hair} />
      <rect x="18" y="9" width="2" height="1" fill={kit.hair} />
      {/* Nose / mouth */}
      <rect x="15" y="12" width="2" height="1" fill={kit.skinShadow} />
      <rect x="14" y="14" width="4" height="1" fill="#b07060" />

      {/* Neck */}
      <rect x="13" y="17" width="6" height="2" fill={o} />
      <rect x="14" y="17" width="4" height="2" fill={kit.skin} />

      {/* ── Torso ── */}
      <rect x="7" y="19" width="18" height="12" fill={o} />
      <rect x="8" y="20" width="16" height="10" fill={kit.shirt} />
      <rect x="8" y="20" width="16" height="2" fill={kit.shirtHighlight} />
      <rect x="8" y="28" width="16" height="2" fill={kit.shirtShadow} />
      {/* Collar / rarity stripe */}
      <rect x="8" y="20" width="16" height="1" fill={kit.accent} />
      <rect x="14" y="22" width="4" height="4" fill={kit.shirtHighlight} opacity={0.35} />
      {/* Side shading */}
      <rect x="8" y="22" width="2" height="6" fill={kit.shirtShadow} opacity={0.5} />
      <rect x="22" y="22" width="2" height="6" fill={kit.shirtHighlight} opacity={0.35} />

      {/* Arms */}
      <Arm
        side="left"
        kit={kit}
        isGk={isGk}
        pose={pose}
        outline={o}
      />
      <Arm
        side="right"
        kit={kit}
        isGk={isGk}
        pose={pose}
        outline={o}
      />

      {/* Shorts */}
      <rect x="9" y="30" width="14" height="5" fill={o} />
      <rect x="10" y="31" width="12" height="3" fill={kit.shorts} />
      <rect x="15" y="31" width="2" height="3" fill={o} opacity={0.5} />

      {/* Legs */}
      <Leg side="left" kit={kit} pose={pose} outline={o} />
      <Leg side="right" kit={kit} pose={pose} outline={o} />
    </svg>
  );
}

function Arm({
  side,
  kit,
  isGk,
  pose,
  outline,
}: {
  side: 'left' | 'right';
  kit: Kit;
  isGk: boolean;
  pose: BonecoPose;
  outline: string;
}) {
  const left = side === 'left';
  const ox = left ? 4 : 24;
  const runRot = left ? [0, 18, 0, -18, 0] : [0, -18, 0, 18, 0];
  const kickRot = left ? -40 : 55;
  const origin = left ? '7px 21px' : '25px 21px';

  return (
    <motion.g
      animate={
        pose === 'run'
          ? { rotate: runRot }
          : pose === 'kick'
            ? { rotate: kickRot }
            : { rotate: [0, left ? -4 : 4, 0] }
      }
      transition={
        pose === 'run'
          ? { duration: 0.38, repeat: Infinity, ease: 'linear' }
          : pose === 'kick'
            ? { duration: 0.22, ease: 'easeOut' }
            : { duration: 2, repeat: Infinity, ease: 'easeInOut' }
      }
      style={{ transformOrigin: origin }}
    >
      <rect x={ox} y="20" width="4" height="8" fill={outline} />
      <rect x={ox + 1} y="21" width="2" height="6" fill={kit.skin} />
      {isGk ? (
        <>
          <rect x={ox} y="26" width="4" height="3" fill={outline} />
          <rect x={ox + 1} y="26" width="2" height="2" fill={kit.gloves} />
        </>
      ) : (
        <rect x={ox + 1} y="26" width="2" height="2" fill={kit.skinShadow} />
      )}
    </motion.g>
  );
}

function Leg({
  side,
  kit,
  pose,
  outline,
}: {
  side: 'left' | 'right';
  kit: Kit;
  pose: BonecoPose;
  outline: string;
}) {
  const left = side === 'left';
  const ox = left ? 10 : 18;
  const run = left
    ? { y: [0, -2, 0, 2, 0], rotate: [0, -14, 0, 14, 0] }
    : { y: [0, 2, 0, -2, 0], rotate: [0, 14, 0, -14, 0] };
  const kick = left
    ? { y: 0, rotate: -22, x: 0 }
    : { y: -2, rotate: 48, x: 2 };
  const origin = `${ox + 2}px 34px`;

  return (
    <motion.g
      animate={
        pose === 'run'
          ? run
          : pose === 'kick'
            ? kick
            : { y: 0, rotate: 0, x: 0 }
      }
      transition={
        pose === 'run'
          ? { duration: 0.38, repeat: Infinity, ease: 'linear' }
          : { duration: 0.2, ease: 'easeOut' }
      }
      style={{ transformOrigin: origin }}
    >
      {/* Thigh / sock */}
      <rect x={ox} y="34" width="4" height="7" fill={outline} />
      <rect x={ox + 1} y="35" width="2" height="5" fill={kit.socks} />
      {/* Boot */}
      <rect x={ox - (left ? 0 : 0)} y="41" width={left ? 5 : 6} height="4" fill={outline} />
      <rect x={ox + 1} y="42" width={left ? 3 : 4} height="2" fill={kit.boots} />
      <rect x={ox + (left ? 3 : 4)} y="42" width="1" height="1" fill="#444" />
    </motion.g>
  );
}
