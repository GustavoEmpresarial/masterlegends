import { ReactNode } from 'react';
import { useGoogleAnalytics } from '../../hooks/useGoogleAnalytics';

export function GoogleAnalyticsProvider({ children }: { children: ReactNode }) {
  useGoogleAnalytics();
  return <>{children}</>;
}
