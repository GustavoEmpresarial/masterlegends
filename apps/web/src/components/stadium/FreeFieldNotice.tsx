import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { FreeFieldWindowDTO } from '@mll/shared';

export function formatFreeFieldRemain(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}min`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function freeFieldRemainMs(iso: string | null | undefined, now = Date.now()): number {
  if (!iso) return 0;
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return 0;
  return Math.max(0, at - now);
}

export function FreeFieldNotice({
  players = [],
  onExpire,
  compact = false,
}: {
  players?: Array<{ name?: string | null; id?: string; freeField?: FreeFieldWindowDTO | null } | null>;
  onExpire?: () => void;
  /** Live widget: show the clock only while an unstaked player is on the pitch. */
  compact?: boolean;
}) {
  const { t } = useTranslation('club');
  const [now, setNow] = useState(() => Date.now());
  const playing = players.filter((player) => player?.freeField?.state === 'playing');

  useEffect(() => {
    if (playing.length === 0) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [playing.length]);

  const nextEnd = playing.reduce<number | null>((soonest, player) => {
    const at = Date.parse(player?.freeField?.playEndsAt ?? '');
    if (!Number.isFinite(at)) return soonest;
    return soonest == null ? at : Math.min(soonest, at);
  }, null);

  useEffect(() => {
    if (nextEnd == null || !onExpire) return;
    const delay = Math.max(0, nextEnd - Date.now()) + 400;
    const timer = window.setTimeout(onExpire, delay);
    return () => window.clearTimeout(timer);
  }, [nextEnd, onExpire]);

  if (compact && playing.length === 0) return null;

  return (
    <section
      className="pixel-card space-y-3"
      style={{ borderColor: 'var(--gold)', background: 'rgba(255, 196, 0, 0.08)' }}
    >
      <h2 className="pixel-text text-lg sm:text-2xl" style={{ color: 'var(--gold)' }}>
        {t('freeField.title')}
      </h2>
      {compact ? null : (
        <p className="retro-text text-sm sm:text-base" style={{ color: '#fff' }}>
          {t('freeField.body')}
        </p>
      )}
      {playing.map((player) => {
        if (!player?.freeField) return null;
        const left = formatFreeFieldRemain(freeFieldRemainMs(player.freeField.playEndsAt, now));
        return (
          <p key={player.id ?? player.name ?? left} className="pixel-text text-xl sm:text-3xl" style={{ color: 'var(--green)' }}>
            {t('freeField.playing', { name: player.name?.trim() || t('freeField.player'), time: left })}
          </p>
        );
      })}
    </section>
  );
}

export function FreeFieldAssignDialog({
  playerName,
  pending = false,
  onCancel,
  onConfirm,
}: {
  playerName: string;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation('club');
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, pending]);

  return createPortal(
    <div
      className="fixed inset-x-0 bottom-0 z-[97] flex items-center justify-center overflow-y-auto p-4"
      style={{ top: 'var(--app-header-h)', background: 'rgba(0,0,0,0.72)' }}
      role="presentation"
      onClick={() => {
        if (!pending) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="free-field-title"
        className="pixel-card w-full max-w-xl max-h-full overflow-y-auto space-y-4 p-6 sm:p-8"
        style={{ borderColor: 'var(--gold)', background: '#12181f' }}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="free-field-title" className="pixel-text text-xl sm:text-3xl" style={{ color: 'var(--gold)' }}>
          {t('freeField.confirmTitle')}
        </h2>
        <p className="retro-text text-base sm:text-lg" style={{ color: '#fff' }}>
          {t('freeField.confirmBody', { name: playerName })}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" className="pixel-btn pixel-btn-gold pixel-btn-md flex-1" disabled={pending} onClick={onConfirm}>
            {pending ? '…' : t('freeField.confirmYes')}
          </button>
          <button type="button" className="pixel-btn pixel-btn-md flex-1" disabled={pending} onClick={onCancel}>
            {t('freeField.confirmNo')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
