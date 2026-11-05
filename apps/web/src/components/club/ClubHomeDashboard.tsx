import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ClubData } from '../../hooks/useApi';
import { useClubRanking, useCtView, usePassProgress } from '../../hooks/useApi';
import { fetchPublicJson } from '../../lib/api/publicFetch';
import { formatGmtAmount, formatStableAmount, formatUsdcAmount } from '../../lib/formatUsdc';
import { drawPlayfieldPlayer, type PlayfieldActor } from '../stadium/stadiumPlayfieldDraw';
import { ClubCommandCenter } from './ClubCommandCenter';
import { StadiumIncomeNotice } from '../stadium/StadiumIncomeNotice';

interface NoticeRow {
  id: string;
  title: string;
  priority: string;
}

function NoticeDoll() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const actor: PlayfieldActor = {
      slotId: 'notice-doll',
      xPct: 50,
      yPct: 50,
      rarity: 'rare',
      position: 'FW',
      slotRole: 'FW',
      name: 'Boneco',
      overwall: 70,
      seed: 'notice-doll',
      index: 1,
      side: 'home',
    };
    const scratch = document.createElement('canvas');
    scratch.width = 180;
    scratch.height = 240;
    const sctx = scratch.getContext('2d');
    if (!sctx) return;
    const scale = 3.6;
    const feetY = 168;
    let raf = 0;
    const loop = (now: number) => {
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.clearRect(0, 0, scratch.width, scratch.height);
      sctx.imageSmoothingEnabled = false;
      drawPlayfieldPlayer(sctx, actor, scratch.width / 2, feetY, now, 'run', 1, scale);
      const top = Math.round(feetY - 16.5 * scale);
      const bottom = Math.round(feetY + 18 * scale);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(scratch, 0, top, scratch.width, bottom - top, 0, 0, canvas.width, canvas.height);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={ref}
      width={120}
      height={150}
      className="h-28 w-24 shrink-0"
      style={{ imageRendering: 'pixelated' }}
      aria-hidden
    />
  );
}

function Panel({
  title,
  children,
  accent = 'var(--green)',
  icon,
}: {
  title: string;
  children: ReactNode;
  accent?: string;
  icon: string;
}) {
  return (
    <section className="pixel-card pixel-card-fluid club-card-skin h-full flex flex-col gap-3" style={{ '--card-accent': accent } as CSSProperties}>
      <h2 className="score-label" style={{ color: accent }}><i className={`club-card-heading-icon bi bi-${icon}`} aria-hidden="true" />{title}</h2>
      <i className={`club-card-emblem bi bi-${icon}`} aria-hidden="true" />
      <div className="flex-1">{children}</div>
    </section>
  );
}

export function ClubHomeDashboard({
  club,
  canClaimCheckIn,
}: {
  club: ClubData;
  canClaimCheckIn: boolean;
}) {
  const { t } = useTranslation(['club', 'common']);
  const { data: ct } = useCtView();
  const { data: pass } = usePassProgress();
  const { data: ranking } = useClubRanking();
  const [notices, setNotices] = useState<NoticeRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchPublicJson<{ notices: NoticeRow[] }>('/api/notices')
      .then((data) => {
        if (!cancelled) setNotices((data.notices ?? []).slice(0, 3));
      })
      .catch(() => {
        if (!cancelled) setNotices([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const avgStamina = ct?.squadStaminaSummary?.avgStamina;
  const recovery = ct?.passiveRecoveryPerHour ?? 0;
  const staminaPct = avgStamina == null ? null : Math.max(0, Math.min(100, Math.round(avgStamina)));
  const myRank = ranking?.clubs.find((row) => row.clubName === club.name);
  const missions = [
    ...(pass?.dailyMissions ?? []),
    ...(pass?.weeklyMissions ?? []),
  ].filter((mission) => !mission.claimed).slice(0, 3);
  const seasonLabel = pass?.active
    ? (pass.seasonName ?? t('common:dashboard.seasonName', { id: pass.seasonId ?? 1, defaultValue: 'TEMPORADA {{id}}' }))
    : `${t('common:labels.season')} 1`;

  return (
    <div className="space-y-4">
      <ClubCommandCenter club={club} />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        <Panel title="OVERWALL" accent="var(--green)" icon="lightning-charge-fill">
          <p className="retro-text text-lg">Elenco {(club.squadOverwall ?? club.totalOverwall).toLocaleString()}</p>
          <p className="retro-text text-lg">Ativo {(club.activeOverwall ?? club.lineupOverwall ?? 0).toLocaleString()}</p>
          <p className="retro-text text-lg">Total {(club.collectionOverwall ?? club.totalOverwall).toLocaleString()}</p>
        </Panel>

        <Panel title={t('common:dashboard.balance', { defaultValue: 'SALDO' })} accent="var(--gold)" icon="wallet2">
          <ul className="space-y-1 retro-text text-xl">
            <li>{formatGmtAmount(club.gmtBalance)} GMT</li>
            <li style={{ color: 'var(--green)' }}>{formatStableAmount(club.usdcBalance)} USDC</li>
            <li style={{ color: 'var(--gold)' }}>{formatStableAmount(club.usdtBalance)} USDT</li>
          </ul>
        </Panel>

        <Panel title={t('common:dashboard.energy', { defaultValue: 'ENERGIA' })} accent="var(--cyan)" icon="battery-charging">
          <div className="stamina-track" aria-hidden>
            <span style={{ width: `${staminaPct ?? 0}%` }} />
          </div>
          <p className="retro-text text-lg mt-2">
            {staminaPct == null
              ? '—'
              : `${t('common:dashboard.staminaAvg', { defaultValue: 'STAMINA MÉDIA' })} ${staminaPct}%`}
          </p>
          <p className="retro-text text-lg">
            {t('common:dashboard.recovery', { defaultValue: 'RECUPERAÇÃO' })} +{recovery}
            {t('common:dashboard.perHour', { defaultValue: '/H' })}
          </p>
          <Link to="/club/ct" className="pixel-btn pixel-btn-sm mt-3">{t('common:dashboard.openCt', { defaultValue: 'ABRIR CT' })}</Link>
        </Panel>

        <Panel title={t('common:dashboard.players', { defaultValue: 'JOGADORES' })} accent="var(--blue)" icon="person-badge-fill">
          <p className="retro-text text-xl">{t('club:stats.base')}: {club.basePlayerCount}</p>
          <Link to="/club/inventory" className="pixel-btn pixel-btn-sm mt-3">{t('club:header.squad')}</Link>
        </Panel>

        <Panel title={t('common:dashboard.tasks', { defaultValue: 'TAREFAS' })} accent="var(--orange)" icon="check2-square">
          <ul className="space-y-2 retro-text text-lg">
            {canClaimCheckIn && (
              <li>
                <Link to="/club/checkin" className="underline" style={{ color: 'var(--gold)' }}>
                  {t('common:dashboard.claimCheckin', { defaultValue: 'RESGATAR PRESENÇA' })}
                </Link>
              </li>
            )}
            {missions.map((mission) => (
              <li key={mission.id}>
                {mission.label} {mission.progress}/{mission.target}
              </li>
            ))}
            {!canClaimCheckIn && missions.length === 0 && (
              <li>{t('common:dashboard.noTasks', { defaultValue: 'Nada pendente' })}</li>
            )}
          </ul>
        </Panel>

        <Panel title={t('common:dashboard.matches', { defaultValue: 'PARTIDAS' })} accent="var(--red)" icon="controller">
          <p className="score-label" style={{ color: 'var(--line)' }}>
            {t('common:dashboard.rank', { defaultValue: 'POSIÇÃO' })}
          </p>
          <p className="score-num mt-2">
            {myRank ? `#${myRank.rank}` : t('common:dashboard.unranked', { defaultValue: 'FORA DA TABELA' })}
          </p>
          <Link to="/pvp" className="pixel-btn pixel-btn-sm pixel-btn-red mt-3">
            {t('common:dashboard.openPvp', { defaultValue: 'ENTRAR NO PVP' })}
          </Link>
        </Panel>

        <Panel title={t('common:dashboard.season', { defaultValue: 'TEMPORADA' })} accent="var(--gold)" icon="stars">
          <p className="retro-text text-xl">{seasonLabel}</p>
          {pass?.active ? (
            <p className="retro-text text-lg mt-2">
              {t('common:dashboard.passLevel', { level: pass.level, defaultValue: 'NÍVEL {{level}}' })} · {pass.xp} XP
            </p>
          ) : (
            <p className="retro-text text-lg mt-2">{t('common:labels.status.inactive')}</p>
          )}
          <Link to={pass?.active ? '/pass' : '/ranking'} className="pixel-btn pixel-btn-sm pixel-btn-gold mt-3">
            {t('common:nav.areas.season', { defaultValue: 'TEMPORADA' })}
          </Link>
        </Panel>

        <Panel title={t('common:dashboard.rewards', { defaultValue: 'RECOMPENSAS' })} accent="var(--purple)" icon="gift-fill">
          <p className="retro-text text-lg">{t('club:dailyFarm.usdcPerRound')}: {formatUsdcAmount(club.estimatedUsdcPerRound ?? 0, 8)}</p>
          <p className="retro-text text-lg">{t('club:dailyFarm.usdcPerHour')}: {formatUsdcAmount(club.usdcPerHour ?? 0, 8)}</p>
          <div className="mt-3">
            <StadiumIncomeNotice online={club.stadiumWatching === true} compact />
          </div>
          <Link to="/patrocinios" className="retro-text text-lg underline mt-2 inline-block" style={{ color: 'var(--blue)' }}>
            {t('club:dailyFarm.sponsorshipLink')}
          </Link>
        </Panel>

        <Panel title={t('common:dashboard.notices', { defaultValue: 'NOTIFICAÇÕES' })} accent="var(--line)" icon="megaphone-fill">
          {notices.length === 0 ? (
            <div className="flex items-center gap-3">
              <NoticeDoll />
              <p className="retro-text text-lg">{t('common:dashboard.noNotices', { defaultValue: 'Sem avisos' })}</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {notices.map((notice) => (
                <li key={notice.id} className="retro-text text-lg truncate">{notice.title}</li>
              ))}
            </ul>
          )}
          <Link to="/avisos" className="pixel-btn pixel-btn-sm mt-3">
            {t('common:dashboard.seeAll', { defaultValue: 'VER TODOS' })}
          </Link>
        </Panel>
      </div>
    </div>
  );
}
