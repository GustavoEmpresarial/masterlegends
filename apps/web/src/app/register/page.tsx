import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { translateError } from '../../lib/apiError';
import { PasswordInput } from '../../components/auth/PasswordInput';
import { PasswordRequirements } from '../../components/auth/PasswordRequirements';
import { TurnstileWidget, isTurnstileConfigured } from '../../components/auth/TurnstileWidget';
import { isPasswordStrong } from '@mll/shared';

export const REGISTERED_EMAIL_KEY = 'mll_registered_email';

export function RegisterPage() {
  const [searchParams] = useSearchParams();
  const { register } = useAuth();
  const { t } = useTranslation(['auth', 'common']);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [referralCode, setReferralCode] = useState(searchParams.get('ref') ?? '');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [captchaLoadFailed, setCaptchaLoadFailed] = useState(false);
  const captchaRequired = isTurnstileConfigured();

  const submitBlockedByCaptcha = captchaRequired && !turnstileToken && !captchaLoadFailed;
  const passwordReady =
    isPasswordStrong(password) && password === confirmPassword && confirmPassword.length > 0;
  const submitDisabled = loading || !acceptTerms || submitBlockedByCaptcha || !passwordReady;

  const goToLogin = (targetEmail: string) => {
    try {
      sessionStorage.setItem(REGISTERED_EMAIL_KEY, targetEmail);
    } catch {
      /* private mode */
    }
    const q = new URLSearchParams({ registered: '1', email: targetEmail });
    window.location.assign(`/login?${q.toString()}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(t('auth:validation.passwordsDontMatch'));
      return;
    }

    if (!isPasswordStrong(password)) {
      setError(t('auth:validation.passwordWeak'));
      return;
    }

    if (!acceptTerms) {
      setError(t('auth:validation.termsRequired'));
      return;
    }

    setLoading(true);

    try {
      const trimmedEmail = email.trim();
      await register(trimmedEmail, username, password, {
        referralCode: referralCode.trim() || undefined,
        turnstileToken: turnstileToken ?? undefined,
      });
      try {
        sessionStorage.setItem(REGISTERED_EMAIL_KEY, trimmedEmail);
      } catch {
        /* private mode */
      }
      setRegisteredEmail(trimmedEmail);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : undefined;
      setError(translateError({ code: message }, 'AUTH_REGISTER_FAILED'));
    } finally {
      setLoading(false);
    }
  };

  if (registeredEmail) {
    return (
      <div className="auth-page-shell flex flex-col items-stretch justify-start py-6 sm:items-center sm:justify-center sm:py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="pixel-card max-w-md w-full mx-auto"
          style={{ borderColor: 'var(--gold)' }}
        >
          <div className="text-center mb-6">
            <div className="text-6xl mb-4"><i className="bi bi-envelope-fill" aria-hidden /></div>
            <h1 className="pixel-text text-2xl mb-3" style={{ color: 'var(--gold)' }}>
              {t('auth:register.successTitle')}
            </h1>
            <p className="retro-text text-lg mb-4" style={{ color: 'var(--text-secondary)' }}>
              {t('auth:register.successBody', { email: registeredEmail })}
            </p>
            <p className="retro-text text-sm" style={{ color: 'var(--text-muted)' }}>
              {t('auth:register.successHint')}
            </p>
          </div>
          <button
            type="button"
            className="pixel-btn pixel-btn-green pixel-btn-lg w-full"
            onClick={() => goToLogin(registeredEmail)}
          >
            {t('auth:register.goLogin')}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="auth-page-shell flex flex-col items-stretch justify-start py-6 sm:items-center sm:justify-center sm:py-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="pixel-card max-w-md w-full mx-auto"
        style={{ borderColor: 'var(--gold)' }}
      >
        <div className="text-center mb-6">
          <motion.div
            className="text-6xl mb-4"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <i className="bi bi-stars" aria-hidden />
          </motion.div>

          <h1 className="pixel-text text-2xl mb-2" style={{ color: 'var(--gold)' }}>
            {t('auth:register.title')}
          </h1>

          <p className="retro-text text-lg" style={{ color: 'var(--text-secondary)' }}>
            {t('auth:register.subtitle')}
          </p>
        </div>

        {error && (
          <div className="pixel-box-light p-4 mb-4 border-red">
            <p className="retro-text text-red text-center">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="register-username" className="ui-label-sm block mb-2">
              {t('auth:fields.username')}
            </label>
            <input
              id="register-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="pixel-input w-full"
              minLength={3}
              maxLength={20}
              pattern="[a-zA-Z0-9_]+"
              autoComplete="username"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="register-email" className="ui-label-sm block mb-2">
              {t('auth:fields.email')}
            </label>
            <input
              id="register-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pixel-input w-full"
              autoComplete="email"
              required
              disabled={loading}
            />
          </div>

          <PasswordInput
            id="register-password"
            label={t('auth:fields.password')}
            value={password}
            onChange={setPassword}
            minLength={8}
            autoComplete="new-password"
            disabled={loading}
          />

          <PasswordInput
            id="register-confirm-password"
            label={t('auth:fields.confirmPassword')}
            value={confirmPassword}
            onChange={setConfirmPassword}
            minLength={8}
            autoComplete="new-password"
            disabled={loading}
          />

          <PasswordRequirements password={password} confirmPassword={confirmPassword} />

          <div>
            <label htmlFor="register-referral" className="ui-label-sm block mb-2">
              {t('auth:fields.referralCode')}
            </label>
            <input
              id="register-referral"
              type="text"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
              className="pixel-input w-full"
              maxLength={8}
              disabled={loading}
              placeholder={t('auth:fields.referralPlaceholder')}
            />
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="mt-1 shrink-0"
              disabled={loading}
            />
            <span
              className="retro-text text-sm sm:text-base break-words leading-snug"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t('auth:register.acceptTermsPrefix')}{' '}
              <Link to="/legal/terms-of-use" className="text-blue hover:underline" target="_blank">
                {t('auth:register.termsOfUse')}
              </Link>
              ,{' '}
              <Link to="/legal/terms-and-conditions" className="text-blue hover:underline" target="_blank">
                {t('auth:register.termsAndConditions')}
              </Link>{' '}
              {t('auth:register.and')}{' '}
              <Link to="/legal/privacy" className="text-blue hover:underline" target="_blank">
                {t('auth:register.privacyPolicy')}
              </Link>
            </span>
          </label>

          {captchaRequired && (
            <>
              {captchaLoadFailed && (
                <div className="pixel-box-light p-3 border-red">
                  <p className="retro-text text-red text-center text-sm">
                    {t('auth:register.captchaLoadFailed')}
                  </p>
                </div>
              )}
              <TurnstileWidget
                onTokenChange={(token) => {
                  setTurnstileToken(token);
                  if (token) setCaptchaLoadFailed(false);
                }}
                onError={() => {
                  setTurnstileToken(null);
                  setCaptchaLoadFailed(true);
                }}
              />
            </>
          )}

          {submitBlockedByCaptcha && (
            <p className="retro-text text-sm text-center" style={{ color: 'var(--text-muted)' }}>
              {t('auth:register.captchaRequired')}
            </p>
          )}

          <button
            type="submit"
            className="pixel-btn pixel-btn-gold pixel-btn-lg w-full"
            disabled={submitDisabled}
          >
            {loading ? t('auth:register.submitting') : t('auth:register.submit')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="retro-text text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t('auth:register.hasAccount')}{' '}
            <Link to="/login" className="text-blue hover:underline">
              {t('auth:register.loginLink')}
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
