import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { ClubRankingProfileDTO } from '@mll/shared';
import { RankingFieldCanvas } from './RankingFieldCanvas';

const MEDAL: Record<number, string> = { 1: 'bi-trophy-fill', 2: 'bi-award-fill', 3: 'bi-award-fill' };

interface RankingClubModalProps {
  profile: ClubRankingProfileDTO | undefined;
  isLoading: boolean;
  onClose: () => void;
}

export function RankingClubModal({ profile, isLoading, onClose }: RankingClubModalProps) {
  const { t } = useTranslation(['common', 'club']);

  const stats = profile
    ? [
        {
          label: t('ranking.totalOverwall'),
          value: profile.totalOverwall.toLocaleString(),
          icon: '⭐',
          accent: 'var(--gold)',
        },
        {
          label: t('ranking.playerCount'),
          value: String(profile.playerCount),
          icon: 'bi-people-fill',
          accent: 'var(--blue)',
        },
        {
          label: t('club:buildings.stadium.name'),
          value: `Lv ${profile.stadiumLvl}`,
          icon: 'bi-building',
          accent: 'var(--green)',
        },
      ]
    : [];

  const modal = (
    <AnimatePresence>
      <motion.div
        key="ranking-club-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-x-0 bottom-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/80 p-2 sm:p-3"
        style={{ top: 'var(--app-header-h)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 20 }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          className="pixel-card relative my-auto w-full max-w-[96vw] xl:max-w-[1400px] overflow-hidden"
          style={{
            borderColor: 'var(--gold)',
            maxHeight: 'calc(100vh - var(--app-header-h) - 1rem)',
            width: 'min(96vw, 1400px)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            className="pixel-btn pixel-btn-sm absolute right-3 top-3 z-20 shrink-0"
            style={{ background: 'var(--bg-light)', borderColor: 'var(--bg-lighter)' }}
            aria-label={t('common:actions.close')}
          >
            <i className="bi bi-x-lg" aria-hidden />
          </button>

          {isLoading && (
            <p className="retro-text p-8 text-center text-lg" style={{ color: 'var(--text-muted)' }}>
              {t('common:actions.loading')}
            </p>
          )}

          {profile && (
            <div className="flex flex-col lg:flex-row lg:items-stretch min-h-0">
              {/* ── Left: club info ── */}
              <aside
                className="flex w-full shrink-0 flex-col gap-5 border-b p-4 pr-12 sm:p-5 lg:w-[260px] xl:w-[300px] lg:border-b-0 lg:border-r lg:pr-5"
                style={{ borderColor: 'color-mix(in srgb, var(--gold) 28%, transparent)' }}
              >
                <div>
                  <p className="ui-label-sm mb-2" style={{ color: 'var(--text-muted)' }}>
                    {profile.rank <= 3
                      ? <><i className={`bi ${MEDAL[profile.rank]}`} aria-hidden /> {t('ranking.positionShort', { rank: profile.rank })}</>
                      : t('ranking.position', { rank: profile.rank })}
                  </p>
                  <h2
                    className="pixel-text text-xl sm:text-2xl leading-tight break-words"
                    style={{ color: 'var(--gold)', textShadow: '0 0 18px color-mix(in srgb, var(--gold) 45%, transparent)' }}
                  >
                    {profile.clubName}
                  </h2>
                  <p className="retro-text mt-2 text-base" style={{ color: 'var(--text-secondary)' }}>
                    @{profile.username}
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  {stats.map((stat) => (
                    <div
                      key={stat.label}
                      className="pixel-box flex items-center gap-3 px-3 py-2.5"
                      style={{
                        borderColor: `color-mix(in srgb, ${stat.accent} 45%, var(--bg-lighter))`,
                        background: `color-mix(in srgb, ${stat.accent} 8%, transparent)`,
                      }}
                    >
                      <i className={`bi ${stat.icon} text-lg leading-none`} aria-hidden />
                      <div className="min-w-0">
                        <p className="ui-label-sm" style={{ color: 'var(--text-muted)' }}>
                          {stat.label}
                        </p>
                        <p className="pixel-text text-base leading-tight" style={{ color: stat.accent }}>
                          {stat.value}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-auto hidden pt-2 lg:block">
                  {profile.stadiumName && (
                    <p className="retro-text text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                      <i className="bi bi-building" aria-hidden /> {profile.stadiumName}
                    </p>
                  )}
                  <p className="retro-text text-[11px] leading-snug" style={{ color: 'var(--text-muted)' }}>
                    {t('ranking.fieldHint', {
                      defaultValue: 'Escalação titular montada no estádio do clube.',
                    })}
                  </p>
                </div>
              </aside>

              {/* ── Right: stadium field (dominant) ── */}
              <section className="flex min-w-0 flex-1 flex-col gap-2 p-3 sm:p-4 lg:pl-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="ui-label-sm" style={{ color: 'var(--gold)' }}>
                    <i className="bi bi-building" aria-hidden /> {t('ranking.fieldTitle', { defaultValue: 'CAMPO TITULAR' })}
                  </h3>
                  {profile.stadiumName && (
                    <span className="retro-text text-xs lg:hidden" style={{ color: 'var(--text-muted)' }}>
                      {profile.stadiumName}
                    </span>
                  )}
                </div>

                {profile.stadiumImageUrl || profile.fieldSlots.length > 0 ? (
                  <div
                    className="ranking-club-field overflow-hidden rounded"
                    style={{
                      border: '2px solid color-mix(in srgb, var(--green) 55%, transparent)',
                      boxShadow:
                        '0 0 0 1px color-mix(in srgb, var(--green) 20%, transparent), 0 12px 40px rgba(0,0,0,0.45)',
                    }}
                  >
                    <RankingFieldCanvas
                      imageUrl={profile.stadiumImageUrl}
                      slots={profile.fieldSlots}
                    />
                  </div>
                ) : (
                  <p className="retro-text flex flex-1 items-center justify-center py-16 text-center" style={{ color: 'var(--text-muted)' }}>
                    {t('ranking.noPlayers')}
                  </p>
                )}

                <p className="retro-text text-center text-[11px] lg:hidden" style={{ color: 'var(--text-muted)' }}>
                  {t('ranking.fieldHint', {
                    defaultValue: 'Escalação titular montada no estádio do clube.',
                  })}
                </p>
              </section>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modal, document.body);
}
