import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { SCOUT_LAP_MS, SCOUT_LANDING_MS } from './scoutMintConstants';

interface ScoutFlightSceneProps {
  phase: 'scouting' | 'landing';
  currentLap: number;
  totalLaps: number;
  highlightColor: string;
  reducedMotion: boolean | null;
  onLapComplete: () => void;
}

const ASSETS = {
  plane: '/ui/pixel/scout/plane-v1.png',
  globe: '/ui/pixel/scout/globe-v1.png',
  cloud: '/ui/pixel/scout/cloud-v1.png',
  moon: '/ui/pixel/scout/moon-v1.png',
  exhaust: '/ui/pixel/scout/exhaust-v1.png',
} as const;

const STARS = Array.from({ length: 42 }, (_, i) => ({
  id: i,
  left: `${(i * 37 + 11) % 100}%`,
  top: `${(i * 53 + 7) % 100}%`,
  size: i % 5 === 0 ? 3 : i % 3 === 0 ? 2 : 1,
  delay: (i % 9) * 0.28,
  twinkle: 1.4 + (i % 5) * 0.35,
}));

const CLOUDS = [
  { id: 'c1', top: '14%', scale: 0.72, duration: 11, delay: 0, opacity: 0.55 },
  { id: 'c2', top: '62%', scale: 1, duration: 16, delay: -4, opacity: 0.4 },
  { id: 'c3', top: '38%', scale: 0.48, duration: 8.5, delay: -2, opacity: 0.7 },
] as const;

const PINGS = [
  { x: -18, y: -8, delay: 0.2 },
  { x: 16, y: 12, delay: 1.1 },
  { x: -6, y: 20, delay: 2.0 },
  { x: 22, y: -16, delay: 2.8 },
] as const;

function PixelCraft({ landing = false }: { landing?: boolean }) {
  return (
    <div className={`scout-flight-scene__craft-inner${landing ? ' scout-flight-scene__craft-inner--landing' : ''}`}>
      <img src={ASSETS.exhaust} alt="" className="scout-flight-scene__exhaust" draggable={false} />
      <img src={ASSETS.plane} alt="" className="scout-flight-scene__plane" draggable={false} />
    </div>
  );
}

function ScoutGlobe({ pulse }: { pulse?: boolean }) {
  return (
    <motion.div
      className="scout-flight-scene__globe-wrap"
      animate={pulse ? { scale: [1, 1.18, 1.04] } : { scale: 1 }}
      transition={pulse ? { duration: SCOUT_LANDING_MS / 1000, ease: 'easeOut' } : undefined}
    >
      <div className="scout-flight-scene__globe-glow" aria-hidden />
      <div className="scout-flight-scene__globe-halo" aria-hidden />
      <img
        src={ASSETS.globe}
        alt=""
        className={`scout-flight-scene__globe${pulse ? ' scout-flight-scene__globe--hold' : ''}`}
        draggable={false}
      />
    </motion.div>
  );
}

export function ScoutFlightScene({
  phase,
  currentLap,
  totalLaps,
  highlightColor,
  reducedMotion,
  onLapComplete,
}: ScoutFlightSceneProps) {
  const showOrbit = phase === 'scouting' && !reducedMotion;
  const showLanding = phase === 'landing';
  const progress = useMemo(
    () => Math.min(100, Math.round((currentLap / Math.max(totalLaps, 1)) * 100)),
    [currentLap, totalLaps],
  );

  return (
    <div className="scout-flight-scene" aria-hidden>
      <div className="scout-flight-scene__sky">
        {STARS.map((star) => (
          <motion.span
            key={star.id}
            className="scout-flight-scene__star"
            style={{
              left: star.left,
              top: star.top,
              width: star.size,
              height: star.size,
            }}
            animate={reducedMotion ? undefined : { opacity: [0.2, 1, 0.3] }}
            transition={{
              duration: star.twinkle,
              repeat: Infinity,
              delay: star.delay,
              ease: 'easeInOut',
            }}
          />
        ))}

        {!reducedMotion && (
          <>
            <span className="scout-flight-scene__shooting scout-flight-scene__shooting--a" />
            <span className="scout-flight-scene__shooting scout-flight-scene__shooting--b" />
          </>
        )}

        <img src={ASSETS.moon} alt="" className="scout-flight-scene__moon" draggable={false} />

        {CLOUDS.map((cloud) => (
          <img
            key={cloud.id}
            src={ASSETS.cloud}
            alt=""
            className="scout-flight-scene__cloud"
            style={{
              top: cloud.top,
              animationDuration: reducedMotion ? '0s' : `${cloud.duration}s`,
              animationDelay: `${cloud.delay}s`,
              opacity: cloud.opacity,
              transform: `scale(${cloud.scale})`,
            }}
            draggable={false}
          />
        ))}
      </div>

      <div className="scout-flight-scene__radar-ring scout-flight-scene__radar-ring--outer" />
      <div className="scout-flight-scene__radar-ring scout-flight-scene__radar-ring--mid" />
      <div className="scout-flight-scene__radar-ring scout-flight-scene__radar-ring--inner" />

      {!reducedMotion && (
        <motion.div
          className="scout-flight-scene__radar-sweep"
          animate={{ rotate: 360 }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'linear' }}
        />
      )}

      <svg className="scout-flight-scene__orbit-path" viewBox="0 0 320 320" aria-hidden>
        <circle
          cx="160"
          cy="160"
          r="132"
          fill="none"
          stroke="var(--green)"
          strokeWidth="1.5"
          strokeDasharray="5 11"
          opacity="0.4"
        />
        <circle
          cx="160"
          cy="160"
          r="98"
          fill="none"
          stroke="var(--gold)"
          strokeWidth="1"
          strokeDasharray="3 16"
          opacity="0.22"
        />
      </svg>

      <div className="scout-flight-scene__center">
        <ScoutGlobe pulse={showLanding} />

        {!reducedMotion &&
          phase === 'scouting' &&
          PINGS.map((ping, i) => (
            <motion.span
              key={`${currentLap}-${i}`}
              className="scout-flight-scene__ping"
              style={{ left: `calc(50% + ${ping.x}px)`, top: `calc(50% + ${ping.y}px)` }}
              initial={{ scale: 0.2, opacity: 0 }}
              animate={{ scale: [0.2, 1.6, 2.2], opacity: [0, 1, 0] }}
              transition={{ duration: 1.4, delay: ping.delay, repeat: Infinity, repeatDelay: 1.6 }}
            />
          ))}

        {showLanding && (
          <>
            <span className="scout-flight-scene__flash" />
            {[0, 1, 2, 3].map((ring) => (
              <motion.div
                key={ring}
                className="scout-flight-scene__shockwave"
                style={{ borderColor: highlightColor }}
                initial={{ scale: 0.4, opacity: 0.95 }}
                animate={{ scale: 2.4 + ring * 0.45, opacity: 0 }}
                transition={{ duration: 0.85, delay: ring * 0.1, ease: 'easeOut' }}
              />
            ))}
            {Array.from({ length: 16 }).map((_, i) => (
              <motion.span
                key={i}
                className="scout-flight-scene__spark"
                style={{ background: i % 2 === 0 ? highlightColor : 'var(--gold)' }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{
                  x: Math.cos((i / 16) * Math.PI * 2) * (90 + (i % 4) * 16),
                  y: Math.sin((i / 16) * Math.PI * 2) * (90 + (i % 4) * 16),
                  opacity: 0,
                  scale: 0,
                }}
                transition={{ duration: 0.75, ease: 'easeOut' }}
              />
            ))}
          </>
        )}
      </div>

      {showOrbit && (
        <motion.div
          key={`orbit-${currentLap}`}
          className="scout-flight-scene__orbit"
          initial={{ rotate: -20 }}
          animate={{ rotate: 340 }}
          transition={{ duration: SCOUT_LAP_MS / 1000, ease: 'linear' }}
          onAnimationComplete={onLapComplete}
        >
          <motion.div
            className="scout-flight-scene__craft"
            animate={{ y: [0, -5, 0], rotate: [8, 2, 8] }}
            transition={{ duration: 0.38, repeat: Infinity, ease: 'easeInOut' }}
          >
            <PixelCraft />
          </motion.div>
        </motion.div>
      )}

      {phase === 'scouting' && reducedMotion && (
        <motion.div
          className="scout-flight-scene__craft scout-flight-scene__craft--static"
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <PixelCraft />
        </motion.div>
      )}

      {showLanding && !reducedMotion && (
        <motion.div
          className="scout-flight-scene__craft scout-flight-scene__craft--landing"
          initial={{ x: 150, y: -150, scale: 1.55, rotate: 28, opacity: 1 }}
          animate={{ x: 0, y: 10, scale: 0.18, rotate: -18, opacity: 0 }}
          transition={{ duration: SCOUT_LANDING_MS / 1000, ease: [0.55, 0.05, 0.9, 0.35] }}
        >
          <PixelCraft landing />
        </motion.div>
      )}

      <div className="scout-flight-scene__progress-wrap">
        <div className="scout-flight-scene__progress-track">
          <motion.div
            className="scout-flight-scene__progress-fill"
            style={{
              background: `linear-gradient(90deg, var(--green-dark), var(--green), ${highlightColor})`,
              boxShadow: `0 0 12px ${highlightColor}`,
            }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          />
        </div>
        <div className="scout-flight-scene__progress-ticks">
          {Array.from({ length: totalLaps }, (_, i) => (
            <span
              key={i}
              className={`scout-flight-scene__progress-tick${i < currentLap ? ' scout-flight-scene__progress-tick--lit' : ''}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
