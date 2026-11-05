import { motion, useReducedMotion } from 'framer-motion';

interface StadiumAnimatedMarkerProps {
  index: number;
  active?: boolean;
  children: React.ReactNode;
}

export function StadiumAnimatedMarker({ index, active = false, children }: StadiumAnimatedMarkerProps) {
  const reduceMotion = useReducedMotion();
  const phase  = index * 0.37;
  const wander = active && !reduceMotion;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* ground shadow ellipse */}
      {active && !reduceMotion && (
        <motion.div
          style={{
            position: 'absolute',
            bottom: -4,
            left: '50%',
            translateX: '-50%',
            width: '70%',
            height: 6,
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.45)',
            filter: 'blur(3px)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
          animate={{ scaleX: [1, 0.75, 1, 1.1, 1], opacity: [0.45, 0.2, 0.45, 0.35, 0.45] }}
          transition={{ duration: 2.4 + (index % 4) * 0.35, repeat: Infinity, ease: 'easeInOut', delay: phase }}
        />
      )}

      <motion.div
        style={{ position: 'relative', zIndex: 1 }}
        animate={wander ? { y: [0, -5, 0, 3, 0], x: [-2, 0, 2, 0, -2] } : { y: 0, x: 0 }}
        transition={wander ? { duration: 2.4 + (index % 4) * 0.35, repeat: Infinity, ease: 'easeInOut', delay: phase } : undefined}
      >
        <motion.div
          animate={
            active && !reduceMotion
              ? { rotate: [0, -5, 12, 0], scale: [1, 1.05, 1.02, 1] }
              : { rotate: 0, scale: 1 }
          }
          transition={
            active && !reduceMotion
              ? { duration: 0.4, repeat: Infinity, repeatDelay: 3 + (index % 5) * 0.5, ease: 'easeOut', delay: phase }
              : undefined
          }
        >
          {children}
        </motion.div>
      </motion.div>
    </div>
  );
}
