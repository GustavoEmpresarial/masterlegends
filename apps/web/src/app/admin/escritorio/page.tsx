import { useEffect, useState } from 'react';
import type { OfficeStaffConfigDTO } from '@mll/shared';
import { adminClient } from '../../../lib/api/adminClient';
import { AdminPageHeader } from '../../../components/admin/AdminTable';
import { usePageTab } from '../../../lib/telemetry/TabContext';
import { OfficeStaffEditor } from '../../../components/admin/OfficeStaffEditor';
import { OfficeAfflictionBroadcaster } from '../../../components/admin/OfficeAfflictionBroadcaster';

type Tab = 'treasurer' | 'coach' | 'events';

const TABS: Array<{ key: Tab; label: string; icon: string }> = [
  { key: 'treasurer', label: 'Tesoureiro', icon: 'bi-briefcase-fill' },
  { key: 'coach',     label: 'Treinador',  icon: 'bi-person-video2' },
  { key: 'events',   label: 'Eventos',    icon: 'bi-calendar-event-fill' },
];

export function AdminEscritorioPage() {
  const [config, setConfig] = useState<OfficeStaffConfigDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('treasurer');
  usePageTab(tab);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const { data } = await adminClient.get<OfficeStaffConfigDTO>('/office-staff-config');
      setConfig(data);
    } catch {
      setError('Não foi possível carregar a configuração do escritório');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Escritório"
        subtitle="Configure Tesoureiro, Treinador e eventos do escritório em um só lugar"
      />

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl border border-white/[0.06] bg-white/[0.02] w-fit">
        {TABS.map(({ key, icon, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === key ? 'bg-white/[0.08] text-slate-100' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <i className={`bi ${icon} text-xs`} />
            {label}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{error}</p>
      )}

      {loading ? (
        <div className="admin-card p-5 flex items-center justify-center py-16">
          <p className="text-sm text-slate-400">Carregando…</p>
        </div>
      ) : (
        <>
          {config && tab !== 'events' && (
            <OfficeStaffEditor
              initial={config}
              onSaved={() => void load()}
              activeRole={tab}
            />
          )}
          {tab === 'events' && <OfficeAfflictionBroadcaster />}
        </>
      )}
    </div>
  );
}
