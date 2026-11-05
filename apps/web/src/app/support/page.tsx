import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { SupportTicketDetailDTO, SupportTicketDTO } from '@mll/shared';
import { apiClient } from '../../lib/api/client';
import { extractErrorCode } from '../../lib/apiError';
import { SupportAttachmentImage } from '../../components/support/SupportAttachmentImage';
import { reportFailure } from '../../lib/telemetry/reportFailure';
import { compressImagesForUpload, isAcceptedImage, resolveImageMime } from '../../lib/compressImage';
import { PageContentShell, PageHero, PixelBadge, type PixelBadgeVariant } from '../../components/content';

const MAX_PHOTOS = 5;
const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPT = 'image/png,image/jpeg,image/webp';

function isHeic(file: File): boolean {
  const n = file.name.toLowerCase();
  return (
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    n.endsWith('.heic') ||
    n.endsWith('.heif')
  );
}

function validateFiles(files: File[], t: (key: string, opts?: Record<string, unknown>) => string): string | null {
  if (files.length > MAX_PHOTOS) {
    return t('support.maxPhotos', { defaultValue: `Máximo de ${MAX_PHOTOS} fotos`, max: MAX_PHOTOS });
  }
  for (const file of files) {
    if (isHeic(file)) {
      return t('support.heicNotSupported', {
        defaultValue:
          'Formato HEIC do iPhone não é suportado. Em Ajustes ▸ Câmera ▸ Formatos, selecione "Mais Compatível" e tire a foto novamente, ou converta para JPEG antes de enviar.',
      });
    }
    if (!isAcceptedImage(file)) {
      return t('support.invalidImage', {
        defaultValue: 'Use imagens nos formatos PNG, JPEG ou WEBP.',
      });
    }
    if (file.size > MAX_BYTES) {
      return t('support.imageTooLarge', {
        defaultValue: `Cada imagem deve ter no máximo ${Math.floor(MAX_BYTES / (1024 * 1024))} MB. Reduza a foto e tente novamente.`,
      });
    }
  }
  return null;
}

function describeServerReason(reason: string | undefined): string | null {
  switch (reason) {
    case 'file_too_large':
    case 'file_too_large_after_encode':
      return 'Imagem muito grande. Tente uma foto menor (até 8 MB).';
    case 'unsupported_mime':
      return 'Formato de imagem não suportado. Use PNG, JPEG ou WEBP.';
    case 'invalid_image_dimensions':
      return 'A imagem está corrompida ou em formato inválido.';
    case 'empty_file':
      return 'Arquivo vazio. Selecione novamente.';
    case 'too_many_files':
      return `Limite de ${MAX_PHOTOS} fotos por mensagem.`;
    case 'message_too_short':
      return 'Mensagem muito curta. Use pelo menos 5 caracteres ou envie só fotos.';
    case 'message_or_image_required':
      return 'Escreva uma mensagem ou anexe ao menos uma foto.';
    case 'rate_limit':
      return 'Limite de envios atingido. Aguarde cerca de 1 hora e tente novamente.';
    default:
      return null;
  }
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Aberto',
  pending: 'Aguardando',
  closed: 'Fechado',
};

const STATUS_VARIANT: Record<string, PixelBadgeVariant> = {
  open: 'green',
  pending: 'orange',
  closed: 'muted',
};

type View = 'list' | 'create' | 'detail';

export function SupportPage() {
  const { t } = useTranslation('common');
  const [searchParams, setSearchParams] = useSearchParams();
  const [tickets, setTickets] = useState<SupportTicketDTO[]>([]);
  const [selected, setSelected] = useState<SupportTicketDetailDTO | null>(null);
  const [view, setView] = useState<View>('list');

  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('general');
  const [message, setMessage] = useState('');
  const [createFiles, setCreateFiles] = useState<File[]>([]);

  const [reply, setReply] = useState('');
  const [replyFiles, setReplyFiles] = useState<File[]>([]);

  const [fileError, setFileError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const createPreviews = useMemo(
    () => createFiles.map((f) => ({ file: f, url: URL.createObjectURL(f) })),
    [createFiles],
  );
  const replyPreviews = useMemo(
    () => replyFiles.map((f) => ({ file: f, url: URL.createObjectURL(f) })),
    [replyFiles],
  );

  useEffect(() => () => createPreviews.forEach((p) => URL.revokeObjectURL(p.url)), [createPreviews]);
  useEffect(() => () => replyPreviews.forEach((p) => URL.revokeObjectURL(p.url)), [replyPreviews]);

  useEffect(() => {
    if (view === 'detail') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selected?.messages, view]);

  async function loadTickets() {
    setLoadError('');
    setLoading(true);
    try {
      const { data } = await apiClient.get<{ tickets: SupportTicketDTO[] }>('/api/support/tickets');
      setTickets(data.tickets);
    } catch {
      setLoadError(t('support.loadError', { defaultValue: 'Não foi possível carregar seus tickets.' }));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTickets();
  }, []);

  async function openTicket(id: string) {
    const { data } = await apiClient.get<SupportTicketDetailDTO>(`/api/support/tickets/${id}`);
    setSelected(data);
    setReplyFiles([]);
    setReply('');
    setFileError('');
    setView('detail');
    setTickets((prev) =>
      prev.map((tk) => (tk.id === id ? { ...tk, hasUnreadAdminReply: false } : tk)),
    );
  }

  // Deep-link from SupportReplyPopup: /support?ticket=<id>
  const deepLinkTicketId = searchParams.get('ticket');
  const deepLinkHandledRef = useRef<string | null>(null);
  useEffect(() => {
    if (!deepLinkTicketId || loading) return;
    if (deepLinkHandledRef.current === deepLinkTicketId) return;
    deepLinkHandledRef.current = deepLinkTicketId;
    void openTicket(deepLinkTicketId).finally(() => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('ticket');
          return next;
        },
        { replace: true },
      );
    });
  }, [loading, deepLinkTicketId, setSearchParams]);

  function handleFileChange(files: FileList | null, mode: 'create' | 'reply') {
    if (!files || files.length === 0) return;
    const list = Array.from(files).slice(0, MAX_PHOTOS);
    const err = validateFiles(list, t);
    setFileError(err ?? '');
    if (!err) {
      void (async () => {
        try {
          const compressed = await compressImagesForUpload(list);
          if (mode === 'create') setCreateFiles(compressed);
          else setReplyFiles(compressed);
        } catch {
          setFileError(t('support.invalidImage', { defaultValue: 'Use imagens nos formatos PNG, JPEG ou WEBP.' }));
        }
      })();
    }
  }

  async function createTicket(e: FormEvent) {
    e.preventDefault();
    setFileError('');
    setSubmitError('');
    const err = validateFiles(createFiles, t);
    if (err) { setFileError(err); return; }
    if (!message.trim() && createFiles.length === 0) {
      setFileError(t('support.messageOrPhoto', { defaultValue: 'Escreva uma mensagem ou anexe ao menos uma foto' }));
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('subject', subject.trim());
      form.append('category', category);
      form.append('message', message.trim());
      for (const file of createFiles) {
        const mime = resolveImageMime(file);
        form.append('images', mime && file.type !== mime ? new File([file], file.name, { type: mime }) : file);
      }
      await apiClient.post('/api/support/tickets', form);
      setSubject('');
      setMessage('');
      setCategory('general');
      setCreateFiles([]);
      setView('list');
      await loadTickets();
    } catch (err) {
      const code = extractErrorCode(err);
      const status = (err as { response?: { status?: number } })?.response?.status;
      const reason = (err as { response?: { data?: { error?: { details?: { reason?: string } } } } })
        ?.response?.data?.error?.details?.reason;
      const friendly = describeServerReason(status === 429 ? 'rate_limit' : reason);
      reportFailure({
        kind: 'support_submit',
        reason: reason || code || 'unknown',
        context: { hasImages: createFiles.length > 0, fileCount: createFiles.length },
      });
      setSubmitError(
        friendly
          ? friendly
          : t('support.submitError', {
              defaultValue: `Erro ao enviar ticket. Tente novamente em instantes.`,
            }) + ` [${code}${reason ? `:${reason}` : ''}]`,
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function sendReply() {
    if (!selected) return;
    setFileError('');
    setSubmitError('');
    const err = validateFiles(replyFiles, t);
    if (err) { setFileError(err); return; }
    if (!reply.trim() && replyFiles.length === 0) return;
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('body', reply.trim());
      for (const file of replyFiles) {
        const mime = resolveImageMime(file);
        form.append('images', mime && file.type !== mime ? new File([file], file.name, { type: mime }) : file);
      }
      await apiClient.post(`/api/support/tickets/${selected.id}/messages`, form);
      setReply('');
      setReplyFiles([]);
      await openTicket(selected.id);
    } catch (err) {
      const code = extractErrorCode(err);
      const status = (err as { response?: { status?: number } })?.response?.status;
      const reason = (err as { response?: { data?: { error?: { details?: { reason?: string } } } } })
        ?.response?.data?.error?.details?.reason;
      const friendly = describeServerReason(status === 429 ? 'rate_limit' : reason);
      reportFailure({
        kind: 'support_upload',
        reason: reason || code || 'unknown',
        context: { hasImages: replyFiles.length > 0, fileCount: replyFiles.length },
      });
      setSubmitError(friendly ?? `Erro ao enviar mensagem [${code}${reason ? `:${reason}` : ''}]`);
    } finally {
      setSubmitting(false);
    }
  }

  // ── LIST VIEW ──────────────────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <PageContentShell>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <PageHero
            title={<><i className="bi bi-chat-fill" aria-hidden /> {t('support.title', { defaultValue: 'Suporte' })}</>}
            subtitle="Abra tickets e acompanhe suas solicitações"
            titleColor="var(--green)"
            align="left"
          />
          <button
            type="button"
            onClick={() => { setCreateFiles([]); setFileError(''); setView('create'); }}
            className="pixel-btn pixel-btn-green pixel-btn-md shrink-0"
          >
            + {t('support.newTicket', { defaultValue: 'Novo ticket' })}
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="pixel-card pixel-card-fluid h-20 animate-pulse" />
            ))}
          </div>
        ) : loadError ? (
          <div className="pixel-card pixel-card-fluid p-6 space-y-4" style={{ borderColor: 'var(--orange)' }}>
            <p className="retro-text text-base">{loadError}</p>
            <button type="button" onClick={() => void loadTickets()} className="pixel-btn pixel-btn-md">
              {t('actions.retry', { defaultValue: 'Tentar novamente' })}
            </button>
          </div>
        ) : tickets.length === 0 ? (
          <div className="pixel-card pixel-card-fluid text-center py-16 px-6">
            <p className="text-4xl mb-3"><i className="bi bi-envelope-fill" aria-hidden /></p>
            <p className="retro-text text-base sm:text-lg" style={{ color: 'var(--text-secondary)' }}>
              {t('support.empty', { defaultValue: 'Nenhum ticket ainda.' })}
            </p>
            <p className="retro-text text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
              Clique em &quot;+ Novo ticket&quot; para abrir sua primeira solicitação.
            </p>
          </div>
        ) : (
          <div className="pixel-card-stack">
            {tickets.map((ticket) => (
              <button
                key={ticket.id}
                type="button"
                onClick={() => void openTicket(ticket.id)}
                className="pixel-card pixel-card-fluid w-full min-w-0 text-left px-5 py-4 sm:px-6 sm:py-5 flex flex-wrap items-center justify-between gap-4 hover:border-[var(--green)] transition-colors"
              >
                <div className="min-w-0 space-y-1 flex-1">
                  <p className="retro-text text-base sm:text-lg font-bold truncate">{ticket.subject}</p>
                  <p className="retro-text text-sm" style={{ color: 'var(--text-muted)' }}>
                    {new Date(ticket.updatedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {ticket.hasUnreadAdminReply && (
                    <PixelBadge variant="orange">
                      {t('support.newReply', { defaultValue: 'Nova resposta' })}
                    </PixelBadge>
                  )}
                  <PixelBadge variant={STATUS_VARIANT[ticket.status] ?? 'muted'}>
                    {STATUS_LABELS[ticket.status] ?? ticket.status}
                  </PixelBadge>
                  <span className="text-xl" style={{ color: 'var(--text-muted)' }}>›</span>
                </div>
              </button>
            ))}
          </div>
        )}

        <Link to="/club" className="retro-text text-sm block mt-4" style={{ color: 'var(--text-muted)' }}>
          ← {t('nav.myClub')}
        </Link>
      </PageContentShell>
    );
  }

  // ── CREATE VIEW ────────────────────────────────────────────────────────────
  if (view === 'create') {
    return (
      <PageContentShell>
        <div className="flex flex-wrap items-center gap-4">
          <button type="button" onClick={() => setView('list')} className="pixel-btn pixel-btn-md shrink-0">
            ← {t('actions.back', { defaultValue: 'Voltar' })}
          </button>
          <h1 className="pixel-text text-xl sm:text-2xl" style={{ color: 'var(--green)' }}>
            {t('support.newTicket', { defaultValue: 'Novo ticket' })}
          </h1>
        </div>

        <form onSubmit={(e) => void createTicket(e)} className="pixel-card pixel-card-fluid p-6 sm:p-8 space-y-6">
          <div>
            <label className="block text-sm sm:text-base font-semibold text-slate-300 mb-2">
              {t('support.subject', { defaultValue: 'Assunto' })} *
            </label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t('support.subject', { defaultValue: 'Assunto' })}
              required
              minLength={3}
              maxLength={200}
              className="pixel-input w-full text-base"
            />
          </div>

          <div>
            <label className="block text-sm sm:text-base font-semibold text-slate-300 mb-2">
              {t('support.category', { defaultValue: 'Categoria' })}
            </label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="pixel-input w-full text-base">
              {[
                ['general', 'Geral'],
                ['wallet', 'Carteira / Depósito'],
                ['account', 'Conta'],
                ['gameplay', 'Gameplay'],
                ['other', 'Outro'],
              ].map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm sm:text-base font-semibold text-slate-300 mb-2">
              {t('support.message', { defaultValue: 'Mensagem' })}
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('support.message', { defaultValue: 'Descreva seu problema detalhadamente' })}
              rows={6}
              maxLength={5000}
              className="pixel-input w-full text-base"
            />
          </div>

          <div>
            <label className="block text-sm sm:text-base font-semibold text-slate-300 mb-3">
              {t('support.attachPhoto', { defaultValue: `Fotos (opcional, máx. ${MAX_PHOTOS})`, max: MAX_PHOTOS })}
            </label>
            <p className="retro-text text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
              PNG, JPEG ou WEBP · máx. {MAX_PHOTOS} fotos · até {Math.floor(MAX_BYTES / (1024 * 1024))} MB cada.
              Fotos do iPhone (HEIC) não são suportadas — use &quot;Mais Compatível&quot; nas configurações da câmera.
            </p>
            <label className="block cursor-pointer">
              <span className="pixel-btn pixel-btn-md inline-block">
                <i className="bi bi-camera-fill" aria-hidden /> {t('support.choosePhoto', { defaultValue: 'Escolher fotos' })}
              </span>
              <input
                type="file"
                accept={ACCEPT}
                multiple
                className="sr-only"
                onChange={(e) => handleFileChange(e.target.files, 'create')}
              />
            </label>
            {createPreviews.length > 0 && (
              <div className="flex flex-wrap gap-3 mt-4">
                {createPreviews.map(({ file, url }) => (
                  <div key={url} className="relative">
                    <img src={url} alt={file.name} className="h-24 w-24 object-cover border border-slate-600 rounded-xl" />
                    <button
                      type="button"
                      onClick={() => setCreateFiles((prev) => prev.filter((f) => f !== file))}
                      className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-red-600 text-white text-xs flex items-center justify-center"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {fileError && <p className="text-sm sm:text-base text-orange-300">{fileError}</p>}
          {submitError && <p className="text-sm sm:text-base text-orange-300">{submitError}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="pixel-btn pixel-btn-green pixel-btn-md w-full text-base"
          >
            {submitting ? '…' : t('support.submit', { defaultValue: 'Enviar ticket' })}
          </button>
        </form>
      </PageContentShell>
    );
  }

  // ── DETAIL VIEW ────────────────────────────────────────────────────────────
  return (
    <PageContentShell className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => { setView('list'); setSelected(null); }}
          className="pixel-btn pixel-btn-md shrink-0"
        >
          ←
        </button>
        <div className="min-w-0 flex-1">
          <p className="retro-text text-base sm:text-lg font-bold truncate">{selected?.subject}</p>
          <p className="retro-text text-sm" style={{ color: 'var(--text-muted)' }}>
            {selected?.status ? (STATUS_LABELS[selected.status] ?? selected.status) : ''} · {selected?.category}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div
        className="pixel-card pixel-card-fluid p-4 sm:p-6 overflow-y-auto space-y-4 w-full min-w-0"
        style={{ maxHeight: '55vh' }}
      >
        {selected?.messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.authorType === 'admin' ? 'justify-start' : 'justify-end'}`}
          >
            <div
              className={`max-w-[85%] min-w-0 pixel-box-light px-4 py-3 space-y-2 ${
                m.authorType === 'admin' ? 'border-[var(--green)]' : 'border-[var(--blue)]'
              }`}
            >
              <p className="retro-text text-xs" style={{ color: 'var(--text-muted)' }}>
                {m.authorType === 'admin' ? 'Suporte' : 'Você'} · {new Date(m.createdAt).toLocaleString('pt-BR')}
              </p>
              {m.body && <p className="retro-text text-sm sm:text-base whitespace-pre-wrap break-words">{m.body}</p>}
              {m.attachments?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {m.attachments.map((att) => (
                    <SupportAttachmentImage key={att.id} attachmentId={att.id} variant="user" />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply area */}
      {selected?.status !== 'closed' && (
        <div className="pixel-card pixel-card-fluid p-4 sm:p-6 space-y-4 w-full min-w-0">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={4}
            className="pixel-input w-full text-base"
            placeholder={t('support.reply', { defaultValue: 'Escreva sua resposta…' })}
          />

          <div className="flex items-center gap-3 flex-wrap">
            <label className="cursor-pointer">
              <span className="pixel-btn pixel-btn-sm inline-block">
                <i className="bi bi-camera-fill" aria-hidden /> {replyFiles.length > 0 ? `${replyFiles.length} foto(s)` : t('support.addPhoto', { defaultValue: 'Foto' })}
              </span>
              <input
                type="file"
                accept={ACCEPT}
                multiple
                className="sr-only"
                onChange={(e) => handleFileChange(e.target.files, 'reply')}
              />
            </label>

            <button
              type="button"
              disabled={submitting || (!reply.trim() && replyFiles.length === 0)}
              onClick={() => void sendReply()}
              className="pixel-btn pixel-btn-green pixel-btn-md ml-auto"
            >
              {submitting ? '…' : t('support.send', { defaultValue: 'Enviar' })}
            </button>
          </div>

          {replyPreviews.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {replyPreviews.map(({ file, url }) => (
                <div key={url} className="relative">
                  <img src={url} alt={file.name} className="h-20 w-20 object-cover border border-slate-600 rounded-xl" />
                  <button
                    type="button"
                    onClick={() => setReplyFiles((prev) => prev.filter((f) => f !== file))}
                    className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-red-600 text-white text-xs flex items-center justify-center"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {fileError && <p className="text-sm text-orange-300">{fileError}</p>}
          {submitError && <p className="text-sm text-orange-300">{submitError}</p>}
        </div>
      )}

      {selected?.status === 'closed' && (
        <div className="pixel-card pixel-card-fluid p-5 text-center w-full min-w-0">
          <p className="retro-text text-base" style={{ color: 'var(--text-muted)' }}>
            {t('support.closed', { defaultValue: 'Este ticket está fechado.' })}
          </p>
        </div>
      )}
    </PageContentShell>
  );
}
