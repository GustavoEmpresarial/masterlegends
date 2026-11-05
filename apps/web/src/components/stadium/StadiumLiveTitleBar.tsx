import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/** Fechar, minimizar e fixar — só no app desktop. */
export function StadiumLiveTitleBar() {
  const { t } = useTranslation('club');
  const shell = window.mllStadiumLive;
  const [pinned, setPinned] = useState(false);
  if (!shell?.isWidgetShell) return null;

  return (
    <header className="stadium-titlebar">
      <div className="stadium-titlebar-brand">
        <span className="stadium-titlebar-dot" aria-hidden />
        <span className="stadium-titlebar-mark pixel-text">MLL</span>
      </div>
      <p className="stadium-titlebar-title retro-text">{t('stadium.titlebar')}</p>
      <div className="stadium-titlebar-controls">
        <button
          type="button"
          className="stadium-titlebar-btn retro-text"
          title={t('stadium.titleMin')}
          onClick={() => void shell.minimize?.()}
        >
          {t('stadium.titleMin')}
        </button>
        <button
          type="button"
          className={`stadium-titlebar-btn retro-text${pinned ? ' is-on' : ''}`}
          title={t('stadium.livePinHint')}
          aria-pressed={pinned}
          onClick={() => {
            void shell.toggleAlwaysOnTop?.().then((on) => setPinned(!!on));
          }}
        >
          {t('stadium.livePin')}
        </button>
        <button
          type="button"
          className="stadium-titlebar-btn stadium-titlebar-btn-close retro-text"
          title={t('stadium.titleClose')}
          onClick={() => void shell.close?.()}
        >
          {t('stadium.titleClose')}
        </button>
      </div>
    </header>
  );
}
