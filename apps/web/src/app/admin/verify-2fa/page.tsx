import { FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AdminButton, AdminInput } from '../../../components/admin/AdminTable';
import { useAdminAuth } from '../../../hooks/useAdminAuth';
import { adminPt } from '../../../lib/admin/i18n';

interface LocationState {
  challengeId?: string;
  expiresIn?: number;
}

export function AdminVerify2faPage() {
  const { verify2fa } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as LocationState;
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const t = adminPt.verify2fa;

  if (!state.challengeId) {
    return <Navigate to="/admin/login" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await verify2fa(state.challengeId!, code);
      navigate('/admin', { replace: true });
    } catch {
      setError(t.invalidCode);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-main-bg flex min-h-screen items-center justify-center bg-[#070b14] p-6 text-slate-100">
      <form onSubmit={handleSubmit} className="admin-auth-card w-full max-w-md space-y-5 p-8">
        <div>
          <h1 className="text-xl font-semibold text-white">{t.title}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {state.expiresIn ? t.subtitle(Math.ceil(state.expiresIn / 60)) : t.subtitle(5)}
          </p>
        </div>
        {error && (
          <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}
        <label className="block space-y-1.5">
          <span className="text-sm text-slate-300">{t.code}</span>
          <AdminInput
            className="text-center text-lg tracking-[0.35em]"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            pattern="\d{6}"
            required
          />
        </label>
        <AdminButton type="submit" disabled={loading || code.length !== 6} className="w-full">
          {loading ? t.verifying : t.verify}
        </AdminButton>
      </form>
    </div>
  );
}
