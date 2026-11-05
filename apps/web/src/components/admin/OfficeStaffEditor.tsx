import { useRef, useState } from 'react';
import type {
  CoachStaffRoleConfigDTO,
  OfficeStaffAvatarRole,
  OfficeStaffConfigDTO,
  OfficeStaffPerkDTO,
  OfficeStaffRoleConfigDTO,
} from '@mll/shared';
import { isOfficeStaffImageAvatar } from '@mll/shared';
import { AxiosError } from 'axios';
import { adminClient } from '../../lib/api/adminClient';
import { adminPt } from '../../lib/admin/i18n';
import { resolveUploadUrl } from '../../lib/resolveUploadUrl';
import { AdminButton, AdminInput } from './AdminTable';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const inputCls = 'w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-500/40 focus:outline-none';

interface RoleFormState {
  enabled: boolean;
  name: string;
  roleLabel: string;
  avatar: string;
  accent: string;
  weeklyUsdc: string;
  perks: OfficeStaffPerkDTO[];
  miningFeePct: string;
  staminaRecoveryPerHour: string;
  dailyRestStamina: string;
  matchStaminaCost: string;
  matchCooldownSec: string;
  trainingStaminaCost: string;
  specialStaminaCost: string;
}

function roleToForm(role: OfficeStaffRoleConfigDTO, coach?: CoachStaffRoleConfigDTO): RoleFormState {
  return {
    enabled: role.enabled,
    name: role.name,
    roleLabel: role.roleLabel,
    avatar: role.avatar,
    accent: role.accent,
    weeklyUsdc: String(role.weeklyUsdc),
    perks: role.perks.map((p) => ({ ...p })),
    miningFeePct: coach ? String(coach.miningFeePct) : '0',
    staminaRecoveryPerHour: coach ? String(coach.staminaRecoveryPerHour) : '24',
    dailyRestStamina: coach ? String(coach.dailyRestStamina ?? 100) : '100',
    matchStaminaCost: coach ? String(coach.matchStaminaCost ?? 20) : '20',
    matchCooldownSec: coach ? String(coach.matchCooldownSec ?? 60) : '60',
    trainingStaminaCost: coach ? String(coach.trainingStaminaCost ?? 8) : '8',
    specialStaminaCost: coach ? String(coach.specialStaminaCost ?? 5) : '5',
  };
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-slate-400">{label}</p>
      {children}
      {hint && <p className="text-[10px] text-slate-600">{hint}</p>}
    </div>
  );
}

function RoleEditor({
  title,
  roleKey,
  isCoach,
  form,
  onChange,
  onAvatarUpdated,
}: {
  title: string;
  roleKey: OfficeStaffAvatarRole;
  isCoach: boolean;
  form: RoleFormState;
  onChange: (next: RoleFormState) => void;
  onAvatarUpdated: (avatar: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const avatarPreview = isOfficeStaffImageAvatar(form.avatar)
    ? resolveUploadUrl(form.avatar)
    : '';

  async function uploadAvatar(file: File) {
    if (file.size > MAX_IMAGE_BYTES) {
      setUploadError(`Imagem muito grande (máx. ${MAX_IMAGE_BYTES / (1024 * 1024)} MB)`);
      return;
    }
    setUploadError('');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set('role', roleKey);
      fd.set('file', file);
      const { data } = await adminClient.post<OfficeStaffConfigDTO>('/office-staff-config/avatar', fd);
      const nextAvatar = roleKey === 'treasurer' ? data.treasurer.avatar : data.coach.avatar;
      onChange({ ...form, avatar: nextAvatar });
      onAvatarUpdated(nextAvatar);
    } catch (err) {
      const axiosErr = err as AxiosError<{ error?: { details?: { reason?: string } } }>;
      const reason = axiosErr.response?.data?.error?.details?.reason;
      if (reason === 'unsupported_mime') setUploadError('Formato inválido — use PNG, JPEG ou WebP');
      else if (reason === 'file_too_large') setUploadError(`Imagem muito grande (máx. ${MAX_IMAGE_BYTES / (1024 * 1024)} MB)`);
      else setUploadError('Falha ao enviar imagem');
    } finally {
      setUploading(false);
    }
  }

  async function removeAvatar() {
    setUploadError('');
    setUploading(true);
    try {
      const { data } = await adminClient.delete<OfficeStaffConfigDTO>(`/office-staff-config/avatar/${roleKey}`);
      const nextAvatar = roleKey === 'treasurer' ? data.treasurer.avatar : data.coach.avatar;
      onChange({ ...form, avatar: nextAvatar });
      onAvatarUpdated(nextAvatar);
    } catch {
      setUploadError('Falha ao remover foto');
    } finally {
      setUploading(false);
    }
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void uploadAvatar(file);
    e.target.value = '';
  }

  function updatePerk(index: number, field: 'icon' | 'text', value: string) {
    onChange({ ...form, perks: form.perks.map((p, i) => (i === index ? { ...p, [field]: value } : p)) });
  }

  function addPerk() {
    if (form.perks.length >= 8) return;
    onChange({ ...form, perks: [...form.perks, { icon: '◆', text: '' }] });
  }

  function removePerk(index: number) {
    if (form.perks.length <= 1) return;
    onChange({ ...form, perks: form.perks.filter((_, i) => i !== index) });
  }

  return (
    <div className="admin-card p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
        <div className="flex items-center gap-3">
          {avatarPreview ? (
            <img src={avatarPreview} alt="" className="h-10 w-10 rounded-full object-cover border border-white/[0.10]" />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center text-xl rounded-full border border-white/[0.08] bg-white/[0.04]">
              {form.avatar || <i className="bi bi-person-fill" aria-hidden />}
            </span>
          )}
          <div>
            <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
            <p className="text-[11px] text-slate-500">{form.name || '—'} · {form.roleLabel || '—'}</p>
          </div>
        </div>
        <div
          className="flex items-center gap-2 cursor-pointer rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 select-none"
          onClick={() => onChange({ ...form, enabled: !form.enabled })}
        >
          <div className={`h-4 w-7 rounded-full transition-colors ${form.enabled ? 'bg-emerald-500' : 'bg-slate-700'}`} />
          <div className="relative">
            <div className={`absolute -top-1.5 -left-5 h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${form.enabled ? 'translate-x-3' : 'translate-x-0'}`} />
          </div>
          <span className="text-xs text-slate-300 ml-1">{form.enabled ? 'Disponível' : 'Indisponível'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-5">
        {/* LEFT: avatar + identity */}
        <div className="space-y-4">
          {/* Avatar upload */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-slate-400">Foto do personagem</p>
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImageChange} className="hidden" />

            {avatarPreview ? (
              <div className="relative w-full h-44 rounded-xl overflow-hidden border border-white/[0.08] bg-black/20 group">
                <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-1.5 rounded-lg bg-white/10 border border-white/20 px-3 py-1.5 text-xs text-white hover:bg-white/20 transition-colors disabled:opacity-50"
                  >
                    <i className="bi bi-arrow-repeat" /> Trocar
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeAvatar()}
                    disabled={uploading}
                    className="flex items-center gap-1.5 rounded-lg bg-red-500/20 border border-red-500/30 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/30 transition-colors disabled:opacity-50"
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
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) void uploadAvatar(f); }}
                className={`w-full h-32 rounded-xl border-2 border-dashed transition-colors flex flex-col items-center justify-center gap-2 disabled:opacity-50 ${
                  drag ? 'border-emerald-500/60 bg-emerald-500/10' : 'border-white/[0.10] bg-white/[0.02] hover:border-emerald-500/30 hover:bg-emerald-500/[0.04]'
                }`}
              >
                {uploading ? (
                  <><i className="bi bi-arrow-repeat animate-spin text-slate-400 text-xl" /><span className="text-xs text-slate-500">Enviando…</span></>
                ) : (
                  <>
                    <i className="bi bi-cloud-upload text-slate-500 text-2xl" />
                    <span className="text-xs text-slate-500">Clique ou arraste a imagem</span>
                    <span className="text-[10px] text-slate-700">PNG · JPEG · WebP · 5 MB</span>
                  </>
                )}
              </button>
            )}

            {uploadError && <p className="text-[11px] text-red-400">{uploadError}</p>}

            <Field label="Emoji / URL manual">
              <input
                value={form.avatar}
                onChange={(e) => onChange({ ...form, avatar: e.target.value })}
                placeholder="emoji ou caminho de upload"
                className={`${inputCls} font-mono text-xs`}
              />
            </Field>
          </div>

          {/* Identity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nome">
              <input value={form.name} onChange={(e) => onChange({ ...form, name: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Cor de destaque">
              <div className="flex items-center gap-2">
                <span className="h-9 w-9 rounded-lg border border-white/[0.08] shrink-0" style={{ background: form.accent || 'transparent' }} />
                <input
                  value={form.accent}
                  onChange={(e) => onChange({ ...form, accent: e.target.value })}
                  placeholder="var(--gold)"
                  className={`${inputCls} font-mono text-xs`}
                />
              </div>
            </Field>
            <Field label="Cargo / subtítulo">
              <input value={form.roleLabel} onChange={(e) => onChange({ ...form, roleLabel: e.target.value })} className={`${inputCls} sm:col-span-2`} />
            </Field>
          </div>
        </div>

        {/* RIGHT: compensation + perks */}
        <div className="space-y-4">
          {/* Compensation */}
          <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.04] p-4 space-y-3">
            <p className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
              <i className="bi bi-coin" /> Remuneração & Mecânica
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Mensalidade (USDC/sem)" hint="Opcional/legado — cobrança principal do treinador é a taxa % no patrocínio">
                <input type="number" step="0.01" min="0" value={form.weeklyUsdc} onChange={(e) => onChange({ ...form, weeklyUsdc: e.target.value })} className={inputCls} />
              </Field>
              {isCoach && (
                <>
                  <Field label="Taxa s/ receita" hint={`Cobrança principal = ${(Number(form.miningFeePct || 0) * 100).toFixed(2)}% por cota`}>
                    <input type="number" step="0.0001" min="0" max="1" value={form.miningFeePct} onChange={(e) => onChange({ ...form, miningFeePct: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Stamina/h (CT)">
                    <input type="number" step="1" min="0" max="200" value={form.staminaRecoveryPerHour} onChange={(e) => onChange({ ...form, staminaRecoveryPerHour: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Descanso diário" hint="Pontos por jogador, uma vez por dia">
                    <input type="number" step="1" min="0" max="100" value={form.dailyRestStamina} onChange={(e) => onChange({ ...form, dailyRestStamina: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Custo da partida">
                    <input type="number" step="1" min="0" max="100" value={form.matchStaminaCost} onChange={(e) => onChange({ ...form, matchStaminaCost: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Cooldown da partida (s)">
                    <input type="number" step="1" min="0" max="86400" value={form.matchCooldownSec} onChange={(e) => onChange({ ...form, matchCooldownSec: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Custo do treino">
                    <input type="number" step="1" min="0" max="100" value={form.trainingStaminaCost} onChange={(e) => onChange({ ...form, trainingStaminaCost: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Custo da atividade especial" hint="Descontado de cada titular ao resgatar uma quest">
                    <input type="number" step="1" min="0" max="100" value={form.specialStaminaCost} onChange={(e) => onChange({ ...form, specialStaminaCost: e.target.value })} className={inputCls} />
                  </Field>
                </>
              )}
            </div>
          </div>

          {/* Perks */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <i className="bi bi-stars text-amber-400" /> Benefícios exibidos no card
              </p>
              <AdminButton size="sm" variant="ghost" onClick={addPerk} disabled={form.perks.length >= 8}>
                <i className="bi bi-plus text-xs" /> Adicionar
              </AdminButton>
            </div>
            {isCoach && (
              <p className="text-[10px] text-slate-600 font-mono">
                Variáveis: <code>{'{recoveryPerHour}'}</code>, <code>{'{miningFeePct}'}</code>
              </p>
            )}
            <ul className="space-y-2">
              {form.perks.map((perk, index) => (
                <li key={index} className="flex gap-2 items-center">
                  <input
                    value={perk.icon}
                    onChange={(e) => updatePerk(index, 'icon', e.target.value)}
                    className="w-10 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-2 text-center text-sm text-slate-100 focus:outline-none focus:border-emerald-500/40"
                    maxLength={8}
                  />
                  <input
                    value={perk.text}
                    onChange={(e) => updatePerk(index, 'text', e.target.value)}
                    placeholder="Descreva o benefício"
                    className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:border-emerald-500/40 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removePerk(index)}
                    disabled={form.perks.length <= 1}
                    className="h-8 w-8 flex items-center justify-center rounded-lg border border-white/[0.06] text-slate-500 hover:border-red-500/30 hover:text-red-400 disabled:opacity-30 transition-colors"
                  >
                    <i className="bi bi-x text-sm" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

interface OfficeStaffEditorProps {
  initial: OfficeStaffConfigDTO;
  onSaved: () => void;
  activeRole?: 'treasurer' | 'coach' | null;
}

export function OfficeStaffEditor({ initial, onSaved, activeRole }: OfficeStaffEditorProps) {
  const [treasurer, setTreasurer] = useState(() => roleToForm(initial.treasurer));
  const [coach, setCoach] = useState(() => roleToForm(initial.coach, initial.coach));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [msgError, setMsgError] = useState(false);

  async function save() {
    setSaving(true);
    setMessage('');
    try {
      await adminClient.patch('/office-staff-config', {
        treasurer: {
          enabled: treasurer.enabled,
          name: treasurer.name,
          roleLabel: treasurer.roleLabel,
          avatar: treasurer.avatar,
          accent: treasurer.accent,
          weeklyUsdc: Number(treasurer.weeklyUsdc),
          perks: treasurer.perks.filter((p) => p.text.trim()),
        },
        coach: {
          enabled: coach.enabled,
          name: coach.name,
          roleLabel: coach.roleLabel,
          avatar: coach.avatar,
          accent: coach.accent,
          weeklyUsdc: Number(coach.weeklyUsdc),
          perks: coach.perks.filter((p) => p.text.trim()),
          miningFeePct: Number(coach.miningFeePct),
          staminaRecoveryPerHour: Number(coach.staminaRecoveryPerHour),
          dailyRestStamina: Number(coach.dailyRestStamina),
          matchStaminaCost: Number(coach.matchStaminaCost),
          matchCooldownSec: Number(coach.matchCooldownSec),
          trainingStaminaCost: Number(coach.trainingStaminaCost),
          specialStaminaCost: Number(coach.specialStaminaCost),
        },
      });
      setMessage(adminPt.saved);
      setMsgError(false);
      onSaved();
    } catch {
      setMessage(adminPt.saveFailed);
      setMsgError(true);
    } finally {
      setSaving(false);
    }
  }

  const showTreasurer = !activeRole || activeRole === 'treasurer';
  const showCoach = !activeRole || activeRole === 'coach';

  return (
    <div className="space-y-5">
      {showTreasurer && (
        <RoleEditor
          title="Tesoureiro"
          roleKey="treasurer"
          isCoach={false}
          form={treasurer}
          onChange={setTreasurer}
          onAvatarUpdated={() => onSaved()}
        />
      )}
      {showCoach && (
        <RoleEditor
          title="Treinador"
          roleKey="coach"
          isCoach
          form={coach}
          onChange={setCoach}
          onAvatarUpdated={() => onSaved()}
        />
      )}

      <div className="sticky bottom-3 z-10 flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#080f1c]/95 backdrop-blur px-5 py-3 shadow-xl">
        <p className="text-xs text-slate-500">
          As alterações são salvas para <span className="text-slate-300 font-medium">todos os usuários</span> simultaneamente.
        </p>
        <div className="flex items-center gap-3 shrink-0">
          {message && (
            <p className={`text-xs ${msgError ? 'text-red-400' : 'text-emerald-400'}`}>{message}</p>
          )}
          <AdminButton onClick={() => void save()} disabled={saving}>
            {saving
              ? <><i className="bi bi-arrow-repeat animate-spin" /> Salvando…</>
              : <><i className="bi bi-check-circle" /> Salvar configurações</>
            }
          </AdminButton>
        </div>
      </div>
    </div>
  );
}
