/** Modo widget Stadium Live — app desktop/mobile só do campo, sem navegar o jogo. */

export const STADIUM_LIVE_PATH = '/club/stadium/live';
export const STADIUM_LIVE_WIDGET_KEY = 'mll_stadium_live_widget';

const AUTH_PATH_PREFIXES = [
  '/login',
  '/register',
  '/auth/',
  '/verificar-email',
  '/esqueci-senha',
  '/recuperar-senha',
  '/stadium-live/authorize',
] as const;

declare global {
  interface Window {
    mllStadiumLive?: {
      isWidgetShell?: boolean;
      getLiveUrl?: () => Promise<string>;
      toggleAlwaysOnTop?: () => Promise<boolean>;
      openExternal?: (url: string) => Promise<boolean>;
      minimize?: () => Promise<void>;
      toggleMaximize?: () => Promise<boolean>;
      close?: () => Promise<void>;
    };
    Capacitor?: {
      isNativePlatform?: () => boolean;
      nativePromise?: (plugin: string, method: string, options?: object) => Promise<unknown>;
    };
  }
}

/** Opens the site login/authorize page in the system browser, not inside the shell. */
export async function openSystemBrowser(url: string): Promise<void> {
  const cap = window.Capacitor;
  if (cap?.isNativePlatform?.() && cap.nativePromise) {
    try {
      await cap.nativePromise('Browser', 'open', { url });
      return;
    } catch {
      /* fall through */
    }
  }
  if (window.mllStadiumLive?.openExternal) {
    await window.mllStadiumLive.openExternal(url);
    return;
  }
  const popup = window.open(url, '_blank', 'noopener');
  // Inside the app shell, never navigate away to the authorize page.
  if (!popup && !window.mllStadiumLive?.isWidgetShell && !window.Capacitor?.isNativePlatform?.()) {
    window.location.assign(url);
  }
}

export function stadiumLiveHref(widget = true): string {
  return widget ? `${STADIUM_LIVE_PATH}?widget=1` : STADIUM_LIVE_PATH;
}

export function markStadiumLiveWidget(): void {
  try {
    sessionStorage.setItem(STADIUM_LIVE_WIDGET_KEY, '1');
  } catch {
    /* private mode */
  }
}

export function clearStadiumLiveWidget(): void {
  try {
    sessionStorage.removeItem(STADIUM_LIVE_WIDGET_KEY);
  } catch {
    /* private mode */
  }
}

export function isStadiumLiveWidget(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.mllStadiumLive?.isWidgetShell) return true;
  if (window.Capacitor?.isNativePlatform?.()) return true;
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get('widget') === '1') return true;
  } catch {
    /* ignore */
  }
  return false;
}

/** Paths the Stadium Live shell may show (auth + live only). */
export function isStadiumLiveAllowedPath(pathname: string): boolean {
  if (pathname === STADIUM_LIVE_PATH || pathname.startsWith(`${STADIUM_LIVE_PATH}/`)) {
    return true;
  }
  return AUTH_PATH_PREFIXES.some(
    (p) => pathname === p.replace(/\/$/, '') || pathname.startsWith(p),
  );
}

/**
 * Safe post-login redirect. Widget mode only returns Stadium Live.
 * Non-widget: only same-app relative paths (no open redirect).
 */
export function safePostLoginRedirect(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('://')) {
    return null;
  }
  const pathOnly = trimmed.split(/[?#]/)[0] ?? '';
  if (isStadiumLiveWidget() || pathOnly === STADIUM_LIVE_PATH) {
    if (pathOnly !== STADIUM_LIVE_PATH) return null;
    return stadiumLiveHref(true);
  }
  if (!pathOnly.startsWith('/')) return null;
  return trimmed;
}
