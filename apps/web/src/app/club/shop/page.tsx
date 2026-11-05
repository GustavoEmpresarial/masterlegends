import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { StadiumShopPanel } from '../../../components/stadium/StadiumShopPanel';
import { PageContentShell } from '../../../components/content';

export function ShopPage() {
  const { t } = useTranslation(['club']);

  return (
    <PageContentShell>
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full min-w-0 space-y-2"
      >
        <h1
          className="pixel-text leading-none"
          style={{
            fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
            color: 'var(--gold)',
            textShadow: '0 0 20px rgba(251,191,36,0.35)',
          }}
        >
          {t('club:shop.title')}
        </h1>
        <p className="text-body" style={{ color: '#ffffff' }}>
          {t('club:shop.subtitle')}
        </p>
      </motion.header>

      <StadiumShopPanel />
    </PageContentShell>
  );
}
