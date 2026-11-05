import { useEffect, useRef, useState, useCallback } from 'react';
import type { GearCatalogItemDTO, StadiumShopEffectType, StadiumShopItemDTO } from '@mll/shared';
import { GearSlot } from '@mll/shared';
import { resolveUploadUrl } from '../../../lib/resolveUploadUrl';
import { GearSprite } from '../../../components/gear/GearSprite';
import { adminClient } from '../../../lib/api/adminClient';
import {
  AdminPageHeader,
  AdminBadge,
  AdminButton,
  AdminInput,
  AdminStatCard,
} from '../../../components/admin/AdminTable';

type Tab = 'stamina' | 'gear' | 'affiliate';

const RARITY_LABELS = ['Comum', 'Incomum', 'Raro', 'Super Raro', 'Épico', 'Lendário'];

interface GearFormState {
  slug: string;
  nameKey: string;
  slot: string;
  rarity: number;
  owBonus: number;
  priceGmt: number;
  imageUrl: string;
  description: string;
  active: boolean;
  sortOrder: number;
}

const emptyGearForm: GearFormState = {
  slug: '',
  nameKey: '',
  slot: GearSlot.BOOTS,
  rarity: 0,
  owBonus: 50,
  priceGmt: 0.01,
  imageUrl: '',
  description: '',
  active: true,
  sortOrder: 0,
};

interface FormState {
  slug: string;
  nameKey: string;
  effectType: StadiumShopEffectType;
  effectValue: number;
  priceUsdc: number;
  active: boolean;
  sortOrder: number;
  imageUrl: string;
  affiliateUrl: string;
  description: string;
  externalPlatform: string;
}

const emptyForm: FormState = {
  slug: '',
  nameKey: '',
  effectType: 'stamina_flat',
  effectValue: 25,
  priceUsdc: 10,
  active: true,
  sortOrder: 0,
  imageUrl: '',
  affiliateUrl: '',
  description: '',
  externalPlatform: '',
};

const emptyAffiliateForm: FormState = {
  ...emptyForm,
  effectType: 'affiliate_link',
  effectValue: 0,
  priceUsdc: 0,
};

const EFFECT_META: Record<StadiumShopEffectType, { label: string; icon: string; color: string; desc: string }> = {
  stamina_flat: { label: 'Stamina Flat', icon: 'bi-lightning-fill', color: 'text-sky-300', desc: 'Adiciona X pontos de stamina' },
  stamina_full: { label: 'Stamina Full', icon: 'bi-battery-full', color: 'text-emerald-300', desc: 'Restaura stamina completa' },
  affiliate_link: { label: 'Link Afiliado', icon: 'bi-box-arrow-up-right', color: 'text-amber-300', desc: 'Redireciona para produto externo' },
};

const PLATFORM_META: Record<string, { label: string; color: string; icon: string }> = {
  mercadolivre: { label: 'Mercado Livre', color: 'text-yellow-300', icon: 'bi-bag-fill' },
  amazon: { label: 'Amazon', color: 'text-orange-400', icon: 'bi-amazon' },
  shopee: { label: 'Shopee', color: 'text-orange-300', icon: 'bi-shop' },
  aliexpress: { label: 'AliExpress', color: 'text-red-400', icon: 'bi-globe' },
  outro: { label: 'Outro', color: 'text-slate-400', icon: 'bi-link-45deg' },
};

function ImageUploadField({
  value,
  onChange,
  endpoint = '/stadium-shop/upload-image',
}: {
  value: string;
  onChange: (url: string) => void;
  endpoint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);

  const upload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await adminClient.post<{ url: string }>(endpoint, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onChange(data.url);
    } finally {
      setUploading(false);
    }
  }, [onChange, endpoint]);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void upload(file);
    e.target.value = '';
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void upload(file);
  }

  return (
    <div className="space-y-2">
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />

      {value ? (
        <div className="relative w-full h-40 rounded-xl overflow-hidden border border-white/[0.08] bg-black/20 group">
          <img src={resolveUploadUrl(value)} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg bg-white/10 border border-white/20 px-3 py-1.5 text-xs text-white hover:bg-white/20 transition-colors"
            >
              <i className="bi bi-arrow-repeat" /> Trocar
            </button>
            <button
              type="button"
              onClick={() => onChange('')}
              className="flex items-center gap-1.5 rounded-lg bg-red-500/20 border border-red-500/30 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/30 transition-colors"
            >
              <i className="bi bi-trash3" /> Remover
            </button>
          </div>
          {uploading && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <i className="bi bi-arrow-repeat animate-spin text-white text-xl" />
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          className={`w-full h-32 rounded-xl border-2 border-dashed transition-colors flex flex-col items-center justify-center gap-2 ${
            drag
              ? 'border-emerald-500/60 bg-emerald-500/10'
              : 'border-white/[0.10] bg-white/[0.02] hover:border-emerald-500/30 hover:bg-emerald-500/[0.04]'
          }`}
        >
          {uploading ? (
            <><i className="bi bi-arrow-repeat animate-spin text-slate-400 text-xl" /><span className="text-xs text-slate-500">Enviando…</span></>
          ) : (
            <>
              <i className="bi bi-cloud-upload text-slate-500 text-2xl" />
              <span className="text-xs text-slate-500">Clique ou arraste a imagem aqui</span>
              <span className="text-[10px] text-slate-700">PNG, JPG, WebP</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      {children}
      {hint && <p className="text-[10px] text-slate-600">{hint}</p>}
    </div>
  );
}

export function AdminStadiumShopPage() {
  const [items, setItems] = useState<StadiumShopItemDTO[]>([]);
  const [gearItems, setGearItems] = useState<GearCatalogItemDTO[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [gearForm, setGearForm] = useState<GearFormState>(emptyGearForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [editingGear, setEditingGear] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [tab, setTab] = useState<Tab>('stamina');
  const formRef = useRef<HTMLDivElement>(null);

  async function load() {
    const [shopRes, gearRes] = await Promise.all([
      adminClient.get<{ items: StadiumShopItemDTO[] }>('/stadium-shop/items'),
      adminClient.get<{ items: GearCatalogItemDTO[] }>('/stadium-shop/gear'),
    ]);
    setItems(shopRes.data.items);
    setGearItems(gearRes.data.items);
  }

  useEffect(() => { void load(); }, []);

  const staminaItems = items.filter((i) => i.effectType !== 'affiliate_link');
  const affiliateItems = items.filter((i) => i.effectType === 'affiliate_link');

  function resetForm(nextTab: Tab = tab) {
    setForm(nextTab === 'affiliate' ? emptyAffiliateForm : emptyForm);
    setGearForm(emptyGearForm);
    setEditing(null);
    setEditingGear(null);
    setMessage('');
  }

  function parseSaveError(err: unknown): string {
    const anyErr = err as {
      response?: { data?: { error?: { message?: string; details?: { issues?: Record<string, string[]> } } } };
    };
    const issues = anyErr?.response?.data?.error?.details?.issues;
    const issueText = issues
      ? Object.entries(issues)
          .map(([field, msgs]) => `${field}: ${(msgs ?? []).join(', ')}`)
          .join(' · ')
      : '';
    return issueText || anyErr?.response?.data?.error?.message || 'Falha ao salvar';
  }

  async function submit() {
    setSubmitting(true);
    setMessage('');
    setIsError(false);
    try {
      const payload = {
        slug: form.slug,
        nameKey: form.nameKey || form.slug,
        effectType: form.effectType,
        effectValue: form.effectValue,
        priceUsdc: form.priceUsdc,
        active: form.active,
        sortOrder: form.sortOrder,
        imageUrl: form.imageUrl.trim() || null,
        affiliateUrl: form.affiliateUrl.trim() || null,
        description: form.description.trim() || null,
        externalPlatform: form.externalPlatform || null,
      };
      if (editing) {
        await adminClient.patch(`/stadium-shop/items/${editing}`, payload);
        setMessage('Item atualizado');
      } else {
        await adminClient.post('/stadium-shop/items', payload);
        setMessage('Item criado');
      }
      resetForm();
      await load();
    } catch (err: unknown) {
      setMessage(parseSaveError(err));
      setIsError(true);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitGear() {
    setSubmitting(true);
    setMessage('');
    setIsError(false);
    try {
      const payload = {
        slug: gearForm.slug,
        nameKey: gearForm.nameKey || gearForm.slug,
        slot: gearForm.slot,
        rarity: gearForm.rarity,
        owBonus: gearForm.owBonus,
        priceGmt: gearForm.priceGmt,
        imageUrl: gearForm.imageUrl.trim() || null,
        description: gearForm.description.trim() || null,
        active: gearForm.active,
        sortOrder: gearForm.sortOrder,
      };
      if (editingGear) {
        await adminClient.patch(`/stadium-shop/gear/${editingGear}`, payload);
        setMessage('Equipamento atualizado');
      } else {
        await adminClient.post('/stadium-shop/gear', payload);
        setMessage('Equipamento criado');
      }
      resetForm();
      await load();
    } catch (err: unknown) {
      setMessage(parseSaveError(err));
      setIsError(true);
    } finally {
      setSubmitting(false);
    }
  }

  function startEditGear(item: GearCatalogItemDTO) {
    setEditingGear(item.id);
    setEditing(null);
    setMessage('');
    setTab('gear');
    setGearForm({
      slug: item.slug,
      nameKey: item.nameKey,
      slot: item.slot,
      rarity: item.rarity,
      owBonus: item.owBonus,
      priceGmt: item.priceGmt,
      imageUrl: item.imageUrl ?? '',
      description: item.description ?? '',
      active: item.active,
      sortOrder: item.sortOrder,
    });
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function startEdit(item: StadiumShopItemDTO) {
    setEditing(item.id);
    setMessage('');
    setTab(item.effectType === 'affiliate_link' ? 'affiliate' : 'stamina');
    setForm({
      slug: item.slug,
      nameKey: item.nameKey,
      effectType: item.effectType,
      effectValue: item.effectValue,
      priceUsdc: item.priceUsdc,
      active: item.active,
      sortOrder: item.sortOrder,
      imageUrl: item.imageUrl ?? '',
      affiliateUrl: item.affiliateUrl ?? '',
      description: item.description ?? '',
      externalPlatform: item.externalPlatform ?? '',
    });
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Lojinha do Estádio"
        subtitle="Stamina, equipamentos (chuteiras) e produtos afiliados"
      />

      <div className="grid grid-cols-3 gap-3">
        <AdminStatCard label="Stamina" value={staminaItems.length} icon="bi-lightning-charge" accent="sky" />
        <AdminStatCard label="Equipamentos" value={gearItems.length} icon="bi-stars" accent="emerald" />
        <AdminStatCard label="Afiliados" value={affiliateItems.length} icon="bi-bag-heart" accent="amber" />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
        {([
          { key: 'stamina' as const, label: 'Stamina', icon: 'bi-lightning-charge-fill', count: staminaItems.length },
          { key: 'gear' as const, label: 'Equipamento', icon: 'bi-stars', count: gearItems.length },
          { key: 'affiliate' as const, label: 'Afiliados', icon: 'bi-bag-heart-fill', count: affiliateItems.length },
        ]).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key);
              resetForm(t.key);
            }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-white/[0.08] text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <i className={`bi ${t.icon} text-xs`} />
            {t.label}
            {t.count > 0 && (
              <span className="rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[10px] font-bold">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Feedback */}
      {message && (
        <p className={`rounded-xl border px-4 py-2 text-sm ${
          isError ? 'border-red-500/25 bg-red-500/10 text-red-300' : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
        }`}>{message}</p>
      )}

      <div className="grid gap-5 lg:grid-cols-[340px_1fr] lg:items-start">

        {/* ── Form ── */}
        <div ref={formRef} className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <div className={`rounded-xl border overflow-hidden ${(editing || editingGear) ? 'border-emerald-500/25' : 'border-white/[0.07]'} bg-[#0c1018]`}>
            <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3">
              <div className="flex items-center gap-2">
                <i className={`bi ${
                  tab === 'affiliate' ? 'bi-bag-plus-fill text-amber-400'
                    : tab === 'gear' ? 'bi-stars text-emerald-400'
                      : 'bi-cart-plus-fill text-sky-400'
                } text-sm`} />
                <h3 className="text-sm font-semibold text-slate-200">
                  {editingGear
                    ? `Editando ${gearItems.find((item) => item.id === editingGear)?.nameKey ?? 'equipamento'}`
                    : editing
                      ? 'Editar item'
                      : tab === 'affiliate'
                        ? 'Novo produto afiliado'
                        : tab === 'gear'
                          ? 'Novo equipamento'
                          : 'Novo item stamina'}
                </h3>
              </div>
              {(editing || editingGear) && (
                <button type="button" onClick={resetForm} className="text-xs text-slate-500 hover:text-slate-300">
                  Cancelar <i className="bi bi-x" />
                </button>
              )}
            </div>

            <div className="space-y-4 p-4">
              {tab === 'gear' ? (
                <>
                  <Field label="Imagem" hint={editingGear ? 'Essa é a arte do card. Troque aqui e clique em Atualizar.' : 'Clique em Editar num card da direita para mudar um item que já existe.'}>
                    <ImageUploadField
                      value={gearForm.imageUrl}
                      onChange={(imageUrl) => setGearForm((f) => ({ ...f, imageUrl }))}
                      endpoint="/stadium-shop/upload-gear-image"
                    />
                  </Field>
                  <Field label="Nome">
                    <AdminInput
                      value={gearForm.nameKey}
                      placeholder="Chuteiras Comum"
                      onChange={(e) => setGearForm((f) => ({ ...f, nameKey: e.target.value }))}
                    />
                  </Field>
                  <Field label="Tipo de slot">
                    <select
                      value={gearForm.slot}
                      onChange={(e) => setGearForm((f) => ({ ...f, slot: e.target.value }))}
                      className="w-full rounded-lg border border-white/[0.08] bg-[#0c1220] px-3 py-2 text-sm text-slate-200"
                    >
                      <option value={GearSlot.BOOTS}>Chuteiras</option>
                      <option value={GearSlot.GLOVES}>Luvas</option>
                      <option value={GearSlot.SHINGUARDS}>Caneleiras</option>
                    </select>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Raridade">
                      <select
                        value={gearForm.rarity}
                        onChange={(e) => setGearForm((f) => ({ ...f, rarity: Number(e.target.value) }))}
                        className="w-full rounded-lg border border-white/[0.08] bg-[#0c1220] px-3 py-2 text-sm text-slate-200"
                      >
                        {RARITY_LABELS.map((label, i) => (
                          <option key={i} value={i}>{label}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Bônus no poder do jogador (%)" hint="Porcentagem do Overwall do jogador. Comum 1, incomum 2, raro 4, super raro 8, épico 16, lendário 30.">
                      <AdminInput
                        type="number"
                        min={0}
                        max={500}
                        value={gearForm.owBonus}
                        onChange={(e) => setGearForm((f) => ({ ...f, owBonus: Number(e.target.value) }))}
                      />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Preço GMT">
                      <AdminInput
                        type="number"
                        min={0}
                        step="any"
                        value={gearForm.priceGmt}
                        onChange={(e) => setGearForm((f) => ({ ...f, priceGmt: Number(e.target.value) }))}
                      />
                    </Field>
                    <Field label="Ordem">
                      <AdminInput
                        type="number"
                        value={gearForm.sortOrder}
                        onChange={(e) => setGearForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
                      />
                    </Field>
                  </div>
                  <Field label="Descrição">
                    <AdminInput
                      value={gearForm.description}
                      onChange={(e) => setGearForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="opcional"
                    />
                  </Field>
                  <Field label="Slug" hint="Identificador interno. Não muda depois de criado.">
                    <AdminInput
                      value={gearForm.slug}
                      disabled={!!editingGear}
                      placeholder="ex: boots-rare-01"
                      onChange={(e) =>
                        setGearForm((f) => ({
                          ...f,
                          slug: e.target.value.toLowerCase().replace(/\s+/g, '-'),
                        }))
                      }
                      className="font-mono"
                    />
                  </Field>
                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={gearForm.active}
                      onChange={(e) => setGearForm((f) => ({ ...f, active: e.target.checked }))}
                    />
                    Ativo (visível na lojinha)
                  </label>
                  <AdminButton className="sticky bottom-0 w-full" disabled={submitting} onClick={() => void submitGear()}>
                    {submitting ? 'Salvando…' : editingGear ? 'Atualizar este equipamento' : 'Criar equipamento'}
                  </AdminButton>
                </>
              ) : (
              <>
              <Field label="Slug (identificador único)">
                <AdminInput
                  value={form.slug}
                  disabled={!!editing}
                  placeholder={tab === 'affiliate' ? 'ex: camisa-flamengo-ml' : 'ex: stamina-25'}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                  className="font-mono"
                />
              </Field>

              {tab === 'affiliate' ? (
                <>
                  <Field label="Nome do produto">
                    <AdminInput
                      value={form.nameKey}
                      placeholder="Ex: Camisa Flamengo Oficial 2025"
                      onChange={(e) => setForm((f) => ({ ...f, nameKey: e.target.value }))}
                    />
                  </Field>

                  <Field label="Plataforma">
                    <select
                      value={form.externalPlatform}
                      onChange={(e) => setForm((f) => ({ ...f, externalPlatform: e.target.value }))}
                      className="w-full rounded-lg border border-white/[0.08] bg-[#0c1220] px-3 py-2 text-sm text-slate-200 focus:border-emerald-500/40 focus:outline-none"
                    >
                      <option value="">Selecione…</option>
                      {Object.entries(PLATFORM_META).map(([key, meta]) => (
                        <option key={key} value={key}>{meta.label}</option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Link afiliado *" hint="URL completa com código de afiliado">
                    <AdminInput
                      value={form.affiliateUrl}
                      placeholder="https://mercadolivre.com.br/…?affil=xxx"
                      onChange={(e) => setForm((f) => ({ ...f, affiliateUrl: e.target.value }))}
                    />
                  </Field>

                  <Field label="Imagem do produto">
                    <ImageUploadField
                      value={form.imageUrl}
                      onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
                    />
                  </Field>

                  <Field label="Descrição curta (opcional)">
                    <textarea
                      value={form.description}
                      placeholder="Ex: Produto oficial, entrega via Mercado Livre"
                      rows={2}
                      maxLength={512}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500/40 focus:outline-none resize-none"
                    />
                  </Field>

                  <Field label="Preço de exibição (USDC)" hint="Pode ser 0 para mostrar apenas o link">
                    <AdminInput
                      type="number"
                      step="0.01"
                      value={String(form.priceUsdc)}
                      onChange={(e) => setForm((f) => ({ ...f, priceUsdc: Number(e.target.value) }))}
                    />
                  </Field>
                </>
              ) : (
                <>
                  <Field label="Chave i18n (nameKey)">
                    <AdminInput
                      value={form.nameKey}
                      placeholder="shop.items.stamina25"
                      onChange={(e) => setForm((f) => ({ ...f, nameKey: e.target.value }))}
                      className="font-mono text-xs"
                    />
                  </Field>

                  <Field label="Tipo de efeito">
                    <select
                      value={form.effectType}
                      onChange={(e) => setForm((f) => ({ ...f, effectType: e.target.value as StadiumShopEffectType }))}
                      className="w-full rounded-lg border border-white/[0.08] bg-[#0c1220] px-3 py-2 text-sm text-slate-200 focus:border-emerald-500/40 focus:outline-none"
                    >
                      <option value="stamina_flat">Stamina Flat (+X pontos)</option>
                      <option value="stamina_full">Stamina Full (recuperação total)</option>
                    </select>
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label={form.effectType === 'stamina_full' ? 'Valor (auto)' : 'Valor stamina'}>
                      <AdminInput
                        type="number"
                        value={String(form.effectValue)}
                        disabled={form.effectType === 'stamina_full'}
                        onChange={(e) => setForm((f) => ({ ...f, effectValue: Number(e.target.value) }))}
                      />
                    </Field>
                    <Field label="Preço USDC">
                      <AdminInput
                        type="number"
                        step="0.01"
                        value={String(form.priceUsdc)}
                        onChange={(e) => setForm((f) => ({ ...f, priceUsdc: Number(e.target.value) }))}
                      />
                    </Field>
                  </div>

                  <Field label="Imagem do item" hint="Aparece na lojinha do estádio">
                    <ImageUploadField
                      value={form.imageUrl}
                      onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
                    />
                  </Field>
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Ordem">
                  <AdminInput
                    type="number"
                    value={String(form.sortOrder)}
                    onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
                  />
                </Field>
              </div>

              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-white/[0.06] px-3 py-2.5 hover:border-white/[0.10] transition-colors">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                  className="rounded border-white/20 accent-emerald-500"
                />
                <span className="text-sm text-slate-300">Ativo (visível na lojinha)</span>
              </label>

              <AdminButton className="w-full" disabled={submitting} onClick={() => void submit()}>
                {submitting
                  ? <><i className="bi bi-hourglass-split" /> Salvando…</>
                  : editing
                    ? <><i className="bi bi-check2" /> Atualizar</>
                    : <><i className="bi bi-plus-circle" /> {tab === 'affiliate' ? 'Adicionar produto' : 'Criar item'}</>
                }
              </AdminButton>
              </>
              )}
            </div>
          </div>
        </div>

        {/* ── List ── */}
        <div>
          {tab === 'stamina' && (
            <StaminaTable items={staminaItems} editing={editing} onEdit={startEdit} onReset={resetForm} />
          )}
          {tab === 'gear' && (
            <GearGrid items={gearItems} editing={editingGear} onEdit={startEditGear} onReset={resetForm} />
          )}
          {tab === 'affiliate' && (
            <AffiliateGrid items={affiliateItems} editing={editing} onEdit={startEdit} onReset={resetForm} />
          )}
        </div>
      </div>
    </div>
  );
}

function GearGrid({
  items,
  editing,
  onEdit,
  onReset,
}: {
  items: GearCatalogItemDTO[];
  editing: string | null;
  onEdit: (item: GearCatalogItemDTO) => void;
  onReset: () => void;
}) {
  if (items.length === 0) {
    return (
      <div className="admin-card flex flex-col items-center justify-center py-16 text-center">
        <i className="bi bi-stars text-3xl text-slate-600 mb-3" />
        <p className="text-sm text-slate-500">Nenhum equipamento cadastrado.</p>
        <p className="text-xs text-slate-600 mt-1 max-w-sm">
          Use o formulário ao lado para criar chuteiras, luvas ou caneleiras (raridade, bônus no poder do jogador e preço GMT).
        </p>
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div
          key={item.id}
          className={`admin-card overflow-hidden ${editing === item.id ? 'border-emerald-500/30' : ''} ${!item.active ? 'opacity-50' : ''}`}
        >
          <div className="relative h-20 overflow-hidden bg-[#060d14]">
            {item.imageUrl ? (
              <GearSprite
                src={resolveUploadUrl(item.imageUrl)}
                className="h-full w-full"
                style={{ aspectRatio: 'auto', height: '100%' }}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-3xl text-slate-700">
                <i className="bi bi-stars" />
              </div>
            )}
          </div>
          <div className="space-y-2 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-white">{item.nameKey}</p>
                <p className="font-mono text-[11px] text-slate-500">{item.slug}</p>
              </div>
              <AdminBadge variant={item.active ? 'success' : 'default'}>
                {item.active ? 'Ativo' : 'Off'}
              </AdminBadge>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className="rounded bg-white/[0.04] px-2 py-0.5 text-slate-300">
                {RARITY_LABELS[item.rarity] ?? item.rarity}
              </span>
              <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-emerald-300">
                Bônus: +{item.owBonus}%
              </span>
              <span className="rounded bg-amber-500/10 px-2 py-0.5 text-amber-300">
                {item.priceGmt} GMT
              </span>
              <span className="rounded bg-white/[0.04] px-2 py-0.5 text-slate-400">
                {item.slot === 'boots' ? 'Chuteiras' : item.slot === 'gloves' ? 'Luvas' : item.slot === 'shinguards' ? 'Caneleiras' : item.slot}
              </span>
            </div>
            <AdminButton
              size="sm"
              variant={editing === item.id ? 'primary' : 'secondary'}
              className="w-full"
              onClick={() => (editing === item.id ? onReset() : onEdit(item))}
            >
              {editing === item.id ? 'Cancelar' : 'Editar foto, preço e bônus'}
            </AdminButton>
          </div>
        </div>
      ))}
    </div>
  );
}

function StaminaTable({ items, editing, onEdit, onReset }: {
  items: StadiumShopItemDTO[];
  editing: string | null;
  onEdit: (item: StadiumShopItemDTO) => void;
  onReset: () => void;
}) {
  if (items.length === 0) {
    return (
      <div className="admin-card flex flex-col items-center justify-center py-16 text-center">
        <i className="bi bi-lightning text-3xl text-slate-600 mb-3" />
        <p className="text-sm text-slate-500">Nenhum item de stamina cadastrado.</p>
      </div>
    );
  }
  return (
    <div className="admin-card overflow-hidden p-0">
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
        <i className="bi bi-lightning-charge-fill text-sm text-sky-400" />
        <h3 className="text-sm font-semibold text-slate-200">Itens de Stamina</h3>
        <AdminBadge variant="info">{items.length}</AdminBadge>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.04] bg-white/[0.01]">
              {['Slug', 'Efeito', 'Valor', 'Preço', 'Ordem', 'Status', ''].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500 last:text-right">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const meta = EFFECT_META[item.effectType];
              return (
                <tr key={item.id} className={`border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] transition-colors ${editing === item.id ? 'bg-emerald-500/5' : ''}`}>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 text-slate-300">{item.slug}</span>
                  </td>
                  <td className="px-4 py-3">
                    {meta && <span className={`flex items-center gap-1.5 text-xs ${meta.color}`}><i className={`bi ${meta.icon}`} />{meta.label}</span>}
                  </td>
                  <td className="px-4 py-3">
                    {item.effectType === 'stamina_full'
                      ? <span className="text-xs text-slate-500">máx.</span>
                      : <span className="font-mono font-semibold text-sky-300">+{item.effectValue}</span>
                    }
                  </td>
                  <td className="px-4 py-3"><span className="font-mono font-semibold text-amber-300">${item.priceUsdc}</span></td>
                  <td className="px-4 py-3 text-slate-500">{item.sortOrder}</td>
                  <td className="px-4 py-3"><AdminBadge variant={item.active ? 'success' : 'default'}>{item.active ? 'Ativo' : 'Inativo'}</AdminBadge></td>
                  <td className="px-4 py-3 text-right">
                    <AdminButton size="sm" variant={editing === item.id ? 'primary' : 'ghost'} onClick={() => editing === item.id ? onReset() : onEdit(item)}>
                      <i className={`bi ${editing === item.id ? 'bi-x' : 'bi-pencil'} text-xs`} />
                    </AdminButton>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AffiliateGrid({ items, editing, onEdit, onReset }: {
  items: StadiumShopItemDTO[];
  editing: string | null;
  onEdit: (item: StadiumShopItemDTO) => void;
  onReset: () => void;
}) {
  if (items.length === 0) {
    return (
      <div className="admin-card flex flex-col items-center justify-center py-16 text-center">
        <i className="bi bi-bag-heart text-3xl text-slate-600 mb-3" />
        <p className="text-sm text-slate-500">Nenhum produto afiliado cadastrado.</p>
        <p className="text-xs text-slate-600 mt-1">Adicione produtos do Mercado Livre, Amazon, etc.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <i className="bi bi-bag-heart-fill text-amber-400 text-sm" />
        <h3 className="text-sm font-semibold text-slate-200">Produtos Afiliados</h3>
        <AdminBadge variant="warning">{items.length}</AdminBadge>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => {
          const platform = item.externalPlatform ? PLATFORM_META[item.externalPlatform] : null;
          return (
            <div
              key={item.id}
              className={`rounded-xl border bg-white/[0.02] overflow-hidden transition-colors ${
                editing === item.id ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-white/[0.07] hover:border-white/[0.12]'
              } ${!item.active ? 'opacity-50' : ''}`}
            >
              {/* Product image */}
              <div className="relative h-32 bg-[#060d14] overflow-hidden">
                {item.imageUrl ? (
                  <img src={resolveUploadUrl(item.imageUrl)} alt={item.nameKey} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <i className="bi bi-image text-3xl text-slate-700" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                {/* Platform badge */}
                {platform && (
                  <div className="absolute top-2 left-2">
                    <span className={`flex items-center gap-1 rounded-full bg-black/60 border border-white/[0.10] px-2 py-0.5 text-[10px] font-semibold ${platform.color}`}>
                      <i className={`bi ${platform.icon}`} /> {platform.label}
                    </span>
                  </div>
                )}
                <AdminBadge variant={item.active ? 'success' : 'default'}>
                  <span className="absolute top-2 right-2">{item.active ? 'Ativo' : 'Inativo'}</span>
                </AdminBadge>
                {/* Price */}
                {item.priceUsdc > 0 && (
                  <div className="absolute bottom-2 right-2">
                    <span className="font-mono font-bold text-amber-300 text-sm">${item.priceUsdc}</span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-3">
                <p className="font-semibold text-slate-200 text-sm truncate">{item.nameKey}</p>
                {item.description && (
                  <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{item.description}</p>
                )}
                {item.affiliateUrl && (
                  <a
                    href={item.affiliateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 flex items-center gap-1 text-[10px] text-slate-600 hover:text-sky-400 transition-colors truncate"
                  >
                    <i className="bi bi-link-45deg" />
                    {item.affiliateUrl.slice(0, 50)}…
                  </a>
                )}
                <div className="mt-3 flex gap-1.5">
                  <AdminButton size="sm" variant={editing === item.id ? 'primary' : 'secondary'} className="flex-1"
                    onClick={() => editing === item.id ? onReset() : onEdit(item)}>
                    <i className={`bi ${editing === item.id ? 'bi-x' : 'bi-pencil'} text-xs`} />
                    {editing === item.id ? 'Cancelar' : 'Editar'}
                  </AdminButton>
                  {item.affiliateUrl && (
                    <a href={item.affiliateUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs text-slate-300 hover:bg-white/[0.08] transition-colors">
                      <i className="bi bi-box-arrow-up-right text-xs" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
