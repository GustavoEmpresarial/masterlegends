import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { PixelBadge } from '../ui/PixelComponents';
import { LandingStats } from './LandingStats';
import { LandingFieldAnimation } from './LandingFieldAnimation';
import { BRAND_NAME } from '../../lib/brand';

export function LandingHero() {
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation(['landing', 'common']);

  return (
    <section
      className="relative flex min-h-[calc(100vh-var(--app-header-h))] flex-col justify-center overflow-hidden px-4 pb-[14vh] pt-6 sm:px-6 md:pb-[16vh] md:pt-8 lg:pb-[18vh] lg:pt-10"
      style={{
        background:
          'linear-gradient(180deg, var(--bg-medium) 0%, var(--bg-dark) 100%)',
      }}
    >
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, var(--green) 0px, var(--green) 1px, transparent 1px, transparent 8px), repeating-linear-gradient(90deg, var(--green) 0px, var(--green) 1px, transparent 1px, transparent 8px)',
        }}
      />

      <div className="relative z-10 mx-auto w-full max-w-7xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="landing-hero-badge mb-8 md:mb-10"
        >
          <PixelBadge color="var(--cyan)">{t('landing:hero.betaBadge')}</PixelBadge>
        </motion.div>

        <motion.div
          className="mb-6 md:mb-8"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, type: 'spring' }}
        >
          <h1 className="sr-only">{BRAND_NAME}</h1>
          <LandingFieldAnimation />
        </motion.div>

        <motion.p
          className="retro-text mx-auto mb-5 max-w-3xl text-xl md:text-2xl lg:text-3xl"
          style={{ color: 'var(--text-primary)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          {t('landing:hero.tagline')}
        </motion.p>

        <motion.p
          className="retro-text mx-auto mb-10 max-w-2xl text-lg md:text-xl lg:text-2xl"
          style={{ color: 'var(--text-secondary)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
        >
          {t('landing:hero.subtitle')}
        </motion.p>

        <motion.div
          className="flex flex-col items-center justify-center gap-5 sm:flex-row"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          {isAuthenticated ? (
            <Link to="/club" className="pixel-btn pixel-btn-gold pixel-btn-lg min-w-[240px] sm:min-w-[280px]">
              {t('landing:cta.play')}
            </Link>
          ) : (
            <>
              <Link to="/register" className="pixel-btn pixel-btn-gold pixel-btn-lg min-w-[240px] sm:min-w-[280px]">
                {t('landing:cta.register')}
              </Link>
              <Link to="/login" className="pixel-btn pixel-btn-blue pixel-btn-lg min-w-[200px] sm:min-w-[240px]">
                {t('landing:cta.login')}
              </Link>
            </>
          )}
        </motion.div>

        <LandingStats />
      </div>
    </section>
  );
}
