import { useCallback, useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { adminClient } from '../../../lib/api/adminClient';
import { resolveUploadUrl } from '../../../lib/resolveUploadUrl';
import { AdminButton, AdminPageHeader } from '../../../components/admin/AdminTable';
import { SanitizedHtml } from '../../../lib/sanitized-html';

type Audience = 'all' | 'user';
type Format = 'plain' | 'html';

interface AdminStatus {
  smtpConfigured: boolean;
  from: string;
  eligibleUsers: number;
  dailyLimit: number;
  perMinute: number;
  sentToday: number;
  reservedToday: number;
  remainingToday: number;
}

interface BroadcastResult {
  ok: boolean;
  campaignId: string | null;
  queuedCount: number;
  reason?: string;
}

interface CampaignRow {
  id: string;
  subject: string;
  audience: string;
  targetUsername: string | null;
  queuedCount: number;
  createdByAdminId: string | null;
  createdAt: string;
}

interface ButtonRow {
  text: string;
  url: string;
}

const MAX_SUBJECT = 200;
const MAX_BODY = 10000;
const inputCls =
  'w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-sky-500/40 focus:outline-none';

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
        ok
          ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
          : 'border-white/[0.08] bg-white/[0.03] text-slate-500'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-emerald-400' : 'bg-slate-600'}`} />
      {label}
    </span>
  );
}

function wrapSelection(
  value: string,
  start: number,
  end: number,
  before: string,
  after: string,
): { next: string; selStart: number; selEnd: number } {
  const selected = value.slice(start, end) || 'texto';
  const next = value.slice(0, start) + before + selected + after + value.slice(end);
  return {
    next,
    selStart: start + before.length,
    selEnd: start + before.length + selected.length,
  };
}

function htmlToPreviewNodes(html: string): string {
  return html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&lt;b&gt;/gi, '<strong>')
    .replace(/&lt;\/b&gt;/gi, '</strong>')
    .replace(/&lt;strong&gt;/gi, '<strong>')
    .replace(/&lt;\/strong&gt;/gi, '</strong>')
    .replace(/&lt;i&gt;/gi, '<em>')
    .replace(/&lt;\/i&gt;/gi, '</em>')
    .replace(/&lt;em&gt;/gi, '<em>')
    .replace(/&lt;\/em&gt;/gi, '</em>')
    .replace(/&lt;u&gt;/gi, '<u>')
    .replace(/&lt;\/u&gt;/gi, '</u>')
    .replace(/&lt;s&gt;/gi, '<s>')
    .replace(/&lt;\/s&gt;/gi, '</s>')
    .replace(/&lt;code&gt;/gi, '<code class="rounded bg-black/40 px-1">')
    .replace(/&lt;\/code&gt;/gi, '</code>')
    .replace(/&lt;br\s*\/?&gt;/gi, '<br/>')
    .replace(
      /&lt;a\s+href=&quot;(https?:\/\/[^&]+)&quot;&gt;/gi,
      '<a href="$1" class="text-[#00ff88] underline" target="_blank" rel="noreferrer">',
    )
    .replace(/&lt;\/a&gt;/gi, '</a>')
    .replace(/\n/g, '<br/>');
}

function EmailPreview({
  format,
  subject,
  body,
  imageUrl,
  buttons,
}: {
  format: Format;
  subject: string;
  body: string;
  imageUrl: string;
  buttons: ButtonRow[];
}) {
  const title = subject.trim() || 'Assunto do e-mail';
  const content = body.trim() || 'Corpo da mensagem…';
  const bodyHtml =
    format === 'html'
      ? htmlToPreviewNodes(content)
      : content
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br/>');

  const visibleButtons = buttons.filter((b) => b.text.trim() && b.url.trim());

  return (
    <div className="rounded-lg border border-white/[0.06] bg-[#0a0a0a] p-4 text-[12px] leading-relaxed text-slate-200">
      <div className="rounded-lg border border-[#2a2a2a] bg-[#111] p-5 space-y-3">
        <p className="text-[#00ff88] text-sm font-semibold">Master Legends League</p>
        <p className="text-slate-100 font-medium">{title}</p>
        <p className="text-slate-300">
          Olá, <strong>jogador</strong>,
        </p>
        {imageUrl && (
          <img
            src={resolveUploadUrl(imageUrl)}
            alt="Prévia"
            className="w-full max-h-48 object-cover rounded-lg border border-white/[0.06]"
          />
        )}
        <SanitizedHtml className="text-slate-300 break-words" html={bodyHtml} />
        {visibleButtons.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {visibleButtons.map((b, i) => (
              <span
                key={`${b.text}-${i}`}
                className="inline-flex items-center rounded-md bg-[#00ff88] px-3 py-1.5 text-[11px] font-semibold text-black"
              >
                {b.text}
              </span>
            ))}
          </div>
        )}
        <p className="pt-2 text-[11px] text-slate-600">
          Você recebeu este e-mail porque tem conta verificada na Master Legends League.
        </p>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AdminEmailPage() {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [statusError, setStatusError] = useState('');
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [audience, setAudience] = useState<Audience>('all');
  const [username, setUsername] = useState('');
  const [format, setFormat] = useState<Format>('plain');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [buttons, setButtons] = useState<ButtonRow[]>([{ text: '', url: '' }]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackOk, setFeedbackOk] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    setStatusError('');
    try {
      const [statusRes, campaignsRes] = await Promise.all([
        adminClient.get<AdminStatus>('/email/admin-status'),
        adminClient.get<{ campaigns: CampaignRow[] }>('/email/campaigns', { params: { limit: 50 } }),
      ]);
      setStatus(statusRes.data);
      setCampaigns(campaignsRes.data.campaigns);
    } catch (err: unknown) {
      setStatusError(err instanceof Error ? err.message : 'Falha ao carregar status.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const canSend =
    subject.trim().length > 0 &&
    body.trim().length > 0 &&
    (audience === 'all' || username.trim().length > 0) &&
    !busy &&
    !uploading;

  function applyWrap(before: string, after: string) {
    const el = taRef.current;
    if (!el) {
      setBody((t) => `${t}${before}texto${after}`.slice(0, MAX_BODY));
      return;
    }
    const { next, selStart, selEnd } = wrapSelection(
      body,
      el.selectionStart,
      el.selectionEnd,
      before,
      after,
    );
    setBody(next.slice(0, MAX_BODY));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(selStart, Math.min(selEnd, MAX_BODY));
    });
  }

  function insertLink() {
    const el = taRef.current;
    const selected = el ? body.slice(el.selectionStart, el.selectionEnd) : '';
    const label = window.prompt('Texto do link', selected || 'Abrir site');
    if (!label) return;
    const url = window.prompt('URL (https://…)', 'https://masterlegends.online');
    if (!url || !/^https?:\/\//i.test(url)) {
      setFeedback('URL inválida. Use https://…');
      setFeedbackOk(false);
      return;
    }
    if (!el) {
      setBody((t) => `${t}<a href="${url}">${label}</a>`.slice(0, MAX_BODY));
      setFormat('html');
      return;
    }
    const s = el.selectionStart;
    const e = el.selectionEnd;
    const insert = `<a href="${url}">${label}</a>`;
    setBody((body.slice(0, s) + insert + body.slice(e)).slice(0, MAX_BODY));
    setFormat('html');
    requestAnimationFrame(() => {
      el.focus();
      const pos = Math.min(s + insert.length, MAX_BODY);
      el.setSelectionRange(pos, pos);
    });
  }

  async function onUpload(file: File) {
    setUploading(true);
    setFeedback('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await adminClient.post<{ url: string }>('/email/upload-image', fd);
      setImageUrl(data.url);
      setFeedback('Imagem enviada. Será embutida no e-mail.');
      setFeedbackOk(true);
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : 'Falha no upload.');
      setFeedbackOk(false);
    } finally {
      setUploading(false);
    }
  }

  async function send() {
    if (!canSend) return;
    setBusy(true);
    setFeedback('');
    setFeedbackOk(null);
    try {
      const cleanButtons = buttons
        .map((b) => ({ text: b.text.trim(), url: b.url.trim() }))
        .filter((b) => b.text && b.url);

      const payload: Record<string, unknown> = {
        subject: subject.trim(),
        body: body.trim(),
        audience,
        format,
      };
      if (audience === 'user') payload.username = username.trim().replace(/^@/, '');
      if (imageUrl.trim()) payload.imageUrl = imageUrl.trim();
      if (cleanButtons.length) payload.buttons = cleanButtons;

      const { data } = await adminClient.post<BroadcastResult>('/email/broadcast', payload);
      if (data.ok) {
        setFeedback(`Enfileirado ${data.queuedCount} e-mail${data.queuedCount === 1 ? '' : 's'}.`);
        setFeedbackOk(true);
        setSubject('');
        setBody('');
        void load();
      } else {
        const reason =
          data.reason === 'smtp_not_configured'
            ? 'SMTP não configurado no servidor.'
            : data.reason === 'no_recipients'
              ? 'Nenhum destinatário elegível.'
              : 'Nenhum e-mail foi enfileirado.';
        setFeedback(reason);
        setFeedbackOk(false);
      }
    } catch (err: unknown) {
      let msg = 'Falha ao enviar.';
      if (isAxiosError(err)) {
        const details = (
          err.response?.data as {
            error?: {
              code?: string;
              details?: {
                reason?: string;
                max?: number;
                eligibleUsers?: number;
                remainingToday?: number;
                requested?: number;
              };
            };
          }
        )?.error?.details;
        const code = (err.response?.data as { error?: { code?: string } })?.error?.code;
        if (details?.reason === 'audience_exceeds_quota') {
          msg = `Cota diária insuficiente: pediu ${details.requested}, restam ${details.remainingToday} hoje.`;
        } else if (details?.reason === 'audience_too_large') {
          msg = `Audiência muito grande (${details.eligibleUsers}). Máximo: ${details.max}.`;
        } else if (err.response?.status === 404 || code === 'USER_NOT_FOUND') {
          msg = 'Usuário não encontrado ou sem e-mail verificado.';
        } else if (err instanceof Error && err.message) {
          msg = err.message;
        }
      } else if (err instanceof Error) {
        msg = err.message;
      }
      setFeedback(msg);
      setFeedbackOk(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="E-mail"
        subtitle="Composer MLL: HTML, links, botões e imagem para contas com e-mail verificado."
      />

      <div className="admin-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Status</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              SMTP, destinatários e cota Hostinger (só marketing).
            </p>
          </div>
          <AdminButton size="sm" variant="ghost" onClick={() => void load()}>
            <i className="bi bi-arrow-clockwise text-xs" /> Atualizar
          </AdminButton>
        </div>

        {statusError ? (
          <p className="text-xs text-rose-400">{statusError}</p>
        ) : !status ? (
          <p className="text-xs text-slate-500">Carregando…</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <StatusPill
                ok={status.smtpConfigured}
                label={status.smtpConfigured ? 'SMTP configurado' : 'SMTP ausente'}
              />
              <StatusPill ok={Boolean(status.from)} label={status.from || 'Sem remetente'} />
              <StatusPill
                ok={status.eligibleUsers > 0}
                label={`${status.eligibleUsers} elegível${status.eligibleUsers === 1 ? '' : 'eis'}`}
              />
              <StatusPill
                ok={status.remainingToday > 0}
                label={`Restam ${status.remainingToday}/${status.dailyLimit} hoje`}
              />
              <StatusPill
                ok={status.sentToday > 0 || status.reservedToday > 0}
                label={`Enviados ${status.sentToday} · fila ${status.reservedToday}`}
              />
              <StatusPill ok label={`Máx. ${status.perMinute}/min`} />
            </div>
            {status.eligibleUsers > status.remainingToday && (
              <p className="text-xs text-amber-300/90 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2">
                Há {status.eligibleUsers} elegíveis, mas só cabem {status.remainingToday} na cota
                de hoje. Envie para usuário específico ou aguarde o reset (UTC).
              </p>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="admin-card p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Enviar</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Tags HTML: &lt;b&gt; &lt;i&gt; &lt;u&gt; &lt;a href&gt;. Imagem e botões CTA no layout MLL.
            </p>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Audiência
            </legend>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { key: 'all', label: 'Todos verificados', icon: 'bi-people' },
                  { key: 'user', label: 'Usuário específico', icon: 'bi-person' },
                ] as { key: Audience; label: string; icon: string }[]
              ).map(({ key, label, icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setAudience(key)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    audience === key
                      ? 'border-sky-500/40 bg-sky-500/10 text-sky-200'
                      : 'border-white/[0.06] bg-white/[0.02] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <i className={`bi ${icon}`} /> {label}
                </button>
              ))}
            </div>
            {audience === 'user' && (
              <input
                className={inputCls}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username do jogador"
                autoComplete="off"
              />
            )}
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Formato
            </legend>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { key: 'plain', label: 'Texto simples', icon: 'bi-type' },
                  { key: 'html', label: 'HTML rico', icon: 'bi-code-slash' },
                ] as { key: Format; label: string; icon: string }[]
              ).map(({ key, label, icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFormat(key)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    format === key
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                      : 'border-white/[0.06] bg-white/[0.02] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <i className={`bi ${icon}`} /> {label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Assunto
              </label>
              <span className="text-[10px] text-slate-600">
                {subject.length}/{MAX_SUBJECT}
              </span>
            </div>
            <input
              className={inputCls}
              value={subject}
              onChange={(e) => setSubject(e.target.value.slice(0, MAX_SUBJECT))}
              maxLength={MAX_SUBJECT}
              placeholder="Assunto do e-mail…"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Mensagem
              </label>
              <span className="text-[10px] text-slate-600">
                {body.length}/{MAX_BODY}
              </span>
            </div>

            <div className="flex flex-wrap gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] p-1.5">
              {(
                [
                  { label: 'B', title: 'Negrito', before: '<b>', after: '</b>' },
                  { label: 'I', title: 'Itálico', before: '<i>', after: '</i>' },
                  { label: 'U', title: 'Sublinhado', before: '<u>', after: '</u>' },
                  { label: 'S', title: 'Riscado', before: '<s>', after: '</s>' },
                  { label: '</>', title: 'Código', before: '<code>', after: '</code>' },
                ] as { label: string; title: string; before: string; after: string }[]
              ).map((btn) => (
                <button
                  key={btn.title}
                  type="button"
                  title={btn.title}
                  onClick={() => {
                    setFormat('html');
                    applyWrap(btn.before, btn.after);
                  }}
                  className="rounded-md px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-white/[0.06] hover:text-white"
                >
                  {btn.label}
                </button>
              ))}
              <button
                type="button"
                title="Inserir link"
                onClick={() => insertLink()}
                className="rounded-md px-2.5 py-1 text-xs font-semibold text-sky-300 hover:bg-sky-500/10"
              >
                <i className="bi bi-link-45deg" /> Link
              </button>
              <button
                type="button"
                title="Quebra de linha"
                onClick={() => {
                  setFormat('html');
                  applyWrap('<br>', '');
                }}
                className="rounded-md px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-white/[0.06]"
              >
                BR
              </button>
            </div>

            <textarea
              ref={taRef}
              className={`${inputCls} min-h-[160px] resize-y font-mono text-[13px]`}
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY))}
              maxLength={MAX_BODY}
              placeholder={
                format === 'html'
                  ? 'HTML… ex: <b>Olá</b>\n<a href="https://masterlegends.online">Abrir MLL</a>'
                  : 'Texto da campanha…'
              }
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Imagem (opcional)
            </label>
            <div className="flex flex-wrap gap-2">
              <AdminButton
                size="sm"
                variant="secondary"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                <i className="bi bi-image text-xs" /> {uploading ? 'Enviando…' : 'Upload'}
              </AdminButton>
              {imageUrl && (
                <AdminButton size="sm" variant="ghost" onClick={() => setImageUrl('')}>
                  Remover
                </AdminButton>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onUpload(f);
                e.target.value = '';
              }}
            />
            <input
              className={inputCls}
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="ou cole URL pública https://… /uploads/…"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Botões CTA (até 6)
              </label>
              <AdminButton
                size="sm"
                variant="ghost"
                disabled={buttons.length >= 6}
                onClick={() => setButtons((b) => [...b, { text: '', url: '' }])}
              >
                + botão
              </AdminButton>
            </div>
            <div className="space-y-2">
              {buttons.map((b, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_1.4fr_auto] gap-2">
                  <input
                    className={inputCls}
                    value={b.text}
                    onChange={(e) =>
                      setButtons((rows) =>
                        rows.map((r, i) => (i === idx ? { ...r, text: e.target.value } : r)),
                      )
                    }
                    placeholder="Texto"
                  />
                  <input
                    className={inputCls}
                    value={b.url}
                    onChange={(e) =>
                      setButtons((rows) =>
                        rows.map((r, i) => (i === idx ? { ...r, url: e.target.value } : r)),
                      )
                    }
                    placeholder="https://…"
                  />
                  <AdminButton
                    size="sm"
                    variant="ghost"
                    onClick={() => setButtons((rows) => rows.filter((_, i) => i !== idx))}
                  >
                    <i className="bi bi-x" />
                  </AdminButton>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <AdminButton disabled={!canSend} onClick={() => void send()}>
              <i className="bi bi-send text-xs" /> {busy ? 'Enviando…' : 'Enviar'}
            </AdminButton>
            {feedback && (
              <p className={`text-xs ${feedbackOk ? 'text-emerald-400' : 'text-rose-400'}`}>
                {feedback}
              </p>
            )}
          </div>
        </div>

        <div className="admin-card p-5 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Prévia</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Espelho do e-mail (layout MLL + imagem + botões).
            </p>
          </div>
          <EmailPreview
            format={format}
            subject={subject}
            body={body}
            imageUrl={imageUrl}
            buttons={buttons}
          />
        </div>
      </div>

      <div className="admin-card p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Histórico</h2>
          <p className="text-xs text-slate-500 mt-0.5">Últimas campanhas enfileiradas.</p>
        </div>

        {campaigns.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">Nenhuma campanha ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-left text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-2 py-2 font-semibold">Quando</th>
                  <th className="px-2 py-2 font-semibold">Assunto</th>
                  <th className="px-2 py-2 font-semibold">Audiência</th>
                  <th className="px-2 py-2 font-semibold">Fila</th>
                  <th className="px-2 py-2 font-semibold">Admin</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-b border-white/[0.04] last:border-0">
                    <td className="px-2 py-2.5 text-slate-400 whitespace-nowrap text-xs">
                      {formatDate(c.createdAt)}
                    </td>
                    <td className="px-2 py-2.5 text-slate-200 max-w-[220px] truncate">{c.subject}</td>
                    <td className="px-2 py-2.5 text-slate-400 text-xs">
                      {c.audience === 'user'
                        ? `@${c.targetUsername ?? '—'}`
                        : 'Todos verificados'}
                    </td>
                    <td className="px-2 py-2.5 text-slate-300">{c.queuedCount}</td>
                    <td className="px-2 py-2.5 text-slate-500 text-xs">{c.createdByAdminId ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
