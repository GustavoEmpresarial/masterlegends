import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useClub } from '../../../hooks/useApi';
import { PageContentShell } from '../../../components/content';
import { ClubCommandCenter } from '../../../components/club/ClubCommandCenter';
import { translateError } from '../../../lib/apiError';

export function GestaoPage() {
  const { t } = useTranslation(['club', 'common']);
  const { data: club, isLoading, isError, error, refetch } = useClub();

  if (isLoading) {
    return (
      <PageContentShell>
        <div className="pixel-card text-center py-16">
          <img src="/ui/pixel/mascot-v3.png" alt="" className="pixel-sprite mx-auto mb-4 h-44 w-32 object-contain" />
          <p className="retro-text text-xl">{t('common:actions.loading')}</p>
        </div>
      </PageContentShell>
    );
  }

  if (!isError && !club) {
    return (
      <PageContentShell>
        <div className="pixel-card text-center py-8">
          <img src="/ui/pixel/mascot-v3.png" alt="" className="pixel-sprite mx-auto mb-4 h-44 w-32 object-contain" />
          <p className="retro-text text-xl mb-4">{t('club:create.subtitle')}</p>
          <Link to="/club" className="pixel-btn pixel-btn-green pixel-btn-md">{t('club:create.title')}</Link>
        </div>
      </PageContentShell>
    );
  }

  if (isError || !club) {
    return (
      <PageContentShell>
        <div className="pixel-card text-center py-8" style={{ borderColor: 'var(--red)' }}>
          <p className="retro-text mb-4">{translateError(error, 'CLUB_LOAD_FAILED')}</p>
          <button type="button" onClick={() => void refetch()} className="pixel-btn pixel-btn-blue pixel-btn-md">
            {t('common:actions.retry', { defaultValue: 'TENTAR DE NOVO' })}
          </button>
        </div>
      </PageContentShell>
    );
  }

  return (
    <PageContentShell>
      <ClubCommandCenter club={club} />
    </PageContentShell>
  );
}
