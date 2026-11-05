import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { ScoutPlayerDTO } from '@mll/shared';
import { SCOUT_COST_GMT, SCOUT_LATERAL_CHANCE } from '@mll/shared';
import { useAuth } from '../../hooks/useAuth';
import { useScoutRules } from '../../hooks/useApi';
import { ScoutMintConfirm } from '../../components/scout/ScoutMintConfirm';
import { ScoutMintOverlay } from '../../components/scout/ScoutMintOverlay';
import { useScoutMintAnimation } from '../../components/scout/useScoutMintAnimation';
import { ScoutRevealCarousel } from '../../components/scout/ScoutRevealCarousel';
import { buildRarityConfig } from '../../components/scout/ScoutRevealCard';
import { highestRarity, rarityColor } from '../../components/scout/scoutMintConstants';
import { PageContentShell } from '../../components/content';

function formatGmt(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(4).replace(/\.?0+$/, '');
}

type RevealedPlayer = ScoutPlayerDTO & { sprite: string };

function formatChancePct(pct: number | undefined): string {
  if (pct == null || Number.isNaN(pct)) return '—';
  if (pct >= 1 && Number.isInteger(pct)) return `${pct}%`;
  if (pct < 0.1) return `${pct.toFixed(4).replace(/\.?0+$/, '')}%`;
  return `${pct.toFixed(2).replace(/\.?0+$/, '')}%`;
}

function formatOverwallRange(min: number, max: number): string {
  const fmt = (n: number) => {
    if (n >= 1000) {
      const k = n / 1000;
      return Number.isInteger(k) ? `${k}K` : `${k.toFixed(1).replace(/\.0$/, '')}K`;
    }
    return String(n);
  };
  return `${fmt(min)}–${fmt(max)}`;
}

export function ScoutPage() {
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation('scout');
  const [quantity, setQuantity] = useState(1);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [revealedNFTs, setRevealedNFTs] = useState<RevealedPlayer[]>([]);
  const {
    phase,
    players,
    error,
    errorCode,
    quantity: mintQuantity,
    startMint,
    skipToReveal,
    reset,
    completeLanding,
    showReveal,
    skipped,
    isActive,
    isPending,
  } = useScoutMintAnimation();

  const { data: remoteRules } = useScoutRules();
  const MINT_PRICE = remoteRules?.effectiveCostUsdc ?? SCOUT_COST_GMT;
  const BASE_PRICE = remoteRules?.costUsdc ?? SCOUT_COST_GMT;
  const discountPct = remoteRules?.discountPct ?? 0;
  const hasDiscount = discountPct > 0;
  const totalCost = parseFloat((quantity * MINT_PRICE).toFixed(4));

  const positionSprites: Record<string, string> = {
    GK: 'bi-hand-index-thumb-fill', DEF: 'bi-shield-fill', LAT: 'bi-arrow-left-right', MID: 'bi-bullseye', FW: 'bi-lightning-charge-fill',
  };

  const rarityConfig = useMemo(() => buildRarityConfig(t), [t]);
  const apiRarities = remoteRules?.rarities ?? [];

  const legendaryChance = formatChancePct(
    apiRarities.find((rule) => rule.id === 'legendary')?.chancePct,
  );

  const handleMint = () => {
    if (!isAuthenticated || isActive) return;
    setConfirmOpen(true);
  };

  const handleConfirmMint = async () => {
    setConfirmOpen(false);
    setRevealedNFTs([]);
    await startMint(quantity);
  };

  const handleRevealStart = () => {
    setRevealedNFTs(players.map((p) => ({ ...p, sprite: positionSprites[p.position] ?? 'bi-shield-fill' })));
    showReveal();
  };

  useEffect(() => {
    if (phase !== 'reveal' || players.length === 0) return;
    setRevealedNFTs(players.map((p) => ({ ...p, sprite: positionSprites[p.position] ?? 'bi-shield-fill' })));
  }, [phase, players]);

  const highlightColor = useMemo(() => {
    if (players.length === 0) return 'var(--gold)';
    return rarityColor(highestRarity(players.map((p) => p.rarity)));
  }, [players]);

  const overwallRanges = useMemo(() => {
    return apiRarities.map((rule) => ({
      id: rule.id,
      label: rarityConfig[rule.id]?.label ?? rule.id,
      color: rarityConfig[rule.id]?.color ?? 'var(--rarity-common)',
      range: formatOverwallRange(rule.overwallMin, rule.overwallMax),
    }));
  }, [apiRarities, rarityConfig]);

  const staminaDrainRows = useMemo(() => {
    return [...apiRarities].reverse().map((rule) => ({
      id: rule.id,
      label: rarityConfig[rule.id]?.label ?? rule.id,
      drain: rule.staminaDrainPerHour,
      color: rarityConfig[rule.id]?.color ?? 'var(--rarity-common)',
    }));
  }, [apiRarities, rarityConfig]);

  return (
    <PageContentShell>
      <ScoutMintOverlay
        open={isActive} phase={phase} quantity={mintQuantity} playerCount={players.length}
        players={players} highlightColor={highlightColor} errorMessage={error} errorCode={errorCode}
        positionSprites={positionSprites} onRevealStart={handleRevealStart}
        onDismiss={completeLanding} onRetry={reset}
        onSkip={skipToReveal} skipped={skipped} mintPending={isPending}
      />

      {/* ── HERO BANNER ── */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden pixel-card text-center py-10 px-6"
        style={{ borderColor: 'var(--green)', background: 'linear-gradient(160deg, rgba(0,200,100,0.07) 0%, rgba(0,0,0,0) 60%)' }}
      >
        {/* bg glow */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse at 50% -10%, rgba(0,200,100,0.18) 0%, transparent 65%)',
        }} />

        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ repeat: Infinity, duration: 2.6, ease: 'easeInOut' }}
          className="text-7xl mb-4 select-none"
        >
          <i className="bi bi-box-seam-fill" aria-hidden />
        </motion.div>

        <h1 className="pixel-text text-2xl sm:text-3xl md:text-4xl mb-2" style={{ color: 'var(--green)' }}>
          <i className="bi bi-search me-2" />
          {t('title')}
        </h1>
        <p className="retro-text text-base sm:text-lg" style={{ color: 'var(--text-secondary)' }}>
          {t('subtitle')}
        </p>

        {/* Quick stats strip */}
        <div className="flex flex-wrap justify-center gap-4 mt-6">
          {[
            {
              icon: 'bi-coin',
              label: t('info.price'),
              value: hasDiscount
                ? `${formatGmt(MINT_PRICE)} GMT (−${Math.round(discountPct * 100)}%)`
                : `${formatGmt(MINT_PRICE)} GMT`,
              color: 'var(--gold)',
            },
            { icon: 'bi-layers-fill', label: t('info.rarities'), value: t('info.fiveTypes'), color: 'var(--purple)' },
            { icon: 'bi-trophy-fill', label: t('info.legendary'), value: legendaryChance, color: 'var(--rarity-legendary)' },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-2 px-4 py-2 pixel-box" style={{ borderColor: s.color + '80' }}>
              <i className={`bi ${s.icon} text-lg`} style={{ color: s.color }} />
              <span className="retro-text text-sm" style={{ color: 'var(--text-muted)' }}>{s.label}</span>
              <span className="pixel-text text-base" style={{ color: s.color }}>{s.value}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── MINT PANEL ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="pixel-card max-w-lg mx-auto space-y-5"
        style={{ borderColor: 'var(--gold)' }}
      >
        <h2 className="pixel-text text-lg text-center" style={{ color: 'var(--gold)' }}>
          <i className="bi bi-person-badge-fill me-2" />
          {t('pack')}
        </h2>

        {hasDiscount && (
          <p className="retro-text text-sm text-center" style={{ color: 'var(--gold)' }}>
            <i className="bi bi-fire" aria-hidden /> {Math.round(discountPct * 100)}% DE DESCONTO NO MINT — de {formatGmt(BASE_PRICE)} para {formatGmt(MINT_PRICE)} GMT
          </p>
        )}

        {/* Quantity */}
        <div className="pixel-box p-4">
          <p className="retro-text text-sm mb-3 text-center" style={{ color: 'var(--text-muted)' }}>
            <i className="bi bi-hash me-1" />{t('quantity')}
          </p>
          <div className="flex items-center justify-center gap-5">
            <button
              type="button"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={isActive || quantity <= 1}
              className="pixel-btn pixel-btn-md disabled:opacity-30 w-11 h-11 flex items-center justify-center text-xl"
              style={{ background: 'var(--bg-light)', borderColor: 'var(--bg-lighter)' }}
            >
              <i className="bi bi-dash-lg" />
            </button>
            <motion.span
              key={quantity}
              initial={{ scale: 1.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="pixel-text text-5xl w-16 text-center tabular-nums"
              style={{ color: 'var(--green)' }}
            >
              {quantity}
            </motion.span>
            <button
              type="button"
              onClick={() => setQuantity(Math.min(10, quantity + 1))}
              disabled={isActive || quantity >= 10}
              className="pixel-btn pixel-btn-md disabled:opacity-30 w-11 h-11 flex items-center justify-center text-xl"
              style={{ background: 'var(--bg-light)', borderColor: 'var(--bg-lighter)' }}
            >
              <i className="bi bi-plus-lg" />
            </button>
          </div>
          {/* Quick picks */}
          <div className="flex justify-center gap-2 mt-3 flex-wrap">
            {[1, 3, 5, 10].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setQuantity(q)}
                className={`pixel-btn pixel-btn-sm ${quantity === q ? 'pixel-btn-gold' : ''}`}
              >
                {q}×
              </button>
            ))}
          </div>
        </div>

        {/* Total + button */}
        <div
          className="flex items-center justify-between px-5 py-3 pixel-box"
          style={{ borderColor: 'var(--gold)', background: 'rgba(255,200,0,0.06)' }}
        >
          <span className="retro-text text-sm" style={{ color: 'var(--text-muted)' }}>
            <i className="bi bi-receipt me-1" />{t('total')}
          </span>
            <span className="pixel-text text-2xl" style={{ color: 'var(--gold)', textShadow: '0 0 10px var(--gold)' }}>
            {formatGmt(totalCost)} GMT
          </span>
        </div>

        <motion.button
          type="button"
          onClick={() => void handleMint()}
          disabled={!isAuthenticated || isActive || isPending}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="pixel-btn pixel-btn-gold pixel-btn-lg w-full text-xl flex items-center justify-center gap-3 disabled:opacity-50"
        >
          {isActive ? (
            <>
              <i className="bi bi-hourglass-split" style={{ animation: 'spin 1.2s linear infinite' }} />
              {t('scoutAnimation.searching')}
            </>
          ) : (
            <>
              <i className="bi bi-lightning-charge-fill" />
              {t('mint', { count: quantity })}
            </>
          )}
        </motion.button>

        <div className="space-y-2">
          <h3 className="pixel-text text-sm" style={{ color: 'var(--text-primary)' }}>{t('rulesTitle')}</h3>
          <ul className="space-y-1 retro-text text-sm" style={{ color: 'var(--text-secondary)' }}>
            <li>{t('rules.attributes')}</li>
            <li>{t('rules.lateral', { pct: Math.round(SCOUT_LATERAL_CHANCE * 100) })}</li>
            <li>{t('rules.payment')}</li>
            <li>{t('rules.inventory')}</li>
          </ul>
        </div>
      </motion.div>

      {confirmOpen && (
        <ScoutMintConfirm
          quantity={quantity}
          totalLabel={formatGmt(totalCost)}
          lateralPct={Math.round(SCOUT_LATERAL_CHANCE * 100)}
          rarities={apiRarities}
          rarityConfig={rarityConfig}
          formatChance={formatChancePct}
          formatRange={formatOverwallRange}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => void handleConfirmMint()}
        />
      )}

      {/* ── INFO GRID ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        {/* Chances */}
        <div className="pixel-card space-y-3" style={{ borderColor: 'var(--cyan)' }}>
          <h3 className="pixel-text text-base flex items-center gap-2" style={{ color: 'var(--cyan)' }}>
            <i className="bi bi-bar-chart-fill" />
            {t('chances')}
          </h3>
          {[...apiRarities].reverse().map((rule) => {
            const config = rarityConfig[rule.id];
            const color = config?.color ?? 'var(--rarity-common)';
            const chance = formatChancePct(rule.chancePct);
            const barW = Math.min(98, Math.max(4, Math.log10(rule.chancePct + 0.0001) * 55 + 100));
            return (
              <div key={rule.id} className="relative overflow-hidden rounded-sm" style={{ border: `1px solid ${color}40` }}>
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ width: `${barW}%`, background: `${color}18` }}
                />
                <div className="relative flex items-center justify-between px-3 py-2">
                  <span className="retro-text text-sm flex items-center gap-1.5" style={{ color }}>
                    <i className="bi bi-gem text-xs" />
                    {config?.label ?? rule.id}
                  </span>
                  <span className="pixel-text text-sm tabular-nums font-bold" style={{ color }}>
                    {chance}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Overwall ranges */}
        <div className="pixel-card space-y-3" style={{ borderColor: 'var(--blue)' }}>
          <h3 className="pixel-text text-base flex items-center gap-2" style={{ color: 'var(--blue)' }}>
            <i className="bi bi-speedometer2" />
            {t('overwallTitle')}
          </h3>
          {overwallRanges.map((item) => (
            <div key={item.id} className="flex items-center justify-between px-3 py-2 rounded-sm" style={{ border: `1px solid ${item.color}40`, background: `${item.color}0d` }}>
              <span className="retro-text text-sm flex items-center gap-1.5" style={{ color: item.color }}>
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: item.color }} />
                {item.label}
              </span>
              <span className="pixel-text text-sm tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {item.range}
              </span>
            </div>
          ))}
        </div>

        {/* Stamina drain */}
        <div className="pixel-card space-y-3" style={{ borderColor: 'var(--purple)' }}>
          <div>
            <h3 className="pixel-text text-base flex items-center gap-2" style={{ color: 'var(--purple)' }}>
              <i className="bi bi-battery-half" />
              {t('staminaTitle')}
            </h3>
            <p className="retro-text text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              {t('staminaHint')}
            </p>
          </div>
          {staminaDrainRows.map((item) => (
            <div key={item.id} className="flex items-center justify-between px-3 py-2 rounded-sm" style={{ border: `1px solid ${item.color}40`, background: `${item.color}0d` }}>
              <span className="retro-text text-sm flex items-center gap-1.5" style={{ color: item.color }}>
                <i className="bi bi-lightning-charge text-xs" />
                {item.label}
              </span>
              <span className="pixel-text text-sm font-bold tabular-nums" style={{ color: item.color }}>
                -{item.drain}/h
              </span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── REVEALED ── */}
      <AnimatePresence>
        {revealedNFTs.length > 0 && phase === 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            <h2 className="pixel-text text-2xl text-center flex items-center justify-center gap-3" style={{ color: 'var(--gold)' }}>
              <i className="bi bi-stars" />
              {t('recruited')}
              <i className="bi bi-stars" />
            </h2>
            <div className="flex justify-center">
              <ScoutRevealCarousel players={revealedNFTs} rarityConfig={rarityConfig} animate={false} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageContentShell>
  );
}
