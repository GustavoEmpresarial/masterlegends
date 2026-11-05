import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AdminPermission,
  QuestKind,
  QuestRewardType,
  QuestTrigger,
  type ItemTemplateDTO,
  type StadiumShopItemDTO,
} from '@mll/shared';
import { adminClient } from '../../../lib/api/adminClient';
import { resolveUploadUrl } from '../../../lib/resolveUploadUrl';
import {
  AdminBadge,
  AdminButton,
  AdminInput,
  AdminPageHeader,
  AdminStatCard,
} from '../../../components/admin/AdminTable';
import { useAdminAuth } from '../../../hooks/useAdminAuth';

/* ── types ─────────────────────────────────────────────── */

type Campaign = {
  id: string;
  slug: string;
  title: string;
  body: string;
  imageUrl: string | null;
  startsAt: string;
  endsAt: string;
  active: boolean;
  sortOrder: number;
  _count?: { quests: number };
};

type RewardLine = {
  type: string;
  amount?: number;
  templateId?: string;
  shopItemId?: string;
  badgeId?: string;
  playerName?: string;
  overwall?: number;
  days?: number;
  position?: number;
  imageUrl?: string | null;
};

type Quest = {
  id: string;
  kind: string;
  campaignId: string | null;
  title: string;
  description: string;
  trigger: string;
  target: number;
  rewards: RewardLine[] | unknown;
  active: boolean;
  period: string;
  maxClaimsPerUser: number;
  maxGlobalClaims: number | null;
  requireEmailVerified: boolean;
  startsAt: string | null;
  endsAt: string | null;
  sortOrder: number;
  _count?: { claims: number };
};

type Badge = { id: string; code: string; title: string; iconUrl: string | null };

type ClaimRow = {
  id: string;
  userId: string;
  questId: string;
  periodKey: string;
  rewards: RewardLine[] | unknown;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  user?: { id: string; username: string | null; email: string | null };
  quest?: { id: string; title: string; kind: string };
};

type Tab = 'campaigns' | 'achievements' | 'quests' | 'badges' | 'claims';

/* ── labels (explicação bem simples) ───────────────────── */

const KIND_LABEL: Record<string, string> = {
  event_task: 'Missão de evento (só nessa campanha)',
  daily_task: 'Missão do dia (todo dia de novo)',
  weekly_task: 'Missão da semana (toda semana de novo)',
  achievement: 'Conquista (só 1 vez na vida)',
};

const TRIGGER_LABEL: Record<string, string> = {
  login: 'O jogador entrou no site',
  checkin_claim: 'O jogador marcou presença do dia',
  lineup_save: 'O jogador salvou a escalação',
  scout_mint: 'O jogador tirou carta no Olheiro',
  trade_player: 'O jogador comprou/vendeu no mercado',
  market_visit: 'O jogador abriu o mercado',
  pass_claim: 'O jogador pegou prêmio do Passe',
  referral_signup: 'Alguém entrou com o link de indicação dele',
};

const REWARD_LABEL: Record<string, string> = {
  gmt: 'GMT',
  usdc: 'USDC',
  usdt: 'USDT',
  overwall: 'Overwall — poder temporário (7 dias)',
};

const ADMIN_REWARD_TYPES = [
  QuestRewardType.GMT,
  QuestRewardType.USDC,
  QuestRewardType.USDT,
  QuestRewardType.OVERWALL,
] as const;

const PERIOD_LABEL: Record<string, string> = {
  none: 'Só uma vez (nunca mais)',
  daily: 'Todo dia (pode pegar de novo amanhã)',
  weekly: 'Toda semana (pode pegar de novo na outra semana)',
};

/* ── helpers ───────────────────────────────────────────── */

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
}

function toLocalInput(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function daysLeft(endsAt: string) {
  return Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86_400_000);
}

function campaignStatus(c: Campaign): 'live' | 'scheduled' | 'expired' | 'inactive' {
  if (!c.active) return 'inactive';
  const now = Date.now();
  const start = new Date(c.startsAt).getTime();
  const end = new Date(c.endsAt).getTime();
  if (now < start) return 'scheduled';
  if (now > end) return 'expired';
  return 'live';
}

function parseRewards(raw: unknown): RewardLine[] {
  if (!Array.isArray(raw)) return [];
  return raw as RewardLine[];
}

function summarizeRewards(raw: unknown, templates: ItemTemplateDTO[] = []): string {
  const rewards = parseRewards(raw);
  if (!rewards.length) return '—';
  return rewards
    .map((r) => {
      const label = REWARD_LABEL[r.type] ?? r.type;
      if (r.type === 'temp_player') {
        const tpl = r.templateId ? templates.find((t) => t.id === r.templateId) : undefined;
        const name = tpl?.name ?? r.playerName ?? 'Catálogo';
        const ow = tpl?.overwall ?? r.overwall ?? '?';
        return `${name} · ${ow}OW/${r.days ?? '?'}d`;
      }
      if (r.type === 'overwall' && r.amount != null) {
        return `${r.amount} ${label} (7d · mineração)`;
      }
      if (r.type === 'item_template') {
        const tpl = r.templateId ? templates.find((t) => t.id === r.templateId) : undefined;
        return tpl ? `${tpl.name} (permanente)` : label;
      }
      if (r.amount != null) return `${r.amount} ${label}`;
      return label;
    })
    .join(' · ');
}

function emptyReward(): RewardLine {
  return { type: QuestRewardType.GMT, amount: 10 };
}

function questSaveError(error: unknown): string {
  const data = (error as { response?: { data?: { error?: { details?: { issues?: Record<string, string[]> } } } } })
    ?.response?.data?.error?.details?.issues;
  if (data && typeof data === 'object') {
    const labels: Record<string, string> = {
      title: 'O nome precisa ter pelo menos 2 letras.',
      description: 'Faltou a explicação. Se deixar em branco, o nome é usado.',
      target: 'A meta precisa ser um número inteiro a partir de 1.',
      rewards: 'O prêmio está inválido. Coloque uma quantidade maior que zero.',
      trigger: 'Escolha a ação que conta.',
      kind: 'Tipo de achievement inválido.',
      maxClaimsPerUser: 'O máximo por jogador precisa ser um número a partir de 1.',
    };
    const messages = Object.entries(data).map(([field, issues]) => labels[field] ?? `${field}: ${issues.join(', ')}`);
    if (messages.length) return messages.join(' ');
  }
  return error instanceof Error ? error.message : 'Falha ao salvar achievement';
}

function WideModal({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-label="Fechar" onClick={onClose} />
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0c1220] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <h2 className="font-semibold text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/[0.06] hover:text-white"
          >
            <i className="bi bi-x-lg text-sm" />
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-white/[0.06] px-5 py-4">{footer}</div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  /** Explicação em português bem simples — aparece embaixo do título. */
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      {hint ? (
        <span className="block text-xs font-normal normal-case tracking-normal leading-snug text-slate-400">
          {hint}
        </span>
      ) : null}
      {children}
    </label>
  );
}

function IdiotGuide({ title, steps }: { title: string; steps: string[] }) {
  return (
    <div className="rounded-xl border border-sky-500/25 bg-sky-500/5 px-4 py-3 text-sm text-slate-200">
      <p className="mb-2 font-semibold text-sky-200">{title}</p>
      <ol className="list-decimal space-y-1.5 pl-5 text-slate-300 leading-snug">
        {steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
    </div>
  );
}

function CampaignImageUpload({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);
  const [uploadErr, setUploadErr] = useState('');

  const upload = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        setUploadErr('Envie PNG, JPG ou WEBP.');
        return;
      }
      setUploading(true);
      setUploadErr('');
      try {
        const fd = new FormData();
        fd.append('file', file);
        const { data } = await adminClient.post<{ url: string }>('/events/upload-image', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        onChange(data.url);
      } catch {
        setUploadErr('Falha no upload. Tente de novo.');
      } finally {
        setUploading(false);
      }
    },
    [onChange],
  );

  return (
    <div className="space-y-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        Foto do cartaz
      </span>
      <p className="text-xs text-slate-400">A imagem grande que o jogador vê no evento.</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = '';
        }}
      />

      {value ? (
        <div className="group relative h-40 w-full overflow-hidden rounded-xl border border-white/[0.08] bg-black/20">
          <img src={resolveUploadUrl(value)} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/20"
            >
              <i className="bi bi-arrow-repeat" /> Trocar
            </button>
            <button
              type="button"
              onClick={() => onChange('')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/20 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/30"
            >
              <i className="bi bi-trash" /> Remover
            </button>
          </div>
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm text-white">
              Enviando…
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void upload(file);
          }}
          className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-10 text-sm transition-colors ${
            drag
              ? 'border-emerald-400 bg-emerald-500/10 text-emerald-200'
              : 'border-white/15 bg-white/[0.02] text-slate-400 hover:border-emerald-500/40 hover:text-slate-200'
          }`}
        >
          <i className="bi bi-cloud-arrow-up text-2xl" />
          {uploading ? 'Enviando…' : 'Clique ou arraste uma imagem (PNG/JPG/WEBP)'}
        </button>
      )}

      <AdminInput
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="ou cole URL https://… /uploads/…"
      />
      {uploadErr && <p className="text-xs text-red-400">{uploadErr}</p>}
    </div>
  );
}

function Select({
  value,
  onChange,
  children,
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full rounded-lg border border-white/[0.08] bg-[#0c1220] px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${className}`}
    >
      {children}
    </select>
  );
}

function TextArea({
  value,
  onChange,
  rows = 3,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
    />
  );
}

/* ── Rewards editor ────────────────────────────────────── */

function RewardsEditor({
  value,
  onChange,
  templates,
  shopItems,
  badges,
}: {
  value: RewardLine[];
  onChange: (v: RewardLine[]) => void;
  templates: ItemTemplateDTO[];
  shopItems: StadiumShopItemDTO[];
  badges: Badge[];
}) {
  function update(i: number, patch: Partial<RewardLine>) {
    onChange(value.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            O que o jogador ganha
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            Pode ser dinheiro, força, jogador ou medalha. Adicione uma linha por prêmio.
          </p>
        </div>
        <AdminButton
          size="sm"
          variant="secondary"
          type="button"
          onClick={() => onChange([...value, emptyReward()])}
        >
          <i className="bi bi-plus text-xs" /> Adicionar prêmio
        </AdminButton>
      </div>
      {value.length === 0 && (
        <p className="text-xs text-amber-300/90">
          Sem prêmio = missão inútil. Clique em “Adicionar prêmio”.
        </p>
      )}
      {value.map((r, i) => (
        <div key={i} className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="flex gap-2">
            <Select
              value={r.type}
              onChange={(type) => {
                const base: RewardLine = { type };
                if (type === 'gmt' || type === 'usdc' || type === 'usdt' || type === 'overwall') {
                  base.amount = type === 'gmt' ? 0.0001 : 1;
                } else if (type === 'temp_player') {
                  base.days = 30;
                  base.templateId = undefined;
                } else if (type === 'item_template') {
                  base.templateId = undefined;
                }
                update(i, base);
              }}
              className="flex-1"
            >
              {ADMIN_REWARD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {REWARD_LABEL[t] ?? t}
                </option>
              ))}
            </Select>
            <AdminButton
              size="sm"
              variant="danger"
              type="button"
              onClick={() => onChange(value.filter((_, idx) => idx !== i))}
            >
              <i className="bi bi-trash text-xs" />
            </AdminButton>
          </div>

          {(r.type === 'gmt' || r.type === 'usdc' || r.type === 'usdt' || r.type === 'overwall') && (
            <div className="space-y-1.5">
              <AdminInput
                type="number"
                min={0}
                step="any"
                value={r.amount ?? 0}
                onChange={(e) => update(i, { amount: Number(e.target.value) })}
                placeholder="Quantidade"
              />
              {r.type === 'overwall' && (
                <p className="text-[11px] leading-snug text-amber-300/90">
                  Poder temporário: soma overwall na mineração por <strong>7 dias</strong>. Depois some. Não é GMT, USDC nem USDT.
                </p>
              )}
            </div>
          )}

          {r.type === 'temp_player' && (
            <div className="space-y-2">
              <Select
                value={r.templateId ?? ''}
                onChange={(templateId) => {
                  const tpl = templates.find((t) => t.id === templateId);
                  update(i, {
                    templateId: templateId || undefined,
                    playerName: tpl?.name,
                    overwall: tpl?.overwall,
                    position: tpl?.position,
                    imageUrl: tpl?.imageUrl ?? null,
                  });
                }}
              >
                <option value="">Escolha um jogador do catálogo (menu Itens)…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} · R{t.rarity} · {t.overwall} OW · pos {t.position}
                  </option>
                ))}
              </Select>
              <AdminInput
                type="number"
                min={1}
                max={90}
                value={r.days ?? 30}
                onChange={(e) => update(i, { days: Number(e.target.value) })}
                placeholder="Quantos dias ele fica no elenco?"
              />
              {r.templateId && (
                <div className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2">
                  {(() => {
                    const tpl = templates.find((t) => t.id === r.templateId);
                    if (!tpl) return <p className="text-xs text-slate-500">Esse jogador não está no catálogo ativo.</p>;
                    return (
                      <>
                        {tpl.imageUrl ? (
                          <img
                            src={resolveUploadUrl(tpl.imageUrl)}
                            alt=""
                            className="h-12 w-12 rounded-lg object-cover border border-white/[0.08]"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/[0.04]">
                            <i className="bi bi-person text-slate-500" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{tpl.name}</p>
                          <p className="text-[11px] text-slate-400">
                            R{tpl.rarity} · {tpl.overwall} OW · pos {tpl.position} · some em {r.days ?? 30} dias
                          </p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
              <p className="text-[11px] leading-snug text-slate-400">
                O jogador entra no elenco do cara. Depois dos dias que você colocou, ele some sozinho.
                Nome, força e foto vêm do catálogo em <strong>Itens</strong> — aqui você só escolhe quem e por quanto tempo.
              </p>
            </div>
          )}

          {r.type === 'item_template' && (
            <Select
              value={r.templateId ?? ''}
              onChange={(templateId) => update(i, { templateId })}
            >
              <option value="">Escolha o jogador permanente…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · R{t.rarity} · {t.overwall} OW
                </option>
              ))}
            </Select>
          )}

          {r.type === 'shop_item' && (
            <Select
              value={r.shopItemId ?? ''}
              onChange={(shopItemId) => update(i, { shopItemId })}
            >
              <option value="">Escolha o item da lojinha…</option>
              {shopItems.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.slug} · {s.effectType}
                </option>
              ))}
            </Select>
          )}

          {r.type === 'badge' && (
            <Select value={r.badgeId ?? ''} onChange={(badgeId) => update(i, { badgeId })}>
              <option value="">Escolha a medalha…</option>
              {badges.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title} ({b.code})
                </option>
              ))}
            </Select>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Campaign card ─────────────────────────────────────── */

function CampaignCard({
  c,
  onEdit,
  onToggle,
  onDelete,
}: {
  c: Campaign;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const status = campaignStatus(c);
  const days = daysLeft(c.endsAt);
  const strip =
    status === 'live'
      ? 'bg-gradient-to-r from-emerald-500 to-cyan-500'
      : status === 'scheduled'
        ? 'bg-sky-500'
        : status === 'expired'
          ? 'bg-slate-600'
          : 'bg-slate-700';

  return (
    <div className="admin-card overflow-hidden">
      <div className={`h-1 w-full ${strip}`} />
      <div className="space-y-3 p-4">
        {c.imageUrl && (
          <img
            src={resolveUploadUrl(c.imageUrl)}
            alt=""
            className="h-28 w-full rounded-lg object-cover"
          />
        )}
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-slate-100">{c.title}</p>
              {status === 'live' && (
                <span className="flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  AO VIVO
                </span>
              )}
              {status === 'scheduled' && <AdminBadge variant="info">Agendado</AdminBadge>}
              {status === 'expired' && <AdminBadge>Expirado</AdminBadge>}
              {status === 'inactive' && <AdminBadge>Inativo</AdminBadge>}
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {c.slug} · {formatDate(c.startsAt)} → {formatDate(c.endsAt)}
              {status === 'live' && (
                <span className={`ml-2 font-medium ${days <= 3 ? 'text-red-400' : 'text-slate-400'}`}>
                  · {days}d restantes
                </span>
              )}
            </p>
          </div>
        </div>
        <p className="line-clamp-2 text-xs text-slate-400">{c.body}</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-2 text-center">
            <p className="text-base font-bold text-slate-100">{c._count?.quests ?? 0}</p>
            <p className="text-[9px] uppercase tracking-wide text-slate-600">Missões</p>
          </div>
          <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-2 text-center">
            <p className="text-base font-bold text-slate-100">{c.sortOrder}</p>
            <p className="text-[9px] uppercase tracking-wide text-slate-600">Ordem</p>
          </div>
        </div>
        <div className="flex gap-1.5 border-t border-white/[0.04] pt-3">
          <AdminButton size="sm" variant="secondary" className="flex-1" onClick={onEdit}>
            <i className="bi bi-pencil text-xs" /> Editar
          </AdminButton>
          <AdminButton size="sm" variant={c.active ? 'ghost' : 'secondary'} onClick={onToggle}>
            <i className={`bi ${c.active ? 'bi-pause-circle' : 'bi-play-circle'} text-xs`} />
            {c.active ? 'Desativar' : 'Ativar'}
          </AdminButton>
          <AdminButton size="sm" variant="danger" onClick={onDelete}>
            <i className="bi bi-trash text-xs" />
          </AdminButton>
        </div>
      </div>
    </div>
  );
}

/* ── Quest card ────────────────────────────────────────── */

function QuestCard({
  q,
  campaignTitle,
  templates,
  onEdit,
  onToggle,
  onDelete,
}: {
  q: Quest;
  campaignTitle?: string;
  templates?: ItemTemplateDTO[];
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="admin-card space-y-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-100">{q.title}</p>
            <AdminBadge variant="info">{KIND_LABEL[q.kind] ?? q.kind}</AdminBadge>
            {!q.active && <AdminBadge>OFF</AdminBadge>}
          </div>
          <p className="mt-1 text-xs text-slate-400 line-clamp-2">{q.description}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
        <span className="rounded bg-white/[0.04] px-2 py-0.5">
          <i className="bi bi-lightning-charge text-amber-400" />{' '}
          {TRIGGER_LABEL[q.trigger] ?? q.trigger}
        </span>
        <span className="rounded bg-white/[0.04] px-2 py-0.5">
          Precisa {q.target}× · {PERIOD_LABEL[q.period] ?? q.period}
        </span>
        <span className="rounded bg-white/[0.04] px-2 py-0.5">
          {q._count?.claims ?? 0} já pegaram
        </span>
        {campaignTitle && (
          <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-emerald-300">{campaignTitle}</span>
        )}
      </div>
      <p className="text-xs text-emerald-300/90">{summarizeRewards(q.rewards, templates)}</p>
      <div className="flex gap-1.5 border-t border-white/[0.04] pt-3">
        <AdminButton size="sm" variant="secondary" className="flex-1" onClick={onEdit}>
          <i className="bi bi-pencil text-xs" /> Editar
        </AdminButton>
        <AdminButton size="sm" variant="ghost" onClick={onToggle}>
          {q.active ? 'Desativar' : 'Ativar'}
        </AdminButton>
        <AdminButton size="sm" variant="danger" onClick={onDelete}>
          <i className="bi bi-trash text-xs" />
        </AdminButton>
      </div>
    </div>
  );
}

/* ── Main page ─────────────────────────────────────────── */

type CampForm = {
  id?: string;
  slug: string;
  title: string;
  body: string;
  imageUrl: string;
  startsAt: string;
  endsAt: string;
  active: boolean;
  sortOrder: number;
  slugManual: boolean;
};

type QuestForm = {
  id?: string;
  kind: string;
  campaignId: string;
  title: string;
  description: string;
  trigger: string;
  target: number;
  rewards: RewardLine[];
  active: boolean;
  period: string;
  maxClaimsPerUser: number;
  maxGlobalClaims: string;
  requireEmailVerified: boolean;
  startsAt: string;
  endsAt: string;
  sortOrder: number;
};

function defaultCampForm(): CampForm {
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + 14);
  return {
    slug: '',
    title: '',
    body: '',
    imageUrl: '',
    startsAt: toLocalInput(start.toISOString()),
    endsAt: toLocalInput(end.toISOString()),
    active: true,
    sortOrder: 0,
    slugManual: false,
  };
}

function defaultQuestForm(): QuestForm {
  return {
    kind: QuestKind.DAILY_TASK,
    campaignId: '',
    title: '',
    description: '',
    trigger: QuestTrigger.LOGIN,
    target: 1,
    rewards: [emptyReward()],
    active: true,
    period: 'daily',
    maxClaimsPerUser: 1,
    maxGlobalClaims: '',
    requireEmailVerified: true,
    startsAt: '',
    endsAt: '',
    sortOrder: 0,
  };
}

export function AdminEventosPage() {
  const { hasPermission } = useAdminAuth();
  const can = hasPermission(AdminPermission.MANAGE_EVENTS);
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('campaigns');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const [campOpen, setCampOpen] = useState(false);
  const [campForm, setCampForm] = useState<CampForm>(defaultCampForm);

  const [questOpen, setQuestOpen] = useState(false);
  const [questScope, setQuestScope] = useState<'achievement' | 'mission'>('mission');
  const [questForm, setQuestForm] = useState<QuestForm>(defaultQuestForm);
  const [questKindFilter, setQuestKindFilter] = useState('all');
  const [questCampFilter, setQuestCampFilter] = useState('all');

  const [badgeOpen, setBadgeOpen] = useState(false);
  const [badgeForm, setBadgeForm] = useState({ id: '', code: '', title: '', iconUrl: '' });

  const [claimQuestFilter, setClaimQuestFilter] = useState('');

  const campaigns = useQuery({
    queryKey: ['admin-events-campaigns'],
    queryFn: async () =>
      (await adminClient.get<{ items: Campaign[] }>('/events/campaigns')).data.items,
    enabled: can,
  });
  const quests = useQuery({
    queryKey: ['admin-events-quests'],
    queryFn: async () => (await adminClient.get<{ items: Quest[] }>('/events/quests')).data.items,
    enabled: can,
  });
  const badges = useQuery({
    queryKey: ['admin-events-badges'],
    queryFn: async () => (await adminClient.get<{ items: Badge[] }>('/events/badges')).data.items,
    enabled: can,
  });
  const claims = useQuery({
    queryKey: ['admin-events-claims', claimQuestFilter],
    queryFn: async () =>
      (
        await adminClient.get<{ items: ClaimRow[] }>('/events/claims', {
          params: { limit: 80, ...(claimQuestFilter ? { questId: claimQuestFilter } : {}) },
        })
      ).data.items,
    enabled: can && tab === 'claims',
  });
  const templates = useQuery({
    queryKey: ['admin-items-active'],
    queryFn: async () =>
      (
        await adminClient.get<{ items: ItemTemplateDTO[] }>('/items', {
          params: { active: 'true', limit: 200 },
        })
      ).data.items,
    enabled: can,
  });
  const shopItems = useQuery({
    queryKey: ['admin-stadium-shop'],
    queryFn: async () =>
      (await adminClient.get<{ items: StadiumShopItemDTO[] }>('/stadium-shop/items')).data.items,
    enabled: can,
  });

  useEffect(() => {
    if (!msg && !err) return;
    const t = setTimeout(() => {
      setMsg('');
      setErr('');
    }, 4000);
    return () => clearTimeout(t);
  }, [msg, err]);

  const campById = useMemo(() => {
    const m = new Map<string, Campaign>();
    for (const c of campaigns.data ?? []) m.set(c.id, c);
    return m;
  }, [campaigns.data]);

  const filteredQuests = useMemo(() => {
    let list = (quests.data ?? []).filter((q) => q.kind !== QuestKind.ACHIEVEMENT);
    if (questKindFilter !== 'all') list = list.filter((q) => q.kind === questKindFilter);
    if (questCampFilter === 'none') list = list.filter((q) => !q.campaignId);
    else if (questCampFilter !== 'all') list = list.filter((q) => q.campaignId === questCampFilter);
    return list;
  }, [quests.data, questKindFilter, questCampFilter]);

  const liveCampaigns = (campaigns.data ?? []).filter((c) => campaignStatus(c) === 'live').length;

  /* mutations */
  const saveCampaign = useMutation({
    mutationFn: async () => {
      const payload = {
        slug: campForm.slug,
        title: campForm.title,
        body: campForm.body,
        imageUrl: campForm.imageUrl || null,
        startsAt: new Date(campForm.startsAt).toISOString(),
        endsAt: new Date(campForm.endsAt).toISOString(),
        active: campForm.active,
        sortOrder: campForm.sortOrder,
      };
      if (campForm.id) {
        return adminClient.patch(`/events/campaigns/${campForm.id}`, payload);
      }
      return adminClient.post('/events/campaigns', payload);
    },
    onSuccess: () => {
      setMsg(campForm.id ? 'Campanha atualizada' : 'Campanha criada');
      setCampOpen(false);
      void qc.invalidateQueries({ queryKey: ['admin-events-campaigns'] });
    },
    onError: (e: unknown) => setErr(e instanceof Error ? e.message : 'Falha ao salvar campanha'),
  });

  const toggleCampaign = useMutation({
    mutationFn: (c: Campaign) => adminClient.patch(`/events/campaigns/${c.id}`, { active: !c.active }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-events-campaigns'] }),
  });

  const deleteCampaign = useMutation({
    mutationFn: (id: string) => adminClient.delete(`/events/campaigns/${id}`),
    onSuccess: () => {
      setMsg('Campanha excluída');
      void qc.invalidateQueries({ queryKey: ['admin-events-campaigns'] });
    },
  });

  const saveQuest = useMutation({
    mutationFn: async () => {
      const achievement = questScope === 'achievement';
      const title = questForm.title.trim();
      const description = questForm.description.trim() || title;
      const target = Math.floor(Number(questForm.target));
      const maxClaimsPerUser = Math.floor(Number(questForm.maxClaimsPerUser));
      if (title.length < 2) throw new Error('O nome precisa ter pelo menos 2 letras.');
      if (!Number.isInteger(target) || target < 1) throw new Error('A meta precisa ser um número inteiro a partir de 1.');
      if (!Number.isInteger(maxClaimsPerUser) || maxClaimsPerUser < 1) {
        throw new Error('O máximo por jogador precisa ser um número a partir de 1.');
      }
      const rewards = questForm.rewards.map((reward) => {
        const next = { ...reward };
        if (next.imageUrl === '') delete next.imageUrl;
        if (next.amount != null) next.amount = Number(next.amount);
        return next;
      });
      if (!rewards.length) throw new Error('Coloque pelo menos um prêmio.');
      if (rewards.some((reward) => ['gmt', 'usdc', 'usdt', 'overwall'].includes(reward.type) && !(Number(reward.amount) > 0))) {
        throw new Error('O prêmio precisa de uma quantidade maior que zero.');
      }
      const payload = {
        kind: achievement ? QuestKind.ACHIEVEMENT : questForm.kind === QuestKind.ACHIEVEMENT ? QuestKind.DAILY_TASK : questForm.kind,
        campaignId: achievement ? null : questForm.campaignId || null,
        title,
        description,
        trigger: questForm.trigger,
        target,
        rewards,
        active: questForm.active,
        period: achievement ? 'none' : questForm.period,
        maxClaimsPerUser: achievement ? 1 : maxClaimsPerUser,
        maxGlobalClaims: questForm.maxGlobalClaims
          ? Number(questForm.maxGlobalClaims)
          : null,
        requireEmailVerified: questForm.requireEmailVerified,
        startsAt: questForm.startsAt ? new Date(questForm.startsAt).toISOString() : null,
        endsAt: questForm.endsAt ? new Date(questForm.endsAt).toISOString() : null,
        sortOrder: questForm.sortOrder,
      };
      if (questForm.id) {
        return adminClient.patch(`/events/quests/${questForm.id}`, payload);
      }
      return adminClient.post('/events/quests', payload);
    },
    onSuccess: () => {
      setMsg(
        questScope === 'achievement'
          ? questForm.id
            ? 'Achievement atualizado'
            : 'Achievement criado'
          : questForm.id
            ? 'Missão atualizada'
            : 'Missão criada',
      );
      setQuestOpen(false);
      void qc.invalidateQueries({ queryKey: ['admin-events-quests'] });
    },
    onError: (e: unknown) => setErr(questSaveError(e)),
  });

  const toggleQuest = useMutation({
    mutationFn: (q: Quest) => adminClient.patch(`/events/quests/${q.id}`, { active: !q.active }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-events-quests'] }),
  });

  const deleteQuest = useMutation({
    mutationFn: (id: string) => adminClient.delete(`/events/quests/${id}`),
    onSuccess: () => {
      setMsg('Excluído');
      void qc.invalidateQueries({ queryKey: ['admin-events-quests'] });
    },
  });

  const saveBadge = useMutation({
    mutationFn: async () => {
      const payload = {
        code: badgeForm.code,
        title: badgeForm.title,
        iconUrl: badgeForm.iconUrl || null,
      };
      if (badgeForm.id) return adminClient.patch(`/events/badges/${badgeForm.id}`, payload);
      return adminClient.post('/events/badges', payload);
    },
    onSuccess: () => {
      setMsg(badgeForm.id ? 'Medalha atualizada' : 'Medalha criada');
      setBadgeOpen(false);
      void qc.invalidateQueries({ queryKey: ['admin-events-badges'] });
    },
    onError: (e: unknown) => setErr(e instanceof Error ? e.message : 'Falha ao salvar badge'),
  });

  const deleteBadge = useMutation({
    mutationFn: (id: string) => adminClient.delete(`/events/badges/${id}`),
    onSuccess: () => {
      setMsg('Medalha excluída');
      void qc.invalidateQueries({ queryKey: ['admin-events-badges'] });
    },
  });

  function openEditCampaign(c: Campaign) {
    setCampForm({
      id: c.id,
      slug: c.slug,
      title: c.title,
      body: c.body,
      imageUrl: c.imageUrl ?? '',
      startsAt: toLocalInput(c.startsAt),
      endsAt: toLocalInput(c.endsAt),
      active: c.active,
      sortOrder: c.sortOrder,
      slugManual: true,
    });
    setCampOpen(true);
  }

  function openNewAchievement() {
    setQuestScope('achievement');
    setQuestForm({
      ...defaultQuestForm(),
      kind: QuestKind.ACHIEVEMENT,
      period: 'none',
      campaignId: '',
    });
    setQuestOpen(true);
  }

  function openNewMission() {
    setQuestScope('mission');
    setQuestForm(defaultQuestForm());
    setQuestOpen(true);
  }

  function openEditQuest(q: Quest) {
    setQuestScope(q.kind === QuestKind.ACHIEVEMENT ? 'achievement' : 'mission');
    setQuestForm({
      id: q.id,
      kind: q.kind,
      campaignId: q.campaignId ?? '',
      title: q.title,
      description: q.description,
      trigger: q.trigger,
      target: q.target,
      rewards: parseRewards(q.rewards).length ? parseRewards(q.rewards) : [emptyReward()],
      active: q.active,
      period: q.period,
      maxClaimsPerUser: q.maxClaimsPerUser,
      maxGlobalClaims: q.maxGlobalClaims != null ? String(q.maxGlobalClaims) : '',
      requireEmailVerified: q.requireEmailVerified,
      startsAt: toLocalInput(q.startsAt),
      endsAt: toLocalInput(q.endsAt),
      sortOrder: q.sortOrder,
    });
    setQuestOpen(true);
  }

  if (!can) {
    return <div className="p-6 text-slate-400">Sem permissão MANAGE_EVENTS.</div>;
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'campaigns', label: '1. Campanhas', icon: 'bi-calendar-event' },
    { id: 'achievements', label: '2. Achievements', icon: 'bi-trophy' },
    { id: 'quests', label: '3. Missões', icon: 'bi-list-check' },
    { id: 'badges', label: '4. Medalhas', icon: 'bi-award' },
    { id: 'claims', label: '5. Quem já pegou', icon: 'bi-shield-check' },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Eventos e missões"
        subtitle="Aqui você cria promoções: o jogador faz uma coisa → ganha um prêmio. Não é o Passe."
        actions={
          tab === 'campaigns' ? (
            <AdminButton
              onClick={() => {
                setCampForm(defaultCampForm());
                setCampOpen(true);
              }}
            >
              <i className="bi bi-plus-circle text-xs" /> Nova campanha
            </AdminButton>
          ) : tab === 'achievements' ? (
            <AdminButton onClick={openNewAchievement}>
              <i className="bi bi-plus-circle text-xs" /> Novo achievement
            </AdminButton>
          ) : tab === 'quests' ? (
            <AdminButton onClick={openNewMission}>
              <i className="bi bi-plus-circle text-xs" /> Nova missão
            </AdminButton>
          ) : tab === 'badges' ? (
            <AdminButton
              onClick={() => {
                setBadgeForm({ id: '', code: '', title: '', iconUrl: '' });
                setBadgeOpen(true);
              }}
            >
              <i className="bi bi-plus-circle text-xs" /> Nova medalha
            </AdminButton>
          ) : undefined
        }
      />

      <IdiotGuide
        title="Como funciona (leia isto)"
        steps={[
          'Campanha = o cartaz do evento (nome, foto, data de início e fim). Ex.: “Carnaval 2026”.',
          'Missão = o que o jogador precisa FAZER pra ganhar o prêmio. Ex.: “Entre no site 1 vez”.',
          'Prêmio = o que ele GANHA (GMT, jogador, medalha…). Sem prêmio a missão não serve pra nada.',
          'Ordem certa: cria a campanha → cria as missões ligadas nela → liga a missão (botão Ativa).',
          'A aba “Quem já pegou” mostra o histórico: quem resgatou o quê. Só consulta, não mexe.',
        ]}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <AdminStatCard label="Campanhas criadas" value={campaigns.data?.length ?? 0} icon="bi-calendar3" accent="sky" />
        <AdminStatCard label="Rolando agora" value={liveCampaigns} icon="bi-broadcast" accent="emerald" />
        <AdminStatCard
          label="Missões criadas"
          value={(quests.data ?? []).filter((q) => q.kind !== QuestKind.ACHIEVEMENT).length}
          icon="bi-list-check"
          accent="amber"
        />
        <AdminStatCard label="Medalhas" value={badges.data?.length ?? 0} icon="bi-award" accent="rose" />
      </div>

      {(msg || err) && (
        <p
          className={`rounded-lg border px-3 py-2 text-sm ${
            err
              ? 'border-red-500/30 bg-red-950/40 text-red-300'
              : 'border-emerald-500/30 bg-emerald-950/40 text-emerald-300'
          }`}
        >
          {err || msg}
        </p>
      )}

      <div className="flex flex-wrap gap-2 border-b border-white/[0.06] pb-3">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            type="button"
            onClick={() => setTab(tb.id)}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
              tab === tb.id
                ? 'bg-emerald-600 text-white'
                : 'bg-white/[0.04] text-slate-400 hover:text-slate-200'
            }`}
          >
            <i className={`bi ${tb.icon} text-xs`} />
            {tb.label}
          </button>
        ))}
      </div>

      {/* ── Campanhas ── */}
      {tab === 'campaigns' && (
        <div className="space-y-4">
          <IdiotGuide
            title="Aba Campanhas"
            steps={[
              'Cada cartão = um evento que o jogador vê na tela de Eventos.',
              'Sem campanha ativa no período certo, as missões dela não aparecem.',
              '“Ativa” ligado + data de início/fim cobrindo HOJE = evento rolando.',
            ]}
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(campaigns.data ?? []).length === 0 && (
            <p className="col-span-full text-sm text-slate-500">
              Nenhuma campanha ainda. Clique em “Nova campanha” em cima.
            </p>
          )}
          {(campaigns.data ?? []).map((c) => (
            <CampaignCard
              key={c.id}
              c={c}
              onEdit={() => openEditCampaign(c)}
              onToggle={() => toggleCampaign.mutate(c)}
              onDelete={() => {
                if (confirm(`Excluir campanha “${c.title}”?`)) deleteCampaign.mutate(c.id);
              }}
            />
          ))}
          </div>
        </div>
      )}

      {tab === 'achievements' && (
        <div className="space-y-4">
          <IdiotGuide
            title="Achievements"
            steps={[
              'Achievement só existe se você criar aqui. Nada entra pronto e nada conta o passado.',
              'Novo achievement, Editar e Excluir ficam nesta aba.',
              'É uma vez na vida: a barra só sobe nas ações feitas depois que o achievement existe.',
              'O prêmio só pode ser GMT, USDC, USDT ou overwall (poder temporário de 7 dias).',
            ]}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {(quests.data ?? []).filter((q) => q.kind === QuestKind.ACHIEVEMENT).length === 0 && (
              <p className="col-span-full text-sm text-slate-500">
                Nenhum achievement. Clique em “Novo achievement”.
              </p>
            )}
            {(quests.data ?? [])
              .filter((q) => q.kind === QuestKind.ACHIEVEMENT)
              .map((q) => (
                <QuestCard
                  key={q.id}
                  q={q}
                  templates={templates.data ?? []}
                  campaignTitle={q.campaignId ? campById.get(q.campaignId)?.title : undefined}
                  onEdit={() => openEditQuest(q)}
                  onToggle={() => toggleQuest.mutate(q)}
                  onDelete={() => {
                    if (confirm(`Apagar o achievement “${q.title}”?`)) deleteQuest.mutate(q.id);
                  }}
                />
              ))}
          </div>
        </div>
      )}

      {/* ── Quests ── */}
      {tab === 'quests' && (
        <div className="space-y-4">
          <IdiotGuide
            title="Aba Missões"
            steps={[
              'Missão = “faça X vezes a ação Y e ganhe o prêmio”.',
              'Trigger = a ação que conta (entrar, marcar presença, etc.). Meta = quantas vezes precisa.',
              'Ligue a missão numa campanha se for de evento. Missão diária/semanal pode ficar sem campanha.',
            ]}
          />
          <div className="flex flex-wrap gap-2">
            <Select value={questKindFilter} onChange={setQuestKindFilter} className="w-auto min-w-[220px]">
              <option value="all">Todos os tipos de missão</option>
              {Object.values(QuestKind)
                .filter((k) => k !== QuestKind.ACHIEVEMENT)
                .map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
            </Select>
            <Select value={questCampFilter} onChange={setQuestCampFilter} className="w-auto min-w-[180px]">
              <option value="all">Todas as campanhas</option>
              <option value="none">Sem campanha (missão solta)</option>
              {(campaigns.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {filteredQuests.length === 0 && (
              <p className="col-span-full text-sm text-slate-500">Nenhuma missão neste filtro.</p>
            )}
            {filteredQuests.map((q) => (
              <QuestCard
                key={q.id}
                q={q}
                templates={templates.data ?? []}
                campaignTitle={q.campaignId ? campById.get(q.campaignId)?.title : undefined}
                onEdit={() => openEditQuest(q)}
                onToggle={() => toggleQuest.mutate(q)}
                onDelete={() => {
                  if (confirm(`Excluir missão “${q.title}”?`)) deleteQuest.mutate(q.id);
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Badges ── */}
      {tab === 'badges' && (
        <div className="space-y-4">
          <IdiotGuide
            title="Aba Medalhas"
            steps={[
              'Medalha não é prêmio. Achievement paga só GMT, USDC, USDT ou overwall temporário.',
              'Esta aba só guarda o desenho da medalha. Ela não entra no resgate.',
              'Código = nome técnico sem espaço (ex.: pioneer). Título = o que o jogador lê.',
            ]}
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {(badges.data ?? []).length === 0 && (
            <p className="col-span-full text-sm text-slate-500">Nenhuma medalha. Clique em “Nova medalha”.</p>
          )}
          {(badges.data ?? []).map((b) => (
            <div key={b.id} className="admin-card flex flex-col items-center gap-3 p-4 text-center">
              {b.iconUrl ? (
                <img src={resolveUploadUrl(b.iconUrl)} alt="" className="h-14 w-14 object-contain" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 text-2xl text-amber-400">
                  <i className="bi bi-award" />
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-white">{b.title}</p>
                <p className="text-[11px] text-slate-500">{b.code}</p>
              </div>
              <div className="flex gap-1.5">
                <AdminButton
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setBadgeForm({
                      id: b.id,
                      code: b.code,
                      title: b.title,
                      iconUrl: b.iconUrl ?? '',
                    });
                    setBadgeOpen(true);
                  }}
                >
                  Editar
                </AdminButton>
                <AdminButton
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    if (confirm('Excluir medalha?')) deleteBadge.mutate(b.id);
                  }}
                >
                  <i className="bi bi-trash text-xs" />
                </AdminButton>
              </div>
            </div>
          ))}
          </div>
        </div>
      )}

      {/* ── Claims ── */}
      {tab === 'claims' && (
        <div className="space-y-4">
          <IdiotGuide
            title="Aba Quem já pegou"
            steps={[
              'Aqui é só o histórico: quem resgatou qual missão e quando.',
              'Serve pra auditar fraude / ver se a missão está sendo usada.',
              'Você não cria nada nesta aba — só olha.',
            ]}
          />
          <Select
            value={claimQuestFilter}
            onChange={setClaimQuestFilter}
            className="max-w-md"
          >
            <option value="">Todas as missões</option>
            {(quests.data ?? []).map((q) => (
              <option key={q.id} value={q.id}>
                {q.title}
              </option>
            ))}
          </Select>
          <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-white/[0.06] bg-white/[0.02] text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Quando</th>
                  <th className="px-3 py-2.5 font-semibold">Quem</th>
                  <th className="px-3 py-2.5 font-semibold">Missão</th>
                  <th className="px-3 py-2.5 font-semibold">Período</th>
                  <th className="px-3 py-2.5 font-semibold">O que ganhou</th>
                  <th className="px-3 py-2.5 font-semibold">IP</th>
                </tr>
              </thead>
              <tbody>
                {(claims.data ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                      Ninguém resgatou nada ainda.
                    </td>
                  </tr>
                )}
                {(claims.data ?? []).map((c) => (
                  <tr key={c.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-400">
                      {formatDate(c.createdAt)}
                    </td>
                    <td className="px-3 py-2.5 text-slate-200">
                      <div className="font-medium">{c.user?.username ?? '—'}</div>
                      <div className="text-[11px] text-slate-500">{c.user?.email ?? c.userId.slice(0, 8)}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="text-slate-200">{c.quest?.title ?? c.questId.slice(0, 8)}</div>
                      <div className="text-[11px] text-slate-500">
                        {KIND_LABEL[c.quest?.kind ?? ''] ?? c.quest?.kind}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-slate-400">{c.periodKey}</td>
                    <td className="px-3 py-2.5 text-xs text-emerald-300/90">
                      {summarizeRewards(c.rewards, templates.data ?? [])}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500">{c.ip ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Campaign modal ── */}
      <WideModal
        open={campOpen}
        title={campForm.id ? 'Editar campanha' : 'Nova campanha'}
        onClose={() => setCampOpen(false)}
        footer={
          <>
            <AdminButton variant="ghost" onClick={() => setCampOpen(false)}>
              Cancelar
            </AdminButton>
            <AdminButton
              disabled={saveCampaign.isPending}
              onClick={() => saveCampaign.mutate()}
            >
              {saveCampaign.isPending ? 'Salvando…' : 'Salvar'}
            </AdminButton>
          </>
        }
      >
        <div className="space-y-4">
          <IdiotGuide
            title="O que é esta tela?"
            steps={[
              'Você está montando o cartaz do evento (não a missão em si).',
              'Depois salva e vai na aba Missões pra dizer o que o jogador precisa fazer.',
            ]}
          />
          <Field label="Nome do evento" hint="O que o jogador lê. Ex.: Carnaval MLL 2026">
            <AdminInput
              value={campForm.title}
              onChange={(e) => {
                const title = e.target.value;
                setCampForm((f) => ({
                  ...f,
                  title,
                  slug: f.slugManual ? f.slug : slugify(title),
                }));
              }}
              required
            />
          </Field>
          <Field
            label="Código interno (slug)"
            hint="Nome técnico sem espaço, só pra o sistema. Pode deixar o automático."
          >
            <AdminInput
              value={campForm.slug}
              onChange={(e) =>
                setCampForm((f) => ({ ...f, slug: slugify(e.target.value), slugManual: true }))
              }
              required
            />
          </Field>
          <Field label="Texto explicando o evento" hint="Aparece na página de Eventos pro jogador.">
            <TextArea value={campForm.body} onChange={(body) => setCampForm((f) => ({ ...f, body }))} rows={4} />
          </Field>
          <CampaignImageUpload
            value={campForm.imageUrl}
            onChange={(imageUrl) => setCampForm((f) => ({ ...f, imageUrl }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Começa em" hint="Antes disso o evento ainda não existe pra ninguém.">
              <AdminInput
                type="datetime-local"
                value={campForm.startsAt}
                onChange={(e) => setCampForm((f) => ({ ...f, startsAt: e.target.value }))}
              />
            </Field>
            <Field label="Termina em" hint="Depois disso some. Coloque a data certa.">
              <AdminInput
                type="datetime-local"
                value={campForm.endsAt}
                onChange={(e) => setCampForm((f) => ({ ...f, endsAt: e.target.value }))}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ordem na lista" hint="Número menor aparece primeiro. 0, 1, 2…">
              <AdminInput
                type="number"
                value={campForm.sortOrder}
                onChange={(e) => setCampForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
              />
            </Field>
            <label className="flex items-end gap-2 pb-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={campForm.active}
                onChange={(e) => setCampForm((f) => ({ ...f, active: e.target.checked }))}
              />
              Ligada (se desmarcar, some mesmo na data certa)
            </label>
          </div>
        </div>
      </WideModal>

      {/* ── Quest modal ── */}
      <WideModal
        open={questOpen}
        title={
          questScope === 'achievement'
            ? questForm.id
              ? 'Editar achievement'
              : 'Novo achievement'
            : questForm.id
              ? 'Editar missão'
              : 'Nova missão'
        }
        onClose={() => setQuestOpen(false)}
        footer={
          <>
            <AdminButton variant="ghost" onClick={() => setQuestOpen(false)}>
              Cancelar
            </AdminButton>
            <AdminButton disabled={saveQuest.isPending} onClick={() => saveQuest.mutate()}>
              {saveQuest.isPending ? 'Salvando…' : 'Salvar'}
            </AdminButton>
          </>
        }
      >
        <div className="space-y-4">
          <IdiotGuide
            title={questScope === 'achievement' ? 'Achievement' : 'Receita de bolo'}
            steps={
              questScope === 'achievement'
                ? [
                    'Isso fica só na aba Achievements. Não vira missão e não entra na campanha.',
                    'É uma vez na vida: a barra só sobe depois que este achievement existe.',
                    'Escolha a ação, a meta e o prêmio.',
                  ]
                : [
                    'Escolha o tipo: diária, semanal ou de evento.',
                    'Escolha a ação que conta (entrar no site, marcar presença…).',
                    'Coloque a meta e o prêmio.',
                    'Achievement não se cria aqui. Use a aba Achievements.',
                  ]
            }
          />
          {questScope === 'achievement' ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              Uma vez na vida. Salva na aba Achievements e não aparece em Missões.
            </p>
          ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Tipo da missão"
              hint="Diária zera todo dia. Semanal zera na outra semana. Evento fica na campanha."
            >
              <Select
                value={questForm.kind === QuestKind.ACHIEVEMENT ? QuestKind.DAILY_TASK : questForm.kind}
                onChange={(kind) =>
                  setQuestForm((f) => ({
                    ...f,
                    kind,
                    period: kind === 'daily_task' ? 'daily' : kind === 'weekly_task' ? 'weekly' : f.period,
                  }))
                }
              >
                {Object.values(QuestKind)
                  .filter((k) => k !== QuestKind.ACHIEVEMENT)
                  .map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABEL[k]}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field
              label="De qual campanha?"
              hint="Se for missão de evento, escolha a campanha. Diária pode ficar “Sem campanha”."
            >
              <Select
                value={questForm.campaignId}
                onChange={(campaignId) => setQuestForm((f) => ({ ...f, campaignId }))}
              >
                <option value="">Sem campanha</option>
                {(campaigns.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          )}
          <Field label="Nome da missão" hint="O que o jogador lê. Ex.: “Entre no site hoje”">
            <AdminInput
              value={questForm.title}
              onChange={(e) => setQuestForm((f) => ({ ...f, title: e.target.value }))}
            />
          </Field>
          <Field label="Explicação pro jogador" hint="Se deixar em branco, o nome da missão é usado.">
            <TextArea
              value={questForm.description}
              onChange={(description) => setQuestForm((f) => ({ ...f, description }))}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Ação que conta (trigger)"
              hint="O que o jogador precisa FAZER no jogo pra a barra subir."
            >
              <Select
                value={questForm.trigger}
                onChange={(trigger) => setQuestForm((f) => ({ ...f, trigger }))}
              >
                {Object.values(QuestTrigger).map((t) => (
                  <option key={t} value={t}>
                    {TRIGGER_LABEL[t] ?? t}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Quantas vezes? (meta)"
              hint="1 = fazer 1 vez. 5 = fazer 5 vezes. Número maior = mais difícil."
            >
              <AdminInput
                type="number"
                min={1}
                value={questForm.target}
                onChange={(e) => setQuestForm((f) => ({ ...f, target: Number(e.target.value) }))}
              />
            </Field>
          </div>

          <RewardsEditor
            value={questForm.rewards}
            onChange={(rewards) => setQuestForm((f) => ({ ...f, rewards }))}
            templates={templates.data ?? []}
            shopItems={shopItems.data ?? []}
            badges={badges.data ?? []}
          />

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-300/80">
                Travas (pra ninguém abusando)
              </p>
              <p className="mt-1 text-xs text-slate-400 leading-snug">
                Aqui você limita quantas vezes a mesma pessoa (ou o mundo inteiro) pode pegar o prêmio.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {questScope === 'achievement' ? (
                <Field label="Repete quando?" hint="Achievement não repete.">
                  <AdminInput value="Só uma vez na vida" readOnly />
                </Field>
              ) : (
              <Field
                label="Repete quando?"
                hint="“Só uma vez” = nunca mais. “Todo dia” = amanhã pode de novo."
              >
                <Select
                  value={questForm.period}
                  onChange={(period) => setQuestForm((f) => ({ ...f, period }))}
                >
                  {Object.entries(PERIOD_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </Field>
              )}
              <Field
                label="Máximo por jogador"
                hint="Ex.: 1 = cada conta só pega 1 vez nesse período. Quase sempre deixe 1."
              >
                <AdminInput
                  type="number"
                  min={1}
                  value={questForm.maxClaimsPerUser}
                  onChange={(e) =>
                    setQuestForm((f) => ({ ...f, maxClaimsPerUser: Number(e.target.value) }))
                  }
                />
              </Field>
              <Field
                label="Máximo no mundo inteiro"
                hint="Vazio = sem limite. Ex.: 100 = só os 100 primeiros ganham."
              >
                <AdminInput
                  type="number"
                  min={1}
                  value={questForm.maxGlobalClaims}
                  onChange={(e) => setQuestForm((f) => ({ ...f, maxGlobalClaims: e.target.value }))}
                  placeholder="deixe vazio = ilimitado"
                />
              </Field>
              <label className="flex items-end gap-2 pb-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={questForm.requireEmailVerified}
                  onChange={(e) =>
                    setQuestForm((f) => ({ ...f, requireEmailVerified: e.target.checked }))
                  }
                />
                Só quem confirmou o e-mail
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Começa em (opcional)"
                hint="Se vazio, usa a data da campanha. Preencha só se quiser outra janela."
              >
                <AdminInput
                  type="datetime-local"
                  value={questForm.startsAt}
                  onChange={(e) => setQuestForm((f) => ({ ...f, startsAt: e.target.value }))}
                />
              </Field>
              <Field
                label="Termina em (opcional)"
                hint="Se vazio, usa a data da campanha."
              >
                <AdminInput
                  type="datetime-local"
                  value={questForm.endsAt}
                  onChange={(e) => setQuestForm((f) => ({ ...f, endsAt: e.target.value }))}
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={questForm.active}
                onChange={(e) => setQuestForm((f) => ({ ...f, active: e.target.checked }))}
              />
              Missão ligada (se desmarcar, ninguém vê)
            </label>
          </div>
        </div>
      </WideModal>

      {/* ── Badge modal ── */}
      <WideModal
        open={badgeOpen}
        title={badgeForm.id ? 'Editar medalha' : 'Nova medalha'}
        onClose={() => setBadgeOpen(false)}
        footer={
          <>
            <AdminButton variant="ghost" onClick={() => setBadgeOpen(false)}>
              Cancelar
            </AdminButton>
            <AdminButton disabled={saveBadge.isPending} onClick={() => saveBadge.mutate()}>
              {saveBadge.isPending ? 'Salvando…' : 'Salvar'}
            </AdminButton>
          </>
        }
      >
        <div className="space-y-4">
          <IdiotGuide
            title="Medalha = figurinha"
            steps={[
              'Não dá dinheiro. Só aparece no perfil.',
              'Crie aqui → depois use como prêmio numa missão.',
            ]}
          />
          <Field label="Código" hint="Só letras minúsculas e underline. Ex.: pioneer">
            <AdminInput
              value={badgeForm.code}
              onChange={(e) =>
                setBadgeForm((f) => ({
                  ...f,
                  code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''),
                }))
              }
              placeholder="ex: pioneer"
            />
          </Field>
          <Field label="Nome bonito" hint="O que o jogador lê. Ex.: Pioneiro">
            <AdminInput
              value={badgeForm.title}
              onChange={(e) => setBadgeForm((f) => ({ ...f, title: e.target.value }))}
            />
          </Field>
          <Field label="Link da figurinha" hint="URL da imagem (ou upload em outro lugar e cola aqui).">
            <AdminInput
              value={badgeForm.iconUrl}
              onChange={(e) => setBadgeForm((f) => ({ ...f, iconUrl: e.target.value }))}
              placeholder="https://…"
            />
          </Field>
          {badgeForm.iconUrl && (
            <img
              src={resolveUploadUrl(badgeForm.iconUrl)}
              alt=""
              className="mx-auto h-16 w-16 object-contain"
            />
          )}
        </div>
      </WideModal>
    </div>
  );
}
