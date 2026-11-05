import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { BrandMark } from './BrandMark';

const SOCIAL = {
  telegram: import.meta.env.VITE_TELEGRAM_URL ?? 'https://t.me/+HVIB4uMslA82ZmZh',
  genesisDao: import.meta.env.VITE_GENESIS_DAO_URL ?? '',
};

const LEGAL_LINKS = [
  { to: '/legal/terms-of-use', key: 'termsOfUse' },
  { to: '/legal/terms-and-conditions', key: 'termsAndConditions' },
  { to: '/legal/privacy', key: 'privacyPolicy' },
  { to: '/legal/cookies', key: 'cookiePolicy' },
  { to: '/legal/web3-risk', key: 'web3Risk' },
  { to: '/legal/community', key: 'communityContent' },
] as const;

function TelegramIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

function SocialRow({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: ReactNode;
}) {
  const baseClass =
    'flex items-center gap-3 retro-text text-sm transition-colors';

  if (!href) {
    return (
      <span
        className={`${baseClass} cursor-default opacity-50`}
        style={{ color: 'var(--text-secondary)' }}
        aria-label={label}
      >
        {icon}
        {label}
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${baseClass} hover:text-gold`}
      style={{ color: 'var(--text-primary)' }}
    >
      {icon}
      {label}
    </a>
  );
}

export function Footer({ variant = 'full' }: { variant?: 'full' | 'content' }) {
  const { t } = useTranslation('legal');
  const year = new Date().getFullYear();
  const isContent = variant === 'content';

  const genesisName = (
    <span style={{ color: 'var(--gold)' }}>Genesis DAO Network</span>
  );

  const genesisLine = SOCIAL.genesisDao ? (
    <>
      {t('footer.developedBy')}{' '}
      <a
        href={SOCIAL.genesisDao}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:underline"
        style={{ color: 'var(--gold)' }}
      >
        Genesis DAO Network
      </a>
    </>
  ) : (
    <>
      {t('footer.developedBy')} {genesisName}
    </>
  );

  return (
    <footer
      className={`relative z-20 mt-auto w-full border-t ${
        isContent
          ? 'px-4 py-8 sm:px-6 sm:py-10'
          : 'px-6 py-10 sm:px-8 sm:py-12 lg:px-12 xl:px-16 2xl:px-20'
      }`}
      style={{
        borderColor: 'var(--bg-lighter)',
        backgroundColor: 'var(--bg-dark)',
      }}
    >
      <div
        className={`grid w-full gap-8 ${
          isContent
            ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 xl:gap-x-10'
            : 'grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-x-12 xl:gap-x-16'
        }`}
      >
        {/* Brand column */}
        <div
          className={`flex flex-col gap-4 ${
            isContent ? 'sm:col-span-2 xl:col-span-1' : 'sm:col-span-2 lg:col-span-1'
          }`}
        >
          <BrandMark compact />
          <p
            className="retro-text max-w-xl text-sm leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t('footer.tagline')}
          </p>
          <p className="retro-text text-sm" style={{ color: 'var(--text-muted)' }}>
            {genesisLine}
          </p>
          <p className="retro-text text-xs" style={{ color: 'var(--text-muted)' }}>
            {t('footer.copyright', { year })}
          </p>
        </div>

        {/* Platforms column */}
        <div className="flex flex-col gap-4">
          <p className="ui-label-sm" style={{ color: 'var(--text-muted)' }}>
            {t('footer.platformsTitle')}
          </p>
          <nav className="flex flex-col gap-3">
            <SocialRow
              href={SOCIAL.telegram}
              label={t('footer.telegram')}
              icon={<TelegramIcon />}
            />
          </nav>
        </div>

        {/* Legal column */}
        <div
          className={`flex flex-col gap-4 ${
            isContent ? 'sm:col-span-2 xl:col-span-1' : 'sm:col-span-2 lg:col-span-1'
          }`}
        >
          <p className="ui-label-sm" style={{ color: 'var(--text-muted)' }}>
            {t('footer.legalTitle')}
          </p>
          <nav className={`grid grid-cols-1 gap-2.5 ${isContent ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 xl:gap-x-8'}`}>
            {LEGAL_LINKS.map(({ to, key }) => (
              <Link
                key={to}
                to={to}
                className="retro-text text-sm transition-colors hover:text-gold"
                style={{ color: 'var(--text-primary)' }}
              >
                {t(`footer.${key}`)}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
