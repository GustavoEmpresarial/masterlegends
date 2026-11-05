import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../../lib/api/client';
import { useAuth } from '../../../hooks/useAuth';

type State = 'idle' | 'verifying' | 'success' | 'failure' | 'missing';

export function VerifyEmailPage() {
  const { t } = useTranslation(['auth']);
  const [params] = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState<State>('idle');
  const { isAuthenticated, refreshUser, patchUser } = useAuth();

  useEffect(() => {
    if (!token) {
      setState('missing');
      return;
    }
    let cancelled = false;
    setState('verifying');
    void apiClient
      .post('/auth/verify-email', { token })
      .then(async () => {
        if (cancelled) return;
        setState('success');
        patchUser({ emailVerified: true });
        try {
          await refreshUser();
        } catch {
          /* offline / not logged in */
        }
      })
      .catch(() => {
        if (!cancelled) setState('failure');
      });
    return () => {
      cancelled = true;
    };
    // Intentionally only re-run when the token changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const message = (() => {
    switch (state) {
      case 'missing':
        return t('auth:verify.missingToken');
      case 'verifying':
        return t('auth:verify.verifying');
      case 'success':
        return t('auth:verify.success');
      case 'failure':
        return t('auth:verify.failure');
      default:
        return '';
    }
  })();

  return (
    <div className="auth-page-shell flex flex-col items-stretch justify-start py-6 sm:items-center sm:justify-center sm:py-10">
      <div className="pixel-card max-w-md w-full mx-auto text-center" style={{ borderColor: 'var(--green)' }}>
        <h1 className="pixel-text text-2xl mb-4" style={{ color: 'var(--green)' }}>
          {t('auth:verify.title')}
        </h1>
        <p className="retro-text text-lg mb-6" style={{ color: 'var(--text-primary)' }}>
          {message}
        </p>
        {state === 'success' && (
          <Link
            to={isAuthenticated ? '/club' : '/login'}
            className="pixel-btn pixel-btn-green pixel-btn-md w-full inline-block"
          >
            {isAuthenticated ? t('auth:verify.goClub') : t('auth:verify.goLogin')}
          </Link>
        )}
      </div>
    </div>
  );
}
