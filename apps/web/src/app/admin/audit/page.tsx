import { useEffect, useState } from 'react';
import { adminClient } from '../../../lib/api/adminClient';
import { AdminPageHeader, AdminTable } from '../../../components/admin/AdminTable';
import { adminPt, auditActionLabel, formatAdminDate, severityLabel } from '../../../lib/admin/i18n';

interface AuditRow {
  id: string;
  action: string;
  severity: string;
  ip: string | null;
  createdAt: string;
  meta: unknown;
}

export function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const t = adminPt.audit;

  useEffect(() => {
    void adminClient
      .get<{ logs: AuditRow[] }>('/audit-logs', { params: { limit: 50 } })
      .then((res) => setLogs(res.data.logs))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <AdminPageHeader title={t.title} subtitle={t.subtitle} />
      <AdminTable
        loading={loading}
        rows={logs}
        rowKey={(l) => l.id}
        columns={[
          { key: 'action', header: t.action, render: (l) => auditActionLabel(l.action) },
          { key: 'severity', header: t.severity, render: (l) => severityLabel(l.severity) },
          { key: 'ip', header: t.ip, render: (l) => l.ip ?? adminPt.dash },
          { key: 'when', header: adminPt.when, render: (l) => formatAdminDate(l.createdAt) },
        ]}
      />
    </>
  );
}
