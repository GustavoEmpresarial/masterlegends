import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminButton, AdminInput } from '../../../components/admin/AdminTable';
import { useAdminAuth } from '../../../hooks/useAdminAuth';
import { adminPt } from '../../../lib/admin/i18n';

export function AdminLoginPage() {
  const { login } = useAdminAuth();
  const navigate = useNavigate();
  const [loginName, setLoginName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const t = adminPt.login;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(loginName, password);
      if ('accessToken' in result) {
        navigate('/admin', { replace: true });
        return;
      }
      navigate('/admin/verify-2fa', {
        state: { challengeId: result.challengeId, expiresIn: result.expiresIn },
      });
    } catch {
      setError(t.invalidCredentials);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-main-bg flex min-h-screen items-center justify-center bg-[#070b14] p-6 text-slate-100">
      <form onSubmit={handleSubmit} className="admin-auth-card w-full max-w-md space-y-5 p-8">
        <div className="flex items-center gap-3">
          <div className="admin-brand-mark flex h-11 w-11 items-center justify-center rounded-xl text-sm font-black">
            ML
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">{t.title}</h1>
            <p className="text-sm text-slate-400">{t.subtitle}</p>
          </div>
        </div>
        {error && (
          <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}
        <label className="block space-y-1.5">
          <span className="text-sm text-slate-300">{t.loginLabel}</span>
          <AdminInput
            value={loginName}
            onChange={(e) => setLoginName(e.target.value)}
            autoComplete="username"
            placeholder="admin"
            required
          />
          <span className="text-xs text-slate-500">{t.loginHint}</span>
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm text-slate-300">{t.password}</span>
          <AdminInput
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <AdminButton
          type="submit"
          disabled={loading}
          className="w-full"
        >
          {loading ? t.signingIn : t.signIn}
        </AdminButton>
      </form>
    </div>
  );
}
