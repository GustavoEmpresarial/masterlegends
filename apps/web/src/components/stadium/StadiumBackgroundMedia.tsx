import { isVestiarioVideoBackground, type VestiarioBackgroundType } from '@mll/shared';
import { resolveUploadUrl } from '../../lib/resolveUploadUrl';

interface StadiumBackgroundMediaProps {
  url: string;
  backgroundType?: VestiarioBackgroundType | null;
  alt?: string;
  className?: string;
  onAspectRatioChange?: (ratio: number) => void;
}

export function StadiumBackgroundMedia({
  url,
  backgroundType,
  alt = '',
  onAspectRatioChange,
  className = 'absolute inset-0 h-full w-full object-contain pointer-events-none select-none',
}: StadiumBackgroundMediaProps) {
  const src = resolveUploadUrl(url);
  const isVideo = isVestiarioVideoBackground(url, backgroundType);

  const mediaStyle = {
    imageRendering: 'auto' as const,
    transform: 'translateZ(0)',
    backfaceVisibility: 'hidden' as const,
  };

  if (isVideo) {
    return (
      <video
        src={src}
        onLoadedMetadata={(event) => {
          const { videoWidth, videoHeight } = event.currentTarget;
          if (videoWidth > 0 && videoHeight > 0) onAspectRatioChange?.(videoWidth / videoHeight);
        }}
        className={className}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        aria-hidden={!alt}
        style={mediaStyle}
      />
    );
  }

  return (
    <img
      src={src}
      onLoad={(event) => {
        const { naturalWidth, naturalHeight } = event.currentTarget;
        if (naturalWidth > 0 && naturalHeight > 0) onAspectRatioChange?.(naturalWidth / naturalHeight);
      }}
      alt={alt}
      className={className}
      style={mediaStyle}
      draggable={false}
    />
  );
}
