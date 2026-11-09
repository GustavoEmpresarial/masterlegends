import { useCallback, useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import type { AdminUserAccountDTO, AdminUpdateUserProfileInput } from '@mll/shared';
import { adminClient } from '../../lib/api/adminClient';
import {
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminInput,
  AdminModal,
} from './AdminTable';
import { UserRoiSection } from './UserRoiSection';
import { adminPt, formatAdminDate } from '../../lib/admin/i18n';

interface UserAccountPanelProps {
  userId: string;
  canManage: boolean;
  embedded?: boolean;
  onUpdated?: () => void;
}

const SOURCE_BADGE: Record<string, 'info' | 'success' | 'warning'> = {
  balance: 'success',
  wallet: 'info',
  security: 'warning',
};

const RARITY_LABELS = ['Common', 'Rare', 'Super Rare', 'Epic', 'Legendary'];
const RARITY_COLORS = ['text-slate-400', 'text-green-400', 'text-blue-400', 'text-purple-400', 'text-amber-400'];
const POSITION_LABELS = ['GK', 'DEF', 'MID', 'FW', 'ST'];

interface ClubTrophy {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  wonAt: string;
}

interface ItemTemplate {
  id: string;
  name: string;
  imageUrl: string | null;
  rarity: number;
  position: number;
  overwall: number;
}

function Section({ title, icon, children, action }: {
  title: string; icon: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] bg-white/[0.02] px-4 py-3">
        <div className="flex items-center gap-2">
          <i className={`bi ${icon} text-sm text-slate-400`} />
          <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <div>{children}</div>
    </div>
  );
}

function BalanceField({ label, value, disabled, onChange, decimals = 4, fieldKey, userId, currentAccountValue, onSaved }: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (next: string) => void;
  decimals?: number;
  fieldKey: 'gmtBalance' | 'usdcBalance' | 'usdtBalance';
  userId: string;
  currentAccountValue: number;
  onSaved: () => Promise<void>;
}) {
  const [addAmount, setAddAmount] = useState('');
  const [confirmSign, setConfirmSign] = useState<1 | -1 | null>(null);
  const [quickSaving, setQuickSaving] = useState(false);
  const [quickError, setQuickError] = useState('');

  const manualNum = Number(value);
  const manualValid = Number.isFinite(manualNum) && manualNum >= 0;
  const manualDirty = manualValid && manualNum !== currentAccountValue;

  async function quickSave() {
    if (!manualDirty || disabled) return;
    setQuickSaving(true);
    setQuickError('');
    try {
      await adminClient.patch(`/users/${userId}/profile`, { [fieldKey]: manualNum });
      await onSaved();
    } catch {
      setQuickError('Falha ao salvar');
    } finally {
      setQuickSaving(false);
    }
  }

  const delta = Number(addAmount);
  const validDelta = Number.isFinite(delta) && delta > 0;
  const current = Number(value) || 0;
  const previewNext = confirmSign
    ? Math.max(0, Number((current + confirmSign * delta).toFixed(decimals)))
    : current;

  const openConfirm = (sign: 1 | -1) => {
    if (!validDelta) return;
    setConfirmSign(sign);
  };

  const confirmApply = () => {
    if (!confirmSign) return;
    onChange(String(previewNext));
    setAddAmount('');
    setConfirmSign(null);
  };

  return (
    <Field label={label}>
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <AdminInput value={value} disabled={disabled} type="number"
            onChange={(e) => onChange(e.target.value)} />
          <AdminButton type="button" variant="primary" size="sm"
            disabled={disabled || !manualDirty || quickSaving}
            onClick={() => void quickSave()} title="Digitar valor exato e salvar direto"
            className="!bg-emerald-600 hover:!bg-emerald-500 shrink-0">
            {quickSaving ? <i className="bi bi-arrow-repeat animate-spin" /> : <i className="bi bi-check-lg" />}
            Salvar
          </AdminButton>
        </div>
        {quickError && <p className="text-xs text-red-400">{quickError}</p>}
        <p className="text-[10px] text-slate-500">
          Digite o valor exato acima e clique em Salvar para aplicar na hora — ou use os botões abaixo para somar/subtrair.
        </p>
        <div className="flex items-center gap-1.5">
          <AdminInput value={addAmount} disabled={disabled} type="number" placeholder="Quantidade"
            className="text-xs"
            onChange={(e) => setAddAmount(e.target.value)} />
          <AdminButton type="button" variant="primary" size="sm" disabled={disabled || !validDelta}
            onClick={() => openConfirm(1)} title="Adicionar ao saldo"
            className="!bg-emerald-600 hover:!bg-emerald-500 shrink-0">
            <i className="bi bi-plus-lg" />
            Adicionar
          </AdminButton>
          <AdminButton type="button" variant="secondary" size="sm" disabled={disabled || !validDelta}
            onClick={() => openConfirm(-1)} title="Remover do saldo" className="shrink-0">
            <i className="bi bi-dash-lg" />
          </AdminButton>
        </div>
      </div>

      <AdminModal
        open={confirmSign !== null}
        title={confirmSign === 1 ? `Adicionar ${label}` : `Remover ${label}`}
        onClose={() => setConfirmSign(null)}
        footer={
          <>
            <AdminButton variant="secondary" onClick={() => setConfirmSign(null)}>
              Cancelar
            </AdminButton>
            <AdminButton
              variant="primary"
              className={confirmSign === 1 ? '!bg-emerald-600 hover:!bg-emerald-500' : '!bg-red-600 hover:!bg-red-500 !border-red-500/40 !shadow-none'}
              onClick={confirmApply}
            >
              <i className={`bi ${confirmSign === 1 ? 'bi-check-lg' : 'bi-dash-circle'}`} />
              Confirmar {confirmSign === 1 ? 'adição' : 'remoção'}
            </AdminButton>
          </>
        }
      >
        <div className="space-y-4">
          <div
            className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-2xl font-bold ${
              confirmSign === 1
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : 'border-red-500/30 bg-red-500/10 text-red-400'
            }`}
          >
            <i className={`bi ${confirmSign === 1 ? 'bi-plus-circle-fill' : 'bi-dash-circle-fill'}`} />
            {confirmSign === 1 ? '+' : '−'}{isFinite(delta) ? delta : 0}
          </div>

          <div className="space-y-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Saldo atual</span>
              <span className="font-mono text-slate-200">{current}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Alteração</span>
              <span className={`font-mono ${confirmSign === 1 ? 'text-emerald-400' : 'text-red-400'}`}>
                {confirmSign === 1 ? '+' : '−'}{isFinite(delta) ? delta : 0}
              </span>
            </div>
            <div className="my-1 border-t border-white/[0.06]" />
            <div className="flex items-center justify-between text-base font-semibold">
              <span className="text-slate-300">Novo saldo</span>
              <span className="font-mono text-white">{previewNext}</span>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Isso só atualiza o campo aqui embaixo — ainda é preciso clicar em{' '}
            <span className="font-semibold text-slate-300">&quot;Salvar perfil&quot;</span> para aplicar de verdade.
          </p>
        </div>
      </AdminModal>
    </Field>
  );
}

function ReadValue({ value }: { value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-slate-400">
      {value}
    </div>
  );
}

export function UserAccountPanel({ userId, canManage, onUpdated }: UserAccountPanelProps) {
  const [account, setAccount] = useState<AdminUserAccountDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  // modals
  const [banModal, setBanModal] = useState(false);
  const [deactivateModal, setDeactivateModal] = useState(false);
  const [grantModal, setGrantModal] = useState(false);
  const [trophyModal, setTrophyModal] = useState(false);

  const [banReason, setBanReason] = useState('');
  const [deactivateReason, setDeactivateReason] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [clearAccountLock, setClearAccountLock] = useState(false);

  const [trophies, setTrophies] = useState<ClubTrophy[]>([]);
  const [trophySaving, setTrophySaving] = useState(false);
  const [trophyForm, setTrophyForm] = useState({
    name: '', description: '', imageUrl: '', wonAt: new Date().toISOString().slice(0, 10),
  });

  const [templates, setTemplates] = useState<ItemTemplate[]>([]);
  const [grantForm, setGrantForm] = useState({
    rarity: 0, position: 0, overwall: 100, name: '', imageUrl: '', templateId: '',
    source: 'admin_grant', temporary: false, expiresAt: '', quantity: 1,
  });
  const [grantSaving, setGrantSaving] = useState(false);

  const [activitySource, setActivitySource] = useState<'all' | 'balance' | 'wallet' | 'security'>('all');
  const [activityTxType, setActivityTxType] = useState<'all' | 'sponsorship'>('all');
  const [activitySearch, setActivitySearch] = useState('');
  const [hideZeroAmounts, setHideZeroAmounts] = useState(true);

  const [form, setForm] = useState({
    username: '', email: '', clubName: '', wallet: '',
    gmtBalance: '', usdcBalance: '', usdtBalance: '', referralCode: '',
    emailVerified: false, failedLoginCount: '',
    stadiumLvl: '', ctLvl: '', treasurerLvl: '', trophyRoomLvl: '', totalOverwall: '',
  });

  const t = adminPt.users;

  const loadTrophies = useCallback(async () => {
    try {
      const { data } = await adminClient.get<{ trophies: ClubTrophy[] } | ClubTrophy[]>(`/users/${userId}/trophies`);
      setTrophies(Array.isArray(data) ? data : (data as { trophies: ClubTrophy[] }).trophies ?? []);
    } catch { /* non-critical */ }
  }, [userId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await adminClient.get<AdminUserAccountDTO>(`/users/${userId}/account`);
      setAccount(data);
      void loadTrophies();
    } catch {
      setError(t.accountLoadFailed);
    } finally {
      setLoading(false);
    }
  }, [userId, t.accountLoadFailed, loadTrophies]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!account) return;
    setForm({
      username: account.username ?? '',
      email: account.email ?? '',
      clubName: account.club?.name ?? '',
      wallet: account.wallet ?? '',
      gmtBalance: String(account.gmtBalance),
      usdcBalance: String(account.usdcBalance),
      usdtBalance: String(account.usdtBalance),
      referralCode: account.referralCode ?? '',
      emailVerified: !!account.emailVerifiedAt,
      failedLoginCount: String(account.failedLoginCount),
      stadiumLvl: account.club ? String(account.club.stadiumLvl) : '',
      ctLvl: account.club ? String(account.club.ctLvl) : '',
      treasurerLvl: account.club ? String(account.club.treasurerLvl) : '',
      trophyRoomLvl: account.club ? String(account.club.trophyRoomLvl) : '',
      totalOverwall: account.club ? String(account.club.totalOverwall) : '',
    });
    setClearAccountLock(false);
  }, [account]);

  // load templates when grant modal opens
  useEffect(() => {
    if (!grantModal || templates.length > 0) return;
    adminClient.get<{ templates: ItemTemplate[] }>('/item-templates')
      .then(({ data }) => setTemplates(data.templates))
      .catch(() => { /* non-critical */ });
  }, [grantModal, templates.length]);

  function apiErrorMessage(err: unknown): string {
    if (isAxiosError(err)) {
      const data = err.response?.data as { message?: string; error?: string | { message?: string; code?: string } } | undefined;
      const e = data?.error;
      if (e && typeof e === 'object') {
        if (e.code === 'AUTH_INVALID_REFERRAL_CODE') return 'Código de indicação já em uso por outro usuário';
        if (e.code === 'AUTH_EMAIL_OR_USERNAME_TAKEN') return 'E-mail ou username já em uso';
        if (e.code === 'AUTH_WALLET_TAKEN') return 'Wallet já vinculada a outro usuário';
        if (e.code === 'CLUB_NAME_TAKEN') return 'Nome de clube já em uso';
        if (typeof e.message === 'string') return e.message;
      }
      if (typeof data?.message === 'string') return data.message;
      if (typeof e === 'string') return e;
    }
    return t.profileSaveFailed;
  }

  async function afterAction(msg?: string) {
    if (msg) setActionMsg(msg);
    await load();
    onUpdated?.();
  }

  async function handleBan() {
    if (banReason.length < 3) return;
    await adminClient.post(`/users/${userId}/ban`, { reason: banReason });
    setBanModal(false); setBanReason('');
    await afterAction(t.banSuccess);
  }

  async function handleUnban() {
    if (!window.confirm(t.confirmUnbanUser)) return;
    await adminClient.post(`/users/${userId}/unban`, {});
    await afterAction(t.unbanSuccess);
  }

  async function handleDeactivate() {
    if (deactivateReason.length < 3) return;
    await adminClient.post(`/users/${userId}/deactivate`, { reason: deactivateReason });
    setDeactivateModal(false); setDeactivateReason('');
    await afterAction(t.deactivateSuccess);
  }

  async function handleReactivate() {
    if (!window.confirm(t.confirmReactivate)) return;
    await adminClient.post(`/users/${userId}/reactivate`, {});
    await afterAction(t.reactivateSuccess);
  }

  async function handleSaveProfile() {
    if (!canManage || !account) return;
    setSaving(true); setSaveError(''); setActionMsg('');
    try {
      const payload: AdminUpdateUserProfileInput = {};
      const username = form.username.trim();
      const email = form.email.trim();
      const clubName = form.clubName.trim();
      const wallet = form.wallet.trim();

      if (username && username.toLowerCase() !== (account.username ?? '').toLowerCase()) payload.username = username;
      if (email !== (account.email ?? '')) payload.email = email || null;
      if (clubName !== (account.club?.name ?? '')) payload.clubName = clubName || undefined;
      if (wallet !== (account.wallet ?? '')) payload.wallet = wallet ? wallet : null;

      const gmtBalance = Number(form.gmtBalance);
      if (Number.isFinite(gmtBalance) && gmtBalance >= 0 && gmtBalance !== account.gmtBalance) payload.gmtBalance = gmtBalance;

      const usdcBalance = Number(form.usdcBalance);
      if (Number.isFinite(usdcBalance) && usdcBalance >= 0 && usdcBalance !== account.usdcBalance) payload.usdcBalance = usdcBalance;

      const usdtBalance = Number(form.usdtBalance);
      if (Number.isFinite(usdtBalance) && usdtBalance >= 0 && usdtBalance !== account.usdtBalance) payload.usdtBalance = usdtBalance;

      const referralCode = form.referralCode.trim().toUpperCase();
      if (referralCode && referralCode !== (account.referralCode ?? '').toUpperCase()) payload.referralCode = referralCode;

      if (form.emailVerified !== !!account.emailVerifiedAt) payload.emailVerified = form.emailVerified;

      const failedLoginCount = Number.parseInt(form.failedLoginCount, 10);
      if (Number.isFinite(failedLoginCount) && failedLoginCount !== account.failedLoginCount) payload.failedLoginCount = failedLoginCount;

      if (clearAccountLock && (account.lockedUntil || account.failedLoginCount > 0)) payload.clearAccountLock = true;

      if (account.club) {
        const sl = Number.parseInt(form.stadiumLvl, 10);
        if (Number.isFinite(sl) && sl !== account.club.stadiumLvl) payload.clubStadiumLvl = sl;
        const cl = Number.parseInt(form.ctLvl, 10);
        if (Number.isFinite(cl) && cl !== account.club.ctLvl) payload.clubCtLvl = cl;
        const tl = Number.parseInt(form.treasurerLvl, 10);
        if (Number.isFinite(tl) && tl !== account.club.treasurerLvl) payload.clubTreasurerLvl = tl;
        const tr = Number.parseInt(form.trophyRoomLvl, 10);
        if (Number.isFinite(tr) && tr !== account.club.trophyRoomLvl) payload.clubTrophyRoomLvl = tr;
        const ow = Number.parseInt(form.totalOverwall, 10);
        if (Number.isFinite(ow) && ow !== account.club.totalOverwall) payload.clubTotalOverwall = ow;
      }

      const passwordChanged = newPassword.length >= 8;

      if (Object.keys(payload).length > 0) await adminClient.patch(`/users/${userId}/profile`, payload);
      if (passwordChanged) {
        await adminClient.post(`/users/${userId}/reset-password`, { password: newPassword });
        setNewPassword('');
      }

      if (Object.keys(payload).length === 0 && !passwordChanged) {
        setSaveError('Nenhuma alteração para salvar'); return;
      }
      await afterAction(passwordChanged && Object.keys(payload).length > 0
        ? `${t.profileSaved} · ${t.passwordResetSuccess}`
        : passwordChanged ? t.passwordResetSuccess : t.profileSaved);
    } catch (err) {
      setSaveError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleOfficeAction(kind: 'treasurer' | 'coach', action: 'hire' | 'fire') {
    await adminClient.post(`/users/${userId}/office/${kind}/${action}`, {});
    await afterAction(action === 'hire' ? 'Staff contratado' : 'Staff demitido');
  }

  async function handleGrantTrophy() {
    if (!trophyForm.name.trim()) return;
    setTrophySaving(true);
    try {
      await adminClient.post(`/users/${userId}/trophies`, {
        name: trophyForm.name.trim(),
        description: trophyForm.description.trim() || undefined,
        imageUrl: trophyForm.imageUrl.trim() || undefined,
        wonAt: new Date(trophyForm.wonAt).toISOString(),
      });
      setTrophyModal(false);
      setTrophyForm({ name: '', description: '', imageUrl: '', wonAt: new Date().toISOString().slice(0, 10) });
      void loadTrophies();
    } finally {
      setTrophySaving(false);
    }
  }

  async function handleGrantPlayer() {
    const quantity = Math.min(100, Math.max(1, Math.floor(Number(grantForm.quantity) || 1)));
    setGrantSaving(true);
    try {
      const payload: Record<string, unknown> = {
        rarity: grantForm.rarity,
        position: grantForm.position,
        overwall: Number(grantForm.overwall),
        source: grantForm.source || 'admin_grant',
        count: quantity,
      };
      if (grantForm.name.trim()) payload.name = grantForm.name.trim();
      if (grantForm.templateId) payload.templateId = grantForm.templateId;
      else if (grantForm.imageUrl.trim()) payload.imageUrl = grantForm.imageUrl.trim();
      if (grantForm.temporary && grantForm.expiresAt) payload.expiresAt = new Date(grantForm.expiresAt).toISOString();

      await adminClient.post(`/users/${userId}/grant-player`, payload);
      setGrantModal(false);
      setGrantForm({
        rarity: 0, position: 0, overwall: 100, name: '', imageUrl: '', templateId: '',
        source: 'admin_grant', temporary: false, expiresAt: '', quantity: 1,
      });
      await afterAction(
        quantity === 1 ? 'Card concedido com sucesso' : `${quantity} cards concedidos com sucesso`,
      );
    } catch (err) {
      setSaveError(apiErrorMessage(err));
    } finally {
      setGrantSaving(false);
    }
  }

  async function handleDeleteTrophy(trophyId: string) {
    await adminClient.delete(`/trophies/${trophyId}`);
    void loadTrophies();
  }

  if (loading) return <AdminCard className="py-16 text-center"><p className="text-sm text-slate-400">{adminPt.loading}</p></AdminCard>;
  if (error || !account) return <AdminCard className="py-16 text-center"><p className="text-sm text-red-400">{error || t.accountLoadFailed}</p></AdminCard>;

  const statusBadges = [];
  if (account.bannedAt) statusBadges.push({ label: t.banned, variant: 'danger' as const });
  else if (account.disabled) statusBadges.push({ label: t.disabled, variant: 'warning' as const });
  else statusBadges.push({ label: t.active, variant: 'success' as const });
  if (!account.emailVerifiedAt) statusBadges.push({ label: t.emailUnverified, variant: 'warning' as const });
  if (account.lockedUntil && !account.disabled) statusBadges.push({ label: 'Conta bloqueada', variant: 'warning' as const });

  const filteredActivityLogs = account.activityLogs.filter((log) => {
    if (activitySource !== 'all' && log.source !== activitySource) return false;
    if (activityTxType === 'sponsorship') {
      if (log.txType !== 'mining_claim' && log.txType !== 'farm') return false;
    }
    if (hideZeroAmounts && log.amount != null && Math.abs(log.amount) < 0.0001) return false;
    if (activitySearch.trim()) {
      const q = activitySearch.toLowerCase();
      const hay = `${log.label} ${log.detail ?? ''} ${log.source}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
            <i className="bi bi-person-gear text-xl" />
          </span>
          <div>
            <p className="font-semibold text-white">{account.username ?? account.email ?? account.id}</p>
            <p className="text-xs text-slate-500 font-mono">{account.id}</p>
          </div>
          <div className="flex flex-wrap gap-1.5 ml-2">
            {statusBadges.map((b) => <AdminBadge key={b.label} variant={b.variant}>{b.label}</AdminBadge>)}
          </div>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            {account.bannedAt ? (
              <AdminButton size="sm" variant="secondary" onClick={() => void handleUnban()}>{t.unbanUser}</AdminButton>
            ) : (
              <AdminButton size="sm" variant="danger" onClick={() => setBanModal(true)}>{t.blockUser}</AdminButton>
            )}
            {account.disabled ? (
              <AdminButton size="sm" variant="secondary" onClick={() => void handleReactivate()}>{t.reactivateAccount}</AdminButton>
            ) : !account.bannedAt && (
              <AdminButton size="sm" variant="danger" onClick={() => setDeactivateModal(true)}>{t.deactivateAccount}</AdminButton>
            )}
          </div>
        )}
      </div>

      {/* ── Feedback messages ── */}
      {actionMsg && <p className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">{actionMsg}</p>}
      {saveError && <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-2 text-sm text-red-300">{saveError}</p>}

      <form onSubmit={(e) => { e.preventDefault(); void handleSaveProfile(); }} autoComplete="off">
        <div className="space-y-4">

          {/* ── 1. Identidade ── */}
          <Section title="Identidade" icon="bi-person-fill">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Username">
                <AdminInput value={form.username} disabled={!canManage}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} />
              </Field>
              <Field label="E-mail">
                <AdminInput value={form.email} disabled={!canManage} type="email"
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </Field>
              <Field label="Wallet (Polygon)">
                <AdminInput value={form.wallet} disabled={!canManage} className="font-mono text-xs"
                  placeholder="0x..." onChange={(e) => setForm((f) => ({ ...f, wallet: e.target.value.trim() }))} />
                {canManage && form.wallet && !/^0x[a-fA-F0-9]{40}$/.test(form.wallet) && (
                  <p className="mt-1 text-[10px] text-red-400">Endereço inválido</p>
                )}
              </Field>
              <Field label="Código de indicação">
                <div className="flex gap-2 items-center">
                  <div className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-slate-300 font-mono tracking-widest">
                    {form.referralCode || '—'}
                  </div>
                  {canManage && (
                    <button type="button" onClick={() => {
                      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
                      const code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
                      setForm((f) => ({ ...f, referralCode: code }));
                    }} className="shrink-0 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-xs text-slate-300 hover:bg-white/[0.08]">
                      Gerar
                    </button>
                  )}
                </div>
              </Field>
              <Field label="Indicado por">
                <ReadValue value={account.referredByCode ?? '—'} />
              </Field>
              <Field label="Clube">
                <AdminInput value={form.clubName} disabled={!canManage}
                  placeholder={account.club ? undefined : 'Sem clube'}
                  onChange={(e) => setForm((f) => ({ ...f, clubName: e.target.value }))} />
              </Field>
            </div>
          </Section>

          {/* ── 2. Conta & Segurança ── */}
          <Section title="Conta & Segurança" icon="bi-shield-lock-fill">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Cadastro"><ReadValue value={formatAdminDate(account.createdAt)} /></Field>
              <Field label="Último login"><ReadValue value={account.lastLoginAt ? formatAdminDate(account.lastLoginAt) : '—'} /></Field>
              <Field label="E-mail verificado em"><ReadValue value={account.emailVerifiedAt ? formatAdminDate(account.emailVerifiedAt) : '—'} /></Field>
              <Field label="Bloqueado até"><ReadValue value={account.lockedUntil ? formatAdminDate(account.lockedUntil) : '—'} /></Field>
              <Field label="Tentativas de login falhas">
                <AdminInput value={form.failedLoginCount} disabled={!canManage} type="number"
                  onChange={(e) => setForm((f) => ({ ...f, failedLoginCount: e.target.value }))} />
              </Field>
              <Field label="Tickets abertos"><ReadValue value={String(account.openTickets)} /></Field>
              <Field label="Saques pendentes"><ReadValue value={String(account.pendingWithdrawals)} /></Field>
              {account.bannedAt && (
                <Field label="Banido em"><ReadValue value={formatAdminDate(account.bannedAt)} /></Field>
              )}
            </div>
            {canManage && (
              <div className="mt-3 flex flex-wrap gap-4 border-t border-white/[0.06] pt-3">
                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={form.emailVerified}
                    onChange={(e) => setForm((f) => ({ ...f, emailVerified: e.target.checked }))}
                    className="rounded border-white/20 accent-emerald-500" />
                  E-mail verificado
                </label>
                {(account.lockedUntil || account.failedLoginCount > 0) && (
                  <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={clearAccountLock}
                      onChange={(e) => setClearAccountLock(e.target.checked)}
                      className="rounded border-white/20 accent-amber-500" />
                    Limpar bloqueio de conta
                  </label>
                )}
              </div>
            )}
            {canManage && (
              <div className="mt-3 border-t border-white/[0.06] pt-3">
                <Field label="Nova senha (mín. 8 caracteres)">
                  <AdminInput type="password" value={newPassword} placeholder="Deixe em branco para não alterar"
                    onChange={(e) => setNewPassword(e.target.value)} />
                </Field>
              </div>
            )}
            {account.bannedAt && account.banReason && (
              <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs">
                <p className="text-red-300"><strong>Motivo do banimento:</strong> {account.banReason}</p>
                {account.bannedBy && <p className="text-slate-500 mt-0.5">por {account.bannedBy}</p>}
              </div>
            )}
          </Section>

          {/* ── 3. Saldos ── */}
          <Section title="Saldos" icon="bi-wallet2">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <BalanceField label="Saldo GMT" value={form.gmtBalance} disabled={!canManage}
                fieldKey="gmtBalance" userId={userId} currentAccountValue={account?.gmtBalance ?? 0}
                onSaved={() => afterAction()}
                onChange={(v) => setForm((f) => ({ ...f, gmtBalance: v }))} />
              <BalanceField label="Saldo USDC" value={form.usdcBalance} disabled={!canManage}
                fieldKey="usdcBalance" userId={userId} currentAccountValue={account?.usdcBalance ?? 0}
                onSaved={() => afterAction()}
                onChange={(v) => setForm((f) => ({ ...f, usdcBalance: v }))} />
              <BalanceField label="Saldo USDT" value={form.usdtBalance} disabled={!canManage}
                fieldKey="usdtBalance" userId={userId} currentAccountValue={account?.usdtBalance ?? 0}
                onSaved={() => afterAction()}
                onChange={(v) => setForm((f) => ({ ...f, usdtBalance: v }))} />
            </div>
          </Section>

          {/* ── ROI / Patrocínios ── */}
          <Section title="ROI & Patrocínios" icon="bi-calculator">
            <UserRoiSection userId={userId} />
          </Section>

          {/* ── Save ── */}
          {canManage && (
            <div className="flex justify-end">
              <AdminButton type="submit"
                disabled={saving || (!!form.wallet && !/^0x[a-fA-F0-9]{40}$/.test(form.wallet))}>
                {saving ? adminPt.saving : t.saveProfile}
              </AdminButton>
            </div>
          )}
        </div>
      </form>

      {/* ── 4. Clube & Edifícios ── */}
      {account.club && (
        <Section title="Clube & Edifícios" icon="bi-building-fill">
          <form onSubmit={(e) => e.preventDefault()} autoComplete="off">
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
              {[
                { label: 'Estádio Lv.', key: 'stadiumLvl' as const, cur: account.club.stadiumLvl },
                { label: 'CT Lv.', key: 'ctLvl' as const, cur: account.club.ctLvl },
                { label: 'Tesouraria Lv.', key: 'treasurerLvl' as const, cur: account.club.treasurerLvl },
                { label: 'Sala de Troféus Lv.', key: 'trophyRoomLvl' as const, cur: account.club.trophyRoomLvl },
                { label: 'Overwall total', key: 'totalOverwall' as const, cur: account.club.totalOverwall },
              ].map(({ label, key, cur }) => (
                <Field key={key} label={label}>
                  {canManage ? (
                    <AdminInput value={form[key]} type="number"
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
                  ) : (
                    <ReadValue value={String(cur)} />
                  )}
                </Field>
              ))}
            </div>
            <div className="mt-4 border-t border-white/[0.06] pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Escritório (staff)</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'Tesoureiro', kind: 'treasurer' as const, hired: account.club.treasurerHired },
                  { label: 'Treinador', kind: 'coach' as const, hired: account.club.coachHired },
                ].map(({ label, kind, hired }) => (
                  <div key={kind} className="flex items-center gap-2 rounded-lg border border-white/[0.06] px-3 py-1.5 text-xs">
                    <span className="text-slate-300">{label}</span>
                    <AdminBadge variant={hired ? 'success' : 'default'}>{hired ? 'contratado' : 'livre'}</AdminBadge>
                    {canManage && (hired
                      ? <AdminButton size="sm" variant="danger" onClick={() => void handleOfficeAction(kind, 'fire')}>Demitir</AdminButton>
                      : <AdminButton size="sm" variant="primary" onClick={() => void handleOfficeAction(kind, 'hire')}>Contratar</AdminButton>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </form>
        </Section>
      )}

      {/* ── 5. Inventário ── */}
      <Section title={`Inventário (${account.inventory.total})`} icon="bi-collection-fill"
        action={canManage ? (
          <AdminButton size="sm" variant="primary" onClick={() => setGrantModal(true)}>
            <i className="bi bi-plus-circle" /> Conceder Card
          </AdminButton>
        ) : undefined}
      >
        {account.inventory.total === 0 ? (
          <p className="text-sm text-slate-500">Nenhum card no inventário.</p>
        ) : (
          <div className="space-y-4">
            {[
              { title: 'Atletas FT (off-chain)', items: account.inventory.basePlayers },
              { title: 'NFTs on-chain', items: account.inventory.nfts },
            ].filter(g => g.items.length > 0).map(({ title, items }) => (
              <div key={title}>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{title} ({items.length})</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((item) => {
                    const listing = (account.marketplaceListings ?? []).find((l) =>
                      item.kind === 'base' ? l.playerId === item.id : l.tokenId === item.tokenId,
                    );
                    return (
                    <div key={item.id}
                      className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-white/[0.05] text-[10px] text-slate-500 font-mono">
                          {item.kind === 'nft' ? 'NFT' : 'FT'}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm text-slate-200">{item.name ?? item.id.slice(0, 8)}</p>
                        <p className={`text-xs ${RARITY_COLORS[RARITY_LABELS.indexOf(item.rarity)] ?? 'text-slate-400'}`}>
                          {item.rarity} · {item.position} · OW {item.overwall.toLocaleString('pt-BR')}
                        </p>
                        {item.listed && (
                          <span className="text-[10px] text-amber-400">
                            Listado no mercado{listing ? ` · ${listing.priceGmt.toLocaleString('pt-BR')} GMT` : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── 5b. Anúncios no marketplace ── */}
      <Section
        title={`Anúncios no Marketplace (${(account.marketplaceListings ?? []).length})`}
        icon="bi-shop"
      >
        {(account.marketplaceListings ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum anúncio ativo no marketplace.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(account.marketplaceListings ?? []).map((listing) => (
              <div
                key={listing.id}
                className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.04] px-3 py-2"
              >
                {listing.imageUrl ? (
                  <img src={listing.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-white/[0.05] text-[10px] text-slate-500 font-mono">
                    {listing.kind === 'nft' ? 'NFT' : 'FT'}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm text-slate-200">
                      {listing.name ?? (listing.tokenId ? `NFT #${listing.tokenId}` : listing.playerId?.slice(0, 8) ?? '—')}
                    </p>
                    <span className="shrink-0 rounded bg-white/[0.06] px-1 py-0.5 text-[9px] uppercase text-slate-400">
                      {listing.kind === 'nft' ? 'NFT' : 'FT'}
                    </span>
                  </div>
                  <p className={`text-xs ${RARITY_COLORS[RARITY_LABELS.indexOf(listing.rarity)] ?? 'text-slate-400'}`}>
                    {listing.rarity} · {listing.position} · OW {listing.overwall.toLocaleString('pt-BR')}
                  </p>
                  <p className="text-[10px] text-amber-300">
                    {listing.priceGmt.toLocaleString('pt-BR')} GMT · {formatAdminDate(listing.listedAt)}
                  </p>
                  <p className="truncate font-mono text-[9px] text-slate-600" title={listing.id}>
                    {listing.id}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── 6. Troféus ── */}
      <Section title={`Troféus (${trophies.length})`} icon="bi-trophy-fill"
        action={canManage ? (
          <AdminButton size="sm" variant="secondary" onClick={() => setTrophyModal(true)}>
            <i className="bi bi-plus" /> Conceder
          </AdminButton>
        ) : undefined}
      >
        {trophies.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum troféu ainda.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {trophies.map((trophy) => (
              <div key={trophy.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  {trophy.imageUrl
                    ? <img src={trophy.imageUrl} alt="" className="h-8 w-8 shrink-0 rounded object-contain" />
                    : <span className="text-xl shrink-0"><i className="bi bi-trophy-fill" aria-hidden /></span>}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-amber-300">{trophy.name}</p>
                    {trophy.description && <p className="truncate text-xs text-slate-500">{trophy.description}</p>}
                    <p className="text-xs text-slate-600">{new Date(trophy.wonAt).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>
                {canManage && (
                  <AdminButton size="sm" variant="danger" onClick={() => void handleDeleteTrophy(trophy.id)}>
                    <i className="bi bi-trash" />
                  </AdminButton>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── 7. Histórico de carteira ── */}
      {account.walletHistory.length > 0 && (
        <Section title="Histórico de Carteira" icon="bi-clock-history">
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {account.walletHistory.map((entry, i) => (
              <div key={`${entry.createdAt}-${i}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] px-3 py-2 text-xs">
                <div>
                  <AdminBadge variant={entry.action === 'linked' ? 'success' : 'warning'}>
                    {entry.action === 'linked' ? t.walletLinked : t.walletUnlinked}
                  </AdminBadge>
                  {entry.wallet && <p className="mt-1 break-all font-mono text-[11px] text-slate-400">{entry.wallet}</p>}
                </div>
                <span className="shrink-0 text-slate-500">{formatAdminDate(entry.createdAt)}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── 8. Log de atividade ── */}
      <Section
        title={`Log de Atividade (${filteredActivityLogs.length}/${account.activityLogs.length})`}
        icon="bi-list-ul"
      >
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <label className="flex min-w-[140px] flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Origem</span>
            <select
              value={activitySource}
              onChange={(e) => setActivitySource(e.target.value as typeof activitySource)}
              className="admin-input rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-xs text-slate-100"
            >
              <option value="all">Todas</option>
              <option value="balance">Saldo</option>
              <option value="wallet">Carteira on-chain</option>
              <option value="security">Segurança</option>
            </select>
          </label>
          <label className="flex min-w-[160px] flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Tipo USDC</span>
            <select
              value={activityTxType}
              onChange={(e) => setActivityTxType(e.target.value as typeof activityTxType)}
              className="admin-input rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-xs text-slate-100"
            >
              <option value="all">Todos</option>
              <option value="sponsorship">Cota de patrocínio</option>
            </select>
          </label>
          <AdminInput
            type="search"
            placeholder="Buscar no log…"
            value={activitySearch}
            onChange={(e) => setActivitySearch(e.target.value)}
            className="min-w-[180px] flex-1"
          />
          <label className="flex items-center gap-2 pb-1 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={hideZeroAmounts}
              onChange={(e) => setHideZeroAmounts(e.target.checked)}
              className="accent-emerald-500"
            />
            Ocultar valores zerados
          </label>
        </div>
        {filteredActivityLogs.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma atividade com os filtros atuais.</p>
        ) : (
          <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
            {filteredActivityLogs.map((log) => (
              <div key={log.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-white/[0.04] bg-white/[0.015] px-3 py-2 text-xs hover:border-white/[0.08]">
                <div className="flex items-start gap-2 min-w-0">
                  <AdminBadge variant={SOURCE_BADGE[log.source] ?? 'default'}>
                    {t.sourceLabels[log.source]}
                  </AdminBadge>
                  <div className="min-w-0">
                    <p className="text-slate-200">{log.label}</p>
                    {log.detail && <p className="text-slate-500 truncate">{log.detail}</p>}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  {log.amount != null && (
                    <p className={`font-mono font-semibold ${log.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {log.amount >= 0 ? '+' : ''}{log.amount.toFixed(4)} USDC
                    </p>
                  )}
                  <p className="text-slate-600 mt-0.5">{formatAdminDate(log.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ─── Modals ─── */}

      {/* Ban */}
      <AdminModal open={banModal} title={t.banUser} onClose={() => setBanModal(false)}
        footer={<>
          <AdminButton variant="secondary" size="sm" onClick={() => setBanModal(false)}>{adminPt.cancel}</AdminButton>
          <AdminButton variant="danger" size="sm" onClick={() => void handleBan()}>{t.confirmBan}</AdminButton>
        </>}>
        <textarea value={banReason} onChange={(e) => setBanReason(e.target.value)}
          placeholder={adminPt.reasonMin} rows={3}
          className="admin-input w-full rounded-lg px-3 py-2 text-sm border border-white/[0.08] bg-white/[0.03] text-slate-100 placeholder:text-slate-500 focus:border-red-500/40 focus:outline-none resize-none" />
      </AdminModal>

      {/* Deactivate */}
      <AdminModal open={deactivateModal} title={t.deactivateAccount} onClose={() => setDeactivateModal(false)}
        footer={<>
          <AdminButton variant="secondary" size="sm" onClick={() => setDeactivateModal(false)}>{adminPt.cancel}</AdminButton>
          <AdminButton variant="danger" size="sm" onClick={() => void handleDeactivate()}>{t.confirmDeactivate}</AdminButton>
        </>}>
        <p className="mb-2 text-xs text-slate-400">{t.deactivateHint}</p>
        <textarea value={deactivateReason} onChange={(e) => setDeactivateReason(e.target.value)}
          placeholder={adminPt.reasonMin} rows={3}
          className="admin-input w-full rounded-lg px-3 py-2 text-sm border border-white/[0.08] bg-white/[0.03] text-slate-100 placeholder:text-slate-500 focus:outline-none resize-none" />
      </AdminModal>

      {/* Trophy */}
      <AdminModal open={trophyModal} title="Conceder Troféu" onClose={() => setTrophyModal(false)}
        footer={<>
          <AdminButton variant="secondary" size="sm" onClick={() => setTrophyModal(false)}>Cancelar</AdminButton>
          <AdminButton variant="primary" size="sm" onClick={() => void handleGrantTrophy()}
            disabled={trophySaving || !trophyForm.name.trim()}>
            {trophySaving ? 'Salvando…' : 'Conceder'}
          </AdminButton>
        </>}>
        <div className="space-y-3">
          {[
            { label: 'Nome *', key: 'name' as const, placeholder: 'Campeão da Temporada 1' },
            { label: 'Descrição', key: 'description' as const, placeholder: 'Descrição opcional' },
            { label: 'URL da Imagem', key: 'imageUrl' as const, placeholder: 'https://…' },
          ].map(({ label, key, placeholder }) => (
            <div key={key}>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">{label}</label>
              <AdminInput value={trophyForm[key]} placeholder={placeholder}
                onChange={(e) => setTrophyForm((f) => ({ ...f, [key]: e.target.value }))} />
            </div>
          ))}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Data</label>
            <AdminInput type="date" value={trophyForm.wonAt}
              onChange={(e) => setTrophyForm((f) => ({ ...f, wonAt: e.target.value }))} />
          </div>
        </div>
      </AdminModal>

      {/* Grant Player */}
      <AdminModal open={grantModal} title="Conceder Card ao Jogador" onClose={() => setGrantModal(false)}
        footer={<>
          <AdminButton variant="secondary" size="sm" onClick={() => setGrantModal(false)}>Cancelar</AdminButton>
          <AdminButton variant="primary" size="sm" onClick={() => void handleGrantPlayer()}
            disabled={grantSaving || Number(grantForm.overwall) < 1 || Number(grantForm.quantity) < 1}>
            {grantSaving
              ? 'Enviando…'
              : Number(grantForm.quantity) > 1
                ? `Conceder ${Math.min(100, Math.floor(Number(grantForm.quantity) || 1))} Cards`
                : 'Conceder Card'}
          </AdminButton>
        </>}>
        <div className="space-y-3">
          {/* Template picker */}
          {templates.length > 0 && (
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Usar template (opcional)
              </label>
              <select
                value={grantForm.templateId}
                onChange={(e) => {
                  const t = templates.find(x => x.id === e.target.value);
                  if (t) {
                    setGrantForm((f) => ({ ...f, templateId: t.id, name: t.name, imageUrl: t.imageUrl ?? '', rarity: t.rarity, position: t.position, overwall: t.overwall }));
                  } else {
                    setGrantForm((f) => ({ ...f, templateId: '' }));
                  }
                }}
                className="w-full rounded-lg border border-white/[0.08] bg-[#0c1220] px-3 py-2 text-sm text-slate-200 focus:border-emerald-500/40 focus:outline-none"
              >
                <option value="">— Personalizado —</option>
                {templates.map((tmpl) => (
                  <option key={tmpl.id} value={tmpl.id}>
                    {tmpl.name} · {RARITY_LABELS[tmpl.rarity] ?? tmpl.rarity} · OW {tmpl.overwall}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Raridade</label>
              <select value={grantForm.rarity}
                onChange={(e) => setGrantForm((f) => ({ ...f, rarity: Number(e.target.value), templateId: '' }))}
                className="w-full rounded-lg border border-white/[0.08] bg-[#0c1220] px-3 py-2 text-sm text-slate-200 focus:border-emerald-500/40 focus:outline-none">
                {RARITY_LABELS.map((r, i) => <option key={i} value={i}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Posição</label>
              <select value={grantForm.position}
                onChange={(e) => setGrantForm((f) => ({ ...f, position: Number(e.target.value), templateId: '' }))}
                className="w-full rounded-lg border border-white/[0.08] bg-[#0c1220] px-3 py-2 text-sm text-slate-200 focus:border-emerald-500/40 focus:outline-none">
                {POSITION_LABELS.map((p, i) => <option key={i} value={i}>{p}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Quantidade
            </label>
            <AdminInput
              type="number"
              min={1}
              max={100}
              value={String(grantForm.quantity)}
              onChange={(e) => {
                const raw = Number(e.target.value);
                const quantity = Number.isFinite(raw) ? Math.min(100, Math.max(1, Math.floor(raw))) : 1;
                setGrantForm((f) => ({ ...f, quantity }));
              }}
            />
            <p className="mt-1 text-[10px] text-slate-500">
              Cria até 100 cards idênticos de uma vez (mesmo template, raridade e stats).
            </p>
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Overwall</label>
            <AdminInput type="number" value={String(grantForm.overwall)}
              onChange={(e) => setGrantForm((f) => ({ ...f, overwall: Number(e.target.value), templateId: '' }))} />
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Nome do card</label>
            <AdminInput value={grantForm.name} placeholder="Ex: Craque Especial"
              onChange={(e) => setGrantForm((f) => ({ ...f, name: e.target.value, templateId: '' }))} />
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Fonte (source)</label>
            <select value={grantForm.source}
              onChange={(e) => setGrantForm((f) => ({ ...f, source: e.target.value }))}
              className="w-full rounded-lg border border-white/[0.08] bg-[#0c1220] px-3 py-2 text-sm text-slate-200 focus:border-emerald-500/40 focus:outline-none">
              <option value="admin_grant">admin_grant (permanente)</option>
              <option value="referral_gift">referral_gift (presente indicação)</option>
              <option value="social_reward">social_reward (recompensa social)</option>
              <option value="referral">referral (NFT temporário)</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input type="checkbox" checked={grantForm.temporary}
              onChange={(e) => setGrantForm((f) => ({ ...f, temporary: e.target.checked }))}
              className="rounded border-white/20 accent-amber-500" />
            Card temporário (com data de expiração)
          </label>

          {grantForm.temporary && (
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Expira em</label>
              <AdminInput type="datetime-local" value={grantForm.expiresAt}
                onChange={(e) => setGrantForm((f) => ({ ...f, expiresAt: e.target.value }))} />
            </div>
          )}
        </div>
      </AdminModal>
    </div>
  );
}
