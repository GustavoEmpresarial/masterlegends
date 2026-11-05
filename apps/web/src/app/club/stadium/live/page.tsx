import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { buildRivalSlots, isAwaySlot } from '@mll/shared';
import { useStadiumView } from '../../../../hooks/useApi';
import { StadiumLiveCanvas } from '../../../../components/stadium/StadiumLiveCanvas';
import { StadiumLiveTitleBar } from '../../../../components/stadium/StadiumLiveTitleBar';
import { FreeFieldNotice } from '../../../../components/stadium/FreeFieldNotice';
import { useStadiumIncomeWatch } from '../../../../hooks/useStadiumIncomeWatch';
import {
  isStadiumLiveWidget,
  markStadiumLiveWidget,
  stadiumLiveHref,
} from '../../../../lib/stadiumLiveWidget';

/** Widget Taskbar-Hero: janela só com o campo ao vivo (sem navegar o jogo). */
export function StadiumLivePage() {
  const { t } = useTranslation(['club', 'common']);
  const stadiumOnline = useStadiumIncomeWatch();
  const { data: view, isLoading, isError, refetch, isFetching } = useStadiumView();
  const widget = isStadiumLiveWidget();

  useEffect(() => {
    markStadiumLiveWidget();
    const prev = document.title;
    document.title = `LIVE · ${t('club:buildings.stadium.name')} · MLL`;
    return () => {
      document.title = prev;
    };
  }, [t]);

  if (isLoading) {
    return (
      <div className="stadium-live-shell">
      <StadiumLiveTitleBar />
      <div className="stadium-live-app flex min-h-0 flex-1 items-center justify-center bg-black">
        <p className="retro-text text-sm animate-pulse" style={{ color: 'var(--text-muted)' }}>
          {t('common:labels.status.loading')}
        </p>
      </div>
      </div>
    );
  }

  if (isError || !view) {
    return (
      <div className="stadium-live-shell">
      <StadiumLiveTitleBar />
      <div className="stadium-live-app flex min-h-0 flex-1 flex-col items-center justify-center gap-4 bg-black px-4">
        <p className="retro-text text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
          {t('club:stadium.liveUnavailable')}
        </p>
        <button
          type="button"
          className="pixel-btn pixel-btn-sm"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          {t('club:stadium.liveRetry')}
        </button>
      </div>
      </div>
    );
  }

  const starterCount = Object.keys(view.assignments).length;
  const emptyHint = widget ? t('club:stadium.noLineupHintWidget') : t('club:stadium.noLineupHint');
  const incomeTitle = stadiumOnline
    ? t('club:stadium.incomeRuleOpen')
    : t('club:stadium.incomeRuleClosed');

  return (
    <div className="stadium-live-shell">
    <StadiumLiveTitleBar />
    <div className="stadium-live-app">
      <header className="stadium-live-bar">
        <div className="stadium-live-brand">
          <span className="stadium-live-dot" aria-hidden />
          <span className="stadium-live-kicker pixel-text">LIVE</span>
          <span className="stadium-live-name retro-text">{view.template.name}</span>
          {starterCount > 0 && (
            <span className="stadium-live-count retro-text">{starterCount}</span>
          )}
        </div>

        {starterCount === 0 ? (
          <p className="stadium-live-hint retro-text" title={emptyHint}>
            {t('club:stadium.noLineupShort')}
          </p>
        ) : (
          <span className="stadium-live-hint" />
        )}

        <div className="stadium-live-actions">
          <span
            className={`stadium-live-income retro-text${stadiumOnline ? ' is-full' : ''}`}
            title={incomeTitle}
          >
            {stadiumOnline ? t('club:stadium.incomeLiveFull') : t('club:stadium.incomeLiveReduced')}
          </span>
          <button
            type="button"
            className="stadium-live-btn retro-text"
            onClick={() => void refetch()}
            disabled={isFetching}
            title={t('club:stadium.liveRefreshHint')}
          >
            {isFetching ? '…' : t('club:stadium.liveRefresh')}
          </button>
        </div>
      </header>

      <div className="px-3 pt-2">
        <FreeFieldNotice
          compact
          players={view.slots.map((item) => item.player)}
          onExpire={() => {
            void refetch();
          }}
        />
      </div>
      <div className="stadium-live-stage">
        <StadiumLiveCanvas
          imageUrl="/ui/stadiums/estadio-campo.jpg?v=1"
          backgroundType="image"
          slots={[
            ...view.slots.filter((item) => !isAwaySlot(item.slot)),
            ...buildRivalSlots(view.template.slots),
          ]}
        />
      </div>
    </div>
    </div>
  );
}

export function openStadiumLiveWidget(): void {
  const width = 720;
  const height = 480;
  const left = Math.max(0, Math.round((window.screen.availWidth - width) / 2));
  const top = Math.max(0, Math.round((window.screen.availHeight - height) / 2));
  const features = [
    'popup=yes',
    `width=${width}`,
    `height=${height}`,
    `left=${left}`,
    `top=${top}`,
    'resizable=yes',
    'scrollbars=no',
  ].join(',');

  markStadiumLiveWidget();
  const href = stadiumLiveHref(true);
  const popup = window.open(href, 'mll-stadium-live', features);
  if (!popup) {
    window.location.assign(href);
  } else {
    popup.focus();
  }
}
