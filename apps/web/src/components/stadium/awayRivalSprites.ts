/** Side-view #17. Eight walk frames, feet on the same baseline, torso centered. */

const idle = load('/ui/rivals/away-idle.png');
const run = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => load(`/ui/rivals/away-run-${i}.png`));
const kick = load('/ui/rivals/away-kick.png');

export type BonecoKit = 'yellow' | 'gold' | 'blue' | 'cyan' | 'green' | 'red';

const KIT_RGB: Record<Exclude<BonecoKit, 'yellow'>, [number, number, number]> = {
  gold: [245, 158, 11],
  blue: [29, 78, 216],
  cyan: [14, 116, 144],
  green: [21, 128, 61],
  red: [185, 28, 28],
};

const tintCache = new Map<string, HTMLCanvasElement>();

function load(src: string): HTMLImageElement {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  return img;
}

function ready(img: HTMLImageElement): boolean {
  return img.complete && img.naturalWidth > 0;
}

export function readyAwaySprites(): boolean {
  return ready(idle) && run.every(ready) && ready(kick);
}

function isJersey(r: number, g: number, b: number, a: number): boolean {
  return a > 20 && r > 200 && g > 150 && b < 20 && g > r * 0.55;
}

function tintFrame(img: HTMLImageElement, kit: Exclude<BonecoKit, 'yellow'>): HTMLCanvasElement {
  const key = `${img.src}:${kit}`;
  const cached = tintCache.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const c = canvas.getContext('2d');
  if (!c) return canvas;
  c.imageSmoothingEnabled = false;
  c.drawImage(img, 0, 0);
  const data = c.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  const [tr, tg, tb] = KIT_RGB[kit];
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i] ?? 0;
    const g = px[i + 1] ?? 0;
    const b = px[i + 2] ?? 0;
    const a = px[i + 3] ?? 0;
    if (!isJersey(r, g, b, a)) continue;
    const lum = (0.3 * r + 0.59 * g + 0.11 * b) / 220;
    px[i] = Math.max(0, Math.min(255, Math.round(tr * lum)));
    px[i + 1] = Math.max(0, Math.min(255, Math.round(tg * lum)));
    px[i + 2] = Math.max(0, Math.min(255, Math.round(tb * lum)));
  }
  c.putImageData(data, 0, 0);
  tintCache.set(key, canvas);
  return canvas;
}

/** Draw in the playfield local space (feet near y=14). Returns false until the frame is loaded. */
export function drawAwayRivalSprite(
  ctx: CanvasRenderingContext2D,
  pose: 'idle' | 'run' | 'kick',
  timeMs: number,
  kit: BonecoKit = 'yellow',
): boolean {
  const frames = pose === 'kick' ? [kick] : pose === 'run' ? run : [idle];
  const fps = pose === 'run' ? 12 : 8;
  const img = frames[Math.floor((timeMs / 1000) * fps) % frames.length] ?? idle;
  if (!ready(img)) return false;
  const source: CanvasImageSource = kit === 'yellow' ? img : tintFrame(img, kit);

  const height = 34;
  const srcW = kit === 'yellow' ? img.naturalWidth : (source as HTMLCanvasElement).width;
  const srcH = kit === 'yellow' ? img.naturalHeight : (source as HTMLCanvasElement).height;
  const width = Math.max(1, Math.round(height * (srcW / srcH)));
  const footFromTop = Math.round(height * ((srcH - 4) / srcH));
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, Math.round(-width / 2), 14 - footFromTop, width, height);
  return true;
}
