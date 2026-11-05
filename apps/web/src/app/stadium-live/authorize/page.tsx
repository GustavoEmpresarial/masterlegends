import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../../lib/api/client';
import { useAuth } from '../../../hooks/useAuth';

export function StadiumLiveAuthorizePage() {
  const { t } = useTranslation(['club', 'common']);
  const { isAuthenticated, loading } = useAuth();
  const [params] = useSearchParams();
  const pair = params.get('pair') ?? '';
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="pixel-text text-lg animate-blink">{t('common:actions.loading')}</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    const back = `/stadium-live/authorize?pair=${encodeURIComponent(pair)}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(back)}`} replace />;
  }

  const approve = async () => {
    setBusy(true);
    setError('');
    try {
      await apiClient.post('/auth/stadium-live/approve', { pairId: pair });
      setDone(true);
    } catch {
      setError(t('club:stadium.widgetAuthorizeError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="pixel-card w-full max-w-md space-y-4 text-center" style={{ borderColor: 'var(--green)' }}>
        <h1 className="pixel-text text-xl" style={{ color: 'var(--green)' }}>
          {t('club:stadium.authorizeTitle')}
        </h1>
        <p className="retro-text text-sm" style={{ color: 'var(--text-secondary)' }}>
          {done ? t('club:stadium.authorizeDone') : t('club:stadium.authorizeBody')}
        </p>
        {error && (
          <p className="retro-text text-sm" style={{ color: 'var(--red)' }}>{error}</p>
        )}
        {!done && (
          <button
            type="button"
            className="pixel-btn pixel-btn-green pixel-btn-lg w-full"
            disabled={busy || !pair}
            onClick={() => void approve()}
          >
            {t('club:stadium.authorizeButton')}
          </button>
        )}
      </div>
    </div>
  );
}
