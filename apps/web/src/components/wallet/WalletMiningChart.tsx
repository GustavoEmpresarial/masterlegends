import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MiningAnalyticsPointDTO } from '@mll/shared';
import { useMiningAnalytics } from '../../hooks/useApi';
import { formatStableAmount } from '../../lib/formatUsdc';

function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}

function dayLabel(iso: string): string {
  const [, month, day] = iso.split('-');
  return `${day}/${month}`;
}

export function WalletMiningChart() {
  const { t } = useTranslation('common');
  const { data, isLoading } = useMiningAnalytics();
  const points = data?.points ?? [];
  const target = data?.usdtBalance ?? 0;
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!data) return;
    const start = performance.now();
    const from = 0;
    const to = data.usdtBalance;
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 1600);
      setShown(from + (to - from) * easeOut(progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [data]);

  const chart = useMemo(() => buildChart(points), [points]);
  const mined = points.reduce((sum, point) => sum + point.mined, 0);
  const withdrawn = points.reduce((sum, point) => sum + point.withdrawn, 0);

  if (isLoading) {
    return <p className="retro-text text-sm" style={{ color: 'var(--text-muted)' }}>{t('actions.loading')}</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="ui-label text-xs" style={{ color: 'var(--text-muted)' }}>{t('wallet.analytics.title')}</p>
        <p className="pixel-text text-3xl sm:text-4xl" style={{ color: 'var(--gold)' }}>
          {formatStableAmount(shown)} <span className="retro-text text-base">USDT</span>
        </p>
        <p className="retro-text mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{t('wallet.analytics.hint')}</p>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <span className="retro-text" style={{ color: 'var(--green)' }}>
          {t('wallet.analytics.mined')}: {formatStableAmount(mined)}
        </span>
        <span className="retro-text" style={{ color: 'var(--red)' }}>
          {t('wallet.analytics.withdrawn')}: {formatStableAmount(withdrawn)}
        </span>
      </div>

      <svg viewBox="0 0 600 220" className="w-full" role="img" aria-label={t('wallet.analytics.title')}>
        <line x1="24" y1="16" x2="24" y2="180" stroke="rgba(255,255,255,0.15)" />
        <line x1="24" y1="180" x2="584" y2="180" stroke="rgba(255,255,255,0.15)" />
        {chart.bars.map((bar) => (
          <rect
            key={bar.date}
            className="mining-balance-bar"
            x={bar.x}
            y={bar.y}
            width={bar.width}
            height={bar.height}
            fill={bar.up ? 'rgba(34,197,94,0.55)' : 'rgba(224,88,88,0.7)'}
            style={{ animationDelay: `${bar.index * 25}ms` }}
          />
        ))}
        <path
          className="mining-balance-line"
          d={chart.line ? `M ${chart.line.replace(/ /g, ' L ')}` : ''}
          fill="none"
          stroke="#e0b028"
          strokeWidth="3"
          pathLength={1}
        />
        {chart.labels.map((label) => (
          <text key={label.date} x={label.x} y="206" fill="#f2f2f2" fontSize="11" textAnchor="middle">
            {dayLabel(label.date)}
          </text>
        ))}
      </svg>
    </div>
  );
}

function buildChart(points: MiningAnalyticsPointDTO[]) {
  const width = 560;
  const left = 24;
  const top = 16;
  const height = 164;
  const balances = points.map((point) => point.balance);
  const min = Math.min(0, ...balances);
  const max = Math.max(1, ...balances);
  const span = max - min || 1;
  const nets = points.map((point) => point.mined - point.withdrawn);
  const netMax = Math.max(1, ...nets.map((value) => Math.abs(value)));
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const barWidth = Math.max(2, step * 0.55);

  const line = points
    .map((point, index) => {
      const x = left + index * step;
      const y = top + height - ((point.balance - min) / span) * height;
      return `${x},${y}`;
    })
    .join(' ');

  const bars = points.map((point, index) => {
    const net = nets[index] ?? 0;
    const barHeight = (Math.abs(net) / netMax) * (height * 0.45);
    const x = left + index * step - barWidth / 2;
    return {
      date: point.date,
      index,
      x,
      y: 180 - barHeight,
      width: barWidth,
      height: barHeight,
      up: net >= 0,
    };
  });

  const labelEvery = Math.max(1, Math.ceil(points.length / 6));
  const labels = points
    .map((point, index) => ({ date: point.date, x: left + index * step, index }))
    .filter((label) => label.index % labelEvery === 0 || label.index === points.length - 1);

  return { line, bars, labels };
}
