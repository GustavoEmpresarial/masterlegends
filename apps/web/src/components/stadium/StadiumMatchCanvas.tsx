import { useEffect, useMemo, useRef } from 'react';
import { resolveUploadUrl } from '../../lib/resolveUploadUrl';
import { drawPlayfieldBall, drawPlayfieldPlayer } from './stadiumPlayfieldDraw';
import { buildMatchActors, type MatchSlotView } from './stadiumMatchFormation';
import { AnimatedStadiumBackdrop } from './AnimatedStadiumBackdrop';

interface StadiumMatchCanvasProps {
  imageUrl: string;
  animatedBackdrop?: boolean;
  slots: MatchSlotView[];
  opponents?: MatchSlotView[];
  paused?: boolean;
  labels?: boolean;
  onSelectPlayer?: (slotId: string) => void;
}

const passRoute = [0, 2, 6, 8, 14, 17, 20, 4, 7, 10, 15, 18, 19, 1, 5, 9, 13, 16, 21, 3];

export function StadiumMatchCanvas({ imageUrl, animatedBackdrop = false, slots, opponents = [], paused = false, labels = false, onSelectPlayer }: StadiumMatchCanvasProps) {
  const actors = useMemo(() => buildMatchActors(slots, opponents), [slots, opponents]);
  const targets = useRef(new Map<string, HTMLButtonElement>());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const options = useRef({ paused, labels, actors });
  options.current = { paused, labels, actors };
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let raf = 0, elapsed = 0, previous = performance.now();
    const tick = (now: number) => {
      // The first RAF timestamp can precede effect setup within the same frame.
      // Negative time would select route[-1] and permanently stop the match.
      const dt = Math.max(0, Math.min(0.04, (now - previous) / 1000));
      previous = now;
      if (!options.current.paused && !motion.matches) elapsed += dt;
      const { width: w, height: h } = canvas.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const actors = options.current.actors;
      const unit = w / 1200;
      const positioned = actors.map((actor, i) => {
        const phase = elapsed * 0.66 + i * 1.71;
        const keeper = actor.position === 'GK';
        const dx = Math.sin(phase) * (keeper ? 0.55 : 1.6);
        const dy = Math.sin(phase * 0.73) * (keeper ? 0.3 : 0.85);
        const footX = (actor.xPct + dx) / 100 * w;
        const footY = (actor.yPct + dy) / 100 * h;
        const scale = unit * (2.25 + (actor.yPct - 50) / 36 * 0.7);
        return { actor, footX, footY, scale, phase };
      });
      if (!positioned.length) { raf = requestAnimationFrame(tick); return; }
      const route = passRoute.filter(index => index < positioned.length);
      const leg = Math.floor(elapsed / 1.65) % route.length;
      const progress = (elapsed / 1.65) % 1;
      const fromIndex = route[leg]!;
      const toIndex = route[(leg + 1) % route.length]!;
      [...positioned].sort((a, b) => a.footY - b.footY).forEach(({ actor, footX, footY, scale, phase }) => {
        const index = actor.index;
        const pose = index === fromIndex && progress < 0.14 ? 'kick' : Math.abs(Math.cos(phase)) > 0.28 ? 'run' : 'idle';
        const facing = pose === 'kick' ? (positioned[toIndex]!.footX >= footX ? 1 : -1) : pose === 'run' ? (Math.cos(phase) >= 0 ? 1 : -1) : actor.side === 'home' ? 1 : -1;
        const drawScale = actor.side === 'away' ? scale * 1.4 : scale;
        drawPlayfieldPlayer(ctx, actor, footX, footY - 14 * drawScale, elapsed * 1000, pose, facing, drawScale, undefined, {
          nameplate: false,
          spriteMotion: { gaitMs: elapsed * 370 + index * 119, reducedMotion: motion.matches },
        });
        const target = targets.current.get(actor.slotId);
        if (target) {
          const width = 34 * drawScale, height = 43 * drawScale;
          target.style.left = `${footX - width / 2}px`;
          target.style.top = `${footY - height}px`;
          target.style.width = `${width}px`;
          target.style.height = `${height}px`;
        }
        if (options.current.labels) {
          ctx.font = `600 ${Math.max(8, 10 * unit)}px system-ui`;
          ctx.textAlign = 'center';
          ctx.fillStyle = '#07101de0';
          const text = actor.name;
          const width = ctx.measureText(text).width + 12;
          ctx.fillRect(footX - width / 2, footY + 6 * unit, width, 16 * unit);
          ctx.fillStyle = actor.side === 'home' ? '#a4dbff' : '#ffe399';
          ctx.fillText(text, footX, footY + 18 * unit);
        }
      });
      const a = positioned[fromIndex]!, b = positioned[toIndex]!;
      const flight = Math.max(0, Math.min(1, (progress - 0.08) / 0.82));
      const bx = a.footX + (b.footX - a.footX) * flight;
      const by = a.footY + (b.footY - a.footY) * flight - Math.sin(flight * Math.PI) * 9 * unit;
      drawPlayfieldBall(ctx, bx, by, elapsed * 1000, 1.35 * unit);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <div className="match-stage" style={{ position: 'relative', width: '100%', overflow: 'hidden', borderRadius: 12 }}>
    {animatedBackdrop ? <AnimatedStadiumBackdrop imageUrl={imageUrl} paused={paused} /> :
      <img src={resolveUploadUrl(imageUrl)} alt="Estádio Master Legends League" style={{ display: 'block', width: '100%', height: 'auto' }} />}
    <canvas ref={canvasRef} aria-label="Times em campo com sprites animados" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
    {onSelectPlayer && actors.filter(a => a.side === 'home').map(actor => <button key={actor.slotId}
      ref={node => { if (node) targets.current.set(actor.slotId, node); else targets.current.delete(actor.slotId); }}
      type="button" aria-label={`Ver ${actor.name}`} title={`${actor.name} · ${actor.overwall} OW`}
      onClick={() => onSelectPlayer(actor.slotId)}
      style={{ position: 'absolute', left: -1000, top: -1000, border: 0, padding: 0, background: 'transparent', cursor: 'pointer' }} />)}
  </div>;
}
