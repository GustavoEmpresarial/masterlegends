import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../../lib/api/client';
import { translateError } from '../../../lib/apiError';

export function ForgotPasswordPage() {
  const { t } = useTranslation(['auth']);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiClient.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(translateError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-shell flex flex-col items-stretch justify-start py-6 sm:items-center sm:justify-center sm:py-10">
      <div className="pixel-card max-w-md w-full mx-auto" style={{ borderColor: 'var(--blue)' }}>
        <h1 className="pixel-text text-2xl mb-2" style={{ color: 'var(--blue)' }}>
          {t('auth:forgot.title')}
        </h1>
        <p className="retro-text text-lg mb-6" style={{ color: 'var(--text-secondary)' }}>
          {t('auth:forgot.subtitle')}
        </p>

        {sent ? (
          <p className="retro-text text-lg" style={{ color: 'var(--green)' }}>
            {t('auth:forgot.sent')}
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            {error && (
              <div className="pixel-box-light p-3 border-red">
                <p className="retro-text text-red">{error}</p>
              </div>
            )}
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pixel-input w-full"
              disabled={loading}
              placeholder={t('auth:fields.email')}
              aria-label={t('auth:fields.email')}
            />
            <button
              type="submit"
              disabled={loading}
              className="pixel-btn pixel-btn-blue pixel-btn-md w-full"
            >
              {loading ? t('auth:forgot.submitting') : t('auth:forgot.submit')}
            </button>
          </form>
        )}

        <p className="retro-text text-sm mt-6 text-center" style={{ color: 'var(--text-muted)' }}>
          <Link to="/login" className="text-blue hover:underline">{t('auth:login.title')}</Link>
        </p>
      </div>
    </div>
  );
}
