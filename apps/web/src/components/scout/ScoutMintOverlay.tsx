import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ErrorCode } from '@mll/shared';
import type { ScoutPlayerDTO } from '@mll/shared';
import type { ScoutMintPhase } from './useScoutMintAnimation';
import { SCOUT_LANDING_MS, SCOUT_LAP_MS } from './scoutMintConstants';
import { ScoutRevealCarousel } from './ScoutRevealCarousel';
import { buildRarityConfig } from './ScoutRevealCard';
import { ScoutFlightScene } from './ScoutFlightScene';

interface ScoutMintOverlayProps {
  open: boolean;
  phase: ScoutMintPhase;
  quantity: number;
  playerCount: number;
  players: ScoutPlayerDTO[];
  highlightColor: string;
  errorMessage?: string;
  errorCode?: string;
  positionSprites: Record<string, string>;
  onRevealStart: () => void;
  onDismiss: () => void;
  onRetry: () => void;
  onSkip: () => void;
  skipped?: boolean;
  mintPending?: boolean;
}

function RevealParticles({ color }: { color: string }) {
  return (
    <div className="scout-reveal-particles" aria-hidden>
      {Array.from({ length: 24 }).map((_, i) => (
        <motion.span
          key={i}
          className="scout-reveal-particles__dot"
          style={{ background: color }}
          initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0, 1.2, 0.4],
            x: Math.cos((i / 24) * Math.PI * 2) * (80 + (i % 5) * 20),
            y: Math.sin((i / 24) * Math.PI * 2) * (80 + (i % 5) * 20),
          }}
          transition={{ duration: 1.2, delay: 0.1 + i * 0.03, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}

export function ScoutMintOverlay({
  open,
  phase,
  quantity,
  playerCount,
  players,
  highlightColor,
  errorMessage,
  errorCode,
  positionSprites,
  onRevealStart,
  onDismiss,
  onRetry,
  onSkip,
  skipped = false,
  mintPending = false,
}: ScoutMintOverlayProps) {
  const { t } = useTranslation('scout');
  const reducedMotion = useReducedMotion();
  const [lapIndex, setLapIndex] = useState(1);
  const isEmailError = errorCode === ErrorCode.AUTH_EMAIL_NOT_VERIFIED;
  const rarityConfig = useMemo(() => buildRarityConfig(t), [t]);

  const playersWithSprites = useMemo(
    () =>
      players.map((p) => ({
        ...p,
        sprite: positionSprites[p.position] ?? 'bi-shield-fill',
      })),
    [players, positionSprites],
  );

  useEffect(() => {
    if (open && phase === 'scouting') {
      setLapIndex(1);
    }
  }, [open, phase, quantity]);

  useEffect(() => {
    if (!reducedMotion || phase !== 'scouting' || quantity <= 1) return undefined;
    const timer = window.setInterval(() => {
      setLapIndex((prev) => (prev < quantity ? prev + 1 : prev));
    }, SCOUT_LAP_MS);
    return () => window.clearInterval(timer);
  }, [reducedMotion, phase, quantity]);

  useEffect(() => {
    if (phase !== 'landing') return undefined;
    const timer = window.setTimeout(() => {
      onRevealStart();
    }, SCOUT_LANDING_MS);
    return () => window.clearTimeout(timer);
  }, [phase, onRevealStart]);

  const currentLap = useMemo(() => Math.min(lapIndex, quantity), [lapIndex, quantity]);
  const showLanding = phase === 'landing';
  const showReveal = phase === 'reveal';
  const showFlight = phase === 'scouting' || showLanding;
  const isPremiumPull = players.some((p) => p.rarity === 'epic' || p.rarity === 'legendary');

  return (
    <AnimatePresence>
      {open && phase !== 'idle' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 scanlines ${
            showReveal ? 'scout-reveal-backdrop' : 'scout-flight-backdrop'
          }`}
          role="dialog"
          aria-modal="true"
          aria-live="polite"
          aria-label={showReveal ? t('scoutAnimation.revealTitle') : t('scoutAnimation.searching')}
        >
          {showReveal ? (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              className="scout-reveal-stage scout-reveal-stage--pack"
            >
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="scout-reveal-stage__header"
              >
                <p className="pixel-text text-xl sm:text-2xl mb-1" style={{ color: 'var(--gold)' }}>
                  {playerCount > 1
                    ? t('scoutAnimation.landing_many', { count: playerCount })
                    : t('scoutAnimation.landing')}
                </p>
                <p className="retro-text text-sm sm:text-base" style={{ color: 'var(--text-secondary)' }}>
                  {t('scoutAnimation.revealSubtitle')}
                </p>
              </motion.div>

              {isPremiumPull && !reducedMotion && !skipped && <RevealParticles color={highlightColor} />}

              <div className="scout-reveal-stage__body">
                <ScoutRevealCarousel
                  players={playersWithSprites}
                  rarityConfig={rarityConfig}
                  animate={!skipped && !reducedMotion}
                />
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: skipped ? 0 : 0.5 + playersWithSprites.length * 0.12 }}
                className="scout-reveal-stage__actions"
              >
                <button
                  type="button"
                  className="pixel-btn pixel-btn-gold pixel-btn-lg min-w-[220px]"
                  onClick={onDismiss}
                >
                  {t('scoutAnimation.continue')}
                </button>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="pixel-card scout-flight-card w-full max-w-lg p-5 sm:p-6 text-center"
              style={{ borderColor: phase === 'error' ? 'var(--red)' : 'var(--green)' }}
            >
              {phase === 'error' ? (
                <div className="space-y-4">
                  <p className="pixel-text text-lg" style={{ color: 'var(--gold)' }}>
                    <i className={`bi ${isEmailError ? 'bi-envelope-fill' : 'bi-exclamation-triangle-fill'}`} aria-hidden />
                  </p>
                  <p className="retro-text text-lg" style={{ color: 'var(--red)' }}>
                    {errorMessage}
                  </p>
                  {isEmailError && (
                    <p className="retro-text text-base" style={{ color: 'var(--text-secondary)' }}>
                      {t('scoutAnimation.emailHint')}
                    </p>
                  )}
                  <button type="button" className="pixel-btn pixel-btn-blue pixel-btn-md w-full" onClick={onRetry}>
                    {isEmailError ? t('scoutAnimation.close') : t('scoutAnimation.retry')}
                  </button>
                </div>
              ) : (
                <>
                  <motion.p
                    className="pixel-text mb-2 text-lg"
                    style={{ color: showLanding ? 'var(--gold)' : 'var(--green)' }}
                    animate={showFlight && !showLanding ? { opacity: [1, 0.65, 1] } : undefined}
                    transition={
                      showFlight && !showLanding
                        ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }
                        : undefined
                    }
                  >
                    {showLanding
                      ? playerCount > 1
                        ? t('scoutAnimation.landing_many', { count: playerCount })
                        : t('scoutAnimation.landing')
                      : t('scoutAnimation.searching')}
                  </motion.p>

                  {!showLanding && (
                    <p className="ui-label-sm mb-4 tracking-wider" style={{ color: 'var(--gold)' }}>
                      {t('scoutAnimation.flight', { current: currentLap, total: quantity })}
                    </p>
                  )}

                  {showFlight && (
                    <ScoutFlightScene
                      phase={showLanding ? 'landing' : 'scouting'}
                      currentLap={currentLap}
                      totalLaps={quantity}
                      highlightColor={highlightColor}
                      reducedMotion={reducedMotion}
                      onLapComplete={() => {
                        if (lapIndex < quantity) {
                          setLapIndex((prev) => prev + 1);
                        }
                      }}
                    />
                  )}

                  {showLanding && (
                    <motion.div
                      className="mx-auto mt-2 h-1 rounded-sm"
                      style={{
                        background: highlightColor,
                        boxShadow: `0 0 16px ${highlightColor}`,
                      }}
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: 140, opacity: 1 }}
                      transition={{ duration: 0.45, ease: 'easeOut' }}
                    />
                  )}

                  <button
                    type="button"
                    className="scout-skip-btn"
                    onClick={onSkip}
                    disabled={skipped && mintPending}
                  >
                    {skipped && mintPending
                      ? t('scoutAnimation.skipOpening')
                      : t('scoutAnimation.skipOpen')}
                  </button>
                </>
              )}
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
