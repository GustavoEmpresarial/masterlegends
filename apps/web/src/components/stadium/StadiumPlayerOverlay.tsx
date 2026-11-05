import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { LineupPlayerDTO } from '@mll/shared';
import { PlayerCardModal } from './PlayerCardModal';

interface StadiumPlayerOverlayProps {
  open: boolean;
  player: LineupPlayerDTO | null;
  onClose: () => void;
  onRemove: () => void;
}

export function StadiumPlayerOverlay({ open, player, onClose, onRemove }: StadiumPlayerOverlayProps) {
  const { t } = useTranslation(['club', 'common']);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <>
      <PlayerCardModal
        player={open ? player : null}
        onClose={onClose}
        extraAction={
          <button
            type="button"
            onClick={() => { onRemove(); onClose(); }}
            className="pixel-btn pixel-btn-red pixel-btn-md w-full"
          >
            {t('club:stadium.removeFromField')}
          </button>
        }
      />
    </>
  );
}
