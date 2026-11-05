import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { useSocialFeed, useSocialMe } from '../../hooks/useApi';
import { SocialCreatorPanel } from './SocialCreatorPanel';
import { SocialVideoCard } from './SocialVideoCard';

type SocialView = 'content' | 'partner';

export function SocialTab() {
  const { t } = useTranslation('common');
  const [searchParams, setSearchParams] = useSearchParams();
  const view: SocialView = searchParams.get('view') === 'partner' ? 'partner' : 'content';
  const { isAuthenticated } = useAuth();
  const { data: feed, isLoading: feedLoading } = useSocialFeed();
  const { data: me, isLoading: meLoading } = useSocialMe(isAuthenticated);

  function setView(next: SocialView) {
    const params = new URLSearchParams(searchParams);
    params.set('tab', 'social');
    params.set('view', next);
    params.delete('club');
    setSearchParams(params, { replace: true });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 max-w-lg mx-auto">
        <button
          type="button"
          onClick={() => setView('content')}
          className={`pixel-btn pixel-btn-md w-full ${view === 'content' ? 'pixel-btn-red' : ''}`}
          style={
            view === 'content'
              ? undefined
              : { background: 'var(--bg-medium)', borderColor: 'var(--bg-lighter)', color: 'var(--text-primary)' }
          }
        >
          {t('social.tabs.content')}
        </button>
        <button
          type="button"
          onClick={() => setView('partner')}
          className={`pixel-btn pixel-btn-md w-full ${view === 'partner' ? 'pixel-btn-red' : ''}`}
          style={
            view === 'partner'
              ? undefined
              : { background: 'var(--bg-medium)', borderColor: 'var(--bg-lighter)', color: 'var(--text-primary)' }
          }
        >
          {t('social.tabs.partner')}
        </button>
      </div>

      {view === 'content' ? (
        <div className="pixel-card p-4 sm:p-6" style={{ borderColor: 'var(--red)', background: 'var(--bg-medium)' }}>
          <h3 className="ui-label mb-4" style={{ color: 'var(--red)' }}>
            {t('social.feedTitle')}
          </h3>
          {feedLoading && (
            <p className="retro-text text-center py-8" style={{ color: 'var(--text-muted)' }}>
              {t('actions.loading')}
            </p>
          )}
          {!feedLoading && (feed?.videos.length ?? 0) === 0 && (
            <p className="retro-text text-center py-8" style={{ color: 'var(--text-muted)' }}>
              {t('social.feedEmpty')}
            </p>
          )}
          <div className="space-y-6">
            {(feed?.videos ?? []).map((video) => (
              <SocialVideoCard key={video.id} video={video} />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div
            className="pixel-card p-4 sm:p-6"
            style={{ borderColor: 'var(--red)', background: 'var(--bg-medium)' }}
          >
            <h2 className="pixel-text text-lg mb-2" style={{ color: 'var(--red)' }}>
              ▶ {t('social.programTitle')}
            </h2>
            <p className="retro-text text-sm sm:text-base" style={{ color: 'var(--text-secondary)' }}>
              {t('social.programHint')}
            </p>
          </div>

          {isAuthenticated && (
            <>
              {meLoading && (
                <p className="retro-text text-center py-4" style={{ color: 'var(--text-muted)' }}>
                  {t('actions.loading')}
                </p>
              )}
              {me && <SocialCreatorPanel me={me} />}
            </>
          )}

          {!isAuthenticated && (
            <div
              className="pixel-card p-4 sm:p-6 text-center"
              style={{ borderColor: 'var(--gold)', background: 'var(--bg-medium)' }}
            >
              <p className="retro-text text-sm sm:text-base" style={{ color: 'var(--text-secondary)' }}>
                {t('social.loginHint')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
