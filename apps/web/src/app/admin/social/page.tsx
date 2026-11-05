import { useCallback, useEffect, useState } from 'react';
import type { YoutubeCreatorDTO, YoutubeVideoDTO } from '@mll/shared';
import { adminClient } from '../../../lib/api/adminClient';
import { AdminButton, AdminPageHeader } from '../../../components/admin/AdminTable';

type PendingCreator = YoutubeCreatorDTO & { username: string | null; email: string | null };
type PendingVideo = YoutubeVideoDTO & { username: string | null };
type ApprovedCreator = PendingCreator & { videoCount: number };
type ApprovedVideo = PendingVideo;

type Tab = 'pending' | 'approved';

type ActionTarget =
  | { action: 'reject'; type: 'creator' | 'video'; id: string; name: string }
  | { action: 'revoke'; type: 'creator' | 'video'; id: string; name: string };

function extractVideoId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/i);
  return m?.[1] ?? null;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}min atrás`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h atrás`;
  return `${Math.floor(hrs / 24)}d atrás`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Reason modal (reject / revoke) ───────────────────────────────────────────

function ReasonModal({
  title,
  hint,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  hint: string;
  confirmLabel: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md admin-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
          <AdminButton size="sm" variant="ghost" onClick={onCancel}><i className="bi bi-x text-base" /></AdminButton>
        </div>
        <p className="text-xs text-slate-500">{hint}</p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Informe o motivo…"
          rows={4}
          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-red-500/40 focus:outline-none resize-none"
        />
        <div className="flex justify-end gap-2">
          <AdminButton variant="ghost" onClick={onCancel}>Cancelar</AdminButton>
          <AdminButton variant="danger" onClick={() => { if (reason.trim()) onConfirm(reason.trim()); }} disabled={!reason.trim()}>
            {confirmLabel}
          </AdminButton>
        </div>
      </div>
    </div>
  );
}

// ─── Creator cards ────────────────────────────────────────────────────────────

function CreatorCard({
  creator, onApprove, onReject,
}: { creator: PendingCreator; onApprove: () => void; onReject: () => void }) {
  return (
    <div className="admin-card overflow-hidden">
      <div className="h-1 w-full bg-gradient-to-r from-amber-500 to-orange-500" />
      <div className="p-4 space-y-4">
        <div className="flex items-start gap-3">
          {creator.photoUrl ? (
            <img src={creator.photoUrl} alt={creator.channelName}
              className="h-12 w-12 rounded-full object-cover border-2 border-white/[0.08] shrink-0" />
          ) : (
            <div className="h-12 w-12 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0">
              <i className="bi bi-person text-slate-500 text-lg" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-100 text-sm leading-tight truncate">{creator.channelName}</p>
            {creator.username && <p className="text-[11px] text-slate-500 mt-0.5">@{creator.username}</p>}
            {creator.email && <p className="text-[10px] text-slate-600 truncate">{creator.email}</p>}
          </div>
          <span className="shrink-0 flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" /> Pendente
          </span>
        </div>
        {creator.description && (
          <p className="text-[11px] text-slate-500 line-clamp-2 bg-white/[0.02] rounded-lg px-3 py-2 border border-white/[0.04]">
            {creator.description}
          </p>
        )}
        <a href={creator.channelUrl} target="_blank" rel="noreferrer"
          className="flex items-center gap-2 text-[11px] text-sky-400 hover:text-sky-300 truncate group">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-red-600/20 shrink-0">
            <i className="bi bi-youtube text-[10px] text-red-400" />
          </span>
          <span className="truncate">{creator.channelUrl}</span>
          <i className="bi bi-box-arrow-up-right text-[9px] opacity-0 group-hover:opacity-100 shrink-0" />
        </a>
        <p className="text-[10px] text-slate-700">{timeAgo(creator.createdAt)}</p>
        <div className="flex gap-2 pt-1 border-t border-white/[0.04]">
          <AdminButton size="sm" variant="secondary" className="flex-1" onClick={onApprove}>
            <i className="bi bi-check-circle-fill text-xs text-emerald-400" /> Aprovar
          </AdminButton>
          <AdminButton size="sm" variant="danger" onClick={onReject}>
            <i className="bi bi-x-circle text-xs" /> Rejeitar
          </AdminButton>
        </div>
      </div>
    </div>
  );
}

function ApprovedCreatorCard({
  creator, onRevoke,
}: { creator: ApprovedCreator; onRevoke: () => void }) {
  return (
    <div className="admin-card overflow-hidden">
      <div className="h-1 w-full bg-gradient-to-r from-emerald-500 to-teal-500" />
      <div className="p-4 space-y-4">
        <div className="flex items-start gap-3">
          {creator.photoUrl ? (
            <img src={creator.photoUrl} alt={creator.channelName}
              className="h-12 w-12 rounded-full object-cover border-2 border-emerald-500/20 shrink-0" />
          ) : (
            <div className="h-12 w-12 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0">
              <i className="bi bi-person text-slate-500 text-lg" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-100 text-sm leading-tight truncate">{creator.channelName}</p>
            {creator.username && <p className="text-[11px] text-slate-500 mt-0.5">@{creator.username}</p>}
            {creator.email && <p className="text-[10px] text-slate-600 truncate">{creator.email}</p>}
          </div>
          <span className="shrink-0 flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
            <i className="bi bi-check-circle-fill text-[9px]" /> Aprovado
          </span>
        </div>
        <div className="flex flex-wrap gap-3 text-[10px] text-slate-500">
          <span>Aprovado em {formatDate(creator.reviewedAt)}</span>
          <span>{creator.videoCount} vídeo(s) ativo(s)</span>
        </div>
        <a href={creator.channelUrl} target="_blank" rel="noreferrer"
          className="flex items-center gap-2 text-[11px] text-sky-400 hover:text-sky-300 truncate group">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-red-600/20 shrink-0">
            <i className="bi bi-youtube text-[10px] text-red-400" />
          </span>
          <span className="truncate">{creator.channelUrl}</span>
          <i className="bi bi-box-arrow-up-right text-[9px] opacity-0 group-hover:opacity-100 shrink-0" />
        </a>
        <div className="flex gap-2 pt-1 border-t border-white/[0.04]">
          <AdminButton size="sm" variant="danger" className="flex-1" onClick={onRevoke}>
            <i className="bi bi-slash-circle text-xs" /> Revogar canal
          </AdminButton>
        </div>
      </div>
    </div>
  );
}

// ─── Video cards ──────────────────────────────────────────────────────────────

function VideoCard({
  video, onApprove, onReject,
}: { video: PendingVideo; onApprove: () => void; onReject: () => void }) {
  const videoId = extractVideoId(video.videoUrl);
  const thumbUrl = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;

  return (
    <div className="admin-card overflow-hidden">
      <div className="h-1 w-full bg-gradient-to-r from-red-500 to-pink-500" />
      {thumbUrl ? (
        <a href={video.videoUrl} target="_blank" rel="noreferrer" className="block relative">
          <img src={thumbUrl} alt="thumbnail" className="h-36 w-full object-cover opacity-80 hover:opacity-100 transition-opacity" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 hover:bg-red-600/80 transition-colors">
              <i className="bi bi-play-fill text-white text-lg" />
            </span>
          </div>
        </a>
      ) : (
        <div className="h-28 bg-white/[0.02] flex items-center justify-center">
          <i className="bi bi-film text-2xl text-slate-700" />
        </div>
      )}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          {video.creator?.photoUrl ? (
            <img src={video.creator.photoUrl} alt={video.creator.channelName}
              className="h-7 w-7 rounded-full object-cover border border-white/[0.08] shrink-0" />
          ) : (
            <div className="h-7 w-7 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0">
              <i className="bi bi-person text-slate-600 text-xs" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-200 truncate">{video.creator?.channelName ?? video.username ?? '—'}</p>
          </div>
          <span className="ml-auto shrink-0 flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" /> Pendente
          </span>
        </div>
        <a href={video.videoUrl} target="_blank" rel="noreferrer"
          className="flex items-center gap-1.5 text-[11px] text-sky-400 hover:text-sky-300 font-mono group">
          <i className="bi bi-link-45deg" />
          <span className="truncate">{video.videoId}</span>
          <i className="bi bi-box-arrow-up-right text-[9px] opacity-0 group-hover:opacity-100 shrink-0" />
        </a>
        <div className="flex items-center gap-2 rounded-lg border border-purple-500/15 bg-purple-500/5 px-3 py-2">
          <i className="bi bi-gem text-purple-400 text-xs shrink-0" />
          <p className="text-[10px] text-purple-300">Aprovar = mintar 1 NFT comum para o criador</p>
        </div>
        <p className="text-[10px] text-slate-700">{timeAgo(video.createdAt)}</p>
        <div className="flex gap-2 pt-1 border-t border-white/[0.04]">
          <AdminButton size="sm" variant="secondary" className="flex-1" onClick={onApprove}>
            <i className="bi bi-gem text-xs text-purple-400" /> Aprovar + NFT
          </AdminButton>
          <AdminButton size="sm" variant="danger" onClick={onReject}>
            <i className="bi bi-x-circle text-xs" /> Rejeitar
          </AdminButton>
        </div>
      </div>
    </div>
  );
}

function ApprovedVideoCard({
  video, onRevoke,
}: { video: ApprovedVideo; onRevoke: () => void }) {
  const videoId = extractVideoId(video.videoUrl);
  const thumbUrl = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;

  return (
    <div className="admin-card overflow-hidden">
      <div className="h-1 w-full bg-gradient-to-r from-emerald-500 to-teal-500" />
      {thumbUrl ? (
        <a href={video.videoUrl} target="_blank" rel="noreferrer" className="block relative">
          <img src={thumbUrl} alt="thumbnail" className="h-36 w-full object-cover opacity-80 hover:opacity-100 transition-opacity" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 hover:bg-red-600/80 transition-colors">
              <i className="bi bi-play-fill text-white text-lg" />
            </span>
          </div>
        </a>
      ) : (
        <div className="h-28 bg-white/[0.02] flex items-center justify-center">
          <i className="bi bi-film text-2xl text-slate-700" />
        </div>
      )}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          {video.creator?.photoUrl ? (
            <img src={video.creator.photoUrl} alt={video.creator.channelName}
              className="h-7 w-7 rounded-full object-cover border border-white/[0.08] shrink-0" />
          ) : (
            <div className="h-7 w-7 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0">
              <i className="bi bi-person text-slate-600 text-xs" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-200 truncate">{video.creator?.channelName ?? video.username ?? '—'}</p>
          </div>
          <span className="ml-auto shrink-0 flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
            <i className="bi bi-check-circle-fill text-[9px]" /> Aprovado
          </span>
        </div>
        <a href={video.videoUrl} target="_blank" rel="noreferrer"
          className="flex items-center gap-1.5 text-[11px] text-sky-400 hover:text-sky-300 font-mono group">
          <i className="bi bi-link-45deg" />
          <span className="truncate">{video.videoId}</span>
          <i className="bi bi-box-arrow-up-right text-[9px] opacity-0 group-hover:opacity-100 shrink-0" />
        </a>
        <div className="flex flex-wrap gap-2 text-[10px] text-slate-500">
          <span>Aprovado em {formatDate(video.reviewedAt)}</span>
          {video.nftGrantedAt && (
            <span className="text-purple-400">
              <i className="bi bi-gem text-[9px]" /> NFT mintado
            </span>
          )}
        </div>
        <div className="flex gap-2 pt-1 border-t border-white/[0.04]">
          <AdminButton size="sm" variant="danger" className="flex-1" onClick={onRevoke}>
            <i className="bi bi-slash-circle text-xs" /> Revogar vídeo
          </AdminButton>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function AdminSocialPage() {
  const [tab, setTab] = useState<Tab>('pending');
  const [pendingCreators, setPendingCreators] = useState<PendingCreator[]>([]);
  const [pendingVideos, setPendingVideos] = useState<PendingVideo[]>([]);
  const [approvedCreators, setApprovedCreators] = useState<ApprovedCreator[]>([]);
  const [approvedVideos, setApprovedVideos] = useState<ApprovedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionTarget, setActionTarget] = useState<ActionTarget | null>(null);
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pc, pv, ac, av] = await Promise.all([
        adminClient.get<{ creators: PendingCreator[] }>('/social/creators/pending'),
        adminClient.get<{ videos: PendingVideo[] }>('/social/videos/pending'),
        adminClient.get<{ creators: ApprovedCreator[] }>('/social/creators/approved'),
        adminClient.get<{ videos: ApprovedVideo[] }>('/social/videos/approved'),
      ]);
      setPendingCreators(pc.data.creators);
      setPendingVideos(pv.data.videos);
      setApprovedCreators(ac.data.creators);
      setApprovedVideos(av.data.videos);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function approveCreator(id: string) {
    await adminClient.post(`/social/creators/${id}/approve`);
    setSuccess('Canal aprovado!');
    setTab('approved');
    await load();
  }

  async function rejectCreator(id: string, reason: string) {
    await adminClient.post(`/social/creators/${id}/reject`, { reason });
    setActionTarget(null);
    setSuccess('Canal rejeitado.');
    await load();
  }

  async function revokeCreator(id: string, reason: string) {
    await adminClient.post(`/social/creators/${id}/revoke`, { reason });
    setActionTarget(null);
    setSuccess('Canal revogado — vídeos removidos do feed.');
    await load();
  }

  async function approveVideo(id: string) {
    await adminClient.post(`/social/videos/${id}/approve`);
    setSuccess('Vídeo aprovado — NFT mintado!');
    setTab('approved');
    await load();
  }

  async function rejectVideo(id: string, reason: string) {
    await adminClient.post(`/social/videos/${id}/reject`, { reason });
    setActionTarget(null);
    setSuccess('Vídeo rejeitado.');
    await load();
  }

  async function revokeVideo(id: string, reason: string) {
    await adminClient.post(`/social/videos/${id}/revoke`, { reason });
    setActionTarget(null);
    setSuccess('Vídeo revogado — removido do feed.');
    await load();
  }

  const totalPending = pendingCreators.length + pendingVideos.length;

  function handleModalConfirm(reason: string) {
    if (!actionTarget) return;
    if (actionTarget.action === 'reject') {
      if (actionTarget.type === 'creator') void rejectCreator(actionTarget.id, reason);
      else void rejectVideo(actionTarget.id, reason);
    } else {
      if (actionTarget.type === 'creator') void revokeCreator(actionTarget.id, reason);
      else void revokeVideo(actionTarget.id, reason);
    }
  }

  const modalProps = actionTarget
    ? actionTarget.action === 'reject'
      ? {
          title: `Rejeitar — ${actionTarget.name}`,
          hint: 'Informe o motivo. O criador será notificado.',
          confirmLabel: 'Confirmar rejeição',
        }
      : actionTarget.type === 'creator'
        ? {
            title: `Revogar canal — ${actionTarget.name}`,
            hint: 'Revoga o canal e todos os vídeos pendentes/aprovados. NFTs já mintados permanecem no inventário do criador.',
            confirmLabel: 'Confirmar revogação',
          }
        : {
            title: `Revogar vídeo — ${actionTarget.name}`,
            hint: 'Remove o vídeo do feed público. NFT já mintado permanece no inventário do criador.',
            confirmLabel: 'Confirmar revogação',
          }
    : null;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Programa YouTube"
        subtitle="Aprove credenciamentos e vídeos. Cada vídeo aprovado minta 1 NFT comum para o criador."
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Pendentes', value: totalPending, icon: 'bi-hourglass-split', accent: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
          { label: 'Canais aprovados', value: approvedCreators.length, icon: 'bi-youtube', accent: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
          { label: 'Vídeos aprovados', value: approvedVideos.length, icon: 'bi-play-circle', accent: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
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

      {/* Tabs */}
      <div className="flex gap-2">
        {([
          { id: 'pending' as Tab, label: 'Pendentes', count: totalPending },
          { id: 'approved' as Tab, label: 'Aprovados', count: approvedCreators.length + approvedVideos.length },
        ]).map(({ id, label, count }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
              tab === id
                ? 'border-white/20 bg-white/10 text-white'
                : 'border-white/[0.06] bg-white/[0.02] text-slate-400 hover:text-slate-200'
            }`}
          >
            {label}
            {count > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                tab === id ? 'bg-white/20 text-white' : 'bg-white/[0.06] text-slate-500'
              }`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {success && (
        <p className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
          {success}
        </p>
      )}

      {loading ? (
        <div className="admin-card flex items-center justify-center py-16">
          <p className="text-sm text-slate-400">Carregando…</p>
        </div>
      ) : tab === 'pending' ? (
        <div className="grid gap-8 xl:grid-cols-2">
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-200">Credenciamentos pendentes</h2>
              {pendingCreators.length > 0 && (
                <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                  {pendingCreators.length}
                </span>
              )}
            </div>
            {pendingCreators.length === 0 ? (
              <div className="admin-card flex flex-col items-center justify-center py-12 text-center">
                <i className="bi bi-check-circle text-3xl text-emerald-600/50 mb-3" />
                <p className="text-sm text-slate-500">Nenhum canal aguardando aprovação.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingCreators.map((c) => (
                  <CreatorCard
                    key={c.id}
                    creator={c}
                    onApprove={() => void approveCreator(c.id)}
                    onReject={() => setActionTarget({ action: 'reject', type: 'creator', id: c.id, name: c.channelName })}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-200">Vídeos pendentes</h2>
              {pendingVideos.length > 0 && (
                <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-300">
                  {pendingVideos.length}
                </span>
              )}
            </div>
            {pendingVideos.length === 0 ? (
              <div className="admin-card flex flex-col items-center justify-center py-12 text-center">
                <i className="bi bi-check-circle text-3xl text-emerald-600/50 mb-3" />
                <p className="text-sm text-slate-500">Nenhum vídeo aguardando aprovação.</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                {pendingVideos.map((v) => (
                  <VideoCard
                    key={v.id}
                    video={v}
                    onApprove={() => void approveVideo(v.id)}
                    onReject={() => setActionTarget({ action: 'reject', type: 'video', id: v.id, name: v.videoId })}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="grid gap-8 xl:grid-cols-2">
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-200">Canais aprovados</h2>
              {approvedCreators.length > 0 && (
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  {approvedCreators.length}
                </span>
              )}
            </div>
            {approvedCreators.length === 0 ? (
              <div className="admin-card flex flex-col items-center justify-center py-12 text-center">
                <i className="bi bi-youtube text-3xl text-slate-700 mb-3" />
                <p className="text-sm text-slate-500">Nenhum canal aprovado ainda.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {approvedCreators.map((c) => (
                  <ApprovedCreatorCard
                    key={c.id}
                    creator={c}
                    onRevoke={() => setActionTarget({ action: 'revoke', type: 'creator', id: c.id, name: c.channelName })}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-200">Vídeos aprovados</h2>
              {approvedVideos.length > 0 && (
                <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-300">
                  {approvedVideos.length}
                </span>
              )}
            </div>
            {approvedVideos.length === 0 ? (
              <div className="admin-card flex flex-col items-center justify-center py-12 text-center">
                <i className="bi bi-play-circle text-3xl text-slate-700 mb-3" />
                <p className="text-sm text-slate-500">Nenhum vídeo aprovado ainda.</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                {approvedVideos.map((v) => (
                  <ApprovedVideoCard
                    key={v.id}
                    video={v}
                    onRevoke={() => setActionTarget({ action: 'revoke', type: 'video', id: v.id, name: v.videoId })}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {actionTarget && modalProps && (
        <ReasonModal
          title={modalProps.title}
          hint={modalProps.hint}
          confirmLabel={modalProps.confirmLabel}
          onConfirm={handleModalConfirm}
          onCancel={() => setActionTarget(null)}
        />
      )}
    </div>
  );
}
