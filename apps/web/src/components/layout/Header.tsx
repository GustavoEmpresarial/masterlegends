import 'bootstrap-icons/font/bootstrap-icons.min.css';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { useClub, useCtView } from '../../hooks/useApi';
import { formatGmtAmount, formatStableAmount } from '../../lib/formatUsdc';
import { isStadiumLiveWidget } from '../../lib/stadiumLiveWidget';
import { LanguageSwitcher } from './LanguageSwitcher';
import { BrandMark } from './BrandMark';
import { PixelCrest } from './PixelCrest';
import { PixelGlyph } from './PixelGlyph';
import { isMarketingRoute } from './marketingRoutes';

function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}

/** USDT minerado: sobe na navbar entre as atualizações e conta o salto quando o saldo cresce. */
function useMinedTicker(target: number | undefined) {
  const [shown, setShown] = useState(target ?? 0);
  const [rising, setRising] = useState(false);
  const shownRef = useRef(target ?? 0);
  const rateRef = useRef(0);
  const ready = useRef(false);
  const last = useRef<{ value: number; at: number } | null>(null);

  useEffect(() => {
    if (target == null || !Number.isFinite(target)) return;
    const now = performance.now();
    if (!ready.current) {
      ready.current = true;
      shownRef.current = target;
      setShown(target);
      last.current = { value: target, at: now };
      return;
    }
    const prev = last.current;
    const delta = prev ? target - prev.value : 0;
    const seconds = prev ? Math.max(1, (now - prev.at) / 1000) : 1;
    rateRef.current = delta > 0 ? delta / seconds : 0;
    last.current = { value: target, at: now };
    if (delta > 0.0000005) setRising(true);

    const from = shownRef.current;
    const started = performance.now();
    let frame = 0;
    const tick = (time: number) => {
      const elapsed = time - started;
      const catchup = Math.min(1, elapsed / 1400);
      const base = from + (target - from) * easeOut(catchup);
      const extra = catchup >= 1 ? rateRef.current * ((elapsed - 1400) / 1000) : 0;
      const next = base + Math.min(Math.max(0, extra), rateRef.current * 35);
      shownRef.current = next;
      setShown(next);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const pulse = window.setTimeout(() => setRising(false), 1600);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(pulse);
    };
  }, [target]);

  return { shown, rising };
}

function MinedUsdtChip({ amount }: { amount: number }) {
  const { shown, rising } = useMinedTicker(amount);
  return (
    <span className={`pixel-chip${rising ? ' is-rising' : ''}`} style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}>
      {formatStableAmount(shown)} USDT
    </span>
  );
}

export function Header() {
  const { user, isAuthenticated, logout } = useAuth();
  const { data: club } = useClub();
  const { data: ct } = useCtView();
  const { t } = useTranslation('common');
  const { pathname } = useLocation();
  const appShell = isAuthenticated && !isMarketingRoute(pathname) && !isStadiumLiveWidget();
  const stamina = ct?.squadStaminaSummary?.avgStamina;
  const staminaPct = stamina == null ? null : Math.max(0, Math.min(100, Math.round(stamina)));

  if (!appShell) {
    return (
      <header className="sticky top-0 z-[96] shrink-0" style={{ background: 'var(--bg-medium)', borderBottom: '4px solid #000' }}>
        <div className="h-1 shrink-0" style={{ background: 'var(--green)' }} />
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-6">
          <BrandMark asLink compact />
          <div className="flex items-center gap-1.5">
            <LanguageSwitcher />
            {isAuthenticated ? (
              <button type="button" onClick={logout} className="pixel-btn pixel-btn-red pixel-btn-md">
                {t('actions.logout')}
              </button>
            ) : (
              <Link to="/login" className="pixel-btn pixel-btn-blue pixel-btn-md">
                {t('actions.login')}
              </Link>
            )}
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="scoreboard sticky top-0 z-[96] shrink-0">
      <div className="flex min-w-0 flex-col gap-1 px-2 py-1.5 sm:px-3">
        <div className="flex min-h-[3.25rem] min-w-0 items-center gap-2 sm:min-h-[4.75rem] sm:gap-3">
        <Link to="/club" className="crest-mark shrink-0" aria-label={club?.name ?? t('nav.areas.home', { defaultValue: 'INÍCIO' })}>
          <PixelCrest letter={club?.name ?? 'M'} size={44} />
        </Link>

        <div className="min-w-0 flex-1">
          <p className="score-label truncate" style={{ color: 'var(--line)' }}>{club?.name ?? user?.username}</p>
          <p className="score-num text-gold">
            OW {club ? club.totalOverwall.toLocaleString() : '—'}
          </p>
        </div>

        {club && (
          <div className="hidden min-w-0 items-center gap-1 md:flex">
            <span className="pixel-chip pixel-chip-gold">{formatGmtAmount(club.gmtBalance)} GMT</span>
            <span className="pixel-chip" style={{ borderColor: 'var(--green)', color: 'var(--green)' }}>
              {formatStableAmount(club.usdcBalance)} USDC
            </span>
            <MinedUsdtChip amount={club.usdtBalance} />
          </div>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Link to="/avisos" className="pixel-btn pixel-btn-sm" aria-label={t('nav.notices', { defaultValue: 'AVISOS' })}>
            <PixelGlyph name="bell" size={22} />
          </Link>
          <span className="hidden sm:inline-flex">
            <LanguageSwitcher />
          </span>
          <button type="button" onClick={logout} className="pixel-btn pixel-btn-red pixel-btn-sm" aria-label={t('actions.logout')}>
            {t('actions.logout')}
          </button>
        </div>
        </div>
        {club && (
          <div className="flex min-w-0 flex-wrap gap-1 md:hidden">
            <span className="pixel-chip pixel-chip-gold">{formatGmtAmount(club.gmtBalance)} GMT</span>
            <span className="pixel-chip" style={{ borderColor: 'var(--green)', color: 'var(--green)' }}>
              {formatStableAmount(club.usdcBalance)} USDC
            </span>
            <MinedUsdtChip amount={club.usdtBalance} />
          </div>
        )}
      </div>
      <div className="stamina-track stamina-track--hud" title={t('dashboard.energy', { defaultValue: 'ENERGIA' })}>
        <span style={{ width: `${staminaPct ?? 0}%` }} />
      </div>
    </header>
  );
}
