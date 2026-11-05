import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { WalletHub } from '../../components/wallet/WalletHub';
import { PageContentShell, PageHero } from '../../components/content';
import { Web3Provider } from '../../lib/web3/Web3Provider';

export function WalletPage() {
  const { t } = useTranslation('common');

  return (
    <Web3Provider>
      <PageContentShell>
        <PageHero
          title={<><i className="bi bi-wallet2" aria-hidden /> {t('wallet.pageTitle')}</>}
          subtitle={t('wallet.pageSubtitleHub')}
          titleColor="var(--purple)"
        />

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <WalletHub />
        </motion.div>
      </PageContentShell>
    </Web3Provider>
  );
}
