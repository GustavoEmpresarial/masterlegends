import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { RoadmapContent } from '../../components/roadmap/RoadmapContent';
import { useRoadmap } from '../../hooks/useRoadmap';
import { PageContentShell } from '../../components/content';

export function RoadmapPage() {
  const { t } = useTranslation('common');
  const { data, isLoading, isError, refetch } = useRoadmap();

  return (
    <PageContentShell>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <h1 className="pixel-text text-xl sm:text-2xl md:text-3xl" style={{ color: 'var(--blue)' }}>
          <i className="bi bi-map-fill" aria-hidden /> {t('nav.roadmap')}
        </h1>
        <p className="retro-text mt-2 text-sm sm:text-base" style={{ color: 'var(--text-secondary)' }}>
          {t('roadmap.subtitle', { defaultValue: 'A jornada do Master Legends League' })}
        </p>
      </motion.div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="pixel-card h-32 animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="pixel-card p-6 text-center space-y-4">
          <p className="retro-text text-sm" style={{ color: 'var(--orange)' }}>
            {t('actions.loading', { defaultValue: 'Erro ao carregar roadmap.' })}
          </p>
          <button type="button" onClick={() => void refetch()} className="pixel-btn pixel-btn-md">
            {t('actions.retry', { defaultValue: 'Tentar novamente' })}
          </button>
        </div>
      ) : (
        <RoadmapContent phases={data?.phases ?? []} />
      )}
    </PageContentShell>
  );
}
