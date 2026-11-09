import { useEffect, useState } from 'react';
import { apiClient } from '../../lib/api/client';
import { resolveUploadUrl } from '../../lib/resolveUploadUrl';
import { escapeHtml, markdownLinkHtml } from '../../lib/safeMarkdown';
import { SanitizedHtml } from '../../lib/sanitized-html';

interface Notice {
  id: string;
  title: string;
  body: string;
  category: string;
  priority: string;
  imageUrl: string | null;
  popupRepeatDaily?: boolean;
}

const STORAGE_KEY = 'mll_dismissed_popups';
export const LOGIN_POPUP_EVENT = 'mll:login-popup';

const CATEGORY_LABEL: Record<string, string> = {
  manutencao: 'Manutenção',
  evento: 'Evento',
  atualizacao: 'Atualização',
  noticia: 'Notícia',
};

function localDayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dismissKey(userId: string, notice: Notice): string {
  if (notice.popupRepeatDaily) {
    return `${userId}:${notice.id}:${localDayKey()}`;
  }
  return `${userId}:${notice.id}`;
}

function readStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

function getDismissed(): Set<string> {
  try {
    const storage = readStorage();
    if (!storage) return new Set();
    const raw = storage.getItem(STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
    const legacy = sessionStorage.getItem(STORAGE_KEY);
    if (legacy) {
      storage.setItem(STORAGE_KEY, legacy);
      sessionStorage.removeItem(STORAGE_KEY);
      return new Set(JSON.parse(legacy) as string[]);
    }
    return new Set();
  } catch {
    return new Set();
  }
}

function dismiss(key: string) {
  const set = getDismissed();
  set.add(key);
  try {
    readStorage()?.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    /* quota / private mode */
  }
}

const LINK_TOKEN = '\uE000';

/** Safe markdown for notices — bold/italic; links allowlisted (no XSS via href). */
function renderMarkdown(md: string): string {
  const links: string[] = [];
  const text = md.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label: string, href: string) => {
    const i = links.length;
    links.push(
      markdownLinkHtml(label, href).replace(
        '<a ',
        '<a style="color:#4ade80" ',
      ),
    );
    return `${LINK_TOKEN}${i}${LINK_TOKEN}`;
  });

  let html = escapeHtml(text)
    .replace(/^### (.+)$/gm, '<strong>$1</strong><br/>')
    .replace(/^## (.+)$/gm, '<strong>$1</strong><br/>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
    .replace(
      /^- (.+)$/gm,
      '<div style="display:flex;gap:0.5rem;margin:0.35rem 0"><span aria-hidden="true">•</span><span>$1</span></div>',
    )
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');

  for (let i = 0; i < links.length; i++) {
    html = html.replace(escapeHtml(`${LINK_TOKEN}${i}${LINK_TOKEN}`), links[i]!);
  }
  return html;
}

export function LoginPopup({ userId }: { userId: string }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiClient.get<{ notices: Notice[] }>('/api/notices?popup=true');
        const dismissed = getDismissed();
        const pending = res.data.notices.filter((n) => !dismissed.has(dismissKey(userId, n)));
        if (!cancelled) setNotices(pending);
      } catch {
        if (!cancelled) setNotices([]);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!ready) return;
    window.dispatchEvent(
      new CustomEvent(LOGIN_POPUP_EVENT, { detail: { ready: true, open: notices.length > 0 } }),
    );
  }, [ready, notices.length]);

  if (notices.length === 0) return null;
  const notice = notices[index];
  if (!notice) return null;

  function close() {
    dismiss(dismissKey(userId, notice));
    const remaining = notices.filter((n) => n.id !== notice.id);
    if (remaining.length > 0) {
      setNotices(remaining);
      setIndex(0);
    } else {
      setNotices([]);
    }
  }

  const categoryColors: Record<string, string> = {
    manutencao: '#f97316',
    evento: '#a855f7',
    atualizacao: '#38bdf8',
    noticia: '#4ade80',
  };
  const color = categoryColors[notice.category] ?? '#4ade80';
  const categoryLabel = CATEGORY_LABEL[notice.category] ?? notice.category;

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center p-4 sm:p-6"
      style={{ background: 'rgba(0,0,0,0.78)' }}
    >
      <div
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border bg-[#0c1219] shadow-2xl"
        style={{
          borderColor: color + '55',
          fontFamily: 'var(--font-sans)',
          letterSpacing: 'normal',
        }}
      >
        <div className="h-1.5 w-full" style={{ background: color }} />

        <div className="space-y-4 p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="rounded-full border px-3 py-1 text-xs font-semibold"
                style={{ color, borderColor: color + '55', background: color + '18' }}
              >
                {categoryLabel}
              </span>
              {notice.priority !== 'normal' && (
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    notice.priority === 'urgent'
                      ? 'border-red-700/40 bg-red-900/20 text-red-300'
                      : 'border-amber-700/40 bg-amber-900/20 text-amber-300'
                  }`}
                >
                  {notice.priority === 'urgent' ? 'Urgente' : 'Importante'}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={close}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
              aria-label="Fechar"
            >
              <i className="bi bi-x-lg" aria-hidden />
            </button>
          </div>

          {notice.imageUrl && (
            <img
              src={resolveUploadUrl(notice.imageUrl)}
              alt=""
              className="max-h-56 w-full rounded-xl object-cover sm:max-h-64"
            />
          )}

          <h2
            className="text-xl font-bold leading-snug text-white sm:text-2xl"
            style={{ fontFamily: 'inherit', letterSpacing: 'normal' }}
          >
            {notice.title}
          </h2>

          <SanitizedHtml
            className="max-h-64 overflow-y-auto pr-1 text-[15px] leading-relaxed text-slate-200 sm:max-h-72 sm:text-base"
            style={{ fontFamily: 'inherit', letterSpacing: 'normal' }}
            html={renderMarkdown(notice.body)}
          />

          {notices.length > 1 && (
            <div className="flex justify-center gap-2">
              {notices.map((_, i) => (
                <span
                  key={i}
                  className="h-2 w-2 rounded-full transition-colors"
                  style={{ background: i === index ? color : '#475569' }}
                />
              ))}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={close}
              className="rounded-lg border border-slate-600 px-6 py-2.5 text-sm font-semibold text-slate-100 transition-colors hover:bg-slate-800 sm:text-base"
            >
              {notices.length > 1 && index < notices.length - 1 ? 'Próximo →' : 'Entendi'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
