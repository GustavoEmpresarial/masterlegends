import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { PixelCard } from '../ui/PixelComponents';

const FEATURES = [
  { key: 'club', to: '/club', color: 'var(--green)', icon: 'bi-shield-fill' },
  { key: 'scout', to: '/scout', color: 'var(--blue)', icon: 'bi-search' },
  { key: 'marketplace', to: '/marketplace', color: 'var(--gold)', icon: 'bi-cart-fill' },
] as const;

export function LandingFeatures() {
  const { t } = useTranslation('landing');

  return (
    <section className="py-16 md:py-20 px-4" style={{ background: 'var(--bg-dark)' }}>
      <div className="max-w-6xl mx-auto">
        <motion.h2
          className="pixel-text text-2xl md:text-3xl text-center mb-12"
          style={{ color: 'var(--green)' }}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          {t('features.title')}
        </motion.h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((item, i) => (
            <motion.div
              key={item.key}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
            >
              <Link to={item.to} className="block h-full group">
                <PixelCard
                  className="h-full p-6 flex flex-col"
                  style={{ borderColor: item.color }}
                  whileHover={{ y: -6, scale: 1.02 }}
                >
                  <i className={`bi ${item.icon} text-4xl mb-4 block`} aria-hidden />
                  <h3 className="ui-label mb-3" style={{ color: item.color }}>
                    {t(`features.${item.key}.title`)}
                  </h3>
                  <p className="retro-text text-base flex-1 mb-4" style={{ color: 'var(--text-secondary)' }}>
                    {t(`features.${item.key}.desc`)}
                  </p>
                  <span
                    className="pixel-text text-xs group-hover:underline"
                    style={{ color: item.color }}
                  >
                    {t(`features.${item.key}.cta`)} →
                  </span>
                </PixelCard>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
