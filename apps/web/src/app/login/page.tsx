import { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { translateError } from '../../lib/apiError';
import { apiClient } from '../../lib/api/client';
import { TurnstileWidget, isTurnstileConfigured } from '../../components/auth/TurnstileWidget';
import { REGISTERED_EMAIL_KEY } from '../register/page';
import {
  isStadiumLiveWidget,
  markStadiumLiveWidget,
  openSystemBrowser,
  safePostLoginRedirect,
  stadiumLiveHref,
} from '../../lib/stadiumLiveWidget';

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, isAuthenticated, loading: authLoading } = useAuth();
  const { t } = useTranslation(['auth', 'common', 'club']);
  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [needsVerify, setNeedsVerify] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const captchaRequired = isTurnstileConfigured();
  const widgetMode = isStadiumLiveWidget() || searchParams.get('widget') === '1';
  const [authorizeState, setAuthorizeState] = useState<'opening' | 'waiting' | 'error'>('opening');
  const [authorizeUrl, setAuthorizeUrl] = useState('');
  const [authorizeAttempt, setAuthorizeAttempt] = useState(0);

  useEffect(() => {
    if (!widgetMode || authLoading || isAuthenticated) return;
    let cancelled = false;
    let timer = 0;
    const run = async () => {
      try {
        const { data } = await apiClient.post<{ pairId: string; pollToken: string }>(
          '/auth/stadium-live/pair',
        );
        if (cancelled) return;
        const url = `${window.location.origin}/stadium-live/authorize?pair=${encodeURIComponent(data.pairId)}`;
        setAuthorizeUrl(url);
        await openSystemBrowser(url);
        setAuthorizeState('waiting');
        const tick = async () => {
          if (cancelled) return;
          try {
            const poll = await apiClient.get<{ status: string; handoff?: string }>(
              '/auth/stadium-live/poll',
              { params: { pairId: data.pairId, pollToken: data.pollToken } },
            );
            if (poll.data.status === 'approved' && poll.data.handoff) {
              window.location.replace(
                `/auth/stadium-live/consume?code=${encodeURIComponent(poll.data.handoff)}`,
              );
              return;
            }
          } catch {
            /* keep waiting */
          }
          timer = window.setTimeout(() => void tick(), 1500);
        };
        timer = window.setTimeout(() => void tick(), 1200);
      } catch {
        if (!cancelled) setAuthorizeState('error');
      }
    };
    void run();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [widgetMode, authorizeAttempt, authLoading, isAuthenticated]);

  useEffect(() => {
    if (widgetMode && isAuthenticated) {
      window.location.replace(stadiumLiveHref(true));
    }
  }, [widgetMode, isAuthenticated]);

  useEffect(() => {
    if (window.mllStadiumLive?.isWidgetShell || window.Capacitor?.isNativePlatform?.()) {
      markStadiumLiveWidget();
    }
    const fromRegister = searchParams.get('registered') === '1';
    let storedEmail: string | null = null;
    try {
      storedEmail = sessionStorage.getItem(REGISTERED_EMAIL_KEY);
      if (storedEmail) sessionStorage.removeItem(REGISTERED_EMAIL_KEY);
    } catch {
      /* private mode */
    }

    const seedEmail = searchParams.get('email') || storedEmail || '';
    if (seedEmail) setEmail(seedEmail);

    if (fromRegister || storedEmail) {
      setInfo(t('auth:login.checkEmail'));
      setNeedsVerify(true);
    }
  }, [searchParams, t, widgetMode]);

  const handleResend = async () => {
    if (!email.trim()) {
      setResendMsg(t('auth:login.resendNeedEmail'));
      return;
    }
    setResending(true);
    setResendMsg('');
    try {
      await apiClient.post('/auth/resend-verification-email', { email: email.trim() });
      setResendMsg(t('auth:login.resendSent'));
    } catch (err) {
      setResendMsg(translateError(err, 'AUTH_LOGIN_FAILED'));
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResendMsg('');
    setLoading(true);

    try {
      await login(email, password, turnstileToken ?? undefined);
      const dest =
        safePostLoginRedirect(searchParams.get('redirect')) ??
        (widgetMode ? stadiumLiveHref(true) : '/club');
      navigate(dest, { replace: true });
    } catch (err: any) {
      const code = err?.message as string | undefined;
      if (code === 'AUTH_EMAIL_NOT_VERIFIED') {
        setNeedsVerify(true);
        setInfo('');
        setError('');
        setResendMsg(
          t('auth:login.emailNotVerifiedBody', { email: email.trim() || '…' }),
        );
      } else {
        setNeedsVerify(false);
        setError(translateError({ code }, 'AUTH_LOGIN_FAILED'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-shell flex flex-col items-stretch justify-start py-6 sm:items-center sm:justify-center sm:py-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="pixel-card max-w-md w-full mx-auto"
        style={{ borderColor: 'var(--green)' }}
      >
        <div className="text-center mb-6">
          <motion.div
            className="text-6xl mb-4"
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <i className="bi bi-shield-lock-fill" aria-hidden />
          </motion.div>

          <h1 className="pixel-text text-2xl mb-2" style={{ color: 'var(--green)' }}>
            {widgetMode ? t('club:stadium.widgetAuthorizeTitle') : t('auth:login.title')}
          </h1>

          {!widgetMode && (
            <p className="retro-text text-lg" style={{ color: 'var(--text-secondary)' }}>
              {t('auth:login.subtitle')}
            </p>
          )}
        </div>

        {info && (
          <div className="pixel-box-light p-4 mb-4" style={{ borderColor: 'var(--gold)' }}>
            <p className="retro-text text-center" style={{ color: 'var(--gold)' }}>
              {info}
            </p>
          </div>
        )}

        {widgetMode ? (
          <div className="space-y-4 text-center">
            <p className="retro-text text-sm" style={{ color: 'var(--text-secondary)' }}>
              {authorizeState === 'error'
                ? t('club:stadium.widgetAuthorizeError')
                : t('club:stadium.widgetAuthorizeBody')}
            </p>
            <p className="retro-text text-xs" style={{ color: 'var(--text-muted)' }}>
              {authorizeState === 'waiting' ? t('club:stadium.widgetAuthorizeWaiting') : null}
            </p>
            <button
              type="button"
              className="pixel-btn pixel-btn-green pixel-btn-md w-full"
              onClick={() => {
                if (authorizeUrl) void openSystemBrowser(authorizeUrl);
                else setAuthorizeAttempt((n) => n + 1);
              }}
            >
              {t('club:stadium.widgetAuthorizeRetry')}
            </button>
          </div>
        ) : null}

        {!widgetMode && error && (
          <div className="pixel-box-light p-4 mb-4 border-red">
            <p className="retro-text text-red text-center">{error}</p>
          </div>
        )}

        {!widgetMode && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="pixel-text text-sm block mb-2">{t('auth:fields.email')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pixel-input w-full"
              required
              disabled={loading}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="pixel-text text-sm">{t('auth:fields.password')}</label>
              <Link
                to={widgetMode ? '/esqueci-senha?widget=1' : '/esqueci-senha'}
                className="retro-text text-xs hover:underline"
                style={{ color: 'var(--blue)' }}
              >
                {t('auth:login.forgotPassword')}
              </Link>
            </div>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pixel-input w-full"
              required
              disabled={loading}
            />
          </div>

          {captchaRequired && (
            <TurnstileWidget onTokenChange={setTurnstileToken} />
          )}

          <button
            type="submit"
            className="pixel-btn pixel-btn-green pixel-btn-lg w-full"
            disabled={loading || (captchaRequired && !turnstileToken)}
          >
            {loading ? t('auth:login.submitting') : t('auth:login.submit')}
          </button>
        </form>
        )}

        {!widgetMode && needsVerify && (
          <div
            className="pixel-box p-4 mt-5 space-y-3"
            style={{ borderColor: 'var(--gold)' }}
          >
            <p
              className="pixel-text text-sm text-center"
              style={{ color: 'var(--gold)' }}
            >
              {t('auth:login.emailNotVerifiedTitle')}
            </p>
            {resendMsg ? (
              <p className="retro-text text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
                {resendMsg}
              </p>
            ) : (
              <p className="retro-text text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
                {t('auth:login.verifyHint')}
              </p>
            )}
            <button
              type="button"
              className="pixel-btn pixel-btn-md w-full"
              style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}
              disabled={resending}
              onClick={() => void handleResend()}
            >
              {resending ? t('auth:login.resending') : t('auth:login.resend')}
            </button>
          </div>
        )}

        <div className="mt-6 text-center">
          {widgetMode ? (
            <p className="retro-text text-xs" style={{ color: 'var(--text-muted)' }}>
              {t('club:stadium.widgetLoginHint')}
            </p>
          ) : (
            <p className="retro-text text-sm" style={{ color: 'var(--text-secondary)' }}>
              {t('auth:login.noAccount')}{' '}
              <Link to="/register" className="text-blue hover:underline">
                {t('auth:login.register')}
              </Link>
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
