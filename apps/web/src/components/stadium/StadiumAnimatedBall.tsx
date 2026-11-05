import { useEffect, useMemo, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ballPathDuration,
  ballPathIndexAt,
  buildStadiumBallPath,
  type BallPathSlot,
} from './stadiumAnimation';

interface StadiumAnimatedBallProps {
  slots: BallPathSlot[];
  onKickSlot?: (slotId: string | null) => void;
}

/** Pixel soccer ball that travels the pass path and pulses kick visits. */
export function StadiumAnimatedBall({ slots, onKickSlot }: StadiumAnimatedBallProps) {
  const reduceMotion = useReducedMotion();
  const path = useMemo(() => buildStadiumBallPath(slots), [slots]);
  const onKickRef = useRef(onKickSlot);
  onKickRef.current = onKickSlot;
  const lastVisit = useRef<string | null>(null);

  const duration = ballPathDuration(path.length);
  const left = path.map((p) => `${p.xPct}%`);
  const top = path.map((p) => `${p.yPct}%`);

  useEffect(() => {
    if (reduceMotion || path.length < 2 || !onKickRef.current) return;

    const started = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const elapsed = (now - started) / 1000;
      const idx = ballPathIndexAt(elapsed, path.length, duration);
      const visit = path[idx]?.visitSlotId ?? null;
      if (visit !== lastVisit.current) {
        lastVisit.current = visit;
        onKickRef.current?.(visit);
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      lastVisit.current = null;
      onKickRef.current?.(null);
    };
  }, [path, duration, reduceMotion]);

  if (path.length < 2 || reduceMotion) return null;

  return (
    <motion.div
      className="stadium-ball pointer-events-none absolute z-[18] -translate-x-1/2 -translate-y-1/2 select-none"
      aria-hidden
      initial={{ left: left[0], top: top[0] }}
      animate={{ left, top }}
      transition={{
        duration,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      <motion.div
        className="stadium-ball__pixel"
        animate={{ rotate: 360, y: [0, -3, 0] }}
        transition={{
          rotate: { duration: 1.1, repeat: Infinity, ease: 'linear' },
          y: { duration: 0.45, repeat: Infinity, ease: 'easeInOut' },
        }}
      >
        <svg viewBox="0 0 10 10" width="100%" height="100%" shapeRendering="crispEdges">
          <rect x="2" y="1" width="6" height="1" fill="#f5f5f5" />
          <rect x="1" y="2" width="8" height="6" fill="#f5f5f5" />
          <rect x="2" y="8" width="6" height="1" fill="#f5f5f5" />
          <rect x="4" y="2" width="2" height="2" fill="#1a1a1a" />
          <rect x="2" y="4" width="2" height="2" fill="#1a1a1a" />
          <rect x="6" y="4" width="2" height="2" fill="#1a1a1a" />
          <rect x="4" y="6" width="2" height="2" fill="#1a1a1a" />
        </svg>
      </motion.div>
    </motion.div>
  );
}
