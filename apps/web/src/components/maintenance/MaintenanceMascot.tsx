import { motion, useReducedMotion } from 'framer-motion';

const OUTLINE = '#1a1a1a';
const BODY = 'var(--gold-dark)';
const BODY_MID = 'var(--gold)';
const BODY_LIGHT = 'var(--gold-light)';
const EYE = '#1a1520';

interface MaintenanceMascotProps {
  size?: number;
}

/** Pequeno bixinho pixel-art (bot com chave de boca) — mascote da tela de manutenção. */
export function MaintenanceMascot({ size = 96 }: MaintenanceMascotProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      aria-hidden="true"
      style={{ width: size, height: size, margin: '0 auto' }}
      animate={reduceMotion ? undefined : { y: [0, -6, 0] }}
      transition={reduceMotion ? undefined : { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
    >
      <svg
        viewBox="0 0 24 24"
        width="100%"
        height="100%"
        shapeRendering="crispEdges"
        style={{ imageRendering: 'pixelated', display: 'block' }}
      >
        {/* antena */}
        <rect x="11" y="0" width="2" height="4" fill={OUTLINE} />
        <rect x="11" y="0" width="2" height="2" fill={BODY_LIGHT} />

        {/* corpo */}
        <rect x="5" y="4" width="14" height="14" fill={OUTLINE} />
        <rect x="6" y="5" width="12" height="12" fill={BODY} />
        <rect x="6" y="5" width="12" height="2" fill={BODY_LIGHT} opacity={0.55} />
        <rect x="6" y="15" width="12" height="2" fill="#000000" opacity={0.22} />

        <BlinkEye reduceMotion={reduceMotion} />

        {/* boca */}
        <rect x="10" y="13" width="4" height="1" fill={OUTLINE} opacity={0.6} />

        {/* braço + chave de boca */}
        <rect x="18" y="9" width="3" height="3" fill={OUTLINE} />
        <rect x="19" y="10" width="1" height="1" fill={BODY_MID} />
        <rect x="20" y="7" width="2" height="2" fill={OUTLINE} />
        <rect x="20" y="12" width="2" height="2" fill={OUTLINE} />
        <rect x="20" y="8" width="1" height="5" fill={OUTLINE} />

        {/* pés */}
        <rect x="7" y="18" width="4" height="2" fill={OUTLINE} />
        <rect x="13" y="18" width="4" height="2" fill={OUTLINE} />
      </svg>
    </motion.div>
  );
}

function BlinkEye({ reduceMotion }: { reduceMotion: boolean | null }) {
  return (
    <motion.g
      style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
      animate={reduceMotion ? undefined : { scaleY: [1, 1, 0.15, 1, 1, 1] }}
      transition={
        reduceMotion
          ? undefined
          : { duration: 3.6, repeat: Infinity, times: [0, 0.85, 0.9, 0.95, 1, 1] }
      }
    >
      <rect x="9" y="8" width="5" height="3" fill={EYE} />
      <rect x="9" y="8" width="1" height="1" fill="#ffffff" opacity={0.6} />
    </motion.g>
  );
}
