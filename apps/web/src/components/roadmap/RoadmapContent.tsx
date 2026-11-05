import { motion } from 'framer-motion';
import type { RoadmapPhaseDTO } from '@mll/shared';

interface RoadmapContentProps {
  phases: RoadmapPhaseDTO[];
  compact?: boolean;
}

export function RoadmapContent({ phases, compact = false }: RoadmapContentProps) {
  return (
    <div className={compact ? 'space-y-4' : 'space-y-6'}>
      {phases.map((phase, index) => (
        <motion.div
          key={phase.id}
          initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
          className={compact ? 'pixel-box-light p-4' : 'pixel-card p-6'}
          style={{ borderColor: phase.color }}
        >
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span className="pixel-text text-sm" style={{ color: phase.color }}>
              {phase.phase}
            </span>
            <h2 className="pixel-text text-base sm:text-lg" style={{ color: '#ffffff' }}>
              {phase.title}
            </h2>
            <span className="retro-text text-xs font-bold" style={{ color: phase.color }}>
              {phase.statusLabel}
            </span>
          </div>
          <ul className={compact ? 'space-y-2' : 'space-y-3'}>
            {phase.items.map((item) => (
              <li key={item.id} className="flex items-start gap-2 retro-text text-sm" style={{ color: 'var(--text-secondary)' }}>
                <span style={{ color: item.done ? 'var(--green)' : phase.color }}>
                  {item.done ? <i className="bi bi-check-lg" aria-hidden /> : '○'}
                </span>
                <span style={item.done ? { opacity: 0.85 } : undefined}>{item.text}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      ))}
    </div>
  );
}
