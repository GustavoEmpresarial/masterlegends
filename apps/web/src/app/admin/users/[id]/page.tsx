import { Link, useParams } from 'react-router-dom';
import { useAdminAuth } from '../../../../hooks/useAdminAuth';
import { UserAccountPanel } from '../../../../components/admin/UserAccountPanel';
import { adminPt } from '../../../../lib/admin/i18n';

export function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { canManageUsers } = useAdminAuth();
  const t = adminPt.users;

  if (!id) return null;

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        to="/admin/users"
        className="mb-5 inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-emerald-400"
      >
        <i className="bi bi-arrow-left" aria-hidden />
        {t.backToList}
      </Link>
      <UserAccountPanel userId={id} canManage={canManageUsers} />
    </div>
  );
}
