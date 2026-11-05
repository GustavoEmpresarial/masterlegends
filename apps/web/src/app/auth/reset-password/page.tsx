import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isPasswordStrong } from '@mll/shared';
import { apiClient } from '../../../lib/api/client';
import { translateError } from '../../../lib/apiError';
import { PasswordInput } from '../../../components/auth/PasswordInput';
import { PasswordRequirements } from '../../../components/auth/PasswordRequirements';

export function ResetPasswordPage() {
  const { t } = useTranslation(['auth']);
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const passwordReady =
    isPasswordStrong(password) && password === confirm && confirm.length > 0;

  if (!token) {
    return (
      <div className="auth-page-shell flex flex-col items-stretch justify-start py-6 sm:items-center sm:justify-center sm:py-10">
        <div className="pixel-card max-w-md w-full mx-auto border-red">
          <p className="retro-text text-red">{t('auth:reset.missingToken')}</p>
        </div>
      </div>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError(t('auth:validation.passwordsDontMatch'));
      return;
    }
    if (!isPasswordStrong(password)) {
      setError(t('auth:validation.passwordWeak'));
      return;
    }
    setLoading(true);
    try {
      await apiClient.post('/auth/reset-password', { token, newPassword: password });
      setDone(true);
    } catch (err) {
      setError(translateError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-shell flex flex-col items-stretch justify-start py-6 sm:items-center sm:justify-center sm:py-10">
      <div className="pixel-card max-w-md w-full mx-auto" style={{ borderColor: 'var(--gold)' }}>
        <h1 className="pixel-text text-2xl mb-2" style={{ color: 'var(--gold)' }}>
          {t('auth:reset.title')}
        </h1>
        <p className="retro-text text-lg mb-6" style={{ color: 'var(--text-secondary)' }}>
          {t('auth:reset.subtitle')}
        </p>

        {done ? (
          <>
            <p className="retro-text text-lg mb-4" style={{ color: 'var(--green)' }}>
              {t('auth:reset.success')}
            </p>
            <Link to="/login" className="pixel-btn pixel-btn-green pixel-btn-md w-full inline-block text-center">
              {t('auth:login.title')}
            </Link>
          </>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            {error && (
              <div className="pixel-box-light p-3 border-red">
                <p className="retro-text text-red">{error}</p>
              </div>
            )}
            <PasswordInput
              id="reset-password"
              label={t('auth:fields.password')}
              value={password}
              onChange={setPassword}
              minLength={8}
              autoComplete="new-password"
              disabled={loading}
            />
            <PasswordInput
              id="reset-confirm-password"
              label={t('auth:fields.confirmPassword')}
              value={confirm}
              onChange={setConfirm}
              minLength={8}
              autoComplete="new-password"
              disabled={loading}
            />
            <PasswordRequirements password={password} confirmPassword={confirm} />
            <button
              type="submit"
              disabled={loading || !passwordReady}
              className="pixel-btn pixel-btn-gold pixel-btn-md w-full"
            >
              {loading ? t('auth:reset.submitting') : t('auth:reset.submit')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
