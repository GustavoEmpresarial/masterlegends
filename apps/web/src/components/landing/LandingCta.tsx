import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';

export function LandingCta() {
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation('landing');

  return (
    <section
      className="py-16 md:py-24 px-4"
      style={{
        background:
          'linear-gradient(180deg, var(--bg-medium) 0%, var(--bg-dark) 100%)',
      }}
    >
      <div className="max-w-3xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="pixel-text text-2xl md:text-4xl mb-4" style={{ color: 'var(--gold)' }}>
            {t('cta.ready')}
          </h2>
          <p className="retro-text text-lg md:text-xl mb-10" style={{ color: 'var(--text-secondary)' }}>
            {t('cta.joinLeague')}
          </p>

          {isAuthenticated ? (
            <Link to="/club" className="pixel-btn pixel-btn-gold pixel-btn-lg inline-block">
              {t('cta.play')}
            </Link>
          ) : (
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link to="/register" className="pixel-btn pixel-btn-gold pixel-btn-lg">
                {t('cta.startFree')}
              </Link>
              <Link
                to="/login"
                className="retro-text text-base underline underline-offset-4 hover:opacity-80"
                style={{ color: 'var(--text-secondary)' }}
              >
                {t('cta.login')}
              </Link>
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
