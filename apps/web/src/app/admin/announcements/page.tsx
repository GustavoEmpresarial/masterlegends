import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SiteAnnouncementDTO } from '@mll/shared';
import { adminClient } from '../../../lib/api/adminClient';
import { AdminBadge, AdminPageHeader, AdminTable } from '../../../components/admin/AdminTable';
import { adminPt } from '../../../lib/admin/i18n';

type Filter = 'all' | 'active' | 'inactive';

interface FormState {
  id: string | null;
  title: string;
  body: string;
  active: boolean;
  dismissible: boolean;
  startsAt: string;
  endsAt: string;
}

const EMPTY_FORM: FormState = {
  id: null,
  title: '',
  body: '',
  active: false,
  dismissible: true,
  startsAt: '',
  endsAt: '',
};

const TITLE_MAX = 120;
const BODY_MAX = 5000;

function toIsoOrNull(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function deriveStatus(item: SiteAnnouncementDTO): {
  label: string;
  variant: 'success' | 'warning' | 'default' | 'danger';
} {
  const now = Date.now();
  if (!item.active) return { label: adminPt.announcements.inactive, variant: 'default' };
  if (item.startsAt && new Date(item.startsAt).getTime() > now)
    return { label: adminPt.announcements.scheduled, variant: 'warning' };
  if (item.endsAt && new Date(item.endsAt).getTime() < now)
    return { label: adminPt.announcements.expired, variant: 'danger' };
  return { label: adminPt.announcements.live, variant: 'success' };
}

export function AdminAnnouncementsPage() {
  const t = adminPt.announcements;
  const [items, setItems] = useState<SiteAnnouncementDTO[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [filter, setFilter] = useState<Filter>('all');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data } = await adminClient.get<{ announcements: SiteAnnouncementDTO[] }>(
      '/announcements',
    );
    setItems(data.announcements);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const editing = form.id !== null;

  const filtered = useMemo(() => {
    if (filter === 'active') return items.filter((i) => i.active);
    if (filter === 'inactive') return items.filter((i) => !i.active);
    return items;
  }, [items, filter]);

  const titleLen = form.title.length;
  const bodyLen = form.body.length;
  const canSubmit = titleLen > 0 && bodyLen > 0 && titleLen <= TITLE_MAX && bodyLen <= BODY_MAX;

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    setError('');
    const payload = {
      title: form.title,
      body: form.body,
      active: form.active,
      dismissible: form.dismissible,
      startsAt: toIsoOrNull(form.startsAt),
      endsAt: toIsoOrNull(form.endsAt),
    };
    try {
      if (form.id) {
        await adminClient.patch(`/announcements/${form.id}`, payload);
      } else {
        await adminClient.post('/announcements', payload);
      }
      setForm(EMPTY_FORM);
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(item: SiteAnnouncementDTO) {
    setForm({
      id: item.id,
      title: item.title,
      body: item.body,
      active: item.active,
      dismissible: item.dismissible,
      startsAt: toLocalInput(item.startsAt),
      endsAt: toLocalInput(item.endsAt),
    });
    setError('');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function startDuplicate(item: SiteAnnouncementDTO) {
    setForm({
      id: null,
      title: `${item.title} (cópia)`,
      body: item.body,
      active: false,
      dismissible: item.dismissible,
      startsAt: '',
      endsAt: '',
    });
    setError('');
  }

  async function toggleActive(item: SiteAnnouncementDTO) {
    await adminClient.patch(`/announcements/${item.id}`, { active: !item.active });
    await load();
  }

  async function remove(id: string) {
    if (!window.confirm(t.confirmDelete)) return;
    await adminClient.delete(`/announcements/${id}`);
    if (form.id === id) setForm(EMPTY_FORM);
    await load();
  }

  return (
    <>
      <AdminPageHeader title={t.title} subtitle={t.subtitle} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* FORM */}
        <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">{editing ? t.edit : t.new}</h2>
            {editing && (
              <button
                type="button"
                onClick={() => setForm(EMPTY_FORM)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                {t.cancel}
              </button>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-slate-400">{adminPt.title}</label>
              <span
                className={`text-[10px] ${titleLen > TITLE_MAX ? 'text-red-400' : 'text-slate-500'}`}
              >
                {titleLen}/{TITLE_MAX}
              </span>
            </div>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder={t.titlePlaceholder}
              maxLength={TITLE_MAX + 10}
              className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-slate-400">{t.body}</label>
              <span
                className={`text-[10px] ${bodyLen > BODY_MAX ? 'text-red-400' : 'text-slate-500'}`}
              >
                {bodyLen}/{BODY_MAX}
              </span>
            </div>
            <textarea
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              placeholder={t.bodyPlaceholder}
              rows={6}
              className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-mono"
            />
          </div>

          <div>
            <p className="text-xs text-slate-400 mb-2">{t.schedule}</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-500">{t.startsAt}</label>
                <input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                  className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500">{t.endsAt}</label>
                <input
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                  className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                />
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            />
            {t.active}
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.dismissible}
              onChange={(e) => setForm((f) => ({ ...f, dismissible: e.target.checked }))}
            />
            {form.dismissible ? t.dismissible : t.nonDismissible}
          </label>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!canSubmit || saving}
              className="rounded bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 text-sm font-medium"
            >
              {saving ? '...' : editing ? t.save : adminPt.create}
            </button>
          </div>
        </div>

        {/* PREVIEW */}
        <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4">
          <h2 className="text-sm font-medium mb-1">{t.preview}</h2>
          <p className="text-[11px] text-slate-500 mb-3">{t.previewHint}</p>
          <div className="rounded-lg border-2 border-amber-500/40 bg-slate-950 p-5 space-y-3 min-h-[200px]">
            <div className="text-xs uppercase tracking-wide text-emerald-400">
              {form.title || '(título do anúncio)'}
            </div>
            <div className="text-sm text-slate-300 whitespace-pre-wrap font-mono">
              {form.body || '(corpo do anúncio aparecerá aqui)'}
            </div>
            <button
              type="button"
              disabled
              className="w-full rounded bg-emerald-700/40 border border-emerald-500/40 px-4 py-2 text-sm cursor-not-allowed"
            >
              OK (5s)
            </button>
            {!form.dismissible && (
              <p className="text-[10px] text-amber-400">
                <i className="bi bi-exclamation-triangle-fill" aria-hidden /> Anúncio obrigatório — não pode ser fechado pelo jogador
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        {(['all', 'active', 'inactive'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded px-3 py-1 text-xs ${
              filter === f
                ? 'bg-emerald-700 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {f === 'all' ? t.filterAll : f === 'active' ? t.filterActive : t.filterInactive}
            <span className="ml-1 opacity-60">
              ({f === 'all' ? items.length : items.filter((i) => (f === 'active' ? i.active : !i.active)).length})
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-700 p-8 text-center text-sm text-slate-500">
          {t.empty}
        </div>
      ) : (
        <AdminTable
          rows={filtered}
          rowKey={(a) => a.id}
          columns={[
            {
              key: 'title',
              header: adminPt.title,
              render: (a) => (
                <div>
                  <div className="font-medium text-slate-100">{a.title}</div>
                  <div className="text-[11px] text-slate-500 line-clamp-1">{a.body}</div>
                </div>
              ),
            },
            {
              key: 'status',
              header: adminPt.status,
              render: (a) => {
                const s = deriveStatus(a);
                return <AdminBadge variant={s.variant}>{s.label}</AdminBadge>;
              },
            },
            {
              key: 'seen',
              header: t.seen,
              render: (a) => (
                <span className="text-xs text-slate-300">{a.dismissalsCount ?? 0}</span>
              ),
            },
            {
              key: 'schedule',
              header: t.schedule,
              render: (a) => (
                <div className="text-[11px] text-slate-400">
                  {a.startsAt && <div>▶ {new Date(a.startsAt).toLocaleString()}</div>}
                  {a.endsAt && <div>⏹ {new Date(a.endsAt).toLocaleString()}</div>}
                  {!a.startsAt && !a.endsAt && <span className="text-slate-600">—</span>}
                </div>
              ),
            },
            {
              key: 'created',
              header: t.createdBy,
              render: (a) => (
                <div className="text-[11px] text-slate-400">
                  <div>{a.createdBy}</div>
                  <div className="text-slate-600">{new Date(a.createdAt).toLocaleDateString()}</div>
                </div>
              ),
            },
            {
              key: 'actions',
              header: adminPt.actions,
              render: (a) => (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(a)}
                    className="text-xs text-sky-400 hover:text-sky-300"
                  >
                    <i className="bi bi-pencil-fill" aria-hidden /> Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleActive(a)}
                    className="text-xs text-emerald-400 hover:text-emerald-300"
                  >
                    {a.active ? '⏸' : '▶'} {adminPt.toggle}
                  </button>
                  <button
                    type="button"
                    onClick={() => startDuplicate(a)}
                    className="text-xs text-amber-400 hover:text-amber-300"
                  >
                    ⎘ {t.duplicate}
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(a.id)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    <i className="bi bi-x-lg" aria-hidden /> {adminPt.delete}
                  </button>
                </div>
              ),
            },
          ]}
        />
      )}
    </>
  );
}
