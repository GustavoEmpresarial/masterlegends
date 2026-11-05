import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { CheckInStatusDTO, CheckInStreakRewardPreviewDTO } from '@mll/shared';
import { CHECKIN_OVERWALL_AMOUNT, CHECKIN_OVERWALL_TTL_DAYS } from '@mll/shared';
import { useCheckInStatus, useClaimCheckIn } from '../../../hooks/useApi';
import { translateError } from '../../../lib/apiError';
import { PageContentShell } from '../../../components/content';
import { resolveUploadUrl } from '../../../lib/resolveUploadUrl';

const POSITION_LABELS = ['GK', 'DEF', 'MID', 'FW', 'LAT'] as const;

function formatCountdown(targetIso: string | null): string {
  if (!targetIso) return '';
  const diff = new Date(targetIso).getTime() - Date.now();
  if (diff <= 0) return '00:00:00';
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function GrantSlot({
  grant,
  empty,
  daysLeftLabel,
}: {
  grant?: CheckInStatusDTO['grants'][number];
  empty?: boolean;
  daysLeftLabel: string;
}) {
  if (empty || !grant) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded border-2 border-dashed p-3 text-center"
        style={{ borderColor: 'var(--text-muted)', minHeight: 88, opacity: 0.5 }}
      >
        <span className="pixel-text text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center justify-center rounded border-2 p-3 text-center"
      style={{ borderColor: 'var(--gold)', background: 'rgba(255, 215, 0, 0.08)', minHeight: 88 }}
    >
      <span className="pixel-text text-sm" style={{ color: 'var(--gold)' }}>+{grant.amount} OW</span>
      <span className="retro-text mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
        {daysLeftLabel}
      </span>
    </div>
  );
}

function StreakRewardCard({
  reward,
  streak,
  streakTarget,
  nextIn,
  streakPct,
}: {
  reward: CheckInStreakRewardPreviewDTO;
  streak: number;
  streakTarget: number;
  nextIn: number;
  streakPct: number;
}) {
  const { t } = useTranslation('club');
  const pos = POSITION_LABELS[reward.position] ?? 'MID';
  const img = reward.imageUrl ? resolveUploadUrl(reward.imageUrl) : null;

  return (
    <div
      className="rounded border-2 p-4 sm:p-5 space-y-4"
      style={{ borderColor: 'var(--blue)', background: 'rgba(56, 189, 248, 0.06)' }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="ui-label-sm" style={{ color: 'var(--text-muted)' }}>
            {t('checkin.page.streakRewardBadge', { defaultValue: 'RECOMPENSA DA SEQUÊNCIA' })}
          </p>
          <p className="pixel-text text-base sm:text-lg mt-1" style={{ color: 'var(--blue)' }}>
            {t('checkin.page.streakTitle')}
          </p>
        </div>
        <p className="pixel-text text-lg" style={{ color: 'var(--blue)' }}>
          {t('checkin.page.streakCount', { streak, target: streakTarget })}
        </p>
      </div>

      <div className="h-3 w-full rounded overflow-hidden" style={{ background: 'var(--bg-dark)' }}>
        <div
          className="h-full transition-all"
          style={{ width: `${streakPct}%`, background: 'var(--blue)' }}
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-stretch">
        <div
          className="relative mx-auto sm:mx-0 shrink-0 overflow-hidden rounded border-2"
          style={{
            width: 128,
            height: 160,
            borderColor: 'var(--gold)',
            background: 'linear-gradient(160deg, rgba(255,215,0,0.12), rgba(0,0,0,0.45))',
          }}
        >
          {img ? (
            <img
              src={img}
              alt={reward.name}
              className="h-full w-full object-cover"
              style={{ imageRendering: 'auto' }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-5xl opacity-60"><i className="bi bi-shield-fill" aria-hidden /></div>
          )}
          <div
            className="absolute left-2 top-2 px-2 py-0.5 text-[10px] font-bold"
            style={{ background: 'rgba(0,0,0,0.75)', color: 'var(--gold)', border: '1px solid var(--gold)' }}
          >
            {pos}
          </div>
          <div
            className="absolute bottom-2 right-2 px-2 py-0.5 text-[10px] font-bold"
            style={{ background: 'rgba(0,0,0,0.75)', color: '#fff', border: '1px solid var(--text-muted)' }}
          >
            {reward.overwall} OW
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-center gap-2">
          <p className="retro-text text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            {t('checkin.page.streakPrizeLabel', { defaultValue: 'Você ganha ao completar' })}
          </p>
          <h3 className="pixel-text text-xl sm:text-2xl truncate" style={{ color: 'var(--gold)' }}>
            {reward.name}
          </h3>
          <div className="flex flex-wrap gap-2">
            <span
              className="pixel-badge pixel-badge--blue"
            >
              {pos}
            </span>
            <span className="pixel-badge pixel-badge--gold">{reward.overwall} OW</span>
            <span className="pixel-badge pixel-badge--orange">
              {t('checkin.page.streakDuration', {
                defaultValue: '{{days}} dias',
                days: reward.durationDays,
              })}
            </span>
          </div>
          <p className="retro-text text-sm" style={{ color: 'var(--text-secondary)' }}>
            {nextIn === 0 && streak > 0
              ? t('checkin.page.streakReady')
              : t('checkin.page.streakNextNamed', {
                  defaultValue: 'Faltam {{count}} dia(s) para receber {{name}}.',
                  count: nextIn || streakTarget,
                  name: reward.name,
                })}
          </p>
        </div>
      </div>
    </div>
  );
}

export function CheckInPage() {
  const { t, i18n } = useTranslation(['club', 'common']);
  const { data: status, isLoading, isError, error, refetch } = useCheckInStatus();
  const claim = useClaimCheckIn();
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    if (!status?.nextAvailableAt) {
      setCountdown('');
      return;
    }
    const tick = () => setCountdown(formatCountdown(status.nextAvailableAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [status?.nextAvailableAt]);

  async function handleClaim() {
    setMsg('');
    setErr('');
    try {
      const result = await claim.mutateAsync();
      let text = t('club:checkin.page.claimSuccess', {
        amount: result.grant.amount,
        days: CHECKIN_OVERWALL_TTL_DAYS,
      });
      if (result.streakRewardGranted) {
        text +=
          ' ' +
          t('club:checkin.page.streakReward', {
            name: result.streakRewardPlayerName ?? 'jogador',
            streak: result.streak,
          });
      }
      setMsg(text);
    } catch (e) {
      setErr(translateError(e, 'CHECKIN_ALREADY_CLAIMED'));
    }
  }

  if (isLoading) {
    return (
      <PageContentShell>
        <div className="pixel-card py-16 text-center retro-text" style={{ color: 'var(--text-muted)' }}>
          {t('common:actions.loading')}
        </div>
      </PageContentShell>
    );
  }

  if (isError || !status) {
    return (
      <PageContentShell>
        <div className="pixel-card py-8 text-center space-y-4">
          <p className="retro-text text-red-400">{translateError(error)}</p>
          <button type="button" className="pixel-btn pixel-btn-md" onClick={() => void refetch()}>
            {t('club:checkin.page.tryAgain')}
          </button>
        </div>
      </PageContentShell>
    );
  }

  const slots = Array.from({ length: CHECKIN_OVERWALL_TTL_DAYS }, (_, i) => status.grants[i] ?? null);
  const locale = i18n.language;
  const streakProgress =
    status.nextStreakRewardIn === 0 && status.streak > 0
      ? status.streakTarget
      : status.streak % status.streakTarget;
  const streakPct = Math.min(100, (streakProgress / Math.max(1, status.streakTarget)) * 100);

  return (
    <PageContentShell className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/club" className="retro-text text-sm underline" style={{ color: 'var(--blue)' }}>
            {t('club:checkin.page.backToClub')}
          </Link>
          <h1 className="pixel-text mt-2 text-xl sm:text-2xl" style={{ color: 'var(--gold)' }}>
            <i className="bi bi-calendar-event-fill" aria-hidden /> {t('common:nav.dailyPresence')}
          </h1>
          <p className="retro-text mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t('club:checkin.page.subtitle', {
              amount: CHECKIN_OVERWALL_AMOUNT,
              days: CHECKIN_OVERWALL_TTL_DAYS,
              max: status.maxActiveOverwall,
            })}
          </p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="pixel-card space-y-4"
        style={{ borderColor: 'var(--gold)' }}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="pixel-box-light p-4 text-center">
            <p className="retro-text text-xs" style={{ color: 'var(--text-muted)' }}>
              {t('club:checkin.page.activeBonus')}
            </p>
            <p className="pixel-text text-2xl mt-1" style={{ color: 'var(--gold)' }}>
              {status.activeOverwall.toLocaleString(locale)} OW
            </p>
            <p className="retro-text text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              {t('club:checkin.page.max')} {status.maxActiveOverwall.toLocaleString(locale)}
            </p>
          </div>
          <div className="pixel-box-light p-4 text-center">
            <p className="retro-text text-xs" style={{ color: 'var(--text-muted)' }}>
              {t('club:checkin.page.lineup')}
            </p>
            <p className="pixel-text text-2xl mt-1" style={{ color: 'var(--purple)' }}>
              {status.lineupOverwall.toLocaleString(locale)} OW
            </p>
          </div>
          <div className="pixel-box-light p-4 text-center">
            <p className="retro-text text-xs" style={{ color: 'var(--text-muted)' }}>
              {t('club:checkin.page.totalSponsorships')}
            </p>
            <p className="pixel-text text-2xl mt-1" style={{ color: 'var(--green)' }}>
              {status.totalOverwall.toLocaleString(locale)} OW
            </p>
          </div>
        </div>

        <StreakRewardCard
          reward={status.streakReward}
          streak={status.streak}
          streakTarget={status.streakTarget}
          nextIn={status.nextStreakRewardIn}
          streakPct={streakPct}
        />

        <div>
          <p className="retro-text text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
            {t('club:checkin.page.activeGrants', {
              count: status.grants.length,
              total: CHECKIN_OVERWALL_TTL_DAYS,
            })}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {slots.map((grant, i) => (
              <GrantSlot
                key={grant?.id ?? `empty-${i}`}
                grant={grant ?? undefined}
                empty={!grant}
                daysLeftLabel={
                  grant
                    ? t('club:checkin.page.daysLeft', { count: grant.daysLeft })
                    : ''
                }
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 pt-2">
          <button
            type="button"
            className="pixel-btn pixel-btn-gold pixel-btn-lg w-full sm:w-auto"
            disabled={!status.canClaimToday || claim.isPending}
            onClick={() => void handleClaim()}
          >
            {status.canClaimToday
              ? t('club:checkin.page.claimToday')
              : t('club:checkin.page.alreadyClaimed')}
          </button>
          {!status.canClaimToday && countdown && (
            <p className="retro-text text-sm" style={{ color: 'var(--text-muted)' }}>
              {t('club:checkin.page.nextCheckIn', { countdown })}
            </p>
          )}
          {msg && <p className="retro-text text-sm" style={{ color: 'var(--green)' }}>{msg}</p>}
          {err && <p className="retro-text text-sm" style={{ color: 'var(--orange)' }}>{err}</p>}
        </div>
      </motion.div>

      <div className="pixel-box-light p-4">
        <p className="retro-text text-sm" style={{ color: 'var(--text-secondary)' }}>
          {t('club:checkin.page.info')}
        </p>
        <Link to="/patrocinios" className="retro-text mt-2 inline-block text-sm underline" style={{ color: 'var(--blue)' }}>
          {t('club:checkin.page.viewSponsorships')}
        </Link>
      </div>
    </PageContentShell>
  );
}
