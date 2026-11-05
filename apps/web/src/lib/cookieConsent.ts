const STORAGE_KEY = 'mll_cookie_consent';

export type CookieConsentChoice = 'all' | 'essential';

export interface CookieConsentState {
  choice: CookieConsentChoice;
  analytics: boolean;
  decidedAt: string;
}

export function getCookieConsent(): CookieConsentState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CookieConsentState;
  } catch {
    return null;
  }
}

export function hasAnalyticsConsent(): boolean {
  return getCookieConsent()?.analytics === true;
}

export function setCookieConsent(choice: CookieConsentChoice): CookieConsentState {
  const state: CookieConsentState = {
    choice,
    analytics: choice === 'all',
    decidedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent('mll:cookie-consent', { detail: state }));
  return state;
}

export function onCookieConsentChange(handler: (state: CookieConsentState) => void): () => void {
  const listener = (event: Event) => {
    const custom = event as CustomEvent<CookieConsentState>;
    handler(custom.detail);
  };
  window.addEventListener('mll:cookie-consent', listener);
  return () => window.removeEventListener('mll:cookie-consent', listener);
}
