import { PassPremiumPrice } from '../../components/pass/PassPremiumPrice';
import { SpendConfirmDialog } from '../../components/economy/SpendConfirmDialog';
import { resolveUploadUrl } from '../../lib/resolveUploadUrl';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { PassProgressDTO } from '@mll/shared';
import {
  usePassProgress,
  useClaimPassLevel,
  useBuyPassPremium,
  useWalletSummary,
} from '../../hooks/useApi';
import { translateError } from '../../lib/apiError';
import { PageContentShell } from '../../components/content';
import { PASS_MAINTENANCE } from './passMaintenance';

const REWARD_ICONS: Record<string, string> = {
  usdc: 'bi-cash-stack',
  player: 'bi-shield-fill',
  catalog_item: 'bi-person-badge',
  gear: 'bi-bag-fill',
  shop_item: 'bi-lightning-charge-fill',
  cosmetic: 'bi-building',
  ticket: 'bi-ticket-perforated-fill',
};

const REWARD_COLORS: Record<string, string> = {
  usdc: 'var(--gold)',
  player: 'var(--green)',
  catalog_item: 'var(--green)',
  gear: 'var(--purple)',
  shop_item: 'var(--blue)',
  cosmetic: 'var(--purple)',
  ticket: 'var(--blue)',
};

const MISSION_LABELS: Record<string, string> = {
  scout: 'pass:missionsList.scout',
  marketBuy: 'pass:missionsList.market',
  marketSell: 'pass:missionsList.marketSell',
};

const MISSION_ICONS: Record<string, string> = {
  scout: 'bi-search',
  marketBuy: 'bi-cart-fill',
  marketSell: 'bi-cash-stack',
};

function RewardTile({
  label,
  imageUrl,
  rewardType,
  claimed,
  locked,
  pending,
  claimLabel,
  lockedLabel,
  claimedLabel,
  onClaim,
}: {
  label?: string | null;
  imageUrl?: string | null;
  rewardType?: string | null;
  claimed: boolean;
  locked: boolean;
  pending: boolean;
  claimLabel: string;
  lockedLabel: string;
  claimedLabel: string;
  onClaim: () => void;
}) {
  if (!label) {
    return <div className="pixel-box-light min-h-[7.5rem] opacity-40 sm:min-h-[9rem]" />;
  }
  return (
    <div
      className="pixel-box-light flex min-h-[7.5rem] items-center gap-3 p-3 sm:min-h-[9rem] sm:gap-4 sm:p-4"
      style={{ borderColor: claimed ? 'var(--green)' : locked ? 'var(--bg-lighter)' : 'var(--gold)', opacity: locked ? 0.72 : 1 }}
    >
      <div className="flex h-20 w-20 shrink-0 items-center justify-center sm:h-28 sm:w-28">
        {imageUrl ? (
          <img src={resolveUploadUrl(imageUrl)} alt="" className="h-full w-full object-contain" />
        ) : (
          <i className={`bi ${REWARD_ICONS[rewardType ?? ''] ?? 'bi-gift-fill'} text-4xl sm:text-5xl`} style={{ color: REWARD_COLORS[rewardType ?? ''] ?? 'var(--gold)' }} aria-hidden />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
        <span className="retro-text text-base leading-snug sm:text-xl" style={{ color: REWARD_COLORS[rewardType ?? ''] ?? 'var(--text-primary)' }}>{label}</span>
        {claimed ? (
          <span className="pixel-badge text-sm" style={{ color: 'var(--green)', borderColor: 'var(--green)' }}><i className="bi bi-check-lg" aria-hidden /> {claimedLabel}</span>
        ) : locked ? (
          <span className="pixel-badge text-sm" style={{ color: 'var(--text-muted)', borderColor: 'var(--text-muted)' }}><i className="bi bi-lock-fill" aria-hidden /> {lockedLabel}</span>
        ) : (
          <button type="button" className="pixel-btn pixel-btn-gold pixel-btn-md" disabled={pending} onClick={onClaim}>{claimLabel}</button>
        )}
      </div>
    </div>
  );
}

function isMiniPass(name: string | null | undefined): boolean {
  return (name ?? '').toLowerCase().includes('mini');
}

function passCover(name: string | null | undefined): string | null {
  const n = (name ?? '').toLowerCase();
  if (n.includes('mini')) return '/ui/pass/mini.png?v=2';
  if (n.includes('campeonato') || n.includes('legend')) return '/ui/pass/campeonato.png?v=3';
  return null;
}

export function PassPage() {
  const { t } = useTranslation(['pass', 'common']);
  const { seasonId: seasonParam } = useParams();
  const { data: progress, isLoading } = usePassProgress();
  const claimLevel = useClaimPassLevel();
  const buyPremium = useBuyPassPremium();
  const wallet = useWalletSummary();
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState<PassProgressDTO | null>(null);

  if (isLoading || !progress) {
    return (
      <div className="pixel-card text-center py-16">
        <p className="retro-text text-xl" style={{ color: 'var(--text-muted)' }}>
          {t('common:labels.status.loading')}
        </p>
      </div>
    );
  }

  if (!progress.active) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <h1 className="pixel-text text-xl sm:text-2xl md:text-3xl" style={{ color: 'var(--gold)' }}>
            <i className="bi bi-ticket-perforated-fill" aria-hidden /> {t('pass:title')}
          </h1>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="pixel-card text-center py-16"
        >
          <p className="text-5xl mb-4" aria-hidden>
            <i className="bi bi-ticket-perforated-fill" aria-hidden />
          </p>
          <p className="pixel-text text-lg mb-3" style={{ color: 'var(--text-primary)' }}>
            {t('pass:inactiveTitle')}
          </p>
          <p className="retro-text text-lg" style={{ color: 'var(--text-secondary)' }}>
            {t('pass:inactiveDescription')}
          </p>
        </motion.div>
      </div>
    );
  }

  const handleClaim = async (seasonId: number, level: number, track: 'free' | 'gold' = 'free') => {
    setError('');
    try {
      await claimLevel.mutateAsync({ level, seasonId, track });
    } catch (err) {
      setError(translateError(err, 'PASS_CLAIM_FAILED'));
    }
  };

  const claimReady = async (board: PassProgressDTO) => {
    setError('');
    try {
      for (const level of board.levels) {
        if (level.goldRewardLabel && !level.goldLocked && !level.goldClaimed) {
          await claimLevel.mutateAsync({ level: level.level, seasonId: board.seasonId ?? 0, track: 'gold' });
        }
        if (!level.locked && !level.claimed) {
          await claimLevel.mutateAsync({ level: level.level, seasonId: board.seasonId ?? 0, track: 'free' });
        }
      }
    } catch (err) {
      setError(translateError(err, 'PASS_CLAIM_FAILED'));
    }
  };

  const confirmPremiumBuy = async () => {
    if (!confirming) return;
    setError('');
    try {
      if (confirming.seasonId == null) await buyPremium.mutateAsync(undefined);
      else await buyPremium.mutateAsync(confirming.seasonId);
      setConfirming(null);
    } catch (err) {
      setError(translateError(err, 'PASS_PREMIUM_FAILED'));
    }
  };

  const boards = progress.passes && progress.passes.length > 0 ? progress.passes : [progress];
  const requestedId = Number(seasonParam);
  const selected = boards.find((board) => board.seasonId === requestedId);
  const visibleBoards = selected ? [selected] : boards.length === 1 ? boards : [];
  const championshipClosed = PASS_MAINTENANCE && visibleBoards.some((board) => !isMiniPass(board.seasonName));

  if (championshipClosed) {
    return (
      <PageContentShell>
        <div className="pixel-card mx-auto max-w-lg p-6 text-center sm:p-8">
          <i className="bi bi-tools text-4xl" style={{ color: 'var(--gold)' }} aria-hidden />
          <h1 className="pixel-text mt-4 text-xl sm:text-2xl" style={{ color: 'var(--gold)' }}>
            PASSE EM MANUTENÇÃO
          </h1>
          <p className="retro-text mt-4 text-base" style={{ color: '#fff' }}>
            O Campeonato está em manutenção. O Mini Passe está liberado.
          </p>
          {boards.some((board) => isMiniPass(board.seasonName)) && (
            <Link
              to={`/pass/${boards.find((board) => isMiniPass(board.seasonName))?.seasonId ?? ''}`}
              className="pixel-btn pixel-btn-gold pixel-btn-sm mt-6 inline-flex"
            >
              Abrir o Mini Passe
            </Link>
          )}
        </div>
      </PageContentShell>
    );
  }

  if (boards.length > 1 && !selected) {
    return (
      <PageContentShell>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <h1 className="pixel-text text-xl sm:text-2xl md:text-3xl" style={{ color: 'var(--gold)' }}>
            <i className="bi bi-ticket-perforated-fill" aria-hidden /> {t('pass:title')}
          </h1>
          <p className="retro-text text-xl mt-2" style={{ color: 'var(--text-secondary)' }}>
            {t('pass:pickSubtitle')}
          </p>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
          {boards.map((board) => {
            const maxXp = Math.max(1, ...board.levels.map((level) => level.xpRequired));
            const progressPct = Math.min(100, (board.xp / maxXp) * 100);
            const reachedLevel = board.levels.reduce(
              (max, level) => (board.xp >= level.xpRequired ? Math.max(max, level.level) : max),
              0,
            );
            const days = board.seasonEndsAt
              ? Math.max(0, Math.ceil((new Date(board.seasonEndsAt).getTime() - Date.now()) / 86_400_000))
              : null;
            const price = board.premiumPricing?.priceGmt ?? board.premiumPriceUsdc;
            const cover = passCover(board.seasonName);
            return (
              <Link
                key={board.seasonId ?? board.seasonName}
                to={`/pass/${board.seasonId}`}
                className="pixel-card block no-underline"
                style={{ borderColor: board.premium ? 'var(--gold)' : 'var(--bg-lighter)' }}
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  {cover && (
                    <img src={cover} alt="" className="h-36 w-32 shrink-0 object-contain" draggable={false} />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="pixel-text text-lg" style={{ color: 'var(--gold)' }}>
                      {board.seasonName ?? t('common:labels.season')}
                    </div>
                    <div className="retro-text text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                      {t('common:labels.level')} {reachedLevel}
                      {days != null ? ` · ${t('pass:daysLeft', { days })}` : ''}
                    </div>
                  </div>
                  {board.premium ? (
                    <span className="pixel-badge" style={{ color: 'var(--gold)', borderColor: 'var(--gold)' }}>
                      ⭐ PREMIUM
                    </span>
                  ) : (
                    <span className="pixel-text text-sm" style={{ color: 'var(--gold)' }}>
                      {price.toLocaleString(undefined, { maximumFractionDigits: 2 })} GMT
                    </span>
                  )}
                </div>
                <div className="pixel-progress h-4 mb-4">
                  <div className="pixel-progress-bar" style={{ width: `${progressPct}%` }} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="retro-text text-sm" style={{ color: 'var(--text-muted)' }}>
                    {board.xp.toLocaleString('pt-BR')} / {maxXp.toLocaleString('pt-BR')} XP
                  </span>
                  <span className="pixel-btn pixel-btn-gold pixel-btn-sm">{t('pass:openPass')}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </PageContentShell>
    );
  }

  return (
    <PageContentShell>
      {error && (
        <div className="pixel-box-light p-3 border-red">
          <p className="retro-text text-red text-center">{error}</p>
        </div>
      )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        {boards.length > 1 && (
          <Link to="/pass" className="retro-text text-sm inline-block mb-3" style={{ color: 'var(--cyan)' }}>
            <i className="bi bi-arrow-left" aria-hidden /> {t('pass:backToPasses')}
          </Link>
        )}
        <h1 className="pixel-text text-xl sm:text-2xl md:text-3xl" style={{ color: 'var(--gold)' }}>
          <i className="bi bi-ticket-perforated-fill" aria-hidden /> {t('pass:title')}
        </h1>
        <p className="retro-text text-xl mt-2" style={{ color: 'var(--text-secondary)' }}>
          {t('pass:subtitle')}
        </p>
      </motion.div>

      {visibleBoards.map((board) => {
        const maxXp = Math.max(1, ...board.levels.map(level => level.xpRequired));
        const progressPct = Math.min(100, (board.xp / maxXp) * 100);
        const reachedLevel = board.levels.reduce(
          (max, level) => (board.xp >= level.xpRequired ? Math.max(max, level.level) : max),
          0,
        );
        const nextLevel = board.levels.find((level) => board.xp < level.xpRequired);
        const xpRemaining = nextLevel ? nextLevel.xpRequired - board.xp : 0;
        const premiumPriceGmt = board.premiumPricing?.priceGmt ?? board.premiumPriceUsdc;
        const cover = passCover(board.seasonName);
        return (
      <div key={board.seasonId ?? 'pass'} className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="pixel-card"
        style={{ borderColor: 'var(--gold)' }}
      >
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-6">
          <div className="flex items-center gap-4">
            {cover && (
              <img src={cover} alt="" className="h-44 w-40 shrink-0 object-contain" draggable={false} />
            )}
            <div>
            <div className="pixel-text text-sm" style={{ color: 'var(--text-muted)' }}>
              {board.seasonName ?? t('common:labels.season')}
            </div>
            <div className="pixel-text text-2xl" style={{ color: 'var(--gold)' }}>
              {t('common:labels.level')} {reachedLevel}
            </div>
            </div>
          </div>
          <div className="text-right">
            <div className="pixel-text text-sm" style={{ color: 'var(--text-muted)' }}>
              {t('pass:totalXp')}
            </div>
            <div className="pixel-text text-3xl" style={{ color: 'var(--gold)' }}>
              {board.xp.toLocaleString('pt-BR')}
            </div>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="retro-text text-sm" style={{ color: 'var(--text-secondary)' }}>
              {t('pass:progress')}
            </span>
            <span className="retro-text text-sm" style={{ color: 'var(--gold)' }}>
              {board.xp.toLocaleString('pt-BR')} / {maxXp.toLocaleString('pt-BR')} XP
            </span>
          </div>
          <div className="pixel-progress h-6">
            <motion.div
              className="pixel-progress-bar"
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 1.5, ease: 'easeOut' }}
            />
          </div>
        </div>

        {!board.premium && board.premiumPricing && (
          <PassPremiumPrice pricing={board.premiumPricing} />
        )}

        <div className="flex items-center justify-between flex-wrap gap-3">
          <span className="retro-text text-lg" style={{ color: 'var(--text-muted)' }}>
            {nextLevel ? t('pass:xpRemaining', { xp: xpRemaining }) : t('pass:passComplete')}
          </span>
          {!board.premium && (
            <motion.button
              className="pixel-btn pixel-btn-gold pixel-btn-md"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              disabled={buyPremium.isPending}
              onClick={() => {
                setError('');
                setConfirming(board);
              }}
            >
              ⭐ {t('pass:buyGold')} ({premiumPriceGmt.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} GMT)
            </motion.button>
          )}
          {board.premium && (
            <div className="text-right">
              <span className="pixel-badge" style={{ color: 'var(--gold)', borderColor: 'var(--gold)' }}>
                ⭐ PREMIUM
              </span>
              <p className="retro-text text-xs mt-2 max-w-xs" style={{ color: 'var(--text-secondary)' }}>
                {t('pass:premiumOpen')}
              </p>
            </div>
          )}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h2 className="pixel-text text-xl mb-4" style={{ color: 'var(--cyan)' }}>
          <i className="bi bi-clipboard-fill" aria-hidden /> {t('pass:missions')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {board.missions.map((mission) => {
            const labelKey = MISSION_LABELS[mission.id];
            const missionLabel = mission.label || (labelKey ? t(labelKey) : mission.id);
            const completed = mission.progress >= mission.target;
            return (
              <motion.div
                key={mission.id}
                className="pixel-box-light p-4"
                style={{
                  borderColor: completed ? 'var(--green)' : 'var(--bg-lighter)',
                  opacity: completed ? 0.7 : 1,
                }}
                whileHover={{ x: 4 }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <i className={`bi ${MISSION_ICONS[mission.id] ?? 'bi-clipboard-fill'} text-2xl`} aria-hidden />
                    <span
                      className="retro-text text-lg"
                      style={{ color: completed ? 'var(--green)' : 'var(--text-primary)' }}
                    >
                      {missionLabel}
                    </span>
                  </div>
                  <span className="pixel-text text-sm" style={{ color: 'var(--gold)' }}>
                    +{mission.xp} XP
                  </span>
                </div>
                <p className="retro-text text-xs" style={{ color: completed ? 'var(--green)' : 'var(--text-muted)' }}>
                  {mission.progress}/{mission.target}
                  {' · '}
                  {completed
                    ? t('common:labels.status.claimed', { defaultValue: 'Concluída' })
                    : t('pass:missionHint', { defaultValue: 'Complete a ação no jogo para ganhar XP' })}
                </p>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="pixel-text text-xl" style={{ color: 'var(--purple)' }}>
            <i className="bi bi-trophy-fill" aria-hidden /> {t('pass:rewards')}
          </h2>
          <button
            type="button"
            className="pixel-btn pixel-btn-green pixel-btn-sm"
            disabled={claimLevel.isPending || !board.levels.some((level) => (!level.locked && !level.claimed) || (level.goldRewardLabel && !level.goldLocked && !level.goldClaimed))}
            onClick={() => void claimReady(board)}
          >
            {t('pass:claimAll')}
          </button>
        </div>
        <div className="mb-3 grid grid-cols-[1fr_4.5rem_1fr] items-center gap-3 px-1">
          <p className="pixel-text text-center text-sm sm:text-lg" style={{ color: 'var(--gold)' }}>{t('pass:goldColumn')}</p>
          <span />
          <p className="pixel-text text-center text-sm sm:text-lg" style={{ color: 'var(--green)' }}>{t('pass:freeColumn')}</p>
        </div>
        <div className="space-y-3">
          {board.levels.map((level) => (
            <div key={level.level} className="grid grid-cols-[1fr_4.5rem_1fr] items-stretch gap-3">
              <RewardTile
                label={level.goldRewardLabel}
                imageUrl={level.goldRewardImageUrl}
                rewardType={level.goldRewardType}
                claimed={Boolean(level.goldClaimed)}
                locked={level.goldLocked !== false}
                pending={claimLevel.isPending}
                claimLabel={t('common:actions.claim')}
                lockedLabel={t('common:labels.status.locked')}
                claimedLabel={t('common:labels.status.claimed')}
                onClaim={() => void handleClaim(board.seasonId ?? 0, level.level, 'gold')}
              />
              <div className="flex flex-col items-center justify-center">
                <span className="pixel-text text-2xl" style={{ color: level.locked && level.goldLocked !== false ? 'var(--text-muted)' : 'var(--gold)' }}>{level.level}</span>
                <span className="retro-text text-center text-xs leading-tight sm:text-sm" style={{ color: 'var(--text-muted)' }}>{level.xpRequired.toLocaleString('pt-BR')}</span>
              </div>
              <RewardTile
                label={level.rewardLabel}
                imageUrl={level.rewardImageUrl}
                rewardType={level.rewardType}
                claimed={level.claimed}
                locked={level.locked}
                pending={claimLevel.isPending}
                claimLabel={t('common:actions.claim')}
                lockedLabel={t('common:labels.status.locked')}
                claimedLabel={t('common:labels.status.claimed')}
                onClaim={() => void handleClaim(board.seasonId ?? 0, level.level, 'free')}
              />
            </div>
          ))}
        </div>
      </motion.div>
      </div>
        );
      })}
      {confirming && (
        <SpendConfirmDialog
          mode="confirm"
          channel="pass"
          itemName={confirming.seasonName ?? t('pass:title')}
          amountGmt={confirming.premiumPricing?.priceGmt ?? confirming.premiumPriceUsdc}
          balanceGmt={wallet.data?.gmtBalance ?? null}
          pending={buyPremium.isPending}
          error={error}
          onCancel={() => {
            if (!buyPremium.isPending) setConfirming(null);
          }}
          onConfirm={() => void confirmPremiumBuy()}
        />
      )}
    </PageContentShell>
  );
}
