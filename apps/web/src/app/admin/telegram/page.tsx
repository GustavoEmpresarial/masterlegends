import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { adminClient } from '../../../lib/api/adminClient';
import { resolveUploadUrl } from '../../../lib/resolveUploadUrl';
import { AdminButton, AdminPageHeader } from '../../../components/admin/AdminTable';

type Target = 'dm' | 'global' | 'both';
type DmMode = 'all' | 'user';
type Format = 'card' | 'html';

interface AdminStatus {
  enabled: boolean;
  botUsername: string | null;
  globalConfigured: boolean;
  globalThreadId: number | null;
  linkedUsers: number;
}

interface BroadcastResult {
  ok: boolean;
  globalSent: boolean;
  dmSent: number;
  reason?: string;
}

interface ButtonRow {
  text: string;
  url: string;
}

const MAX_TEXT_CARD = 900;
const MAX_TEXT_HTML = 3500;
const MAX_TEXT_PHOTO = 1024;

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
      '<a href="$1" class="text-sky-400 underline" target="_blank" rel="noreferrer">',
    )
    .replace(/&lt;\/a&gt;/gi, '</a>')
    .replace(/\n/g, '<br/>');
}

function MessagePreview({
  format,
  title,
  text,
  photoUrl,
  buttons,
}: {
  format: Format;
  title: string;
  text: string;
  photoUrl: string;
  buttons: ButtonRow[];
}) {
  const body = text.trim() || 'Seu comunicado aparece aqui…';
  const heading = title.trim() || 'Comunicado';
  const previewHtml =
    format === 'html'
      ? htmlToPreviewNodes(body)
      : htmlToPreviewNodes(
          [
            '╔════════════════════╗',
            '║  ⚡ <b>MLL · GENESIS DAO</b>',
            '╠════════════════════╣',
            `║  📣 <b>${heading.toUpperCase()}</b>`,
            '╚════════════════════╝',
            '',
            body,
            '',
            '────────────────────',
            '<i>Master Legends League · Genesis DAO</i>',
          ].join('\n'),
        );

  const visibleButtons =
    buttons.filter((b) => b.text.trim() && b.url.trim()).length > 0
      ? buttons.filter((b) => b.text.trim() && b.url.trim())
      : [{ text: 'Abrir MLL', url: 'https://masterlegends.online' }];

  return (
    <div className="rounded-lg border border-white/[0.06] bg-[#0e1621] p-4 space-y-3">
      {photoUrl && (
        <img
          src={resolveUploadUrl(photoUrl)}
          alt="Prévia"
          className="w-full max-h-48 object-cover rounded-lg border border-white/[0.06]"
        />
      )}
      <div
        className="font-mono text-[12px] leading-relaxed text-slate-200 break-words"
        dangerouslySetInnerHTML={{ __html: previewHtml }}
      />
      <div className="flex flex-wrap gap-2 pt-1">
        {visibleButtons.map((b, i) => (
          <span
            key={`${b.text}-${i}`}
            className="inline-flex items-center rounded-md border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-[11px] text-sky-200"
          >
            {b.text}
          </span>
        ))}
      </div>
    </div>
  );
}

export function AdminTelegramPage() {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [statusError, setStatusError] = useState('');
  const [target, setTarget] = useState<Target>('global');
  const [dmMode, setDmMode] = useState<DmMode>('all');
  const [username, setUsername] = useState('');
  const [format, setFormat] = useState<Format>('card');
  const [title, setTitle] = useState('Comunicado');
  const [text, setText] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [buttons, setButtons] = useState<ButtonRow[]>([{ text: '', url: '' }]);
  const [linkPreview, setLinkPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackOk, setFeedbackOk] = useState<boolean | null>(null);

  const maxText = useMemo(() => {
    if (photoUrl) return MAX_TEXT_PHOTO;
    return format === 'html' ? MAX_TEXT_HTML : MAX_TEXT_CARD;
  }, [format, photoUrl]);

  const loadStatus = useCallback(async () => {
    setStatusError('');
    try {
      const { data } = await adminClient.get<AdminStatus>('/telegram/admin-status');
      setStatus(data);
    } catch (err: unknown) {
      setStatusError(err instanceof Error ? err.message : 'Falha ao carregar status.');
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const needsDm = target === 'dm' || target === 'both';
  const canSend =
    text.trim().length > 0 &&
    (!needsDm || dmMode === 'all' || username.trim().length > 0) &&
    !busy &&
    !uploading;

  function applyWrap(before: string, after: string) {
    const el = taRef.current;
    if (!el) {
      setText((t) => `${t}${before}texto${after}`);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const { next, selStart, selEnd } = wrapSelection(text, start, end, before, after);
    setText(next.slice(0, maxText));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(selStart, Math.min(selEnd, maxText));
    });
  }

  function insertLink() {
    const el = taRef.current;
    const selected = el ? text.slice(el.selectionStart, el.selectionEnd) : '';
    const label = window.prompt('Texto do link', selected || 'Abrir site');
    if (!label) return;
    const url = window.prompt('URL (https://…)', 'https://masterlegends.online');
    if (!url || !/^https?:\/\//i.test(url)) {
      setFeedback('URL inválida. Use https://…');
      setFeedbackOk(false);
      return;
    }
    if (!el) {
      setText((t) => `${t}<a href="${url}">${label}</a>`.slice(0, maxText));
      return;
    }
    const s = el.selectionStart;
    const e = el.selectionEnd;
    const insert = `<a href="${url}">${label}</a>`;
    const next = (text.slice(0, s) + insert + text.slice(e)).slice(0, maxText);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = Math.min(s + insert.length, maxText);
      el.setSelectionRange(pos, pos);
    });
  }

  async function onUpload(file: File) {
    setUploading(true);
    setFeedback('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await adminClient.post<{ url: string; absoluteUrl: string }>(
        '/telegram/upload-image',
        fd,
      );
      setPhotoUrl(data.url);
      setFeedback('Imagem enviada. Será usada no sendPhoto do Telegram.');
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
        text: text.trim(),
        target,
        format,
        title: title.trim() || 'Comunicado',
        disableWebPagePreview: !linkPreview,
      };
      if (needsDm) {
        payload.dmMode = dmMode;
        if (dmMode === 'user') payload.username = username.trim().replace(/^@/, '');
      }
      if (photoUrl.trim()) payload.photoUrl = photoUrl.trim();
      if (cleanButtons.length) payload.buttons = cleanButtons;

      const { data } = await adminClient.post<BroadcastResult>('/telegram/broadcast', payload);
      if (data.ok) {
        const parts: string[] = [];
        if (data.globalSent) parts.push('canal público');
        if (data.dmSent > 0) parts.push(`${data.dmSent} DM${data.dmSent === 1 ? '' : 's'}`);
        setFeedback(`Enfileirado: ${parts.join(' + ') || 'ok'}.`);
        setFeedbackOk(true);
        setText('');
        void loadStatus();
      } else {
        const reason =
          data.reason === 'telegram_disabled'
            ? 'Bot Telegram desligado no servidor.'
            : data.reason === 'global_not_configured'
              ? 'Canal global não configurado (TELEGRAM_GLOBAL_CHAT_ID).'
              : 'Nenhuma mensagem foi enfileirada.';
        setFeedback(reason);
        setFeedbackOk(false);
      }
    } catch (err: unknown) {
      let msg = 'Falha ao enviar.';
      if (isAxiosError(err)) {
        const details = (
          err.response?.data as { error?: { code?: string; details?: { message?: string } } }
        )?.error;
        if (err.response?.status === 404 || details?.code === 'USER_NOT_FOUND') {
          msg = 'Usuário não encontrado ou sem Telegram vinculado/alertas ativos.';
        } else if (err.response?.status === 400) {
          msg = 'Dados inválidos (cheque HTML, URL da imagem ou tamanho do texto).';
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
        title="Telegram"
        subtitle="Composer MLL: HTML, links, botões e imagem para DMs, canal ou ambos."
      />

      <div className="admin-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Status</h2>
            <p className="text-xs text-slate-500 mt-0.5">Estado do bot e destinos disponíveis.</p>
          </div>
          <AdminButton size="sm" variant="ghost" onClick={() => void loadStatus()}>
            <i className="bi bi-arrow-clockwise text-xs" /> Atualizar
          </AdminButton>
        </div>

        {statusError ? (
          <p className="text-xs text-rose-400">{statusError}</p>
        ) : !status ? (
          <p className="text-xs text-slate-500">Carregando…</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <StatusPill ok={status.enabled} label={status.enabled ? 'Bot ativo' : 'Bot desligado'} />
            <StatusPill
              ok={Boolean(status.botUsername)}
              label={status.botUsername ? `@${status.botUsername}` : 'Sem @bot'}
            />
            <StatusPill
              ok={status.globalConfigured}
              label={status.globalConfigured ? 'Canal configurado' : 'Canal ausente'}
            />
            <StatusPill
              ok={Boolean(status.globalThreadId)}
              label={status.globalThreadId ? `Tópico ${status.globalThreadId}` : 'Sem tópico'}
            />
            <StatusPill
              ok={status.linkedUsers > 0}
              label={`${status.linkedUsers} DM${status.linkedUsers === 1 ? '' : 's'} elegível${status.linkedUsers === 1 ? '' : 's'}`}
            />
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="admin-card p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Enviar</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Tags HTML Telegram: &lt;b&gt; &lt;i&gt; &lt;u&gt; &lt;s&gt; &lt;code&gt; &lt;a href&gt;.
              Imagem usa sendPhoto (caption até 1024).
            </p>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Destino
            </legend>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { key: 'dm', label: 'Perfil (DM)', icon: 'bi-person' },
                  { key: 'global', label: 'Canal público', icon: 'bi-broadcast' },
                  { key: 'both', label: 'Ambos', icon: 'bi-layers' },
                ] as { key: Target; label: string; icon: string }[]
              ).map(({ key, label, icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTarget(key)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    target === key
                      ? 'border-sky-500/40 bg-sky-500/10 text-sky-200'
                      : 'border-white/[0.06] bg-white/[0.02] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <i className={`bi ${icon}`} /> {label}
                </button>
              ))}
            </div>
          </fieldset>

          {needsDm && (
            <fieldset className="space-y-2">
              <legend className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Destinatários DM
              </legend>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { key: 'all', label: 'Todos vinculados' },
                    { key: 'user', label: 'Usuário específico' },
                  ] as { key: DmMode; label: string }[]
                ).map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setDmMode(key)}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                      dmMode === key
                        ? 'border-violet-500/40 bg-violet-500/10 text-violet-200'
                        : 'border-white/[0.06] bg-white/[0.02] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {dmMode === 'user' && (
                <input
                  className={inputCls}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username do jogador"
                  autoComplete="off"
                />
              )}
            </fieldset>
          )}

          <fieldset className="space-y-2">
            <legend className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Formato
            </legend>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { key: 'card', label: 'Card MLL', icon: 'bi-postcard' },
                  { key: 'html', label: 'HTML livre', icon: 'bi-code-slash' },
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

          {format === 'card' && (
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Título do card
              </label>
              <input
                className={inputCls}
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 64))}
                maxLength={64}
                placeholder="Comunicado"
              />
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Mensagem
              </label>
              <span className="text-[10px] text-slate-600">
                {text.length}/{maxText}
                {photoUrl ? ' (caption)' : ''}
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
                  onClick={() => applyWrap(btn.before, btn.after)}
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
                title="Quebra de linha HTML"
                onClick={() => applyWrap('<br>', '')}
                className="rounded-md px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-white/[0.06]"
              >
                BR
              </button>
            </div>

            <textarea
              ref={taRef}
              className={`${inputCls} min-h-[160px] resize-y font-mono text-[13px]`}
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, maxText))}
              maxLength={maxText}
              placeholder={
                format === 'html'
                  ? 'HTML Telegram… ex: <b>Olá</b>\n<a href="https://masterlegends.online">Abrir MLL</a>'
                  : 'Texto do comunicado…'
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
              {photoUrl && (
                <AdminButton size="sm" variant="ghost" onClick={() => setPhotoUrl('')}>
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
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="ou cole URL pública https://… /uploads/…"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Botões (até 6)
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

          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={linkPreview}
              onChange={(e) => setLinkPreview(e.target.checked)}
              className="rounded border-white/20"
              disabled={Boolean(photoUrl)}
            />
            Prévia de link no Telegram (só sem imagem)
          </label>

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
              Espelho aproximado do que o bot envia (HTML + imagem + botões).
            </p>
          </div>
          <MessagePreview
            format={format}
            title={title}
            text={text}
            photoUrl={photoUrl}
            buttons={buttons}
          />
        </div>
      </div>
    </div>
  );
}
