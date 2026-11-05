import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { hasAnalyticsConsent, onCookieConsentChange } from '../lib/cookieConsent';
import { initGA, trackPageView } from '../lib/analytics';

const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

export function useGoogleAnalytics(): void {
  const location = useLocation();

  useEffect(() => {
    if (!MEASUREMENT_ID) return;

    const maybeInit = () => {
      if (hasAnalyticsConsent()) {
        initGA(MEASUREMENT_ID);
        trackPageView(location.pathname + location.search);
      }
    };

    maybeInit();
    return onCookieConsentChange((state) => {
      if (state.analytics) {
        initGA(MEASUREMENT_ID);
        trackPageView(location.pathname + location.search);
      }
    });
  }, []);

  useEffect(() => {
    if (!MEASUREMENT_ID || !hasAnalyticsConsent()) return;
    initGA(MEASUREMENT_ID);
    trackPageView(location.pathname + location.search);
  }, [location.pathname, location.search]);
}
