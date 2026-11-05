import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatStableAmount } from '../../lib/formatUsdc';
import { apiClient } from '../../lib/api/client';
import { PageContentShell } from '../../components/content';
import { StadiumIncomeNotice } from '../../components/stadium/StadiumIncomeNotice';

interface SponsorshipSummary {
  lifetimeEarned: number;
  currentOverwall: number;
  lineupOverwall?: number;
  playersBaseOverwall?: number;
  gearBonusOverwall?: number;
  stadiumBonusOverwall?: number;
  stadiumFarmBonusPct?: number;
  stadiumName?: string | null;
  checkInOverwall?: number;
  bonusTotal?: number;
  bonusPctOnBase?: number;
  networkOverwall: number;
  sharePct: number;
  estimatedPerBlock: number;
  blockRewardUsdc: number;
  blockIntervalMin: number;
  paused: boolean;
  lastBlockNumber: number | null;
  lastBlockAt: string | null;
  stadiumWatching?: boolean;
  presenceRate?: number;
}

interface RoundRow {
  blockNumber: number;
  minedAt: string;
  totalOverwall: number;
  rewardUsdc: number;
  participantCount: number;
}

interface PayoutRow {
  id: string;
  blockNumber: number;
  overwallSnapshot: number;
  share: number;
  amountUsdc: number;
  createdAt: string;
}

function nextRoundEta(lastAt: string | null, intervalMin: number): number {
  if (!lastAt) return intervalMin * 60;
  const next = new Date(lastAt).getTime() + intervalMin * 60 * 1000;
  return Math.max(0, Math.floor((next - Date.now()) / 1000));
}

function fmtOw(n: number): string {
  return n.toLocaleString('pt-BR');
}

export function SponsorshipsPage() {
  const { t } = useTranslation('common');
  const [summary, setSummary] = useState<SponsorshipSummary | null>(null);
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [history, setHistory] = useState<PayoutRow[]>([]);
  const [eta, setEta] = useState(0);

  async function load() {
    const [s, b, h] = await Promise.all([
      apiClient.get<SponsorshipSummary>('/api/mining/me'),
      apiClient.get<{ blocks: RoundRow[] }>('/api/mining/blocks?limit=10'),
      apiClient.get<{ rewards: PayoutRow[] }>('/api/mining/history?limit=20'),
    ]);
    setSummary(s.data);
    setRounds(b.data.blocks);
    setHistory(h.data.rewards);
  }

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!summary) return;
    const tick = () => setEta(nextRoundEta(summary.lastBlockAt, summary.blockIntervalMin));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [summary]);

  if (!summary) {
    return (
      <div className="pixel-card py-16 text-center">
        <p className="retro-text text-lg" style={{ color: 'var(--text-muted)' }}>
          {t('actions.loading')}
        </p>
      </div>
    );
  }

  const mm = String(Math.floor(eta / 60)).padStart(2, '0');
  const ss = String(eta % 60).padStart(2, '0');

  const playersBase = summary.playersBaseOverwall ?? Math.max(
    0,
    (summary.lineupOverwall ?? summary.currentOverwall) - (summary.gearBonusOverwall ?? 0),
  );
  const gearBonus = summary.gearBonusOverwall ?? 0;
  const stadiumBonus = summary.stadiumBonusOverwall ?? 0;
  const stadiumFarmPct = summary.stadiumFarmBonusPct ?? 0;
  const stadiumName = summary.stadiumName ?? null;
  const checkInBonus = summary.checkInOverwall ?? 0;
  const lineupTotal = summary.lineupOverwall ?? playersBase + gearBonus;
  const totalPower = summary.currentOverwall;
  const bonusTotal = summary.bonusTotal ?? gearBonus + stadiumBonus + checkInBonus;
  const bonusPct =
    summary.bonusPctOnBase ??
    (playersBase > 0 ? (bonusTotal / playersBase) * 100 : bonusTotal > 0 ? 100 : 0);

  const barParts = [
    {
      key: 'base',
      value: playersBase,
      color: '#b898e8',
      label: t('sponsorships.power.base', { defaultValue: 'Jogadores (base)' }),
    },
    {
      key: 'gear',
      value: gearBonus,
      color: '#72b8f8',
      label: t('sponsorships.power.gear', { defaultValue: 'Equipamentos' }),
    },
    {
      key: 'stadium',
      value: stadiumBonus,
      color: '#7ee07e',
      label: t('sponsorships.power.stadium', {
        defaultValue: stadiumName
          ? `Estádio (+${Math.round(stadiumFarmPct * 100)}%)`
          : 'Bônus estádio',
      }),
    },
    {
      key: 'checkin',
      value: checkInBonus,
      color: '#ffe048',
      label: t('sponsorships.power.checkIn', { defaultValue: 'Presença / check-in' }),
    },
  ].filter((p) => p.value > 0 || p.key === 'base' || p.key === 'stadium');

  const barMax = Math.max(1, totalPower);

  const stats = [
    {
      label: t('sponsorships.stats.lifetime', { defaultValue: 'TOTAL EM PATROCÍNIOS' }),
      value: `${formatStableAmount(summary.lifetimeEarned)} USDT`,
      color: '#ffe048',
    },
    {
      label: t('sponsorships.stats.power', { defaultValue: 'PODER TOTAL (OW)' }),
      value: fmtOw(totalPower),
      color: '#b898e8',
    },
    {
      label: t('sponsorships.stats.network', { defaultValue: 'FORÇA DA LIGA' }),
      value: fmtOw(summary.networkOverwall),
      color: '#72b8f8',
    },
    {
      label: t('sponsorships.stats.share', { defaultValue: 'SUA FATIA' }),
      value: `${summary.sharePct.toFixed(4)}%`,
      color: '#58c0c8',
    },
    {
      label: t('sponsorships.stats.estimated', { defaultValue: 'ESTIMADO POR RODADA' }),
      value: `${formatStableAmount(summary.estimatedPerBlock)} USDT`,
      color: '#7ee07e',
    },
    {
      label: t('sponsorships.stats.roundPool', { defaultValue: 'COTA DA RODADA' }),
      value: `${summary.blockRewardUsdc} USDT`,
      color: '#ffe048',
    },
    {
      label: t('sponsorships.stats.interval', { defaultValue: 'INTERVALO' }),
      value: `${summary.blockIntervalMin} min`,
      color: '#ffffff',
    },
    {
      label: t('sponsorships.stats.nextRound', { defaultValue: 'PRÓXIMA RODADA EM' }),
      value: `${mm}:${ss}`,
      color: '#b898e8',
    },
  ];

  return (
    <PageContentShell wide>
      <div className="text-center">
        <h1 className="pixel-text text-2xl sm:text-3xl md:text-4xl" style={{ color: '#b898e8' }}>
          <i className="bi bi-briefcase-fill" aria-hidden /> {t('sponsorships.title', { defaultValue: 'Patrocínios' })}
        </h1>
        <p className="retro-text mt-3 text-lg sm:text-xl" style={{ color: '#f2f2f2' }}>
          {t('sponsorships.subtitle', {
            defaultValue: 'Receba USDT da liga conforme a força dos jogadores escalados no estádio',
          })}
        </p>
      </div>

      {summary.paused && (
        <div className="pixel-box-light p-4 text-center" style={{ borderColor: '#e89848', borderWidth: 3 }}>
          <p className="retro-text text-base sm:text-lg" style={{ color: '#e89848' }}>
            {t('sponsorships.paused', { defaultValue: '⏸️ Patrocínios pausados temporariamente' })}
          </p>
        </div>
      )}

      <div className="pixel-box-light p-4 text-center" style={{ borderColor: '#7ee07e', borderWidth: 3 }}>
        <p className="retro-text text-base sm:text-lg" style={{ color: '#ffffff' }}>
          <i className="bi bi-cash-stack" aria-hidden />{' '}
          {t('sponsorships.autoCredit', {
            defaultValue: 'Cotas creditadas automaticamente na carteira do jogo a cada rodada.',
          })}
        </p>
      </div>

      <StadiumIncomeNotice online={summary.stadiumWatching === true} />

      {/* De onde vem o OW distribuído */}
      <section className="pixel-card p-5 sm:p-7" style={{ borderColor: '#b898e8', borderWidth: 3 }}>
        <h2 className="ui-label mb-2 text-lg sm:text-xl" style={{ color: '#b898e8' }}>
          {t('sponsorships.power.title', { defaultValue: 'DE ONDE VEM SEU OVERWALL' })}
        </h2>
        <p className="retro-text mb-5 text-base sm:text-lg" style={{ color: '#f2f2f2' }}>
          {t('sponsorships.power.hint', {
            defaultValue:
              'Só entram jogadores escalados no estádio. Bônus de equipamento e presença somam em cima do OW base.',
          })}
        </p>

        <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
          <PowerStat
            label={t('sponsorships.power.base', { defaultValue: 'OW base (jogadores)' })}
            value={fmtOw(playersBase)}
            color="#b898e8"
            hint={t('sponsorships.power.baseHint', { defaultValue: 'Soma do overwall dos titulares' })}
          />
          <PowerStat
            label={t('sponsorships.power.gear', { defaultValue: 'Bônus equipamentos' })}
            value={gearBonus > 0 ? `+${fmtOw(gearBonus)}` : '0'}
            color="#72b8f8"
            hint={t('sponsorships.power.gearHint', {
              defaultValue: 'OW dos itens equipados nos titulares',
            })}
          />
          <PowerStat
            label={t('sponsorships.power.stadium', { defaultValue: 'Bônus estádio' })}
            value={
              stadiumBonus > 0
                ? `+${fmtOw(stadiumBonus)}`
                : stadiumFarmPct > 0
                  ? '+0'
                  : '0'
            }
            color="#7ee07e"
            hint={
              stadiumName
                ? t('sponsorships.power.stadiumHint', {
                    defaultValue: '{{name}} · +{{pct}}% sobre a escalação',
                    name: stadiumName,
                    pct: Math.round(stadiumFarmPct * 100),
                  })
                : t('sponsorships.power.stadiumHintEmpty', {
                    defaultValue: 'Ative um campo com bônus de farm no Escritório',
                  })
            }
          />
          <PowerStat
            label={t('sponsorships.power.checkIn', { defaultValue: 'Bônus presença' })}
            value={checkInBonus > 0 ? `+${fmtOw(checkInBonus)}` : '0'}
            color="#ffe048"
            hint={t('sponsorships.power.checkInHint', {
              defaultValue: 'Check-in diário ativo (expira em 7 dias)',
            })}
          />
          <PowerStat
            label={t('sponsorships.power.total', { defaultValue: 'Poder total' })}
            value={fmtOw(totalPower)}
            color="#7ee07e"
            hint={t('sponsorships.power.totalHint', {
              defaultValue: 'Base + equipamentos + estádio + presença = fatia na rodada',
            })}
          />
        </div>

        {/* Barra visual de composição */}
        <div
          className="mb-3 overflow-hidden rounded"
          style={{ height: 22, background: '#1a1a1a', border: '3px solid #4d4d4d' }}
        >
          <div className="flex h-full w-full">
            {barParts.map((p) => (
              <div
                key={p.key}
                title={`${p.label}: ${fmtOw(p.value)}`}
                style={{
                  width: `${Math.max(p.value > 0 ? 2 : 0, (p.value / barMax) * 100)}%`,
                  background: p.color,
                  minWidth: p.value > 0 ? 4 : 0,
                }}
              />
            ))}
          </div>
        </div>
        <div className="mb-5 flex flex-wrap gap-4 text-sm sm:text-base">
          {barParts.map((p) => (
            <span
              key={p.key}
              className="retro-text inline-flex items-center gap-2"
              style={{ color: '#f2f2f2' }}
            >
              <span className="inline-block h-3 w-3" style={{ background: p.color }} />
              {p.label}: <strong style={{ color: p.color }}>{fmtOw(p.value)}</strong>
            </span>
          ))}
        </div>

        <div
          className="space-y-2 rounded px-4 py-4 sm:px-5"
          style={{ borderColor: '#4d4d4d', borderWidth: 3, borderStyle: 'solid', background: '#2d2d2d' }}
        >
          <p className="retro-text text-base sm:text-lg" style={{ color: '#ffffff' }}>
            <strong style={{ color: '#7ee07e' }}>{fmtOw(totalPower)}</strong>
            {' = '}
            <span style={{ color: '#b898e8' }}>{fmtOw(playersBase)}</span>
            {' (base)'}
            {gearBonus > 0 && (
              <>
                {' + '}
                <span style={{ color: '#72b8f8' }}>{fmtOw(gearBonus)}</span>
                {' (equip.)'}
              </>
            )}
            {stadiumBonus > 0 && (
              <>
                {' + '}
                <span style={{ color: '#7ee07e' }}>{fmtOw(stadiumBonus)}</span>
                {' (estádio)'}
              </>
            )}
            {checkInBonus > 0 && (
              <>
                {' + '}
                <span style={{ color: '#ffe048' }}>{fmtOw(checkInBonus)}</span>
                {' (presença)'}
              </>
            )}
          </p>
          <p className="retro-text text-sm sm:text-base" style={{ color: '#f2f2f2' }}>
            {t('sponsorships.power.formula', {
              defaultValue:
                'Escalação em campo: {{lineup}} OW · Bônus sobre o base: +{{bonus}} OW ({{pct}}%)',
              lineup: fmtOw(lineupTotal),
              bonus: fmtOw(bonusTotal),
              pct: bonusPct.toFixed(1),
            })}
          </p>
          {stadiumFarmPct <= 0 && totalPower > 0 && (
            <p className="retro-text text-sm sm:text-base" style={{ color: '#d6d6d6' }}>
              {t('sponsorships.power.noStadiumFarm', {
                defaultValue:
                  'Campo ativo sem bônus de farm{{name}}. Assine/ative um estádio com +% no Escritório.',
                name: stadiumName ? ` (${stadiumName})` : '',
              })}{' '}
              <Link to="/club/escritorio" className="underline" style={{ color: '#72b8f8' }}>
                Escritório →
              </Link>
            </p>
          )}
          {bonusTotal > 0 && playersBase > 0 && (
            <p className="retro-text text-sm sm:text-base" style={{ color: '#ffe048' }}>
              {t('sponsorships.power.bonusEffect', {
                defaultValue:
                  'Os bônus aumentam seu OW base em {{pct}}% — de {{base}} para {{total}} OW na distribuição da rodada.',
                pct: bonusPct.toFixed(1),
                base: fmtOw(playersBase),
                total: fmtOw(totalPower),
              })}
            </p>
          )}
          {totalPower === 0 && (
            <p className="retro-text text-sm sm:text-base" style={{ color: '#e89848' }}>
              {t('sponsorships.power.empty', {
                defaultValue: 'Escale jogadores no estádio para gerar overwall e participar das cotas.',
              })}{' '}
              <Link to="/club/stadium" className="underline" style={{ color: '#72b8f8' }}>
                Ir ao estádio →
              </Link>
            </p>
          )}
          {checkInBonus === 0 && totalPower > 0 && (
            <p className="retro-text text-sm sm:text-base" style={{ color: '#d6d6d6' }}>
              {t('sponsorships.power.noCheckIn', {
                defaultValue: 'Sem bônus de presença ativo. Faça check-in diário para somar OW extra.',
              })}{' '}
              <Link to="/club/checkin" className="underline" style={{ color: '#72b8f8' }}>
                Check-in →
              </Link>
            </p>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Stat key={stat.label} label={stat.label} value={stat.value} color={stat.color} />
        ))}
      </div>

      <section className="pixel-card p-5 sm:p-7" style={{ borderColor: '#b898e8', borderWidth: 3 }}>
        <h2 className="ui-label mb-4 text-lg sm:text-xl" style={{ color: '#b898e8' }}>
          {t('sponsorships.recentRounds', { defaultValue: 'Últimas rodadas' })}
        </h2>
        <div className="pixel-table-wrap">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b-2" style={{ borderColor: '#4d4d4d' }}>
                <th className="ui-label-sm py-3 pr-4" style={{ color: '#f2f2f2' }}>
                  #
                </th>
                <th className="ui-label-sm py-3 pr-4" style={{ color: '#f2f2f2' }}>
                  Quando
                </th>
                <th className="ui-label-sm py-3 pr-4 text-right" style={{ color: '#f2f2f2' }}>
                  Cota da rodada
                </th>
                <th className="ui-label-sm py-3 pr-4 text-right" style={{ color: '#f2f2f2' }}>
                  Força total da liga
                </th>
                <th className="ui-label-sm py-3 text-right" style={{ color: '#f2f2f2' }}>
                  Clubes ativos
                </th>
              </tr>
            </thead>
            <tbody>
              {rounds.map((b) => (
                <tr key={b.blockNumber} className="border-b" style={{ borderColor: '#1a1a1a' }}>
                  <td className="retro-text py-3 pr-4 text-base" style={{ color: '#ffffff' }}>
                    {b.blockNumber}
                  </td>
                  <td className="retro-text py-3 pr-4 text-base" style={{ color: '#ffffff' }}>
                    {new Date(b.minedAt).toLocaleString('pt-BR')}
                  </td>
                  <td className="retro-text py-3 pr-4 text-base text-right" style={{ color: '#ffe048' }}>
                    {b.rewardUsdc} USDT
                  </td>
                  <td className="retro-text py-3 pr-4 text-base text-right" style={{ color: '#ffffff' }}>
                    {b.totalOverwall.toLocaleString('pt-BR')}
                  </td>
                  <td className="retro-text py-3 text-base text-right" style={{ color: '#ffffff' }}>
                    {b.participantCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="pixel-card p-5 sm:p-7" style={{ borderColor: '#72b8f8', borderWidth: 3 }}>
        <h2 className="ui-label mb-4 text-lg sm:text-xl" style={{ color: '#72b8f8' }}>
          {t('sponsorships.yourPayouts', { defaultValue: 'Suas cotas' })}
        </h2>
        {history.length === 0 ? (
          <p className="retro-text py-8 text-center text-base" style={{ color: '#d6d6d6' }}>
            Nenhuma cota ainda. Escale jogadores no estádio para participar!
          </p>
        ) : (
          <div className="pixel-table-wrap">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b-2" style={{ borderColor: '#4d4d4d' }}>
                  <th className="ui-label-sm py-3 pr-4" style={{ color: '#f2f2f2' }}>
                    Rodada
                  </th>
                  <th className="ui-label-sm py-3 pr-4" style={{ color: '#f2f2f2' }}>
                    Quando
                  </th>
                  <th className="ui-label-sm py-3 pr-4 text-right" style={{ color: '#f2f2f2' }}>
                    Força do seu clube
                  </th>
                  <th className="ui-label-sm py-3 pr-4 text-right" style={{ color: '#f2f2f2' }}>
                    Sua fatia
                  </th>
                  <th className="ui-label-sm py-3 text-right" style={{ color: '#f2f2f2' }}>
                    Recebido
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.map((r) => (
                  <tr key={r.id} className="border-b" style={{ borderColor: '#1a1a1a' }}>
                    <td className="retro-text py-3 pr-4 text-base" style={{ color: '#ffffff' }}>
                      {r.blockNumber}
                    </td>
                    <td className="retro-text py-3 pr-4 text-base" style={{ color: '#ffffff' }}>
                      {new Date(r.createdAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="retro-text py-3 pr-4 text-base text-right" style={{ color: '#ffffff' }}>
                      {r.overwallSnapshot.toLocaleString('pt-BR')}
                    </td>
                    <td className="retro-text py-3 pr-4 text-base text-right" style={{ color: '#ffffff' }}>
                      {(r.share * 100).toFixed(4)}%
                    </td>
                    <td
                      className="retro-text py-3 text-base text-right font-bold"
                      style={{ color: '#7ee07e' }}
                    >
                      {formatStableAmount(r.amountUsdc)} USDT
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </PageContentShell>
  );
}

function PowerStat({
  label,
  value,
  color,
  hint,
}: {
  label: string;
  value: string;
  color: string;
  hint?: string;
}) {
  return (
    <div
      className="pixel-box-light p-4 sm:p-5"
      style={{ borderColor: color, borderWidth: 3, background: '#2d2d2d' }}
    >
      <div className="ui-label-sm mb-2 text-sm sm:text-base" style={{ color: '#f2f2f2' }}>
        {label}
      </div>
      <div className="pixel-text text-xl sm:text-2xl" style={{ color }}>
        {value}
      </div>
      {hint && (
        <p className="retro-text mt-2 text-xs leading-snug sm:text-sm" style={{ color: '#d6d6d6' }}>
          {hint}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      className="pixel-box-light p-5 sm:p-6"
      style={{ borderColor: color, borderWidth: 3, background: '#2d2d2d' }}
    >
      <div className="ui-label-sm mb-2 text-sm sm:text-base" style={{ color: '#f2f2f2' }}>
        {label}
      </div>
      <div className="pixel-text break-words text-xl sm:text-2xl lg:text-3xl" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
