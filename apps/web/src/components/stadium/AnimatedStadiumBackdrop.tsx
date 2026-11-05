import { useEffect, useRef } from 'react';
import { resolveUploadUrl } from '../../lib/resolveUploadUrl';

// Coordinates belong to arena-overcast-v1 (1536 × 1024). Masks keep the
// spectators' movement off the roof, stairs, barriers and playable pitch.
const crowdSections = [
  [[0, 260], [46, 255], [46, 332], [0, 366]],
  [[83, 355], [158, 280], [181, 277], [127, 356]],
  [[195, 279], [394, 275], [369, 357], [166, 357]],
  [[428, 275], [647, 275], [623, 357], [402, 357]],
  [[891, 275], [1107, 275], [1133, 357], [914, 357]],
  [[1141, 275], [1339, 279], [1370, 357], [1167, 357]],
  [[1357, 278], [1378, 281], [1454, 355], [1408, 355]],
  [[1490, 256], [1536, 260], [1536, 366], [1490, 332]],
  [[210, 235], [267, 214], [336, 214], [336, 245], [210, 245]],
  [[367, 215], [506, 215], [506, 245], [365, 245]],
  [[537, 214], [643, 214], [643, 245], [536, 245]],
  [[675, 214], [866, 214], [866, 242], [675, 242]],
  [[896, 214], [1005, 214], [1005, 245], [896, 245]],
  [[1037, 215], [1173, 215], [1176, 245], [1037, 245]],
  [[1209, 215], [1271, 215], [1329, 235], [1329, 245], [1209, 245]],
];

function drawAtmosphere(ctx: CanvasRenderingContext2D, image: HTMLImageElement, time: number) {
  ctx.clearRect(0, 0, 1536, 1024);
  // Animate only the sky above the skyline. A feathered mask preserves the
  // building silhouettes and floodlight towers without a moving rectangular edge.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(139, 0); ctx.lineTo(685, 0); ctx.lineTo(685, 33);
  ctx.lineTo(139, 33); ctx.closePath();
  ctx.moveTo(714, 0); ctx.lineTo(1390, 0); ctx.lineTo(1390, 40);
  ctx.lineTo(714, 40); ctx.closePath(); ctx.clip();
  const skyMask = ctx.createLinearGradient(0, 0, 0, 40);
  skyMask.addColorStop(0, 'rgba(255,255,255,.5)');
  skyMask.addColorStop(1, 'rgba(255,255,255,0)');
  // A slow oscillating drift closes naturally, with no jump at a loop boundary.
  ctx.globalAlpha = .42;
  const drift = Math.sin(time * .09) * 28;
  ctx.drawImage(image, 100, 0, 1330, 44, 100 + drift, 0, 1330, 44);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = skyMask; ctx.fillRect(0, 0, 1536, 44);
  ctx.restore();

  crowdSections.forEach((points, section) => {
    const left = Math.min(...points.map(p => p[0]));
    const right = Math.max(...points.map(p => p[0]));
    const top = Math.min(...points.map(p => p[1]));
    const bottom = Math.max(...points.map(p => p[1]));
    ctx.save(); ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath(); ctx.clip();
    // Small groups rise and settle in a travelling crowd wave. Rendering the
    // original art keeps every spectator consistent with the generated stadium.
    for (let x = left; x < right; x += 7) {
      const jump = Math.max(0, Math.sin(time * 2.6 - x * .024 + section * .7));
      const dy = -jump * (1.8 + Math.sin(section * 3) * .6);
      ctx.drawImage(image, x, top - 4, 7, bottom - top + 8,
        x, top - 4 + dy, 7, bottom - top + 8);
    }
    ctx.restore();
  });

  // Cloth ripples stay attached to the existing poles and banner rails.
  const cloth = [
    { x: 69, y: 389, w: 19, h: 20, axis: 'y', direction: 1 },
    { x: 1448, y: 389, w: 19, h: 20, axis: 'y', direction: -1 },
    { x: 27, y: 896, w: 23, h: 26, axis: 'y', direction: 1 },
    { x: 1486, y: 896, w: 24, h: 26, axis: 'y', direction: -1 },
    { x: 111, y: 205, w: 45, h: 87, axis: 'x', direction: 1 },
    { x: 1381, y: 205, w: 45, h: 87, axis: 'x', direction: -1 },
  ];
  cloth.forEach(({ x, y, w, h, axis, direction }, i) => {
    if (axis === 'y') {
      for (let column = 0; column < w; column += 1) {
        const free = direction === 1 ? column / w : 1 - column / w;
        const offset = Math.sin(time * 4.1 - free * 5 + i) * 2.4 * free;
        ctx.drawImage(image, x + column, y, 1, h, x + column, y + offset, 1, h);
      }
    } else {
      for (let row = 0; row < h; row += 1) {
        const free = row / h;
        const offset = Math.sin(time * 2.4 - free * 5 + i) * 2 * free;
        ctx.drawImage(image, x, y + row, w, 1, x + offset, y + row, w, 1);
      }
    }
  });
}

export function AnimatedStadiumBackdrop({ imageUrl, paused = false }: { imageUrl: string; paused?: boolean }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const image = imageRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let visible = true, raf = 0, elapsed = 0, previous = 0;
    const stop = () => { cancelAnimationFrame(raf); raf = 0; previous = 0; };
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (previous && now - previous < 1000 / 30) return;
      elapsed += previous ? Math.min(.08, (now - previous) / 1000) : 0;
      previous = now;
      drawAtmosphere(ctx, image, elapsed);
    };
    const sync = () => {
      stop();
      if (motion.matches) ctx.clearRect(0, 0, 1536, 1024);
      if (!paused && !motion.matches && visible && !document.hidden && image.complete && image.naturalWidth) {
        raf = requestAnimationFrame(frame);
      }
    };
    const observer = new IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting ?? false; sync();
    });
    observer.observe(canvas);
    image.addEventListener('load', sync);
    document.addEventListener('visibilitychange', sync);
    motion.addEventListener('change', sync);
    sync();
    return () => {
      stop(); observer.disconnect(); image.removeEventListener('load', sync);
      document.removeEventListener('visibilitychange', sync); motion.removeEventListener('change', sync);
    };
  }, [imageUrl, paused]);
  return <>
    <img ref={imageRef} src={resolveUploadUrl(imageUrl)} alt="Estádio Master Legends League" style={{ display: 'block', width: '100%', height: 'auto' }} />
    <canvas ref={canvasRef} width={1536} height={1024} aria-label="Torcida, bandeiras e nuvens animadas no estádio"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
  </>;
}
