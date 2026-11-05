import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useClub, useStadiumView } from '../../../hooks/useApi';
import { StadiumMatchCanvas } from '../../../components/stadium/StadiumMatchCanvas';
import { StadiumIncomeNotice } from '../../../components/stadium/StadiumIncomeNotice';
import { FreeFieldNotice } from '../../../components/stadium/FreeFieldNotice';
import { PlayerCardModal } from '../../../components/stadium/PlayerCardModal';
import { useStadiumIncomeWatch } from '../../../hooks/useStadiumIncomeWatch';
import {
  STADIUM_LIVE_DOWNLOADS,
  stadiumLiveDownloadUrl,
} from '../../../lib/stadiumLiveDownloads';
import { buildRivalSlots, type LineupPlayerDTO } from '@mll/shared';

export function StadiumPage() {
  const { t } = useTranslation(['club', 'common']);
  const stadiumOnline = useStadiumIncomeWatch();
  const { data: club, isLoading: clubLoading } = useClub();
  const { data: view, isLoading: viewLoading, refetch } = useStadiumView();
  const [selected, setSelected] = useState<LineupPlayerDTO | null>(null);

  if (clubLoading || viewLoading) {
    return (
      <div className="pixel-card text-center py-16">
        <p className="retro-text text-xl" style={{ color: 'var(--text-muted)' }}>
          {t('common:labels.status.loading')}
        </p>
      </div>
    );
  }

  if (!club) {
    return (
      <div className="pixel-card text-center py-12">
        <p className="retro-text mb-4">{t('club:create.subtitle')}</p>
        <Link to="/club" className="pixel-btn pixel-btn-green pixel-btn-md">
          {t('club:create.title')}
        </Link>
      </div>
    );
  }

  const imageUrl = view?.template.imageUrl ?? '';

  const handleSelectPlayer = (slotId: string) => {
    const slotView =
      view?.slots.find((s) => s.slot.id === slotId) ??
      view?.opponents?.find((s) => s.slot.id === slotId);
    if (slotView?.player) setSelected(slotView.player);
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      {imageUrl && view && (
        <div className="w-full">
          <StadiumMatchCanvas
            imageUrl={imageUrl}
            slots={view.slots.filter(item => item.slot.side !== 'away' && !String(item.slot.id).startsWith('rival-'))}
            opponents={buildRivalSlots()}
            onSelectPlayer={handleSelectPlayer}
          />
        </div>
      )}
      <FreeFieldNotice
        players={view?.slots.map((item) => item.player) ?? []}
        onExpire={() => {
          void refetch();
        }}
      />
      <StadiumIncomeNotice online={stadiumOnline} />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="pixel-card space-y-3"
        style={{ borderColor: 'rgba(52,211,153,0.35)' }}
      >
        <div>
          <h2 className="pixel-text text-sm sm:text-base" style={{ color: 'var(--green)' }}>
            <i className="bi bi-download" aria-hidden /> {t('club:stadium.installTitle')}
          </h2>
          <p className="retro-text mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            {t('club:stadium.installSubtitle')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {STADIUM_LIVE_DOWNLOADS.map((item) => (
            <a
              key={item.id}
              href={stadiumLiveDownloadUrl(item.file)}
              download={item.file}
              className="pixel-btn pixel-btn-md"
              title={t(item.hintKey)}
            >
              <i className={item.icon} aria-hidden /> {t(item.labelKey)}
            </a>
          ))}
        </div>
      </motion.div>

      <PlayerCardModal player={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
