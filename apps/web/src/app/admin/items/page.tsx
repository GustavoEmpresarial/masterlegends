import { useEffect, useRef, useState } from 'react';
import type { AxiosError } from 'axios';
import type { ItemTemplateDTO } from '@mll/shared';
import { adminClient } from '../../../lib/api/adminClient';
import {
  AdminPageHeader,
  AdminBadge,
  AdminButton,
  AdminInput,
} from '../../../components/admin/AdminTable';
import { resolveUploadUrl } from '../../../lib/resolveUploadUrl';

const RARITY_LABELS = ['Common', 'Uncommon', 'Rare', 'Super Rare', 'Epic', 'Legendary'];
const POSITION_LABELS = ['GK', 'DEF', 'MID', 'FW', 'LAT'];

const RARITY_STYLES = [
  { badge: 'default' as const, color: 'text-slate-300', glow: 'border-white/[0.08]', dot: 'bg-slate-400' },
  { badge: 'success' as const, color: 'text-lime-300', glow: 'border-lime-500/25', dot: 'bg-lime-400' },
  { badge: 'success' as const, color: 'text-emerald-300', glow: 'border-emerald-500/25', dot: 'bg-emerald-400' },
  { badge: 'info' as const, color: 'text-sky-300', glow: 'border-sky-500/25', dot: 'bg-sky-400' },
  { badge: 'warning' as const, color: 'text-purple-300', glow: 'border-purple-500/25', dot: 'bg-purple-400' },
  { badge: 'warning' as const, color: 'text-amber-300', glow: 'border-amber-500/30', dot: 'bg-amber-400' },
];

interface FormState {
  name: string;
  rarity: number;
  position: number;
  overwall: number;
  weight: number;
  active: boolean;
  file: File | null;
  preview: string | null;
}

function formatSaveError(err: unknown): string {
  const ax = err as AxiosError<{
    error?: { code?: string; details?: Record<string, unknown> & { issues?: Record<string, string[]> } };
  }>;
  const status = ax.response?.status;
  if (status === 401) return 'Sessão expirada — saia e entre de novo no admin.';
  if (status === 403) return 'Acesso negado ou CSRF inválido — recarregue a página (Ctrl+Shift+R).';
  const details = ax.response?.data?.error?.details;
  if (details?.message && typeof details.message === 'string') return details.message;
  if (details?.issues && typeof details.issues === 'object') {
    const first = Object.entries(details.issues).find(([, v]) => Array.isArray(v) && v.length > 0);
    if (first) return `${first[0]}: ${first[1]![0]}`;
  }
  if (details?.field === 'overwall') return 'Overwall inválido para esta raridade.';
  if (details?.reason === 'image_required') return 'Selecione uma imagem.';
  if (details?.reason === 'invalid_body') return 'Requisição inválida — recarregue a página e tente de novo.';
  const code = ax.response?.data?.error?.code;
  if (code === 'VALIDATION_ERROR') return 'Dados inválidos — confira nome, raridade e overwall.';
  if (code) return code;
  return `Falha ao salvar${status ? ` (HTTP ${status})` : ''}`;
}

const emptyForm: FormState = {
  name: '',
  rarity: 0,
  position: 0,
  overwall: 500,
  weight: 1,
  active: true,
  file: null,
  preview: null,
};

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      {children}
    </div>
  );
}

export function AdminItemsPage() {
  const [items, setItems] = useState<ItemTemplateDTO[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [filterRarity, setFilterRarity] = useState('');
  const [filterActive, setFilterActive] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  async function load() {
    const params = new URLSearchParams();
    if (filterRarity) params.set('rarity', filterRarity);
    if (filterActive) params.set('active', filterActive);
    const { data } = await adminClient.get<{ items: ItemTemplateDTO[] }>(`/items?${params.toString()}`);
    setItems(data.items);
  }

  useEffect(() => { void load(); }, [filterRarity, filterActive]);

  function resetForm() {
    setForm(emptyForm);
    setEditing(null);
    setError('');
    setMessage('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function submit() {
    setSubmitting(true);
    setMessage('');
    setError('');
    try {
      if (!form.name.trim()) { setError('Informe o nome do item.'); return; }

      const payload = {
        name: form.name.trim(),
        rarity: form.rarity,
        position: form.position,
        overwall: form.overwall,
        weight: form.weight,
        active: form.active,
      };

      if (editing) {
        if (form.file) {
          const fd = new FormData();
          Object.entries(payload).forEach(([k, v]) => fd.set(k, String(v)));
          fd.set('image', form.file);
          await adminClient.patch(`/items/${editing}`, fd);
        } else {
          await adminClient.patch(`/items/${editing}`, payload);
        }
        setMessage('Item atualizado com sucesso');
      } else {
        if (!form.file) { setError('Selecione uma imagem'); return; }
        const fd = new FormData();
        Object.entries(payload).forEach(([k, v]) => fd.set(k, String(v)));
        fd.set('image', form.file);
        await adminClient.post('/items', fd);
        setMessage('Item criado com sucesso');
      }
      resetForm();
      await load();
    } catch (err: unknown) {
      setError(formatSaveError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(item: ItemTemplateDTO) {
    await adminClient.post(`/items/${item.id}/active`, { active: !item.active });
    await load();
  }

  async function remove(item: ItemTemplateDTO) {
    if (!confirm(`Deletar "${item.name}"? Esta ação não pode ser desfeita.`)) return;
    await adminClient.delete(`/items/${item.id}`);
    await load();
  }

  function startEdit(item: ItemTemplateDTO) {
    setEditing(item.id);
    setError('');
    setMessage('');
    setForm({
      name: item.name,
      rarity: item.rarity,
      position: item.position,
      overwall: item.overwall,
      weight: item.weight,
      active: item.active,
      file: null,
      preview: item.imageUrl ? resolveUploadUrl(item.imageUrl) : null,
    });
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Pool stats
  const poolByRarity = RARITY_LABELS.map((label, i) => ({
    label,
    active: items.filter((it) => it.active && it.rarity === i).length,
    total: items.filter((it) => it.rarity === i).length,
  }));

  const rarityStyle = RARITY_STYLES[form.rarity] ?? RARITY_STYLES[0];

  return (
    <>
      <AdminPageHeader
        title="Itens do Scout"
        subtitle="O olheiro só sorteia jogadores cadastrados aqui. Itens inativos não entram no pool."
      />

      {/* Pool summary */}
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {poolByRarity.map(({ label, active, total }, i) => {
          const s = RARITY_STYLES[i]!;
          return (
            <div
              key={label}
              className={`rounded-xl border ${s.glow} bg-white/[0.02] p-3 text-center transition-colors`}
            >
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                <p className={`text-[10px] font-semibold uppercase tracking-wider ${s.color}`}>{label}</p>
              </div>
              <p className="text-lg font-bold text-white">{active}</p>
              <p className="text-[10px] text-slate-600">de {total} ativos</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">

        {/* ── Form ── */}
        <div ref={formRef}>
          <div className={`rounded-xl border ${editing ? 'border-emerald-500/25' : 'border-white/[0.07]'} bg-white/[0.02] overflow-hidden`}>
            <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3">
              <div className="flex items-center gap-2">
                <i className={`bi ${editing ? 'bi-pencil-fill text-emerald-400' : 'bi-plus-circle-fill text-slate-400'} text-sm`} />
                <h3 className="text-sm font-semibold text-slate-200">
                  {editing ? 'Editar item' : 'Novo item'}
                </h3>
              </div>
              {editing && (
                <button type="button" onClick={resetForm} className="text-xs text-slate-500 hover:text-slate-300">
                  Cancelar <i className="bi bi-x" />
                </button>
              )}
            </div>

            <div className="space-y-4 p-4">
              {/* Image preview + upload */}
              <FormField label={`Imagem ${editing ? '(opcional — mantém a atual)' : '*'}`}>
                <div className="flex items-center gap-3">
                  <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border ${rarityStyle.glow} bg-white/[0.03] overflow-hidden`}>
                    {form.preview ? (
                      <img src={form.preview} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <i className="bi bi-image text-xl text-slate-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-white/[0.10] px-3 py-2 text-xs text-slate-400 hover:border-white/20 hover:text-slate-200 transition-colors">
                      <i className="bi bi-upload" />
                      {form.file ? form.file.name : 'Escolher arquivo…'}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="sr-only"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          const preview = file ? URL.createObjectURL(file) : (form.preview ?? null);
                          setForm((f) => ({ ...f, file, preview }));
                        }}
                      />
                    </label>
                    <p className="mt-1 text-[10px] text-slate-600">PNG, JPG ou WebP</p>
                  </div>
                </div>
              </FormField>

              <FormField label="Nome">
                <AdminInput
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Craque Lendário"
                  maxLength={64}
                />
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Raridade">
                  <select
                    value={form.rarity}
                    onChange={(e) => setForm((f) => ({ ...f, rarity: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-white/[0.08] bg-[#0c1220] px-3 py-2 text-sm text-slate-200 focus:border-emerald-500/40 focus:outline-none"
                  >
                    {RARITY_LABELS.map((l, i) => <option key={l} value={i}>{l}</option>)}
                  </select>
                </FormField>

                <FormField label="Posição">
                  <select
                    value={form.position}
                    onChange={(e) => setForm((f) => ({ ...f, position: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-white/[0.08] bg-[#0c1220] px-3 py-2 text-sm text-slate-200 focus:border-emerald-500/40 focus:outline-none"
                  >
                    {POSITION_LABELS.map((l, i) => <option key={l} value={i}>{l}</option>)}
                  </select>
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Overwall">
                  <AdminInput
                    type="number"
                    value={String(form.overwall)}
                    onChange={(e) => setForm((f) => ({ ...f, overwall: Number(e.target.value) }))}
                  />
                </FormField>

                <FormField label="Peso (prob.)">
                  <AdminInput
                    type="number"
                    min={1}
                    value={String(form.weight)}
                    onChange={(e) => setForm((f) => ({ ...f, weight: Number(e.target.value) }))}
                  />
                </FormField>
              </div>

              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-white/[0.06] px-3 py-2.5 hover:border-white/[0.10] transition-colors">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                  className="rounded border-white/20 accent-emerald-500"
                />
                <span className="text-sm text-slate-300">Item ativo (entra no pool do scout)</span>
              </label>

              {error && (
                <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  <i className="bi bi-exclamation-triangle mr-1" />{error}
                </p>
              )}
              {message && (
                <p className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                  {message}
                </p>
              )}

              <AdminButton
                className="w-full"
                disabled={submitting}
                onClick={() => void submit()}
              >
                {submitting
                  ? <><i className="bi bi-hourglass-split" /> Salvando…</>
                  : editing
                    ? <><i className="bi bi-check2" /> Atualizar item</>
                    : <><i className="bi bi-plus-circle" /> Criar item</>
                }
              </AdminButton>
            </div>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="space-y-3">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterRarity}
              onChange={(e) => setFilterRarity(e.target.value)}
              className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-sm text-slate-300 focus:border-emerald-500/40 focus:outline-none"
            >
              <option value="">Todas raridades</option>
              {RARITY_LABELS.map((l, i) => <option key={l} value={i}>{l}</option>)}
            </select>
            <select
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value)}
              className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-sm text-slate-300 focus:border-emerald-500/40 focus:outline-none"
            >
              <option value="">Todos</option>
              <option value="true">Ativos</option>
              <option value="false">Inativos</option>
            </select>
            <span className="ml-auto text-xs text-slate-600">{items.length} itens</span>
          </div>

          <div className="admin-card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                    {['Card', 'Raridade', 'Pos.', 'Overwall', 'Peso', 'Status', ''].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500 last:text-right"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => {
                    const rs = RARITY_STYLES[it.rarity]!;
                    return (
                      <tr
                        key={it.id}
                        className={`border-b border-white/[0.03] transition-colors last:border-0 hover:bg-white/[0.02] ${editing === it.id ? 'bg-emerald-500/5' : ''}`}
                      >
                        {/* Card cell */}
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-3">
                            <div className={`h-10 w-10 shrink-0 overflow-hidden rounded-lg border ${rs.glow} bg-white/[0.03]`}>
                              <img
                                src={resolveUploadUrl(it.imageUrl)}
                                alt={it.name}
                                className="h-full w-full object-cover"
                              />
                            </div>
                            <span className="font-medium text-slate-200">{it.name}</span>
                          </div>
                        </td>

                        {/* Rarity */}
                        <td className="px-4 py-2.5">
                          <AdminBadge variant={rs.badge}>
                            {RARITY_LABELS[it.rarity]}
                          </AdminBadge>
                        </td>

                        {/* Position */}
                        <td className="px-4 py-2.5">
                          <span className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 text-xs font-mono text-slate-400">
                            {POSITION_LABELS[it.position]}
                          </span>
                        </td>

                        {/* Overwall */}
                        <td className="px-4 py-2.5">
                          <span className={`font-mono font-semibold ${rs.color}`}>
                            {it.overwall.toLocaleString('pt-BR')}
                          </span>
                        </td>

                        {/* Weight */}
                        <td className="px-4 py-2.5 text-slate-400">{it.weight}</td>

                        {/* Status toggle */}
                        <td className="px-4 py-2.5">
                          <button
                            type="button"
                            onClick={() => void toggleActive(it)}
                            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                              it.active
                                ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15'
                                : 'border-white/[0.06] bg-white/[0.03] text-slate-500 hover:bg-white/[0.06]'
                            }`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${it.active ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                            {it.active ? 'Ativo' : 'Inativo'}
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <AdminButton
                              size="sm"
                              variant={editing === it.id ? 'primary' : 'ghost'}
                              onClick={() => editing === it.id ? resetForm() : startEdit(it)}
                            >
                              <i className={`bi ${editing === it.id ? 'bi-x' : 'bi-pencil'} text-xs`} />
                            </AdminButton>
                            <AdminButton
                              size="sm"
                              variant="danger"
                              onClick={() => void remove(it)}
                            >
                              <i className="bi bi-trash text-xs" />
                            </AdminButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-14 text-center text-sm text-slate-500">
                        <i className="bi bi-inbox text-2xl block mb-2 opacity-30" />
                        Nenhum item cadastrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
