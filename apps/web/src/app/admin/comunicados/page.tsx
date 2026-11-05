import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { isAxiosError } from 'axios';
import type { BlogPostDTO, BlogPostListDTO } from '@mll/shared';
import { adminClient } from '../../../lib/api/adminClient';
import { resolveUploadUrl } from '../../../lib/resolveUploadUrl';
import { AdminBadge, AdminButton, AdminPageHeader } from '../../../components/admin/AdminTable';
import { usePageTab } from '../../../lib/telemetry/TabContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toSlug(title: string): string {
  return title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 160);
}

function renderMarkdown(md: string): string {
  let html = md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="md-h2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="md-h1">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer" class="md-link">$1</a>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="md-img" />')
    .replace(/^---$/gm, '<hr class="md-hr" />').replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]+?<\/li>)/g, '<ul class="md-ul">$1</ul>')
    .replace(/`([^`]+)`/g, '<code class="md-code">$1</code>')
    .replace(/\n\n/g, '</p><p class="md-p">').replace(/\n/g, '<br/>');
  return `<p class="md-p">${html}</p>`;
}

function toIsoOrNull(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function toLocalDatetime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── Notice types ─────────────────────────────────────────────────────────────

interface Notice {
  id: string; title: string; body: string; category: string; priority: string;
  imageUrl: string | null; active: boolean; showAsPopup: boolean; popupRepeatDaily: boolean;
  startsAt: string | null; endsAt: string | null; createdBy: string | null;
  createdAt: string; updatedAt: string;
}

interface NoticeForm {
  id: string | null; title: string; body: string; category: string; priority: string;
  imageUrl: string; active: boolean; showAsPopup: boolean; popupRepeatDaily: boolean;
  startsAt: string; endsAt: string;
}

const EMPTY_NOTICE: NoticeForm = {
  id: null, title: '', body: '', category: 'noticia', priority: 'normal',
  imageUrl: '', active: true, showAsPopup: false, popupRepeatDaily: false, startsAt: '', endsAt: '',
};

const NOTICE_CATEGORIES = [
  { value: 'noticia', label: 'Notícia', icon: 'bi-newspaper', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  { value: 'manutencao', label: 'Manutenção', icon: 'bi-tools', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
  { value: 'evento', label: 'Evento', icon: 'bi-calendar-event', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
  { value: 'atualizacao', label: 'Atualização', icon: 'bi-arrow-up-circle', color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/20' },
];

const PRIORITIES = [
  { value: 'urgent', label: 'Urgente', color: 'text-red-400' },
  { value: 'high', label: 'Importante', color: 'text-amber-400' },
  { value: 'normal', label: 'Normal', color: 'text-slate-400' },
];

function uploadErrorMessage(err: unknown): string {
  if (isAxiosError(err)) {
    const body = err.response?.data as { error?: { message?: string; details?: { reason?: string } } } | undefined;
    const reason = body?.error?.details?.reason;
    if (reason === 'unsupported_mime') return 'Formato não suportado. Use PNG, JPEG ou WEBP.';
    if (reason === 'file_too_large' || reason === 'file_too_large_after_encode') return 'Imagem muito grande.';
    if (reason === 'empty_file') return 'Arquivo vazio ou não recebido pelo servidor.';
    if (reason === 'invalid_image_dimensions') return 'Imagem inválida ou corrompida.';
    if (body?.error?.message) return body.error.message;
  }
  return err instanceof Error ? err.message : 'Falha ao enviar imagem';
}

function getCatMeta(cat: string) {
  return NOTICE_CATEGORIES.find((c) => c.value === cat) ?? NOTICE_CATEGORIES[0];
}

function deriveStatus(n: Notice): { label: string; variant: 'success' | 'warning' | 'default' | 'danger' } {
  const now = Date.now();
  if (!n.active) return { label: 'Inativo', variant: 'default' };
  if (n.startsAt && new Date(n.startsAt).getTime() > now) return { label: 'Agendado', variant: 'warning' };
  if (n.endsAt && new Date(n.endsAt).getTime() < now) return { label: 'Expirado', variant: 'danger' };
  return { label: 'No ar', variant: 'success' };
}

// ─── Shared styled input ──────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-400 mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-emerald-500/40 focus:outline-none';
const selectCls = `${inputCls} appearance-none`;

// ─── Notice card ──────────────────────────────────────────────────────────────

function NoticeCard({ n, onEdit, onToggle, onRemove }: {
  n: Notice; onEdit: () => void; onToggle: () => void; onRemove: () => void;
}) {
  const cat = getCatMeta(n.category);
  const status = deriveStatus(n);
  const prio = PRIORITIES.find((p) => p.value === n.priority) ?? PRIORITIES[2];

  return (
    <div className={`admin-card overflow-hidden transition-colors ${n.active && status.variant === 'success' ? 'border-white/[0.08]' : 'border-white/[0.04] opacity-70'}`}>
      {n.imageUrl && (
        <div className="h-28 overflow-hidden">
          <img src={resolveUploadUrl(n.imageUrl)} alt={n.title} className="h-full w-full object-cover opacity-80" />
        </div>
      )}
      <div className="p-4 space-y-3">
        {/* Badges */}
        <div className="flex flex-wrap gap-1.5">
          <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cat.bg} ${cat.color}`}>
            <i className={`bi ${cat.icon} text-[9px]`} />{cat.label}
          </span>
          {n.priority !== 'normal' && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border border-white/[0.06] bg-white/[0.04] ${prio.color}`}>
              {prio.label}
            </span>
          )}
          {n.showAsPopup && (
            <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
              <i className="bi bi-bell-fill text-[9px]" /> Popup
            </span>
          )}
          <AdminBadge variant={status.variant}>{status.label}</AdminBadge>
        </div>

        {/* Title + body */}
        <div>
          <p className="font-semibold text-slate-100 text-sm leading-tight">{n.title}</p>
          <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{n.body.replace(/[#*_`[\]]/g, '').slice(0, 120)}</p>
        </div>

        {/* Period */}
        {(n.startsAt || n.endsAt) && (
          <p className="text-[10px] text-slate-600">
            {n.startsAt && `De ${new Date(n.startsAt).toLocaleDateString('pt-BR')}`}
            {n.endsAt && ` até ${new Date(n.endsAt).toLocaleDateString('pt-BR')}`}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-1.5 pt-1 border-t border-white/[0.04]">
          <AdminButton size="sm" variant="secondary" className="flex-1" onClick={onEdit}>
            <i className="bi bi-pencil text-xs" /> Editar
          </AdminButton>
          <AdminButton size="sm" variant="ghost" onClick={onToggle} title={n.active ? 'Desativar' : 'Ativar'}>
            <i className={`bi ${n.active ? 'bi-pause-circle' : 'bi-play-circle'} text-xs`} />
          </AdminButton>
          <AdminButton size="sm" variant="danger" onClick={onRemove}>
            <i className="bi bi-trash text-xs" />
          </AdminButton>
        </div>
      </div>
    </div>
  );
}

// ─── Notices tab ──────────────────────────────────────────────────────────────

function NoticesTab() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [form, setForm] = useState<NoticeForm>(EMPTY_NOTICE);
  const [filter, setFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminClient.get<{ notices: Notice[] }>('/notices');
      setNotices(data.notices);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const editing = form.id !== null;

  const filtered = useMemo(() => {
    if (filter === 'all') return notices;
    if (filter === 'popup') return notices.filter((n) => n.showAsPopup);
    if (filter === 'active') return notices.filter((n) => n.active && deriveStatus(n).variant === 'success');
    return notices.filter((n) => n.category === filter);
  }, [notices, filter]);

  async function submit() {
    if (!form.title || !form.body) return;
    setSaving(true); setError('');
    const payload = {
      title: form.title, body: form.body, category: form.category, priority: form.priority,
      imageUrl: form.imageUrl || null, active: form.active, showAsPopup: form.showAsPopup,
      popupRepeatDaily: form.popupRepeatDaily,
      startsAt: toIsoOrNull(form.startsAt), endsAt: toIsoOrNull(form.endsAt),
    };
    try {
      if (form.id) {
        await adminClient.patch(`/notices/${form.id}`, payload);
        setSuccess('Aviso atualizado!');
      } else {
        await adminClient.post('/notices', payload);
        setSuccess('Aviso criado!');
      }
      setForm(EMPTY_NOTICE); setShowForm(false); await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(n: Notice) {
    setForm({
      id: n.id, title: n.title, body: n.body, category: n.category, priority: n.priority,
      imageUrl: n.imageUrl ?? '', active: n.active, showAsPopup: n.showAsPopup,
      popupRepeatDaily: n.popupRepeatDaily ?? false,
      startsAt: toLocalDatetime(n.startsAt), endsAt: toLocalDatetime(n.endsAt),
    });
    setShowForm(true); setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function toggleActive(n: Notice) {
    await adminClient.patch(`/notices/${n.id}/toggle`);
    await load();
  }

  async function remove(id: string) {
    if (!window.confirm('Excluir este aviso?')) return;
    await adminClient.delete(`/notices/${id}`);
    if (form.id === id) { setForm(EMPTY_NOTICE); setShowForm(false); }
    setSuccess('Aviso excluído'); await load();
  }

  const activeCount = notices.filter((n) => n.active && deriveStatus(n).variant === 'success').length;
  const popupCount = notices.filter((n) => n.showAsPopup).length;
  const scheduledCount = notices.filter((n) => deriveStatus(n).label === 'Agendado').length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: notices.length, icon: 'bi-megaphone', accent: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/20' },
          { label: 'No ar', value: activeCount, icon: 'bi-broadcast', accent: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
          { label: 'Popups', value: popupCount, icon: 'bi-bell-fill', accent: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
          { label: 'Agendados', value: scheduledCount, icon: 'bi-calendar-check', accent: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
        ].map(({ label, value, icon, accent, bg }) => (
          <div key={label} className="admin-card p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${bg}`}>
                <i className={`bi ${icon} text-xs ${accent}`} />
              </span>
            </div>
            <p className="mt-2 text-xl font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Feedback */}
      {(success || error) && (
        <p className={`rounded-xl border px-4 py-2.5 text-sm ${error ? 'border-red-500/25 bg-red-500/10 text-red-300' : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'}`}>
          {error || success}
        </p>
      )}

      {/* Form */}
      {showForm && (
        <div className="admin-card p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">{editing ? 'Editar aviso' : 'Novo aviso'}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{editing ? 'Modifique os campos e salve' : 'Preencha os campos e publique'}</p>
            </div>
            <AdminButton size="sm" variant="ghost" onClick={() => { setShowForm(false); setForm(EMPTY_NOTICE); setError(''); }}>
              <i className="bi bi-x text-base" />
            </AdminButton>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: inputs */}
            <div className="space-y-4">
              <Field label="Título">
                <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Ex: Manutenção programada para sábado"
                  className={inputCls} />
              </Field>

              <Field label="Corpo (Markdown)">
                <textarea value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                  placeholder="Descreva o aviso em detalhes…" rows={7}
                  className={`${inputCls} font-mono resize-y`} />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Categoria">
                  <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className={selectCls}>
                    {NOTICE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </Field>
                <Field label="Prioridade">
                  <select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} className={selectCls}>
                    {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Início (opcional)">
                  <input type="datetime-local" value={form.startsAt} onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))} className={inputCls} />
                </Field>
                <Field label="Fim (opcional)">
                  <input type="datetime-local" value={form.endsAt} onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))} className={inputCls} />
                </Field>
              </div>

              {/* Image upload */}
              <Field label="Imagem (opcional)">
                <div className="flex gap-2 items-center">
                  <label className="cursor-pointer flex-1">
                    <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-400 hover:bg-white/[0.06] transition-colors">
                      <i className="bi bi-image text-slate-500" />
                      <span className="text-xs">{uploading ? 'Enviando…' : form.imageUrl ? 'Trocar imagem' : 'Fazer upload'}</span>
                    </div>
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={uploading}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 8 * 1024 * 1024) {
                          setError('Imagem muito grande (máx. 8 MB).');
                          e.target.value = '';
                          return;
                        }
                        setUploading(true); setError('');
                        try {
                          const fd = new FormData(); fd.append('file', file);
                          const { data } = await adminClient.post<{ url: string }>('/notices/upload-image', fd);
                          setForm((f) => ({ ...f, imageUrl: data.url }));
                        } catch (err: unknown) {
                          setError(uploadErrorMessage(err));
                        } finally { setUploading(false); e.target.value = ''; }
                      }} />
                  </label>
                  {form.imageUrl && (
                    <AdminButton size="sm" variant="danger" onClick={() => setForm((f) => ({ ...f, imageUrl: '' }))}>
                      <i className="bi bi-x text-xs" />
                    </AdminButton>
                  )}
                </div>
                {form.imageUrl && <img src={resolveUploadUrl(form.imageUrl)} alt="" className="mt-2 max-h-32 w-full rounded-lg object-cover border border-white/[0.06]" />}
              </Field>

              {/* Toggles */}
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 space-y-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="text-sm text-slate-200 font-medium">Ativo</p>
                    <p className="text-xs text-slate-500">Visível para os usuários</p>
                  </div>
                  <div className="relative">
                    <input type="checkbox" className="sr-only" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
                    <div className={`h-5 w-9 rounded-full transition-colors ${form.active ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                    <div className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${form.active ? 'translate-x-4' : ''}`} />
                  </div>
                </label>
                <div className="border-t border-white/[0.04]" />
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="text-sm text-amber-300 font-medium flex items-center gap-1.5">
                      <i className="bi bi-bell-fill text-xs" /> Exibir como popup
                    </p>
                    <p className="text-xs text-slate-500">Aparece no /club após login. Use com moderação.</p>
                  </div>
                  <div className="relative">
                    <input type="checkbox" className="sr-only" checked={form.showAsPopup} onChange={(e) => setForm((f) => ({ ...f, showAsPopup: e.target.checked }))} />
                    <div className={`h-5 w-9 rounded-full transition-colors ${form.showAsPopup ? 'bg-amber-500' : 'bg-slate-700'}`} />
                    <div className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${form.showAsPopup ? 'translate-x-4' : ''}`} />
                  </div>
                </label>
                {form.showAsPopup && (
                  <>
                    <div className="border-t border-white/[0.04]" />
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <p className="text-sm text-sky-300 font-medium flex items-center gap-1.5">
                          <i className="bi bi-calendar-day text-xs" /> Repetir 1× por dia
                        </p>
                        <p className="text-xs text-slate-500">Após fechar, volta a aparecer no dia seguinte.</p>
                      </div>
                      <div className="relative">
                        <input type="checkbox" className="sr-only" checked={form.popupRepeatDaily} onChange={(e) => setForm((f) => ({ ...f, popupRepeatDaily: e.target.checked }))} />
                        <div className={`h-5 w-9 rounded-full transition-colors ${form.popupRepeatDaily ? 'bg-sky-500' : 'bg-slate-700'}`} />
                        <div className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${form.popupRepeatDaily ? 'translate-x-4' : ''}`} />
                      </div>
                    </label>
                  </>
                )}
              </div>

              {error && <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

              <div className="flex justify-end gap-2">
                <AdminButton variant="ghost" onClick={() => { setShowForm(false); setForm(EMPTY_NOTICE); }}>Cancelar</AdminButton>
                <AdminButton onClick={() => void submit()} disabled={!form.title || !form.body || saving}>
                  {saving ? <><i className="bi bi-arrow-repeat animate-spin text-xs" /> Salvando…</> : <><i className="bi bi-check-circle text-xs" /> {editing ? 'Salvar alterações' : 'Criar aviso'}</>}
                </AdminButton>
              </div>
            </div>

            {/* Right: live preview */}
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-widest mb-3">Preview — card na lista</p>
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
                  {form.imageUrl && <img src={resolveUploadUrl(form.imageUrl)} alt="" className="h-28 w-full object-cover opacity-80" />}
                  <div className="p-4 space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {(() => { const c = getCatMeta(form.category); return (
                        <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${c.bg} ${c.color}`}>
                          <i className={`bi ${c.icon} text-[9px]`} />{c.label}
                        </span>
                      ); })()}
                      {form.priority !== 'normal' && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border border-white/[0.06] bg-white/[0.04] ${PRIORITIES.find((p) => p.value === form.priority)?.color}`}>
                          {PRIORITIES.find((p) => p.value === form.priority)?.label}
                        </span>
                      )}
                      {form.showAsPopup && <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300"><i className="bi bi-bell-fill text-[9px]" /> Popup</span>}
                    </div>
                    <p className="font-semibold text-slate-100 text-sm">{form.title || <span className="text-slate-600">(título do aviso)</span>}</p>
                    <p className="text-[11px] text-slate-500 line-clamp-2">{form.body.replace(/[#*_`[\]]/g, '').slice(0, 120) || <span className="text-slate-700">(corpo do aviso)</span>}</p>
                  </div>
                </div>
              </div>

              {form.showAsPopup && (
                <div>
                  <p className="text-xs font-medium text-amber-400/70 uppercase tracking-widest mb-3">Preview — popup após login</p>
                  <div className="rounded-xl border border-amber-500/20 bg-[#060d14] p-5 shadow-2xl space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-wrap gap-1.5">
                        {(() => { const c = getCatMeta(form.category); return (
                          <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${c.bg} ${c.color}`}>
                            <i className={`bi ${c.icon} text-[9px]`} />{c.label}
                          </span>
                        ); })()}
                        {form.priority !== 'normal' && (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] border border-white/[0.06] ${PRIORITIES.find((p) => p.value === form.priority)?.color}`}>
                            {PRIORITIES.find((p) => p.value === form.priority)?.label}
                          </span>
                        )}
                      </div>
                      <i className="bi bi-x text-slate-500" />
                    </div>
                    {form.imageUrl && <img src={resolveUploadUrl(form.imageUrl)} alt="" className="w-full max-h-36 object-cover rounded-lg" />}
                    <p className="text-base font-bold text-white">{form.title || '(título)'}</p>
                    <div className="text-xs text-slate-300 leading-relaxed line-clamp-4"
                      dangerouslySetInnerHTML={{ __html: form.body ? renderMarkdown(form.body) : '(corpo)' }} />
                    <div className="flex justify-end gap-2 pt-1 border-t border-white/[0.04]">
                      <button type="button" className="rounded-lg border border-white/[0.08] px-4 py-1.5 text-xs text-slate-300">Fechar</button>
                      <button type="button" className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs text-white font-medium">Entendido</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all', label: `Todos`, count: notices.length },
          { key: 'active', label: 'No ar', count: activeCount },
          { key: 'popup', label: 'Popup', count: popupCount },
          ...NOTICE_CATEGORIES.map((c) => ({ key: c.value, label: c.label, count: notices.filter((n) => n.category === c.value).length })),
        ].map(({ key, label, count }) => (
          <button key={key} type="button" onClick={() => setFilter(key)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === key
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-white/[0.06] bg-white/[0.02] text-slate-400 hover:text-slate-200'
            }`}>
            {label}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${filter === key ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/[0.06] text-slate-500'}`}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Grid or empty */}
      {loading ? (
        <div className="admin-card flex items-center justify-center py-16">
          <p className="text-sm text-slate-400">Carregando avisos…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="admin-card flex flex-col items-center justify-center py-16 text-center">
          <i className="bi bi-megaphone text-3xl text-slate-600 mb-3" />
          <p className="text-sm text-slate-500">Nenhum aviso encontrado.</p>
          {!showForm && (
            <AdminButton className="mt-4" onClick={() => { setShowForm(true); setError(''); }}>
              <i className="bi bi-plus-circle text-xs" /> Criar aviso
            </AdminButton>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((n) => (
            <NoticeCard key={n.id} n={n}
              onEdit={() => startEdit(n)}
              onToggle={() => void toggleActive(n)}
              onRemove={() => void remove(n.id)}
            />
          ))}
          {!showForm && (
            <button type="button" onClick={() => { setShowForm(true); setForm(EMPTY_NOTICE); setError(''); }}
              className="flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/[0.08] bg-white/[0.01] text-slate-500 transition-colors hover:border-white/[0.16] hover:text-slate-300">
              <i className="bi bi-plus-circle text-2xl" />
              <span className="text-sm font-medium">Novo aviso</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Blog toolbar ─────────────────────────────────────────────────────────────

function Toolbar({ onInsert }: { onInsert: (b: string, a?: string) => void }) {
  const tools = [
    { label: 'H1', before: '# ' }, { label: 'H2', before: '## ' }, { label: 'H3', before: '### ' },
    { label: 'B', before: '**', after: '**' }, { label: 'I', before: '*', after: '*' },
    { label: 'Link', before: '[texto](', after: ')' }, { label: 'Img', before: '![alt](', after: ')' },
    { label: '—', before: '\n---\n' }, { label: '• Lista', before: '- ' }, { label: '`code`', before: '`', after: '`' },
  ];
  return (
    <div className="flex flex-wrap gap-1 border-b border-white/[0.06] pb-2 mb-2">
      {tools.map((t) => (
        <button key={t.label} type="button" onClick={() => onInsert(t.before, t.after)}
          className="rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 text-xs font-mono text-slate-300 hover:bg-white/[0.08]">
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Blog editor ──────────────────────────────────────────────────────────────

function BlogEditor({ post, onSaved, onCancel }: { post: BlogPostDTO | null; onSaved: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState(post?.title ?? '');
  const [slug, setSlug] = useState(post?.slug ?? '');
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? '');
  const [content, setContent] = useState(post?.content ?? '');
  const [tags, setTags] = useState(post?.tags.join(', ') ?? '');
  const [published, setPublished] = useState(post?.published ?? false);
  const [coverPreview, setCoverPreview] = useState<string | null>(post?.coverImageUrl ?? null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleTitleChange(val: string) { setTitle(val); if (!post) setSlug(toSlug(val)); }

  function insertAtCursor(before: string, after = '') {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart; const end = ta.selectionEnd;
    const selected = content.slice(start, end);
    setContent(content.slice(0, start) + before + selected + after + content.slice(end));
    requestAnimationFrame(() => { ta.selectionStart = start + before.length; ta.selectionEnd = start + before.length + selected.length; ta.focus(); });
  }

  async function save() {
    setError(''); setSaving(true);
    try {
      const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean);
      const payload = { title, slug, excerpt, content, tags: tagList, published };
      let saved: BlogPostDTO;
      if (post) { const res = await adminClient.put<BlogPostDTO>(`/blog/admin/posts/${post.id}`, payload); saved = res.data; }
      else { const res = await adminClient.post<BlogPostDTO>('/blog/admin/posts', payload); saved = res.data; }
      if (coverFile) { const form = new FormData(); form.append('file', coverFile); await adminClient.post(`/blog/admin/posts/${saved.id}/cover`, form); }
      onSaved();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg ?? 'Erro ao salvar');
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="admin-card p-4 flex items-center gap-3 flex-wrap">
        <AdminButton variant="ghost" size="sm" onClick={onCancel}>
          <i className="bi bi-arrow-left text-xs" /> Voltar
        </AdminButton>
        <h2 className="text-sm font-semibold text-white flex-1">{post ? 'Editar post' : 'Novo post'}</h2>
        <AdminButton size="sm" variant="secondary" onClick={() => setPreview((p) => !p)}>
          <i className={`bi ${preview ? 'bi-pencil' : 'bi-eye'} text-xs`} /> {preview ? 'Editar' : 'Preview'}
        </AdminButton>
        <label className="flex items-center gap-2 cursor-pointer">
          <div className="relative">
            <input type="checkbox" className="sr-only" checked={published} onChange={(e) => setPublished(e.target.checked)} />
            <div className={`h-5 w-9 rounded-full transition-colors ${published ? 'bg-emerald-500' : 'bg-slate-700'}`} />
            <div className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${published ? 'translate-x-4' : ''}`} />
          </div>
          <span className={`text-xs font-medium ${published ? 'text-emerald-400' : 'text-slate-400'}`}>{published ? 'Publicado' : 'Rascunho'}</span>
        </label>
        <AdminButton onClick={() => void save()} disabled={saving}>
          {saving ? <><i className="bi bi-arrow-repeat animate-spin text-xs" /> Salvando…</> : <><i className="bi bi-check-circle text-xs" /> Salvar</>}
        </AdminButton>
      </div>

      {error && <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: form */}
        <div className="admin-card p-5 space-y-4">
          <Field label="Título *">
            <input value={title} onChange={(e) => handleTitleChange(e.target.value)} placeholder="Título do post" className={inputCls} />
          </Field>
          <Field label="Slug (URL)">
            <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2">
              <span className="text-xs text-slate-600 shrink-0">/news/</span>
              <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="slug-do-post"
                className="flex-1 bg-transparent text-xs font-mono text-slate-300 focus:outline-none" />
            </div>
          </Field>
          <Field label="Resumo *">
            <textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="Resumo breve (aparece nos cards)" rows={2} maxLength={500} className={`${inputCls} resize-none`} />
          </Field>
          <Field label="Tags">
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="atualização, evento, manutenção" className={inputCls} />
          </Field>
          <Field label="Capa (opcional)">
            {coverPreview && (
              <div className="relative mb-2">
                <img src={coverPreview} alt="capa" className="w-full max-h-40 object-cover rounded-lg border border-white/[0.06]" />
                <button type="button" onClick={() => { setCoverPreview(null); setCoverFile(null); }}
                  className="absolute top-2 right-2 rounded-full bg-black/70 w-6 h-6 text-white text-xs flex items-center justify-center hover:bg-black">
                  <i className="bi bi-x" />
                </button>
              </div>
            )}
            <label className="cursor-pointer block">
              <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-slate-400 hover:bg-white/[0.06] transition-colors">
                <i className="bi bi-image text-slate-500" /> {coverPreview ? 'Trocar imagem' : 'Adicionar capa'}
              </div>
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setCoverFile(f); setCoverPreview(URL.createObjectURL(f)); } }} />
            </label>
          </Field>
          <Field label="Conteúdo (Markdown) *">
            <Toolbar onInsert={insertAtCursor} />
            <textarea ref={textareaRef} value={content} onChange={(e) => setContent(e.target.value)} rows={18}
              placeholder="Escreva o conteúdo em Markdown…"
              className={`${inputCls} font-mono leading-relaxed resize-y`} />
            <p className="text-right text-[10px] text-slate-600 mt-1">{content.length.toLocaleString()} / 50 000 chars</p>
          </Field>
        </div>

        {/* Right: preview */}
        <div className={`${preview ? 'block' : 'hidden lg:block'}`}>
          <div className="admin-card p-5" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-widest mb-4">Preview</p>
            {coverPreview && <img src={coverPreview} alt="capa" className="w-full max-h-60 object-cover rounded-lg mb-5" />}
            <h1 className="text-xl font-bold text-white mb-2">{title || <span className="text-slate-500">Título</span>}</h1>
            {tags && (
              <div className="flex flex-wrap gap-1 mb-3">
                {tags.split(',').map((t) => t.trim()).filter(Boolean).map((t) => (
                  <span key={t} className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">{t}</span>
                ))}
              </div>
            )}
            {excerpt && <p className="text-slate-300 text-sm mb-4 italic border-l-2 border-emerald-600/60 pl-3">{excerpt}</p>}
            <div className="blog-content text-sm text-slate-200 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Blog tab ─────────────────────────────────────────────────────────────────

function BlogTab() {
  const [view, setBlogView] = useState<'list' | 'new' | 'edit'>('list');
  const [posts, setPosts] = useState<BlogPostListDTO[]>([]);
  const [editPost, setEditPost] = useState<BlogPostDTO | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try { const res = await adminClient.get<BlogPostListDTO[]>('/blog/admin/posts'); setPosts(res.data); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function openEdit(id: string) {
    const res = await adminClient.get<BlogPostDTO>(`/blog/admin/posts/${id}`);
    setEditPost(res.data); setBlogView('edit');
  }

  async function deletePost(id: string) {
    if (!window.confirm('Excluir este post permanentemente?')) return;
    await adminClient.delete(`/blog/admin/posts/${id}`); await load();
  }

  async function togglePublish(post: BlogPostListDTO) {
    await adminClient.put(`/blog/admin/posts/${post.id}`, { published: !post.published }); await load();
  }

  if (view === 'new') return <BlogEditor post={null} onSaved={() => { void load(); setBlogView('list'); }} onCancel={() => setBlogView('list')} />;
  if (view === 'edit' && editPost) return <BlogEditor post={editPost} onSaved={() => { void load(); setBlogView('list'); setEditPost(null); }} onCancel={() => { setBlogView('list'); setEditPost(null); }} />;

  const published = posts.filter((p) => p.published).length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', value: posts.length, icon: 'bi-file-text', accent: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/20' },
          { label: 'Publicados', value: published, icon: 'bi-globe', accent: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
          { label: 'Rascunhos', value: posts.length - published, icon: 'bi-pencil-square', accent: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20' },
        ].map(({ label, value, icon, accent, bg }) => (
          <div key={label} className="admin-card p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${bg}`}>
                <i className={`bi ${icon} text-xs ${accent}`} />
              </span>
            </div>
            <p className="mt-2 text-xl font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <AdminButton onClick={() => setBlogView('new')}>
          <i className="bi bi-plus-circle text-xs" /> Novo post
        </AdminButton>
      </div>

      {loading ? (
        <div className="admin-card flex items-center justify-center py-16">
          <p className="text-sm text-slate-400">Carregando posts…</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="admin-card flex flex-col items-center justify-center py-16 text-center">
          <i className="bi bi-file-earmark-text text-3xl text-slate-600 mb-3" />
          <p className="text-sm text-slate-500">Nenhum post ainda.</p>
          <AdminButton className="mt-4" onClick={() => setBlogView('new')}>
            <i className="bi bi-plus-circle text-xs" /> Criar primeiro post
          </AdminButton>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => (
            <div key={p.id} className="admin-card flex gap-4 items-start">
              {p.coverImageUrl && (
                <img src={p.coverImageUrl} alt={p.title} className="h-20 w-28 shrink-0 rounded-lg object-cover border border-white/[0.06]" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-sm text-white truncate">{p.title}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${p.published ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-white/[0.06] bg-white/[0.03] text-slate-500'}`}>
                    {p.published ? 'Publicado' : 'Rascunho'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{p.excerpt}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {p.tags.map((t) => <span key={t} className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 text-[10px] text-slate-400">{t}</span>)}
                  <span className="text-[10px] text-slate-600 ml-auto">{new Date(p.createdAt).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <AdminButton size="sm" variant="secondary" onClick={() => void openEdit(p.id)}>
                  <i className="bi bi-pencil text-xs" />
                </AdminButton>
                <AdminButton size="sm" variant="ghost" onClick={() => void togglePublish(p)} title={p.published ? 'Despublicar' : 'Publicar'}>
                  <i className={`bi ${p.published ? 'bi-eye-slash' : 'bi-globe'} text-xs`} />
                </AdminButton>
                <AdminButton size="sm" variant="danger" onClick={() => void deletePost(p.id)}>
                  <i className="bi bi-trash text-xs" />
                </AdminButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type Tab = 'avisos' | 'blog';

export function AdminComunicadosPage() {
  const [tab, setTab] = useState<Tab>('avisos');
  usePageTab(tab);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Comunicados"
        subtitle="Gerencie avisos, anúncios popup e posts do blog em um só lugar."
      />

      <p className="text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
        <span>
          Envios para Telegram:{' '}
          <Link to="/admin/telegram" className="text-sky-400 hover:text-sky-300 underline-offset-2 hover:underline">
            Gerenciar Telegram →
          </Link>
        </span>
        <span>
          E-mail marketing:{' '}
          <Link to="/admin/email" className="text-sky-400 hover:text-sky-300 underline-offset-2 hover:underline">
            Gerenciar E-mail →
          </Link>
        </span>
      </p>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl border border-white/[0.06] bg-white/[0.02] w-fit">
        {([
          { key: 'avisos', icon: 'bi-megaphone', label: 'Avisos & Anúncios' },
          { key: 'blog', icon: 'bi-file-richtext', label: 'Blog' },
        ] as { key: Tab; icon: string; label: string }[]).map(({ key, icon, label }) => (
          <button key={key} type="button" onClick={() => setTab(key)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === key
                ? 'bg-white/[0.08] text-slate-100 shadow'
                : 'text-slate-500 hover:text-slate-300'
            }`}>
            <i className={`bi ${icon} text-xs`} /> {label}
          </button>
        ))}
      </div>

      {tab === 'avisos' ? <NoticesTab /> : <BlogTab />}
    </div>
  );
}
