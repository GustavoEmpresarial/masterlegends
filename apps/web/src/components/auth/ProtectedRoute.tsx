import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { isStadiumLiveWidget, stadiumLiveHref } from '../../lib/stadiumLiveWidget';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const { t } = useTranslation('common');
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="pixel-card p-8">
          <p className="pixel-text text-lg animate-blink">{t('actions.loading')}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const returnTo =
      location.pathname.startsWith('/club/stadium/live') || isStadiumLiveWidget()
        ? stadiumLiveHref(true)
        : `${location.pathname}${location.search}`;
    const params = new URLSearchParams();
    params.set('redirect', returnTo);
    if (isStadiumLiveWidget() || location.pathname.startsWith('/club/stadium/live')) {
      params.set('widget', '1');
    }
    return <Navigate to={`/login?${params.toString()}`} replace />;
  }

  return <>{children}</>;
}
