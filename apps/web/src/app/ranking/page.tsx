import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { ClubRankingEntryDTO } from '@mll/shared';
import { useClubRanking, useClubRankingProfile } from '../../hooks/useApi';
import { RankingClubModal } from '../../components/ranking/RankingClubModal';
import { SocialTab } from '../../components/social/SocialTab';
import { PageContentShell } from '../../components/content';
import { resolveUploadUrl } from '../../lib/resolveUploadUrl';

const MEDAL: Record<number, string> = { 1: 'bi-trophy-fill', 2: 'bi-award-fill', 3: 'bi-award-fill' };

type RankingTab = 'clubs' | 'social';

function filterClubs(clubs: ClubRankingEntryDTO[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return clubs;
  return clubs.filter(
    (c) => c.clubName.toLowerCase().includes(q) || c.username.toLowerCase().includes(q),
  );
}

export function RankingPage() {
  const { t } = useTranslation('common');
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get('tab') === 'social' ? 'social' : 'clubs') as RankingTab;
  const selectedClub = searchParams.get('club');
  const [search, setSearch] = useState('');

  const { data: clubsData, isLoading: clubsLoading } = useClubRanking();
  const { data: profile, isLoading: profileLoading } = useClubRankingProfile(selectedClub);

  const clubs = useMemo(
    () => filterClubs(clubsData?.clubs ?? [], search),
    [clubsData?.clubs, search],
  );

  const isLoading = clubsLoading;
  const isEmpty = clubs.length === 0;

  function setTab(next: RankingTab) {
    const params = new URLSearchParams(searchParams);
    params.set('tab', next);
    if (next === 'social') {
      if (!params.get('view')) params.set('view', 'content');
    } else {
      params.delete('view');
    }
    params.delete('club');
    setSearchParams(params, { replace: true });
  }

  function openClub(clubName: string) {
    const params = new URLSearchParams(searchParams);
    params.set('club', clubName);
    setSearchParams(params, { replace: true });
  }

  function closeClub() {
    const params = new URLSearchParams(searchParams);
    params.delete('club');
    setSearchParams(params, { replace: true });
  }

  return (
    <PageContentShell>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <h1 className="pixel-text text-xl sm:text-2xl md:text-3xl" style={{ color: 'var(--gold)' }}>
          <i className="bi bi-trophy-fill" aria-hidden /> {t('nav.ranking', { defaultValue: 'RANKING' })}
        </h1>
        <p className="retro-text text-xl mt-2" style={{ color: 'var(--text-secondary)' }}>
          {tab === 'social' ? t('social.pageSubtitle') : t('ranking.subtitle', { defaultValue: 'Top clubs by power' })}
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-2 gap-2 max-w-md mx-auto"
      >
        <button
          type="button"
          onClick={() => setTab('clubs')}
          className={`pixel-btn pixel-btn-md w-full ${tab === 'clubs' ? 'pixel-btn-gold' : ''}`}
          style={
            tab === 'clubs'
              ? undefined
              : { background: 'var(--bg-light)', borderColor: 'var(--bg-lighter)' }
          }
        >
          {t('ranking.tabs.clubs')}
        </button>
        <button
          type="button"
          onClick={() => setTab('social')}
          className={`pixel-btn pixel-btn-md w-full ${tab === 'social' ? 'pixel-btn-red' : ''}`}
          style={
            tab === 'social'
              ? undefined
              : { background: 'var(--bg-light)', borderColor: 'var(--bg-lighter)' }
          }
        >
          ▶ {t('ranking.tabs.social')}
        </button>
      </motion.div>

      {tab === 'social' ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <SocialTab />
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="pixel-card"
          style={{ borderColor: 'var(--gold)' }}
        >
          <div className="mb-4">
            <input
              type="search"
              className="pixel-input w-full"
              placeholder={t('ranking.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {isLoading && (
            <p className="retro-text text-lg text-center py-8" style={{ color: 'var(--text-muted)' }}>
              {t('actions.loading', { defaultValue: 'LOADING...' })}
            </p>
          )}

          {!isLoading && isEmpty && (
            <p className="retro-text text-lg text-center py-8" style={{ color: 'var(--text-muted)' }}>
              {search.trim()
                ? t('ranking.noResults')
                : t('ranking.empty', { defaultValue: 'No clubs ranked yet.' })}
            </p>
          )}

          {!isLoading && clubs.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--bg-lighter)' }}>
                    <th className="ui-label-sm text-left pb-3 pr-4" style={{ color: 'var(--text-muted)' }}>#</th>
                    <th className="ui-label-sm text-left pb-3 pr-4" style={{ color: 'var(--text-muted)' }}>
                      {t('ranking.columns.club')}
                    </th>
                    <th className="ui-label-sm text-left pb-3 pr-4 hidden sm:table-cell" style={{ color: 'var(--text-muted)' }}>
                      {t('ranking.columns.manager')}
                    </th>
                    <th className="ui-label-sm text-right pb-3" style={{ color: 'var(--text-muted)' }}>
                      ⭐ {t('ranking.columnOverwall')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {clubs.map((club, i) => (
                    <motion.tr
                      key={club.clubName}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.03 * i }}
                      className="cursor-pointer transition-colors hover:bg-[var(--bg-light)]"
                      style={{ borderBottom: '1px solid var(--bg-lighter)' }}
                      onClick={() => openClub(club.clubName)}
                      title={t('ranking.openClub')}
                    >
                      <td className="py-3 pr-4">
                        <span
                          className="pixel-text text-base"
                          style={{ color: club.rank <= 3 ? 'var(--gold)' : 'var(--text-muted)' }}
                        >
                          {MEDAL[club.rank] ? <i className={`bi ${MEDAL[club.rank]}`} aria-hidden /> : club.rank}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="relative h-10 w-16 shrink-0 overflow-hidden rounded"
                            style={{
                              border: '1px solid color-mix(in srgb, var(--green) 45%, transparent)',
                              background: 'var(--bg-light)',
                            }}
                            title={club.stadiumName ?? undefined}
                          >
                            {club.stadiumImageUrl ? (
                              <img
                                src={resolveUploadUrl(club.stadiumImageUrl)}
                                alt={club.stadiumName ?? ''}
                                className="h-full w-full object-cover"
                                style={{ imageRendering: 'pixelated' }}
                                loading="lazy"
                                decoding="async"
                              />
                            ) : (
                              <span
                                className="flex h-full w-full items-center justify-center text-sm"
                                style={{ color: 'var(--text-muted)' }}
                                aria-hidden
                              >
                                <i className="bi bi-building" aria-hidden />
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="ui-label-sm block truncate" style={{ color: 'var(--text-primary)' }}>
                              {club.clubName}
                            </span>
                            <span className="retro-text text-sm sm:hidden block truncate" style={{ color: 'var(--text-muted)' }}>
                              @{club.username}
                            </span>
                            {club.stadiumName && (
                              <span
                                className="retro-text hidden sm:block text-[11px] truncate mt-0.5"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                {club.stadiumName}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4 hidden sm:table-cell">
                        <span className="retro-text text-lg" style={{ color: 'var(--text-secondary)' }}>
                          @{club.username}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <span className="pixel-text text-sm" style={{ color: 'var(--gold)' }}>
                          {club.totalOverwall.toLocaleString()}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!isLoading && !isEmpty && (
            <p className="retro-text text-sm text-center mt-4" style={{ color: 'var(--text-muted)' }}>
              {t('ranking.hint')}
            </p>
          )}
        </motion.div>
      )}

      <AnimatePresence>
        {selectedClub && (
          <RankingClubModal profile={profile} isLoading={profileLoading} onClose={closeClub} />
        )}
      </AnimatePresence>
    </PageContentShell>
  );
}
