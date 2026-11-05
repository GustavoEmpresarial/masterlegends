import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ClubData } from '../../hooks/useApi';
import { PixelGlyph, type PixelGlyphName } from '../layout/PixelGlyph';

export function ClubBuildingGrid({ club }: { club: ClubData }) {
  const { t } = useTranslation(['club', 'common']);

  const buildings: {
    key: string;
    name: string;
    description: string;
    bonus: string;
    path?: string;
    color: string;
    icon: PixelGlyphName;
  }[] = [
    {
      key: 'stadium',
      name: t('club:buildings.stadium.name'),
      description: t('club:buildings.stadium.description'),
      bonus: t('common:labels.level') + ` ${club.stadiumLvl}`,
      path: '/club/stadium',
      color: '#ffffff',
      icon: 'shield',
    },
    {
      key: 'checkin',
      name: t('common:nav.dailyPresence'),
      description: t('club:checkin.building.description'),
      bonus: t('club:checkin.building.bonus'),
      path: '/club/checkin',
      color: '#ffffff',
      icon: 'bell',
    },
    {
      key: 'office',
      name: t('common:nav.office', { defaultValue: 'ESCRITÓRIO' }),
      description: t('common:roadmap.items.office', { defaultValue: 'Staff e aflições' }),
      bonus: '',
      path: '/club/escritorio',
      color: '#ffffff',
      icon: 'gear',
    },
    {
      key: 'museum',
      name: t('common:nav.museum', { defaultValue: 'MUSEU' }),
      description: t('club:buildings.trophies.description'),
      bonus: t('club:buildings.trophies.bonus'),
      path: '/club/museum',
      color: '#ffffff',
      icon: 'trophy',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      {buildings.map((building) => {
        const card = (
          <article className="pixel-card pixel-card-fluid h-full" style={{ borderColor: '#ffffff' }}>
            <div className="flex items-start gap-3">
              <span className="pixel-box flex h-12 w-12 shrink-0 items-center justify-center" style={{ color: '#ffffff', borderColor: '#ffffff' }}>
                <PixelGlyph name={building.icon} size={40} />
              </span>
              <div className="min-w-0">
                <h3 className="score-label" style={{ color: '#ffffff' }}>{building.name}</h3>
                <p className="retro-text text-lg mt-2" style={{ color: '#ffffff' }}>{building.description}</p>
                {building.bonus ? (
                  <p className="retro-text text-base mt-2" style={{ color: '#ffffff' }}>{building.bonus}</p>
                ) : null}
              </div>
            </div>
          </article>
        );
        return building.path ? (
          <Link key={building.key} to={building.path} className="block h-full">
            {card}
          </Link>
        ) : (
          <div key={building.key} className="h-full">{card}</div>
        );
      })}
    </div>
  );
}
