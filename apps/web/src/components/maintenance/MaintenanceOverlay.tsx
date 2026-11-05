import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MAINTENANCE_EVENT } from '../../lib/api/client';
import { PixelBox, PixelButton } from '../ui/PixelComponents';
import { MaintenanceMascot } from './MaintenanceMascot';

/** Full-screen takeover shown app-wide when the API reports maintenanceMode active. */
export function MaintenanceOverlay() {
  const { t } = useTranslation('errors');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      if (window.location.pathname.startsWith('/admin')) return;
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      setMessage(detail?.message?.trim() || t('MAINTENANCE_MODE'));
    };
    window.addEventListener(MAINTENANCE_EVENT, handler);
    return () => window.removeEventListener(MAINTENANCE_EVENT, handler);
  }, [t]);

  if (!message) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-label={t('MAINTENANCE_MODE')}
      className="fixed inset-0 z-[9999] flex min-h-dvh items-center justify-center overflow-y-auto px-4 py-8 text-center"
      style={{ background: 'var(--bg-dark)' }}
    >
      <PixelBox glowColor="var(--gold)" className="w-full max-w-md p-6 sm:p-8">
        <MaintenanceMascot />

        <h1
          className="mt-4 text-2xl sm:text-3xl"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--gold)', lineHeight: 1.4 }}
        >
          {t('MAINTENANCE_TITLE')}
        </h1>

        <p className="text-body mt-4">{message}</p>

        <div className="text-label mt-6 flex items-center justify-center gap-2" style={{ color: 'var(--gold-light)' }}>
          <span className="animate-blink" aria-hidden="true">●</span>
          <span>{t('MAINTENANCE_STATUS')}</span>
        </div>

        <PixelButton
          variant="gold"
          size="sm"
          className="mt-6"
          onClick={() => window.location.reload()}
        >
          {t('MAINTENANCE_RELOAD')}
        </PixelButton>
      </PixelBox>
    </div>
  );
}
