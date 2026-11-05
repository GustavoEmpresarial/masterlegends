import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getCookieConsent, setCookieConsent } from '../../lib/cookieConsent';

export function CookieConsent() {
  const { t } = useTranslation('legal');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(getCookieConsent() === null);
  }, []);

  useEffect(() => {
    if (!visible) {
      document.body.classList.remove('cookie-banner-visible');
      return;
    }
    document.body.classList.add('cookie-banner-visible');
    return () => {
      document.body.classList.remove('cookie-banner-visible');
    };
  }, [visible]);

  if (!visible) return null;

  const accept = (choice: 'all' | 'essential') => {
    setCookieConsent(choice);
    setVisible(false);
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[90] box-border max-w-full px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4"
      role="dialog"
      aria-label={t('cookieBanner.title')}
    >
      <div
        className="pixel-card mx-auto box-border w-full max-w-4xl overflow-hidden p-4 shadow-lg sm:p-6"
        style={{ borderColor: 'var(--gold)', background: 'var(--bg-medium)' }}
      >
        <h2 className="pixel-text text-sm mb-2" style={{ color: 'var(--gold)' }}>
          {t('cookieBanner.title')}
        </h2>
        <p className="retro-text text-sm mb-3 sm:mb-4 leading-snug" style={{ color: 'var(--text-secondary)' }}>
          {t('cookieBanner.description')}{' '}
          <Link to="/legal/privacy" className="text-blue hover:underline">
            {t('cookieBanner.privacyLink')}
          </Link>
        </p>
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3">
          <button
            type="button"
            className="pixel-btn pixel-btn-gold pixel-btn-sm w-full sm:w-auto"
            onClick={() => accept('all')}
          >
            {t('cookieBanner.acceptAll')}
          </button>
          <button
            type="button"
            className="pixel-btn pixel-btn-md w-full sm:w-auto"
            style={{ background: 'var(--bg-light)', borderColor: 'var(--bg-lighter)' }}
            onClick={() => accept('essential')}
          >
            {t('cookieBanner.essentialOnly')}
          </button>
        </div>
      </div>
    </div>
  );
}
