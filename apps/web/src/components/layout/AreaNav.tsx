import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePassProgress } from '../../hooks/useApi';
import { playUiBlip } from '../../lib/audioPref';
import { PixelGlyph } from './PixelGlyph';
import { PRIMARY_AREAS } from './primaryAreas';
import './areaNavSkin.css';

export function AreaNav({ placement }: { placement: 'side' | 'bottom' }) {
  const { pathname } = useLocation();
  const { t } = useTranslation('common');
  const { data: pass } = usePassProgress();
  const seasonPath = pass?.active ? '/pass' : '/ranking';

  return (
    <nav
      className={placement === 'side' ? 'area-nav area-nav--side' : 'area-nav area-nav--bottom'}
      aria-label={t('nav.menu', { defaultValue: 'MENU' })}
    >
      {PRIMARY_AREAS.map((area) => {
        const href = area.id === 'temporada' ? seasonPath : area.path;
        const active = area.match(pathname);
        return (
          <Link
            key={area.id}
            to={href}
            data-nav-area={area.id}
            className={`area-nav__btn${active ? ' is-active' : ''}`}
            aria-current={active ? 'page' : undefined}
            onClick={() => playUiBlip()}
          >
              <span className="area-nav__icon-frame">
              <PixelGlyph name={area.icon} size={placement === 'side' ? 36 : 22} />
            </span>
            <span className="area-nav__label">{t(area.labelKey, { defaultValue: area.defaultLabel })}</span>
          </Link>
        );
      })}
    </nav>
  );
}
