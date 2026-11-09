import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminClient } from '../../../lib/api/adminClient';
import { AdminButton, AdminPageHeader } from '../../../components/admin/AdminTable';
import { SanitizedHtml } from '../../../lib/sanitized-html';

// ─── Markdown renderer ────────────────────────────────────────────────────────

function renderMarkdown(md: string): string {
  const html = md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="md-h2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="md-h1">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer" class="md-link">$1</a>')
    .replace(/^---$/gm, '<hr class="md-hr" />').replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/`([^`]+)`/g, '<code class="md-code">$1</code>')
    .replace(/\n\n/g, '</p><p class="md-p">').replace(/\n/g, '<br/>');
  return `<p class="md-p">${html}</p>`;
}

// ─── Shared ───────────────────────────────────────────────────────────────────

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

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="relative cursor-pointer" onClick={() => onChange(!checked)}>
      <div className={`h-5 w-9 rounded-full transition-colors ${checked ? 'bg-emerald-500' : 'bg-slate-700'}`} />
      <div className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
    </div>
  );
}

// ─── Section types ────────────────────────────────────────────────────────────

interface Section {
  id: string; title: string; body: string; imageUrl: string | null;
  order: number; visible: boolean; createdAt: string; updatedAt: string;
}

interface SectionForm {
  id: string | null; title: string; body: string; imageUrl: string; order: number; visible: boolean;
}

const EMPTY_SECTION: SectionForm = { id: null, title: '', body: '', imageUrl: '', order: 0, visible: true };

// ─── Financial types ──────────────────────────────────────────────────────────

interface FinancialRecord {
  id: string; type: 'receita' | 'despesa'; label: string; description: string | null;
  amount: number; currency: string; recurring: boolean; recurringPeriod: string | null;
  source: string | null; referenceUrl: string | null; imageUrl: string | null;
  date: string; visible: boolean; createdAt: string; updatedAt: string;
}

interface FinancialSummary {
  totalReceita: number; totalDespesa: number; lucroLiquido: number; recorrente: number; total: number;
}

interface FinancialForm {
  id: string | null; type: 'receita' | 'despesa'; label: string; description: string;
  amount: string; currency: string; recurring: boolean; recurringPeriod: string;
  source: string; referenceUrl: string; imageUrl: string; date: string; visible: boolean;
}

const EMPTY_FINANCIAL: FinancialForm = {
  id: null, type: 'receita', label: '', description: '', amount: '',
  currency: 'usdc', recurring: false, recurringPeriod: 'monthly',
  source: '', referenceUrl: '', imageUrl: '', date: new Date().toISOString().slice(0, 10), visible: true,
};

const CURRENCIES = ['usdc', 'brl', 'usd'];
const RECURRING_PERIODS = [{ value: 'monthly', label: 'Mensal' }, { value: 'yearly', label: 'Anual' }];

function fmtCurrency(amount: number, currency: string): string {
  if (currency === 'brl') return `R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${currency.toUpperCase()}`;
}

// ─── Sections tab ─────────────────────────────────────────────────────────────

function SectionCard({
  s, index, total, onEdit, onRemove, onMoveUp, onMoveDown, onToggle,
}: {
  s: Section; index: number; total: number;
  onEdit: () => void; onRemove: () => void; onMoveUp: () => void; onMoveDown: () => void; onToggle: () => void;
}) {
  const snippet = s.body.replace(/[#*_`[\]]/g, '').slice(0, 140);
  return (
    <div className={`admin-card ${!s.visible ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3 p-4">
        <div className="flex flex-col items-center gap-1 shrink-0">
          <button type="button" onClick={onMoveUp} disabled={index === 0}
            className="flex h-6 w-6 items-center justify-center rounded border border-white/[0.06] bg-white/[0.02] text-slate-500 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed">
            <i className="bi bi-chevron-up text-[10px]" />
          </button>
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.04] text-[11px] font-bold text-slate-400">{s.order}</span>
          <button type="button" onClick={onMoveDown} disabled={index === total - 1}
            className="flex h-6 w-6 items-center justify-center rounded border border-white/[0.06] bg-white/[0.02] text-slate-500 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed">
            <i className="bi bi-chevron-down text-[10px]" />
          </button>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-slate-100 text-sm">{s.title}</p>
            <span className={`shrink-0 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${s.visible ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-white/[0.06] bg-white/[0.03] text-slate-500'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${s.visible ? 'bg-emerald-400' : 'bg-slate-600'}`} />
              {s.visible ? 'Visível' : 'Oculto'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 line-clamp-2">{snippet}{s.body.length > 140 ? '…' : ''}</p>
          <p className="text-[10px] text-slate-700">Atualizado {new Date(s.updatedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
        </div>
      </div>
      <div className="flex gap-1.5 px-4 pb-4 pt-1 border-t border-white/[0.04]">
        <AdminButton size="sm" variant="secondary" className="flex-1" onClick={onEdit}><i className="bi bi-pencil text-xs" /> Editar</AdminButton>
        <AdminButton size="sm" variant="ghost" onClick={onToggle}><i className={`bi ${s.visible ? 'bi-eye-slash' : 'bi-eye'} text-xs`} /></AdminButton>
        <AdminButton size="sm" variant="danger" onClick={onRemove}><i className="bi bi-trash text-xs" /></AdminButton>
      </div>
    </div>
  );
}

function SectionsTab() {
  const [sections, setSections] = useState<Section[]>([]);
  const [form, setForm] = useState<SectionForm>(EMPTY_SECTION);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { const { data } = await adminClient.get<{ sections: Section[] }>('/transparency'); setSections(data.sections); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const editing = form.id !== null;
  const sorted = useMemo(() => [...sections].sort((a, b) => a.order - b.order), [sections]);

  async function submit() {
    if (!form.title || !form.body) return;
    setSaving(true); setError('');
    try {
      if (form.id) { await adminClient.patch(`/transparency/${form.id}`, { title: form.title, body: form.body, imageUrl: form.imageUrl || null, order: form.order, visible: form.visible }); setSuccess('Seção atualizada!'); }
      else { await adminClient.post('/transparency', { title: form.title, body: form.body, imageUrl: form.imageUrl || null, order: form.order, visible: form.visible }); setSuccess('Seção criada!'); }
      setForm(EMPTY_SECTION); setShowForm(false); await load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Erro ao salvar'); }
    finally { setSaving(false); }
  }

  function startEdit(s: Section) {
    setForm({ id: s.id, title: s.title, body: s.body, imageUrl: s.imageUrl ?? '', order: s.order, visible: s.visible });
    setShowForm(true); setError(''); window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function remove(id: string) {
    if (!window.confirm('Excluir esta seção?')) return;
    await adminClient.delete(`/transparency/${id}`);
    if (form.id === id) { setForm(EMPTY_SECTION); setShowForm(false); }
    setSuccess('Seção excluída'); await load();
  }

  async function toggleVisible(s: Section) {
    await adminClient.patch(`/transparency/${s.id}`, { visible: !s.visible }); await load();
  }

  async function moveSection(s: Section, direction: 'up' | 'down') {
    const idx = sorted.findIndex((x) => x.id === s.id);
    const swap = direction === 'up' ? sorted[idx - 1] : sorted[idx + 1];
    if (!swap) return;
    await Promise.all([
      adminClient.patch(`/transparency/${s.id}`, { order: swap.order }),
      adminClient.patch(`/transparency/${swap.id}`, { order: s.order }),
    ]);
    await load();
  }

  const visibleCount = sections.filter((s) => s.visible).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Seções', value: sections.length, icon: 'bi-file-text', accent: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/20' },
          { label: 'Visíveis', value: visibleCount, icon: 'bi-eye', accent: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
          { label: 'Ocultas', value: sections.length - visibleCount, icon: 'bi-eye-slash', accent: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20' },
        ].map(({ label, value, icon, accent, bg }) => (
          <div key={label} className="admin-card p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${bg}`}><i className={`bi ${icon} text-xs ${accent}`} /></span>
            </div>
            <p className="mt-2 text-xl font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>

      {(success || error) && (
        <p className={`rounded-xl border px-4 py-2.5 text-sm ${error ? 'border-red-500/25 bg-red-500/10 text-red-300' : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'}`}>{error || success}</p>
      )}

      {showForm && (
        <div className="admin-card p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">{editing ? 'Editar seção' : 'Nova seção'}</h2>
              <p className="text-xs text-slate-500 mt-0.5">Suporta Markdown completo</p>
            </div>
            <AdminButton size="sm" variant="ghost" onClick={() => { setShowForm(false); setForm(EMPTY_SECTION); setError(''); }}><i className="bi bi-x text-base" /></AdminButton>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Field label="Título"><input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Ex: Sobre o Projeto" className={inputCls} /></Field>
              <Field label="Conteúdo (Markdown)">
                <textarea value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} placeholder="Conteúdo em Markdown…" rows={14} className={`${inputCls} font-mono resize-y`} />
                <p className="text-right text-[10px] text-slate-600 mt-1">{form.body.length.toLocaleString()} chars</p>
              </Field>
              <Field label="Imagem (opcional)">
                <div className="flex gap-2">
                  <label className="cursor-pointer flex-1">
                    <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-slate-400 hover:bg-white/[0.06]">
                      <i className="bi bi-image text-slate-500" />{uploading ? 'Enviando…' : form.imageUrl ? 'Trocar imagem' : 'Fazer upload'}
                    </div>
                    <input type="file" accept="image/*" className="sr-only" disabled={uploading}
                      onChange={async (e) => {
                        const file = e.target.files?.[0]; if (!file) return;
                        setUploading(true); setError('');
                        try {
                          const fd = new FormData(); fd.append('file', file);
                          const { data } = await adminClient.post<{ url: string }>('/transparency/upload-image', fd);
                          setForm((f) => ({ ...f, imageUrl: data.url }));
                        } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Falha'); }
                        finally { setUploading(false); e.target.value = ''; }
                      }} />
                  </label>
                  {form.imageUrl && <AdminButton size="sm" variant="danger" onClick={() => setForm((f) => ({ ...f, imageUrl: '' }))}><i className="bi bi-x text-xs" /></AdminButton>}
                </div>
                {form.imageUrl && <img src={form.imageUrl} alt="" className="mt-2 max-h-36 w-full rounded-lg object-cover border border-white/[0.06]" />}
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Ordem"><input type="number" min={0} value={form.order} onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))} className={inputCls} /></Field>
                <Field label="Visibilidade">
                  <label className="flex items-center justify-between cursor-pointer rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
                    <span className="text-sm text-slate-300">{form.visible ? 'Visível' : 'Oculto'}</span>
                    <Toggle checked={form.visible} onChange={(v) => setForm((f) => ({ ...f, visible: v }))} />
                  </label>
                </Field>
              </div>
              {error && <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <AdminButton variant="ghost" onClick={() => { setShowForm(false); setForm(EMPTY_SECTION); }}>Cancelar</AdminButton>
                <AdminButton onClick={() => void submit()} disabled={!form.title || !form.body || saving}>
                  {saving ? <><i className="bi bi-arrow-repeat animate-spin text-xs" /> Salvando…</> : <><i className="bi bi-check-circle text-xs" /> {editing ? 'Salvar' : 'Criar seção'}</>}
                </AdminButton>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-widest mb-3">Preview</p>
              <div className="rounded-xl border border-white/[0.06] bg-[#060d14] p-5 space-y-4" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                {form.imageUrl && <img src={form.imageUrl} alt="" className="w-full max-h-48 object-cover rounded-lg border border-white/[0.06] mb-4" />}
                {form.title ? <h2 className="text-lg font-bold text-white border-b border-white/[0.06] pb-3">{form.title}</h2> : <p className="text-slate-600 text-sm italic">Título da seção</p>}
                {form.body
                  ? <SanitizedHtml className="prose-sm text-slate-300 leading-relaxed" html={renderMarkdown(form.body)} />
                  : <p className="text-slate-600 text-sm italic">Escreva o conteúdo para ver o preview</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="admin-card flex items-center justify-center py-16"><p className="text-sm text-slate-400">Carregando…</p></div>
      ) : sorted.length === 0 ? (
        <div className="admin-card flex flex-col items-center justify-center py-16 text-center">
          <i className="bi bi-shield-check text-3xl text-slate-600 mb-3" />
          <p className="text-sm text-slate-500">Nenhuma seção criada.</p>
          <AdminButton className="mt-4" onClick={() => setShowForm(true)}><i className="bi bi-plus-circle text-xs" /> Criar seção</AdminButton>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {sorted.map((s, i) => (
              <SectionCard key={s.id} s={s} index={i} total={sorted.length}
                onEdit={() => startEdit(s)} onRemove={() => void remove(s.id)}
                onToggle={() => void toggleVisible(s)}
                onMoveUp={() => void moveSection(s, 'up')} onMoveDown={() => void moveSection(s, 'down')} />
            ))}
          </div>
          {!showForm && (
            <button type="button" onClick={() => { setShowForm(true); setForm({ ...EMPTY_SECTION, order: sections.length }); setError(''); }}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-dashed border-white/[0.08] bg-white/[0.01] py-5 text-slate-500 hover:border-white/[0.16] hover:text-slate-300">
              <i className="bi bi-plus-circle" /><span className="text-sm font-medium">Nova seção</span>
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ─── Financial record card ────────────────────────────────────────────────────

function FinancialCard({ r, onEdit, onRemove, onToggle }: {
  r: FinancialRecord; onEdit: () => void; onRemove: () => void; onToggle: () => void;
}) {
  const isReceita = r.type === 'receita';
  return (
    <div className={`admin-card overflow-hidden ${!r.visible ? 'opacity-60' : ''}`}>
      <div className={`h-1 w-full ${isReceita ? 'bg-gradient-to-r from-emerald-500 to-cyan-500' : 'bg-gradient-to-r from-red-500 to-orange-500'}`} />
      {r.imageUrl && <img src={r.imageUrl} alt={r.label} className="h-28 w-full object-cover opacity-80" />}
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${isReceita ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-red-500/20 bg-red-500/10 text-red-300'}`}>
                <i className={`bi ${isReceita ? 'bi-arrow-up-circle-fill' : 'bi-arrow-down-circle-fill'} text-[9px]`} />
                {isReceita ? 'Receita' : 'Despesa'}
              </span>
              {r.recurring && (
                <span className="flex items-center gap-1 rounded-full border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold text-purple-300">
                  <i className="bi bi-arrow-repeat text-[9px]" />
                  {r.recurringPeriod === 'monthly' ? 'Mensal' : 'Anual'}
                </span>
              )}
              {!r.visible && <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 text-[10px] text-slate-500">Oculto</span>}
            </div>
            <p className="font-semibold text-slate-100 text-sm leading-tight truncate">{r.label}</p>
            {r.source && <p className="text-[11px] text-slate-500 mt-0.5">Fonte: {r.source}</p>}
          </div>
          <div className="shrink-0 text-right">
            <p className={`text-sm font-bold ${isReceita ? 'text-emerald-400' : 'text-red-400'}`}>
              {isReceita ? '+' : '-'}{fmtCurrency(r.amount, r.currency)}
            </p>
            <p className="text-[10px] text-slate-600">{new Date(r.date).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}</p>
          </div>
        </div>

        {r.description && <p className="text-[11px] text-slate-500 line-clamp-2">{r.description}</p>}

        {r.referenceUrl && (
          <a href={r.referenceUrl} target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 text-[10px] text-sky-400 hover:text-sky-300 truncate">
            <i className="bi bi-link-45deg" />{r.referenceUrl.replace(/^https?:\/\//, '').slice(0, 50)}
          </a>
        )}

        <div className="flex gap-1.5 pt-2 border-t border-white/[0.04]">
          <AdminButton size="sm" variant="secondary" className="flex-1" onClick={onEdit}><i className="bi bi-pencil text-xs" /> Editar</AdminButton>
          <AdminButton size="sm" variant="ghost" onClick={onToggle}><i className={`bi ${r.visible ? 'bi-eye-slash' : 'bi-eye'} text-xs`} /></AdminButton>
          <AdminButton size="sm" variant="danger" onClick={onRemove}><i className="bi bi-trash text-xs" /></AdminButton>
        </div>
      </div>
    </div>
  );
}

// ─── Finances tab ─────────────────────────────────────────────────────────────

function FinancesTab() {
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [form, setForm] = useState<FinancialForm>(EMPTY_FINANCIAL);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<'all' | 'receita' | 'despesa'>('all');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminClient.get<{ records: FinancialRecord[]; summary: FinancialSummary }>('/financial-records');
      setRecords(data.records); setSummary(data.summary);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const editing = form.id !== null;

  const filtered = useMemo(() => {
    if (filter === 'all') return records;
    return records.filter((r) => r.type === filter);
  }, [records, filter]);

  async function submit() {
    if (!form.label || !form.amount) return;
    setSaving(true); setError('');
    const payload = {
      type: form.type, label: form.label, description: form.description || null,
      amount: Number(form.amount), currency: form.currency,
      recurring: form.recurring, recurringPeriod: form.recurring ? form.recurringPeriod : null,
      source: form.source || null,
      referenceUrl: form.referenceUrl || null,
      imageUrl: form.imageUrl || null,
      date: form.date ? new Date(form.date).toISOString() : undefined,
      visible: form.visible,
    };
    try {
      if (form.id) { await adminClient.patch(`/financial-records/${form.id}`, payload); setSuccess('Registro atualizado!'); }
      else { await adminClient.post('/financial-records', payload); setSuccess('Registro criado!'); }
      setForm(EMPTY_FINANCIAL); setShowForm(false); await load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Erro ao salvar'); }
    finally { setSaving(false); }
  }

  function startEdit(r: FinancialRecord) {
    setForm({
      id: r.id, type: r.type, label: r.label, description: r.description ?? '',
      amount: String(r.amount), currency: r.currency, recurring: r.recurring,
      recurringPeriod: r.recurringPeriod ?? 'monthly', source: r.source ?? '',
      referenceUrl: r.referenceUrl ?? '', imageUrl: r.imageUrl ?? '',
      date: r.date.slice(0, 10), visible: r.visible,
    });
    setShowForm(true); setError(''); window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function remove(id: string) {
    if (!window.confirm('Excluir este registro?')) return;
    await adminClient.delete(`/financial-records/${id}`);
    if (form.id === id) { setForm(EMPTY_FINANCIAL); setShowForm(false); }
    setSuccess('Registro excluído'); await load();
  }

  async function toggleVisible(r: FinancialRecord) {
    await adminClient.patch(`/financial-records/${r.id}`, { visible: !r.visible }); await load();
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total receitas', value: summary ? fmtCurrency(summary.totalReceita, 'usdc') : '—', icon: 'bi-arrow-up-circle-fill', accent: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
          { label: 'Total despesas', value: summary ? fmtCurrency(summary.totalDespesa, 'usdc') : '—', icon: 'bi-arrow-down-circle-fill', accent: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
          {
            label: 'Lucro líquido',
            value: summary ? fmtCurrency(Math.abs(summary.lucroLiquido), 'usdc') : '—',
            icon: summary && summary.lucroLiquido >= 0 ? 'bi-graph-up-arrow' : 'bi-graph-down-arrow',
            accent: summary && summary.lucroLiquido >= 0 ? 'text-cyan-400' : 'text-orange-400',
            bg: summary && summary.lucroLiquido >= 0 ? 'bg-cyan-500/10 border-cyan-500/20' : 'bg-orange-500/10 border-orange-500/20',
          },
          { label: 'Recorrentes', value: summary?.recorrente ?? '—', icon: 'bi-arrow-repeat', accent: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
        ].map(({ label, value, icon, accent, bg }) => (
          <div key={label} className="admin-card p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${bg}`}><i className={`bi ${icon} text-xs ${accent}`} /></span>
            </div>
            <p className={`mt-2 text-base font-bold truncate ${label === 'Lucro líquido' ? (summary && summary.lucroLiquido >= 0 ? 'text-cyan-400' : 'text-orange-400') : 'text-white'}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Feedback */}
      {(success || error) && (
        <p className={`rounded-xl border px-4 py-2.5 text-sm ${error ? 'border-red-500/25 bg-red-500/10 text-red-300' : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'}`}>{error || success}</p>
      )}

      {/* Form */}
      {showForm && (
        <div className="admin-card p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">{editing ? 'Editar registro' : 'Novo lançamento'}</h2>
              <p className="text-xs text-slate-500 mt-0.5">Registre receitas, despesas e fontes de renda</p>
            </div>
            <AdminButton size="sm" variant="ghost" onClick={() => { setShowForm(false); setForm(EMPTY_FINANCIAL); setError(''); }}><i className="bi bi-x text-base" /></AdminButton>
          </div>

          {/* Type selector */}
          <div className="flex gap-2">
            {(['receita', 'despesa'] as const).map((t) => (
              <button key={t} type="button" onClick={() => setForm((f) => ({ ...f, type: t }))}
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition-colors ${
                  form.type === t
                    ? t === 'receita' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-red-500/30 bg-red-500/10 text-red-300'
                    : 'border-white/[0.06] bg-white/[0.02] text-slate-500 hover:text-slate-300'
                }`}>
                <i className={`bi ${t === 'receita' ? 'bi-arrow-up-circle-fill' : 'bi-arrow-down-circle-fill'}`} />
                {t === 'receita' ? 'Receita / Lucro' : 'Despesa / Custo'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Descrição / Nome *">
              <input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder={form.type === 'receita' ? 'Ex: Venda de passes premium' : 'Ex: Servidor AWS mensal'}
                className={inputCls} />
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Valor *">
                <input type="number" min={0} step="0.01" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00" className={inputCls} />
              </Field>
              <Field label="Moeda">
                <select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} className={selectCls}>
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Data">
              <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className={inputCls} />
            </Field>

            <Field label="Fonte / Origem">
              <input value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                placeholder={form.type === 'receita' ? 'Ex: Mercado de jogadores' : 'Ex: Amazon Web Services'}
                className={inputCls} />
            </Field>

            <Field label="Link de referência (opcional)">
              <input value={form.referenceUrl} onChange={(e) => setForm((f) => ({ ...f, referenceUrl: e.target.value }))}
                placeholder="https://…" className={inputCls} />
            </Field>

            <Field label="Imagem (opcional)">
              <div className="flex gap-2">
                <label className="cursor-pointer flex-1">
                  <div className={`flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs transition-colors ${uploading ? 'opacity-60' : 'hover:bg-white/[0.06]'} text-slate-400`}>
                    <i className="bi bi-image text-slate-500" />
                    {uploading ? 'Enviando…' : form.imageUrl ? 'Trocar imagem' : 'Fazer upload do PC'}
                  </div>
                  <input type="file" accept="image/*" className="sr-only" disabled={uploading}
                    onChange={async (e) => {
                      const file = e.target.files?.[0]; if (!file) return;
                      setUploading(true); setError('');
                      try {
                        const fd = new FormData(); fd.append('file', file);
                        const { data } = await adminClient.post<{ url: string }>('/financial-records/upload-image', fd);
                        setForm((f) => ({ ...f, imageUrl: data.url }));
                      } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Falha ao enviar imagem'); }
                      finally { setUploading(false); e.target.value = ''; }
                    }} />
                </label>
                {form.imageUrl && (
                  <AdminButton size="sm" variant="danger" onClick={() => setForm((f) => ({ ...f, imageUrl: '' }))}>
                    <i className="bi bi-x text-xs" />
                  </AdminButton>
                )}
              </div>
              {form.imageUrl && <img src={form.imageUrl} alt="" className="mt-2 max-h-36 w-full rounded-lg object-cover border border-white/[0.06]" />}
            </Field>
          </div>

          <Field label="Detalhes / Observações (opcional)">
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Contexto adicional, notas internas, quebra de valores…" rows={3}
              className={`${inputCls} resize-y`} />
          </Field>

          {/* Recurring + visible toggles */}
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 space-y-4">
            <label className="flex items-center justify-between cursor-pointer" onClick={() => setForm((f) => ({ ...f, recurring: !f.recurring }))}>
              <div>
                <p className="text-sm text-slate-200 font-medium flex items-center gap-2">
                  <i className="bi bi-arrow-repeat text-purple-400" /> Lançamento recorrente
                </p>
                <p className="text-xs text-slate-500">Assinatura, salário, aluguel de servidor, etc.</p>
              </div>
              <Toggle checked={form.recurring} onChange={(v) => setForm((f) => ({ ...f, recurring: v }))} />
            </label>

            {form.recurring && (
              <div className="pl-6 border-l-2 border-purple-500/20">
                <Field label="Periodicidade">
                  <select value={form.recurringPeriod} onChange={(e) => setForm((f) => ({ ...f, recurringPeriod: e.target.value }))} className={selectCls}>
                    {RECURRING_PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </Field>
              </div>
            )}

            <div className="border-t border-white/[0.04]" />
            <label className="flex items-center justify-between cursor-pointer" onClick={() => setForm((f) => ({ ...f, visible: !f.visible }))}>
              <div>
                <p className="text-sm text-slate-200 font-medium">Visível publicamente</p>
                <p className="text-xs text-slate-500">Aparece na página de transparência para jogadores</p>
              </div>
              <Toggle checked={form.visible} onChange={(v) => setForm((f) => ({ ...f, visible: v }))} />
            </label>
          </div>

          {error && <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

          <div className="flex justify-end gap-2">
            <AdminButton variant="ghost" onClick={() => { setShowForm(false); setForm(EMPTY_FINANCIAL); }}>Cancelar</AdminButton>
            <AdminButton onClick={() => void submit()} disabled={!form.label || !form.amount || saving}>
              {saving ? <><i className="bi bi-arrow-repeat animate-spin text-xs" /> Salvando…</> : <><i className="bi bi-check-circle text-xs" /> {editing ? 'Salvar' : 'Lançar'}</>}
            </AdminButton>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all' as const, label: 'Todos', count: records.length },
          { key: 'receita' as const, label: 'Receitas', count: records.filter((r) => r.type === 'receita').length },
          { key: 'despesa' as const, label: 'Despesas', count: records.filter((r) => r.type === 'despesa').length },
        ].map(({ key, label, count }) => (
          <button key={key} type="button" onClick={() => setFilter(key)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === key ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-white/[0.06] bg-white/[0.02] text-slate-400 hover:text-slate-200'
            }`}>
            {label}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${filter === key ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/[0.06] text-slate-500'}`}>{count}</span>
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="admin-card flex items-center justify-center py-16"><p className="text-sm text-slate-400">Carregando registros…</p></div>
      ) : filtered.length === 0 ? (
        <div className="admin-card flex flex-col items-center justify-center py-16 text-center">
          <i className="bi bi-bar-chart-line text-3xl text-slate-600 mb-3" />
          <p className="text-sm text-slate-500">Nenhum lançamento financeiro ainda.</p>
          {!showForm && <AdminButton className="mt-4" onClick={() => setShowForm(true)}><i className="bi bi-plus-circle text-xs" /> Novo lançamento</AdminButton>}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <FinancialCard key={r.id} r={r}
              onEdit={() => startEdit(r)} onRemove={() => void remove(r.id)} onToggle={() => void toggleVisible(r)} />
          ))}
          {!showForm && (
            <button type="button" onClick={() => { setShowForm(true); setForm(EMPTY_FINANCIAL); setError(''); }}
              className="flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/[0.08] bg-white/[0.01] text-slate-500 hover:border-white/[0.16] hover:text-slate-300">
              <i className="bi bi-plus-circle text-2xl" /><span className="text-sm font-medium">Novo lançamento</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type Tab = 'secoes' | 'financas';

export function AdminTransparencyPage() {
  const [tab, setTab] = useState<Tab>('secoes');

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Transparência"
        subtitle="Gerencie as seções da página pública e o histórico financeiro do projeto."
        actions={undefined}
      />

      <div className="flex gap-1 p-1 rounded-xl border border-white/[0.06] bg-white/[0.02] w-fit">
        {([
          { key: 'secoes', icon: 'bi-shield-check', label: 'Seções' },
          { key: 'financas', icon: 'bi-bar-chart-line', label: 'Finanças' },
        ] as { key: Tab; icon: string; label: string }[]).map(({ key, icon, label }) => (
          <button key={key} type="button" onClick={() => setTab(key)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === key ? 'bg-white/[0.08] text-slate-100 shadow' : 'text-slate-500 hover:text-slate-300'
            }`}>
            <i className={`bi ${icon} text-xs`} /> {label}
          </button>
        ))}
      </div>

      {tab === 'secoes' ? <SectionsTab /> : <FinancesTab />}
    </div>
  );
}
