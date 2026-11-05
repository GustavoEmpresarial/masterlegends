import manifest from './playerSpriteManifest.json';
import { playerSpriteFrame, type SpriteMotion } from './playerSpriteMotion';

// Generated animation poses: never read or segment card pixels in the browser.
const sprites: Readonly<Record<string, string>> = manifest;
const cache = new Map<string, HTMLImageElement>();

export function cardSpritePath(imageUrl: string): string | null {
  try {
    return sprites[new URL(imageUrl, 'https://mll.local').pathname] ?? null;
  } catch {
    return null;
  }
}

/** Shared stadium/locker renderer, with a fixed root at the boots. */
export function drawCardBoneco(
  ctx: CanvasRenderingContext2D,
  imageUrl: string,
  timeMs = 0,
  pose: 'idle' | 'run' | 'kick' = 'idle',
  motion?: SpriteMotion,
): boolean {
  const src = cardSpritePath(imageUrl);
  if (!src) return false;
  let img = cache.get(src);
  if (!img) {
    img = new Image();
    img.decoding = 'async';
    img.src = src;
    cache.set(src, img);
  }
  if (!img.complete || img.naturalWidth !== 1024 || img.naturalHeight !== 128) return false;
  const frame = playerSpriteFrame(pose, motion?.gaitMs ?? timeMs, motion?.reducedMotion);
  const height = 46;
  const foot = 120 / 128 * height;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, frame * 128, 0, 128, 128, -height / 2, 14 - foot, height, height);
  return true;
}
