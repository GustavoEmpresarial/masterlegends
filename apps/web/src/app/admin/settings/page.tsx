import { useEffect, useState } from 'react';
import { MERGE_LADDER, SCOUT_RARITY_ORDER, SCOUT_RARITY_WEIGHTS, type PlatformConfigDTO, type ItemTemplateDTO, type ScoutRarityId } from '@mll/shared';
import { adminClient } from '../../../lib/api/adminClient';
import { AdminButton, AdminInput, AdminPageHeader } from '../../../components/admin/AdminTable';

const POSITIONS = ['GK', 'DEF', 'MID', 'FW', 'LAT'];
const SCOUT_WEIGHT_LABELS: Record<ScoutRarityId, string> = {
  common: 'Comum',
  uncommon: 'Incomum',
  rare: 'Raro',
  'super-rare': 'Super raro',
  epic: 'Épico',
  legendary: 'Lendário',
};
const DEFAULT_COLORS = ['#22c55e', '#a78bfa', '#38bdf8', '#fb923c', '#f43f5e', '#facc15', '#34d399', '#60a5fa'];

interface AllocationSlice { label: string; pct: number; color: string }
type Tab = 'geral' | 'referrals' | 'nfts' | 'alocacao' | 'fusao';

// ─── Atoms ────────────────────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-slate-400">{label}</p>
      {children}
      {hint && <p className="text-[10px] text-slate-600">{hint}</p>}
    </div>
  );
}

function SwitchRow({
  checked, onChange, label, description,
}: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <div
      className="flex items-center justify-between gap-4 cursor-pointer rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 select-none"
      onClick={() => onChange(!checked)}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-200">{label}</p>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <div className="relative shrink-0">
        <div className={`h-5 w-9 rounded-full transition-colors duration-200 ${checked ? 'bg-emerald-500' : 'bg-slate-700'}`} />
        <div className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
      </div>
    </div>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="admin-card p-5 space-y-5">
      <div className="flex items-center gap-2 border-b border-white/[0.06] pb-4">
        <i className={`bi ${icon} text-slate-400`} />
        <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
      </div>
      {children}
    </div>
  );
}

// ─── Catalog Picker Modal ─────────────────────────────────────────────────────

function CatalogPicker({
  onSelect, onClose,
}: {
  onSelect: (t: ItemTemplateDTO) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<ItemTemplateDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    void adminClient.get<{ items: ItemTemplateDTO[] }>('/items', { params: { active: 'true', limit: 200 } })
      .then((r) => setItems(r.data.items))
      .finally(() => setLoading(false));
  }, []);

  const filtered = q
    ? items.filter((i) => i.name?.toLowerCase().includes(q.toLowerCase()))
    : items;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-white/[0.08] bg-[#0a1020] shadow-2xl flex flex-col max-h-[80vh]">
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4 shrink-0">
          <i className="bi bi-grid-3x3-gap-fill text-emerald-400" />
          <p className="text-sm font-semibold text-white flex-1">Selecionar do Catálogo</p>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white">
            <i className="bi bi-x-lg text-sm" />
          </button>
        </div>
        <div className="px-4 py-3 shrink-0">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar jogador…"
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-emerald-500/40 focus:outline-none"
          />
        </div>
        <div className="overflow-y-auto px-4 pb-4 flex-1">
          {loading ? (
            <div className="flex justify-center py-8 text-slate-500">
              <i className="bi bi-arrow-repeat animate-spin text-xl" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-slate-500 py-8">Nenhum item encontrado.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {filtered.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelect(t)}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 hover:border-emerald-500/30 hover:bg-emerald-500/[0.05] transition-colors text-center"
                >
                  {t.imageUrl ? (
                    <img src={t.imageUrl} alt={t.name ?? ''} className="h-14 w-14 rounded-lg object-cover border border-white/[0.06]" />
                  ) : (
                    <div className="h-14 w-14 rounded-lg bg-white/[0.04] flex items-center justify-center border border-white/[0.06]">
                      <i className="bi bi-person text-slate-600 text-xl" />
                    </div>
                  )}
                  <p className="text-[10px] text-slate-300 font-medium leading-tight truncate w-full">{t.name}</p>
                  <p className="text-[9px] text-slate-600">{POSITIONS[t.position]} · {t.overwall} OVR</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── NFT card fields ──────────────────────────────────────────────────────────

function NftFields({
  name, imageUrl, overwall, position, durationDays,
  onChange, onDurationChange,
}: {
  name: string; imageUrl: string; overwall: number; position: number; durationDays?: number;
  onChange: (field: string, val: string | number) => void;
  onDurationChange?: (v: number) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  function selectTemplate(t: ItemTemplateDTO) {
    onChange('Name', t.name ?? '');
    onChange('ImageUrl', t.imageUrl ?? '');
    onChange('Overwall', t.overwall);
    onChange('Position', t.position);
    setPickerOpen(false);
  }

  return (
    <div className="space-y-4">
      {/* Selected preview + picker button */}
      <div className="flex items-center gap-3">
        {imageUrl ? (
          <img src={imageUrl} alt={name} className="h-16 w-16 rounded-xl object-cover border border-white/[0.08] shrink-0" />
        ) : (
          <div className="h-16 w-16 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center shrink-0">
            <i className="bi bi-person text-slate-600 text-2xl" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          {name
            ? <p className="text-sm font-semibold text-slate-200 truncate">{name}</p>
            : <p className="text-sm text-slate-600">Nenhum jogador selecionado</p>
          }
          {imageUrl && (
            <p className="text-[10px] text-slate-600 truncate mt-0.5">{POSITIONS[position]} · {overwall} OVR</p>
          )}
          <AdminButton size="sm" variant="ghost" onClick={() => setPickerOpen(true)} className="mt-2">
            <i className="bi bi-grid-3x3-gap-fill text-xs" />
            {imageUrl ? 'Trocar jogador' : 'Selecionar do catálogo'}
          </AdminButton>
        </div>
      </div>

      {/* Editable fields (override after picking) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Nome do jogador">
          <AdminInput value={name} onChange={(e) => onChange('Name', e.target.value)} placeholder="Craque Indicação" />
        </Field>
        <Field label="Overall">
          <AdminInput
            type="number" min="1" max="9999" value={overwall}
            onChange={(e) => onChange('Overwall', Number(e.target.value))}
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-4">
        <Field label="Posição">
          <select
            value={position}
            onChange={(e) => onChange('Position', Number(e.target.value))}
            className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/40 focus:outline-none w-28"
          >
            {POSITIONS.map((p, i) => <option key={p} value={i}>{p}</option>)}
          </select>
        </Field>
        {durationDays !== undefined && onDurationChange && (
          <Field label="Duração (dias)">
            <AdminInput
              type="number" min="1" max="9999" value={durationDays}
              onChange={(e) => onDurationChange(Number(e.target.value))}
              className="w-24"
            />
          </Field>
        )}
      </div>

      {pickerOpen && (
        <CatalogPicker onSelect={selectTemplate} onClose={() => setPickerOpen(false)} />
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function AdminSettingsPage() {
  const [cfg, setCfg] = useState<PlatformConfigDTO | null>(null);
  const [tab, setTab] = useState<Tab>('geral');
  const [form, setForm] = useState({
    registrationOpen: true, maintenanceMode: false, maintenanceMessage: '',
    referralBonusPct: 0.05,
    referralNftName: 'Craque Indicação', referralNftImageUrl: '', referralNftOverwall: 100,
    referralNftPosition: 2, referralNftDurationDays: 30,
    referralGiftNftName: 'Craque Indicação', referralGiftNftImageUrl: '',
    referralGiftNftOverwall: 100, referralGiftNftPosition: 2,
    socialRewardNftName: 'Craque Criador', socialRewardNftImageUrl: '',
    socialRewardNftOverwall: 100, socialRewardNftPosition: 2, socialRewardNftDays: 30,
    checkInStreakPlayerName: 'Comum 1', checkInStreakPlayerImageUrl: '/ui/bonecos/comum-1.png?v=1',
    checkInStreakPlayerOverwall: 5, checkInStreakPlayerPosition: 0,
    checkInStreakPlayerDays: 30, checkInStreakThreshold: 7,
    mergeDiscountPct: 0,
    scoutDiscountPct: 0,
    scoutCostGmt: 0.25,
    scoutRarityWeights: { ...SCOUT_RARITY_WEIGHTS },
  });
  const [allocation, setAllocation] = useState<AllocationSlice[]>([
    { label: 'Saques de jogadores', pct: 83, color: '#22c55e' },
    { label: 'Bônus de indicação', pct: 5, color: '#a78bfa' },
    { label: 'Coaches & mineração', pct: 2, color: '#38bdf8' },
    { label: 'Taxa de marketplace', pct: 10, color: '#fb923c' },
  ]);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [msgError, setMsgError] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  useEffect(() => {
    void adminClient.get<PlatformConfigDTO>('/wallet-config').then((res) => {
      setCfg(res.data);
      setForm({
        registrationOpen: res.data.registrationOpen,
        maintenanceMode: res.data.maintenanceMode,
        maintenanceMessage: res.data.maintenanceMessage ?? '',
        referralBonusPct: res.data.referralBonusPct,
        referralNftName: res.data.referralNftName ?? 'Craque Indicação',
        referralNftImageUrl: res.data.referralNftImageUrl ?? '',
        referralNftOverwall: res.data.referralNftOverwall ?? 100,
        referralNftPosition: res.data.referralNftPosition ?? 2,
        referralNftDurationDays: res.data.referralNftDurationDays ?? 30,
        referralGiftNftName: res.data.referralGiftNftName ?? 'Craque Indicação',
        referralGiftNftImageUrl: res.data.referralGiftNftImageUrl ?? '',
        referralGiftNftOverwall: res.data.referralGiftNftOverwall ?? 100,
        referralGiftNftPosition: res.data.referralGiftNftPosition ?? 2,
        socialRewardNftName: res.data.socialRewardNftName ?? 'Craque Criador',
        socialRewardNftImageUrl: res.data.socialRewardNftImageUrl ?? '',
        socialRewardNftOverwall: res.data.socialRewardNftOverwall ?? 100,
        socialRewardNftPosition: res.data.socialRewardNftPosition ?? 2,
        socialRewardNftDays: res.data.socialRewardNftDays ?? 30,
        checkInStreakPlayerName: res.data.checkInStreakPlayerName ?? 'Comum 1',
        checkInStreakPlayerImageUrl: res.data.checkInStreakPlayerImageUrl ?? '/ui/bonecos/comum-1.png?v=1',
        checkInStreakPlayerOverwall: res.data.checkInStreakPlayerOverwall ?? 5,
        checkInStreakPlayerPosition: res.data.checkInStreakPlayerPosition ?? 0,
        checkInStreakPlayerDays: res.data.checkInStreakPlayerDays ?? 30,
        checkInStreakThreshold: res.data.checkInStreakThreshold ?? 7,
        mergeDiscountPct: res.data.mergeDiscountPct ?? 0,
        scoutDiscountPct: res.data.scoutDiscountPct ?? 0,
        scoutCostGmt: res.data.scoutCostGmt ?? 0.25,
        scoutRarityWeights: res.data.scoutRarityWeights ?? { ...SCOUT_RARITY_WEIGHTS },
      });
      if (res.data.allocationJson?.length) {
        setAllocation(res.data.allocationJson.map((s) => ({ label: s.label, pct: s.pct, color: s.color ?? '#22c55e' })));
      }
    });
  }, []);

  async function save() {
    if (Object.values(form.scoutRarityWeights).every((weight) => weight <= 0)) {
      setMessage('Pelo menos uma raridade precisa de peso maior que zero.');
      setMsgError(true);
      return;
    }
    setSaving(true); setMessage('');
    try {
      const { data } = await adminClient.patch<PlatformConfigDTO>('/wallet-config', {
        registrationOpen: form.registrationOpen,
        maintenanceMode: form.maintenanceMode,
        maintenanceMessage: form.maintenanceMessage || null,
        referralBonusPct: form.referralBonusPct,
        referralNftName: form.referralNftName,
        referralNftImageUrl: form.referralNftImageUrl || null,
        referralNftOverwall: form.referralNftOverwall,
        referralNftPosition: form.referralNftPosition,
        referralNftDurationDays: form.referralNftDurationDays,
        referralGiftNftName: form.referralGiftNftName,
        referralGiftNftImageUrl: form.referralGiftNftImageUrl || null,
        referralGiftNftOverwall: form.referralGiftNftOverwall,
        referralGiftNftPosition: form.referralGiftNftPosition,
        socialRewardNftName: form.socialRewardNftName,
        socialRewardNftImageUrl: form.socialRewardNftImageUrl || null,
        socialRewardNftOverwall: form.socialRewardNftOverwall,
        socialRewardNftPosition: form.socialRewardNftPosition,
        socialRewardNftDays: form.socialRewardNftDays,
        checkInStreakPlayerName: form.checkInStreakPlayerName,
        checkInStreakPlayerImageUrl: form.checkInStreakPlayerImageUrl || null,
        checkInStreakPlayerOverwall: form.checkInStreakPlayerOverwall,
        checkInStreakPlayerPosition: form.checkInStreakPlayerPosition,
        checkInStreakPlayerDays: form.checkInStreakPlayerDays,
        checkInStreakThreshold: form.checkInStreakThreshold,
        mergeDiscountPct: form.mergeDiscountPct,
        scoutDiscountPct: form.scoutDiscountPct,
        scoutCostGmt: form.scoutCostGmt,
        scoutRarityWeights: form.scoutRarityWeights,
        allocationJson: allocation,
      });
      setCfg(data);
      setMessage('Configurações salvas!');
      setMsgError(false);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
      setMessage(anyErr?.response?.data?.error?.message ?? 'Falha ao salvar.');
      setMsgError(true);
    } finally {
      setSaving(false);
    }
  }

  async function syncNfts(source: 'referral' | 'referral_gift') {
    const isGift = source === 'referral_gift';
    setSyncing(source); setSyncMsg('');
    try {
      const { data } = await adminClient.post<{ updated: number }>('/referral-nft/sync', {
        source,
        name: isGift ? form.referralGiftNftName : form.referralNftName,
        imageUrl: (isGift ? form.referralGiftNftImageUrl : form.referralNftImageUrl) || null,
        overwall: isGift ? form.referralGiftNftOverwall : form.referralNftOverwall,
        position: isGift ? form.referralGiftNftPosition : form.referralNftPosition,
      });
      setSyncMsg(`${data.updated} NFTs de ${isGift ? 'indicado' : 'indicador'} atualizados`);
    } catch {
      setSyncMsg('Falha ao sincronizar');
    } finally {
      setSyncing(null);
    }
  }

  const allocationTotal = allocation.reduce((s, a) => s + a.pct, 0);
  const allocationOk = Math.abs(allocationTotal - 100) < 0.01;

  const tabs: { key: Tab; icon: string; label: string }[] = [
    { key: 'geral',    icon: 'bi-gear',         label: 'Geral' },
    { key: 'referrals', icon: 'bi-people',       label: 'Referrals' },
    { key: 'nfts',     icon: 'bi-gem',           label: 'NFTs' },
    { key: 'alocacao', icon: 'bi-pie-chart',     label: 'Alocação' },
    { key: 'fusao',    icon: 'bi-percent',        label: 'Descontos' },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Configurações" subtitle="Controle geral da plataforma, recompensas e alocação de receitas." />

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl border border-white/[0.06] bg-white/[0.02] w-fit">
        {tabs.map(({ key, icon, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === key
                ? 'bg-white/[0.08] text-slate-100'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <i className={`bi ${icon} text-xs`} />
            {label}
          </button>
        ))}
      </div>

      {!cfg ? (
        <div className="admin-card p-5 flex items-center justify-center py-16">
          <p className="text-sm text-slate-400">Carregando…</p>
        </div>
      ) : (
        <div className="max-w-2xl space-y-5">

          {/* ── GERAL ── */}
          {tab === 'geral' && (
            <SectionCard title="Acesso à plataforma" icon="bi-shield-lock">
              <SwitchRow
                checked={form.registrationOpen}
                onChange={(v) => setForm((f) => ({ ...f, registrationOpen: v }))}
                label="Permitir novos registros"
                description="Desativar bloqueia criação de novas contas"
              />
              <SwitchRow
                checked={form.maintenanceMode}
                onChange={(v) => setForm((f) => ({ ...f, maintenanceMode: v }))}
                label="Modo manutenção"
                description="Bloqueia o acesso ao jogo e exibe a mensagem abaixo"
              />
              {form.maintenanceMode && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
                  <p className="text-xs font-medium text-amber-400 flex items-center gap-1.5">
                    <i className="bi bi-exclamation-triangle-fill" /> Mensagem exibida aos jogadores
                  </p>
                  <textarea
                    value={form.maintenanceMessage}
                    onChange={(e) => setForm((f) => ({ ...f, maintenanceMessage: e.target.value }))}
                    rows={3}
                    maxLength={500}
                    placeholder="Voltamos em breve!"
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-amber-500/40 focus:outline-none resize-none"
                  />
                </div>
              )}
            </SectionCard>
          )}

          {/* ── REFERRALS ── */}
          {tab === 'referrals' && (
            <SectionCard title="Programa de referrals" icon="bi-people">
              <Field label="Bônus de referral" hint="Fração do depósito repassada a quem indicou. Ex: 0.05 = 5%">
                <div className="flex items-center gap-3">
                  <AdminInput
                    type="number" step="0.01" min="0" max="1"
                    value={form.referralBonusPct}
                    onChange={(e) => setForm((f) => ({ ...f, referralBonusPct: Number(e.target.value) }))}
                    className="w-28"
                  />
                  <span className="text-sm font-semibold text-slate-200">
                    = {(form.referralBonusPct * 100).toFixed(1)}%
                  </span>
                </div>
              </Field>

              {/* Simulation bar */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
                <p className="text-xs text-slate-500 font-medium">Simulação em depósito de $100</p>
                <div className="flex h-7 w-full rounded-lg overflow-hidden text-xs font-semibold">
                  <div
                    className="flex items-center justify-center text-white bg-emerald-600 transition-all"
                    style={{ width: `${(1 - form.referralBonusPct) * 100}%` }}
                  >
                    ${(100 * (1 - form.referralBonusPct)).toFixed(2)} plataforma
                  </div>
                  <div
                    className="flex items-center justify-center text-white bg-purple-600 transition-all"
                    style={{ width: `${form.referralBonusPct * 100}%` }}
                  >
                    ${(100 * form.referralBonusPct).toFixed(2)}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-600 inline-block" /> Plataforma</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-purple-600 inline-block" /> Indicador</span>
                </div>
              </div>
            </SectionCard>
          )}

          {/* ── NFTs ── */}
          {tab === 'nfts' && (
            <div className="space-y-5">
              {syncMsg && (
                <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-300">
                  {syncMsg}
                </p>
              )}

              <SectionCard title="NFT do Indicador (quem indicou)" icon="bi-cursor-fill">
                <p className="text-xs text-slate-500 -mt-2">Temporário · expira {form.referralNftDurationDays} dias após ser escalado</p>
                <NftFields
                  name={form.referralNftName}
                  imageUrl={form.referralNftImageUrl}
                  overwall={form.referralNftOverwall}
                  position={form.referralNftPosition}
                  durationDays={form.referralNftDurationDays}
                  onChange={(field, val) => setForm((f) => ({ ...f, [`referralNft${field}`]: val }))}
                  onDurationChange={(v) => setForm((f) => ({ ...f, referralNftDurationDays: v }))}
                />
                <div className="pt-2 border-t border-white/[0.04]">
                  <AdminButton
                    variant="ghost"
                    size="sm"
                    onClick={() => void syncNfts('referral')}
                    disabled={syncing === 'referral'}
                  >
                    {syncing === 'referral'
                      ? <><i className="bi bi-arrow-repeat animate-spin" /> Sincronizando…</>
                      : <><i className="bi bi-arrow-repeat" /> Aplicar retroativamente</>
                    }
                  </AdminButton>
                </div>
              </SectionCard>

              <SectionCard title="NFT do Indicado (novo usuário)" icon="bi-gift-fill">
                <p className="text-xs text-slate-500 -mt-2">Permanente · sem expiração</p>
                <NftFields
                  name={form.referralGiftNftName}
                  imageUrl={form.referralGiftNftImageUrl}
                  overwall={form.referralGiftNftOverwall}
                  position={form.referralGiftNftPosition}
                  onChange={(field, val) => setForm((f) => ({ ...f, [`referralGiftNft${field}`]: val }))}
                />
                <div className="pt-2 border-t border-white/[0.04]">
                  <AdminButton
                    variant="ghost"
                    size="sm"
                    onClick={() => void syncNfts('referral_gift')}
                    disabled={syncing === 'referral_gift'}
                  >
                    {syncing === 'referral_gift'
                      ? <><i className="bi bi-arrow-repeat animate-spin" /> Sincronizando…</>
                      : <><i className="bi bi-arrow-repeat" /> Aplicar retroativamente</>
                    }
                  </AdminButton>
                </div>
              </SectionCard>

              <SectionCard title="NFT do Criador YouTube" icon="bi-youtube">
                <p className="text-xs text-slate-500 -mt-2">Concedida ao aprovar vídeo · expira em {form.socialRewardNftDays} dias · máx. 2 por semana</p>
                <NftFields
                  name={form.socialRewardNftName}
                  imageUrl={form.socialRewardNftImageUrl}
                  overwall={form.socialRewardNftOverwall}
                  position={form.socialRewardNftPosition}
                  durationDays={form.socialRewardNftDays}
                  onChange={(field, val) => setForm((f) => ({ ...f, [`socialRewardNft${field}`]: val }))}
                  onDurationChange={(v) => setForm((f) => ({ ...f, socialRewardNftDays: v }))}
                />
              </SectionCard>

              <SectionCard title="Jogador Check-in (streak)" icon="bi-calendar-check">
                <p className="text-xs text-slate-500 -mt-2">
                  A cada {form.checkInStreakThreshold} dias consecutivos de presença · expira em {form.checkInStreakPlayerDays} dias
                </p>
                <div className="mb-3">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Dias consecutivos</label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={form.checkInStreakThreshold}
                    onChange={(e) => setForm((f) => ({ ...f, checkInStreakThreshold: Number(e.target.value) || 7 }))}
                    className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/40 focus:outline-none"
                  />
                </div>
                <NftFields
                  name={form.checkInStreakPlayerName}
                  imageUrl={form.checkInStreakPlayerImageUrl}
                  overwall={form.checkInStreakPlayerOverwall}
                  position={form.checkInStreakPlayerPosition}
                  durationDays={form.checkInStreakPlayerDays}
                  onChange={(field, val) => setForm((f) => ({ ...f, [`checkInStreakPlayer${field}`]: val }))}
                  onDurationChange={(v) => setForm((f) => ({ ...f, checkInStreakPlayerDays: v }))}
                />
              </SectionCard>
            </div>
          )}

          {/* ── ALOCAÇÃO ── */}
          {tab === 'alocacao' && (
            <SectionCard title="Alocação de Receitas" icon="bi-pie-chart">
              <p className="text-xs text-slate-500 -mt-2">Fatias exibidas no portal público de transparência. Deve somar 100%.</p>

              {/* Total */}
              <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                allocationOk
                  ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300'
                  : 'border-red-500/20 bg-red-500/5 text-red-300'
              }`}>
                <i className={`bi ${allocationOk ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} text-xs`} />
                <span className="font-semibold text-xs">Total: {allocationTotal.toFixed(1)}%</span>
                {!allocationOk && (
                  <span className="text-[10px] ml-auto opacity-70">
                    {allocationTotal > 100 ? `${(allocationTotal - 100).toFixed(1)}% acima` : `${(100 - allocationTotal).toFixed(1)}% abaixo`}
                  </span>
                )}
              </div>

              {/* Bar */}
              <div className="flex h-3 w-full rounded-full overflow-hidden bg-white/[0.04]">
                {allocation.map((s, i) => (
                  <div
                    key={i}
                    title={`${s.label}: ${s.pct}%`}
                    style={{ width: `${Math.max(s.pct, 0)}%`, background: s.color }}
                    className="transition-all duration-300"
                  />
                ))}
              </div>

              {/* Slices */}
              <div className="space-y-2">
                {allocation.map((slice, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="color"
                      value={slice.color}
                      onChange={(e) => setAllocation((a) => a.map((s, j) => j === i ? { ...s, color: e.target.value } : s))}
                      className="h-8 w-8 shrink-0 rounded-lg cursor-pointer border border-white/[0.08] bg-transparent p-0.5"
                    />
                    <input
                      type="text"
                      value={slice.label}
                      placeholder="Nome da fatia"
                      onChange={(e) => setAllocation((a) => a.map((s, j) => j === i ? { ...s, label: e.target.value } : s))}
                      className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/40 focus:outline-none"
                    />
                    <input
                      type="number"
                      min="0" max="100" step="0.1"
                      value={slice.pct}
                      onChange={(e) => setAllocation((a) => a.map((s, j) => j === i ? { ...s, pct: Number(e.target.value) } : s))}
                      className="w-20 shrink-0 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-right text-slate-100 focus:border-emerald-500/40 focus:outline-none"
                    />
                    <span className="text-xs text-slate-600 shrink-0">%</span>
                    <button
                      type="button"
                      onClick={() => setAllocation((a) => a.filter((_, j) => j !== i))}
                      className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] text-slate-500 hover:border-red-500/30 hover:text-red-400 transition-colors"
                    >
                      <i className="bi bi-x text-sm" />
                    </button>
                  </div>
                ))}
              </div>

              <AdminButton
                variant="ghost"
                size="sm"
                onClick={() => {
                  const used = allocation.map((s) => s.color);
                  const next = DEFAULT_COLORS.find((c) => !used.includes(c)) ?? '#94a3b8';
                  setAllocation((a) => [...a, { label: 'Nova categoria', pct: 0, color: next }]);
                }}
              >
                <i className="bi bi-plus-circle" /> Adicionar fatia
              </AdminButton>
            </SectionCard>
          )}

          {/* ── DESCONTOS (fusão + scout) ── */}
          {tab === 'fusao' && (() => {
            const FUSION_FEES = MERGE_LADDER.map((step) => ({
              label: `${SCOUT_WEIGHT_LABELS[SCOUT_RARITY_ORDER[step.inputRarity]!]} → ${SCOUT_WEIGHT_LABELS[SCOUT_RARITY_ORDER[step.outputRarity]!]}`,
              fee: step.feeGmt,
            }));
            const discount = form.mergeDiscountPct;
            const scoutDiscount = form.scoutDiscountPct;
            const SCOUT_BASE = form.scoutCostGmt;
            const scoutEffective = parseFloat((SCOUT_BASE * (1 - scoutDiscount)).toFixed(4));
            return (
              <div className="space-y-5">
                <SectionCard title="Desconto de Fusão" icon="bi-fire">
                  <p className="text-xs text-slate-500 -mt-2">
                    Desconto aplicado globalmente sobre a taxa de fusão. 0 = sem desconto, 1 = 100% grátis.
                  </p>

                  <Field label="Desconto (%)" hint={`Taxa atual: ${(discount * 100).toFixed(0)}% de desconto`}>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="0" max="1" step="0.01"
                        value={discount}
                        onChange={(e) => setForm((f) => ({ ...f, mergeDiscountPct: Number(e.target.value) }))}
                        className="flex-1 accent-emerald-500"
                      />
                      <div className="flex items-center gap-1.5 shrink-0">
                        <AdminInput
                          type="number" step="1" min="0" max="100"
                          value={Math.round(discount * 100)}
                          onChange={(e) => setForm((f) => ({ ...f, mergeDiscountPct: Number(e.target.value) / 100 }))}
                          className="w-20 text-center"
                        />
                        <span className="text-sm text-slate-400">%</span>
                      </div>
                    </div>

                    {/* Discount bar visual */}
                    <div className="flex h-6 w-full rounded-lg overflow-hidden text-[10px] font-semibold mt-1">
                      <div
                        className="flex items-center justify-center bg-slate-700 text-slate-300 transition-all duration-300"
                        style={{ width: `${(1 - discount) * 100}%` }}
                      >
                        {((1 - discount) * 100).toFixed(0)}% pago
                      </div>
                      {discount > 0 && (
                        <div
                          className="flex items-center justify-center bg-emerald-600 text-white transition-all duration-300"
                          style={{ width: `${discount * 100}%` }}
                        >
                          {(discount * 100).toFixed(0)}% desc
                        </div>
                      )}
                    </div>
                  </Field>
                </SectionCard>

                <SectionCard title="Prévia das taxas" icon="bi-table">
                  <p className="text-xs text-slate-500 -mt-2">
                    Cinco fusões, uma por raridade até o épico. Lendário vale 3.125 GMT e não é ingrediente.
                  </p>
                  <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                          <th className="px-4 py-2.5 text-left font-medium text-slate-400">Fusão</th>
                          <th className="px-4 py-2.5 text-right font-medium text-slate-400">Taxa base</th>
                          <th className="px-4 py-2.5 text-right font-medium text-slate-400">Desconto</th>
                          <th className="px-4 py-2.5 text-right font-medium text-slate-400">Taxa efetiva</th>
                        </tr>
                      </thead>
                      <tbody>
                        {FUSION_FEES.map(({ label, fee }) => {
                          const effective = parseFloat((fee * (1 - discount)).toFixed(4));
                          const saved = fee - effective;
                          return (
                            <tr key={label} className="border-b border-white/[0.04] last:border-0">
                              <td className="px-4 py-2.5 text-slate-300">
                                {label}
                              </td>
                              <td className="px-4 py-2.5 text-right text-slate-500">{fee} GMT</td>
                              <td className="px-4 py-2.5 text-right text-emerald-400">
                                {discount > 0 ? `-${saved.toFixed(2)} GMT` : '—'}
                              </td>
                              <td className="px-4 py-2.5 text-right font-semibold text-slate-100">{effective} GMT</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>

                <SectionCard title="Preço do Scout / Mint" icon="bi-search">
                  <p className="text-xs text-slate-500 -mt-2">
                    Preço de cada carta no olheiro, em GMT. O comum no mercado custa 0,25 GMT.
                    O desconto abaixo reduz esse preço para todo mundo.
                  </p>
                  <Field label="Preço base (GMT)">
                    <AdminInput
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={String(form.scoutCostGmt)}
                      onChange={(e) => setForm((f) => ({ ...f, scoutCostGmt: Number(e.target.value) }))}
                    />
                  </Field>
                  <Field label="Desconto (%)" hint={`Cobrado agora: ${scoutEffective} GMT por carta`}>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="0" max="1" step="0.01"
                        value={scoutDiscount}
                        onChange={(e) => setForm((f) => ({ ...f, scoutDiscountPct: Number(e.target.value) }))}
                        className="flex-1 accent-amber-500"
                      />
                      <div className="flex items-center gap-1.5 shrink-0">
                        <AdminInput
                          type="number" step="1" min="0" max="100"
                          value={Math.round(scoutDiscount * 100)}
                          onChange={(e) => setForm((f) => ({ ...f, scoutDiscountPct: Number(e.target.value) / 100 }))}
                          className="w-20 text-center"
                        />
                        <span className="text-sm text-slate-400">%</span>
                      </div>
                    </div>

                    <div className="flex h-6 w-full rounded-lg overflow-hidden text-[10px] font-semibold mt-1">
                      <div
                        className="flex items-center justify-center bg-slate-700 text-slate-300 transition-all duration-300"
                        style={{ width: `${(1 - scoutDiscount) * 100}%` }}
                      >
                        {((1 - scoutDiscount) * 100).toFixed(0)}% pago
                      </div>
                      {scoutDiscount > 0 && (
                        <div
                          className="flex items-center justify-center bg-amber-600 text-white transition-all duration-300"
                          style={{ width: `${scoutDiscount * 100}%` }}
                        >
                          {(scoutDiscount * 100).toFixed(0)}% desc
                        </div>
                      )}
                    </div>
                  </Field>

                  <div className="rounded-xl border border-white/[0.06] overflow-hidden mt-2">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                          <th className="px-4 py-2.5 text-left font-medium text-slate-400">Pack</th>
                          <th className="px-4 py-2.5 text-right font-medium text-slate-400">Base</th>
                          <th className="px-4 py-2.5 text-right font-medium text-slate-400">Efetivo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[1, 3, 5, 10].map((qty) => {
                          const base = SCOUT_BASE * qty;
                          const effective = parseFloat((scoutEffective * qty).toFixed(4));
                          return (
                            <tr key={qty} className="border-b border-white/[0.04] last:border-0">
                              <td className="px-4 py-2.5 text-slate-300">{qty}× NFT</td>
                              <td className="px-4 py-2.5 text-right text-slate-500">{base} GMT</td>
                              <td className="px-4 py-2.5 text-right font-semibold text-slate-100">{effective} GMT</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>

                <SectionCard title="Chances do sorteio" icon="bi-dice-5">
                  <p className="text-xs text-slate-500 -mt-2">
                    Pesos de cada raridade no mint. Não precisam somar 1: o jogo divide pela soma. Pelo menos um peso maior que zero.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {SCOUT_RARITY_ORDER.map((id) => (
                      <Field key={id} label={SCOUT_WEIGHT_LABELS[id]}>
                        <AdminInput
                          type="number"
                          min="0"
                          step="0.0001"
                          value={form.scoutRarityWeights[id]}
                          onChange={(e) => {
                            const next = Number(e.target.value);
                            setForm((f) => ({
                              ...f,
                              scoutRarityWeights: {
                                ...f.scoutRarityWeights,
                                [id]: Number.isFinite(next) ? Math.max(0, next) : 0,
                              },
                            }));
                          }}
                        />
                      </Field>
                    ))}
                  </div>
                </SectionCard>
              </div>
            );
          })()}

          {/* ── Save ── */}
          <div className="flex items-center gap-4 border-t border-white/[0.06] pt-4">
            <AdminButton onClick={() => void save()} disabled={saving}>
              {saving
                ? <><i className="bi bi-arrow-repeat animate-spin" /> Salvando…</>
                : <><i className="bi bi-check-circle" /> Salvar configurações</>
              }
            </AdminButton>
            {message && (
              <p className={`text-sm ${msgError ? 'text-red-400' : 'text-emerald-400'}`}>{message}</p>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
