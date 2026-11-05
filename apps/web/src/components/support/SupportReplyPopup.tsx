import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  NotificationType,
  SocketEvent,
  type NotificationPayload,
  type SupportTicketDTO,
} from '@mll/shared';
import { apiClient } from '../../lib/api/client';
import { useSocket } from '../../hooks/useSocket';

export interface SupportReplyNotice {
  ticketId: string;
  subject: string;
  preview: string;
}

const SESSION_DISMISS_PREFIX = 'mll_support_reply_dismissed:';

function isSessionDismissed(ticketId: string): boolean {
  try {
    return sessionStorage.getItem(`${SESSION_DISMISS_PREFIX}${ticketId}`) === '1';
  } catch {
    return false;
  }
}

function dismissSession(ticketId: string) {
  try {
    sessionStorage.setItem(`${SESSION_DISMISS_PREFIX}${ticketId}`, '1');
  } catch {
    /* private mode */
  }
}

type UnreadTicket = SupportTicketDTO & { preview?: string };

/**
 * Shows a popup on /club when support has replied — unread API on landing + socket while mounted.
 * z-[190] sits under LoginPopup (z-[200]) so login notices close first.
 */
export function SupportReplyPopup({ userId }: { userId: string }) {
  const { t } = useTranslation('common');
  const socket = useSocket();
  const navigate = useNavigate();
  const [notice, setNotice] = useState<SupportReplyNotice | null>(null);

  const showNotice = useCallback((next: SupportReplyNotice) => {
    if (!next.ticketId || isSessionDismissed(next.ticketId)) return;
    setNotice((current) => {
      if (current?.ticketId === next.ticketId) return current;
      return next;
    });
  }, []);

  // Refetch unread every time we land on /club (mount) or userId changes after login
  useEffect(() => {
    if (!userId) {
      setNotice(null);
      return;
    }
    let cancelled = false;
    void apiClient
      .get<{ tickets: UnreadTicket[] }>('/api/support/unread')
      .then((res) => {
        if (cancelled) return;
        const first = res.data.tickets.find((tk) => !isSessionDismissed(tk.id));
        if (first) {
          showNotice({
            ticketId: first.id,
            subject: first.subject,
            preview: first.preview ?? '',
          });
        }
      })
      .catch(() => {
        /* offline / transient — remount on next /club visit retries */
      });
    return () => {
      cancelled = true;
    };
  }, [userId, showNotice]);

  // Realtime while on /club
  useEffect(() => {
    if (!userId || !socket) return;

    const onNotification = (payload: NotificationPayload) => {
      if (payload.type !== NotificationType.SUPPORT_REPLIED) return;
      const data = payload.data ?? {};
      const ticketId = typeof data.ticketId === 'string' ? data.ticketId : '';
      const subject = typeof data.subject === 'string' ? data.subject : '';
      const preview = typeof data.preview === 'string' ? data.preview : '';
      if (!ticketId) return;
      showNotice({ ticketId, subject, preview });
    };

    socket.on(SocketEvent.NOTIFICATION, onNotification);
    return () => {
      socket.off(SocketEvent.NOTIFICATION, onNotification);
    };
  }, [userId, socket, showNotice]);

  if (!notice) return null;

  const handleClose = () => {
    dismissSession(notice.ticketId);
    setNotice(null);
  };

  const handleOpen = () => {
    dismissSession(notice.ticketId);
    const ticketId = notice.ticketId;
    setNotice(null);
    navigate(`/support?ticket=${encodeURIComponent(ticketId)}`);
  };

  return (
    <div className="fixed inset-0 z-[190] flex items-center justify-center p-4 bg-black/80">
      <div
        className="pixel-card max-w-md w-full p-6 space-y-4"
        style={{ borderColor: 'var(--blue)' }}
        role="dialog"
        aria-labelledby="support-reply-title"
      >
        <p className="ui-label-sm text-center" style={{ color: 'var(--text-muted)' }}>
          {t('support.replyPopup.badge', { defaultValue: 'SUPORTE' })}
        </p>
        <h2
          id="support-reply-title"
          className="pixel-text text-xl text-center"
          style={{ color: 'var(--blue)' }}
        >
          {t('support.replyPopup.title', { defaultValue: 'Suporte respondeu!' })}
        </h2>
        {notice.subject && (
          <p className="retro-text text-base text-center font-bold" style={{ color: 'var(--text-primary)' }}>
            {notice.subject}
          </p>
        )}
        {notice.preview && (
          <p
            className="retro-text text-sm text-center whitespace-pre-wrap line-clamp-4"
            style={{ color: 'var(--text-secondary)' }}
          >
            {notice.preview}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 pt-1">
          <button
            type="button"
            className="pixel-btn pixel-btn-md sm:flex-1"
            style={{ borderColor: 'var(--text-muted)', color: 'var(--text-muted)' }}
            onClick={handleClose}
          >
            {t('support.replyPopup.close', { defaultValue: 'Fechar' })}
          </button>
          <button
            type="button"
            className="pixel-btn pixel-btn-blue pixel-btn-md sm:flex-1"
            onClick={handleOpen}
          >
            {t('support.replyPopup.open', { defaultValue: 'Ver ticket' })}
          </button>
        </div>
      </div>
    </div>
  );
}
