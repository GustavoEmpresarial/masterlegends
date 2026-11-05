import { useEffect, useState, type CSSProperties } from 'react';
import { getGearMedia } from './gearMedia';

/** A complete animated image, never a strip of adjacent sprite frames. */
export function GearSprite({
  src,
  className,
  style,
  animate = true,
  onError,
}: {
  src: string;
  className?: string;
  style?: CSSProperties;
  animate?: boolean;
  onError?: () => void;
}) {
  const media = getGearMedia(src);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const still = !animate || failed;

  return (
    <picture
      aria-hidden="true"
      className={className}
      style={{
        display: 'block',
        position: 'relative',
        maxWidth: '100%',
        aspectRatio: '16 / 9',
        overflow: 'hidden',
        minHeight: 0,
        ...style,
      }}
    >
      {!still && <source media="(prefers-reduced-motion: reduce)" srcSet={media.poster} />}
      <img
        src={still ? media.poster : media.animation}
        alt=""
        width={576}
        height={324}
        decoding="async"
        draggable={false}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
        onError={() => {
          if (!still && media.poster !== media.animation) setFailed(true);
          else onError?.();
        }}
      />
    </picture>
  );
}
