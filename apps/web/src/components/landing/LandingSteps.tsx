import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { PixelBadge } from '../ui/PixelComponents';

const STEPS = [
  { n: 1, color: 'var(--green)' },
  { n: 2, color: 'var(--blue)' },
  { n: 3, color: 'var(--cyan)' },
  { n: 4, color: 'var(--gold)' },
  { n: 5, color: 'var(--purple)' },
] as const;

export function LandingSteps() {
  const { t } = useTranslation('landing');

  return (
    <section className="py-16 md:py-20 px-4" style={{ background: 'var(--bg-medium)' }}>
      <div className="max-w-6xl mx-auto">
        <motion.h2
          className="pixel-text text-2xl md:text-3xl text-center mb-14"
          style={{ color: 'var(--green)' }}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          {t('howItWorks.title')}
        </motion.h2>

        <div className="relative">
          <div
            className="hidden lg:block absolute top-8 left-[10%] right-[10%] h-1 -z-0"
            style={{ background: 'var(--bg-lighter)' }}
            aria-hidden
          />

          <ol className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-4">
            {STEPS.map((step, i) => (
              <motion.li
                key={step.n}
                className="relative flex flex-col items-center text-center list-none"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div
                  className="w-16 h-16 flex items-center justify-center pixel-box mb-4 relative z-10"
                  style={{
                    borderColor: step.color,
                    background: 'var(--bg-dark)',
                  }}
                >
                  <span className="pixel-text text-xl" style={{ color: step.color }}>
                    {step.n}
                  </span>
                </div>

                <PixelBadge color={step.color}>
                  {t('howItWorks.stepLabel', { n: step.n })}
                </PixelBadge>

                <h3 className="ui-label-sm mt-4 mb-2" style={{ color: step.color }}>
                  {t(`howItWorks.steps.${step.n}.title`)}
                </h3>
                <p className="retro-text text-base max-w-[260px]" style={{ color: 'var(--text-secondary)' }}>
                  {t(`howItWorks.steps.${step.n}.desc`)}
                </p>

                {i < STEPS.length - 1 && (
                  <div
                    className="lg:hidden w-px h-8 mt-6"
                    style={{ background: 'var(--bg-lighter)' }}
                    aria-hidden
                  />
                )}
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
