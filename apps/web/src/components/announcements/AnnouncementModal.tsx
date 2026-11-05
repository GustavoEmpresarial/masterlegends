import { useEffect, useState } from 'react';
import type { SiteAnnouncementDTO } from '@mll/shared';
import { apiClient } from '../../lib/api/client';
import { useAuth } from '../../hooks/useAuth';

const LOCK_SECONDS = 5;

export function AnnouncementModal() {
  const { isAuthenticated } = useAuth();
  const [announcement, setAnnouncement] = useState<SiteAnnouncementDTO | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(LOCK_SECONDS);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) return;
    void apiClient
      .get<{ announcement: SiteAnnouncementDTO | null }>('/api/announcements/active')
      .then((res) => {
        const next = res.data.announcement;
        if (next) {
          const key = `mll:announcement:${next.id}`;
          if (sessionStorage.getItem(key)) {
            setAnnouncement(null);
            return;
          }
          setAnnouncement(next);
          setSecondsLeft(LOCK_SECONDS);
        } else {
          setAnnouncement(null);
        }
      })
      .catch(() => {});
  }, [isAuthenticated, reloadKey]);

  useEffect(() => {
    if (!announcement) return;
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [announcement, secondsLeft]);

  if (!announcement) return null;

  async function handleDismiss() {
    if (!announcement) return;
    if (announcement.dismissible) {
      try {
        await apiClient.post(`/api/announcements/${announcement.id}/dismiss`, {});
      } catch {
        /* ignore */
      }
    }
    sessionStorage.setItem(`mll:announcement:${announcement.id}`, '1');
    setAnnouncement(null);
    setReloadKey((k) => k + 1);
  }

  const locked = secondsLeft > 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80">
      <div className="pixel-card max-w-md w-full p-6 space-y-4" style={{ borderColor: 'var(--gold)' }}>
        <h2 className="ui-label text-green">{announcement.title}</h2>
        <p className="retro-text text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
          {announcement.body}
        </p>
        <button
          type="button"
          onClick={() => void handleDismiss()}
          disabled={locked}
          className="pixel-btn pixel-btn-green pixel-btn-md w-full"
          style={locked ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
        >
          {locked ? `OK (${secondsLeft}s)` : announcement.dismissible ? 'OK' : 'Close'}
        </button>
      </div>
    </div>
  );
}
