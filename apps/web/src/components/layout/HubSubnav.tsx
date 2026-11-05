import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { playUiBlip } from '../../lib/audioPref';
import { areaById, type AreaId } from './primaryAreas';

export function HubSubnav({ area }: { area: AreaId }) {
  const spec = areaById(area);
  const items = spec.subnav;
  const { pathname } = useLocation();
  const { t } = useTranslation('common');

  if (!items?.length) return null;

  const solid = items.some((item) => item.accent);

  return (
    <div
      className={`hub-subnav${solid ? ' hub-subnav--solid' : ''}`}
      role="navigation"
      aria-label={t(spec.labelKey, { defaultValue: spec.defaultLabel })}
    >
      {items.map((item) => {
        const active = pathname === item.path || pathname.startsWith(`${item.path}/`);
        return (
          <Link
            key={item.path}
            to={item.path}
            data-tour={`sub-${item.path}`}
            className={`hub-subnav__link${item.accent ? ' hub-subnav__link--solid' : ''}${active ? ' is-active' : ''}`}
            style={item.accent ? { ['--hub-accent' as string]: item.accent } : undefined}
            aria-current={active ? 'page' : undefined}
            onClick={() => playUiBlip()}
          >
            {t(item.labelKey, { defaultValue: item.defaultLabel })}
          </Link>
        );
      })}
    </div>
  );
}
