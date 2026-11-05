import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { StatDisplay } from '../ui/PixelComponents';

const STATS = [
  { key: 'starterMgt', color: 'var(--green)', icon: 'bi-shield-fill' },
  { key: 'scoutCost', color: 'var(--blue)', icon: 'bi-search' },
  { key: 'rarities', color: 'var(--purple)', icon: 'bi-star-fill' },
  { key: 'freeRegister', color: 'var(--cyan)', icon: 'bi-controller' },
] as const;

export function LandingEconomy() {
  const { t } = useTranslation('landing');

  return (
    <section className="py-16 md:py-20 px-4" style={{ background: 'var(--bg-dark)' }}>
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="pixel-text text-2xl md:text-3xl mb-3" style={{ color: 'var(--gold)' }}>
            {t('economy.title')}
          </h2>
          <p className="retro-text text-base" style={{ color: 'var(--text-muted)' }}>
            {t('economy.subtitle')}
          </p>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.key}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="flex flex-col items-center"
            >
              <StatDisplay
                icon={stat.icon}
                value={t(`economy.${stat.key}.value`)}
                label={t(`economy.${stat.key}.label`)}
                color={stat.color}
              />
              <p className="retro-text text-xs mt-2 text-center max-w-[160px]" style={{ color: 'var(--text-muted)' }}>
                {t(`economy.${stat.key}.hint`)}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
