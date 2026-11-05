import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { AuthUserDTO } from '@mll/shared';
import { apiClient } from '../../lib/api/client';
import { useAuth } from '../../hooks/useAuth';
import { translateError } from '../../lib/apiError';

export const REPLAY_TUTORIAL_EVENT = 'mll:replay-tutorial';

const STEP_STORAGE_KEY = 'mll:tutorial-step';

const STEP_IDS = [
  'freeStart',
  'lineup',
  'checkin',
  'patrocinios',
  'wallet',
  'scout',
  'office',
  'economy',
  'referrals',
  'ready',
] as const;
type StepId = (typeof STEP_IDS)[number];

const STEP_META: Record<
  StepId,
  { image: string; icon: string; color: string }
> = {
  freeStart: {
    image: '/tutorial/01-free-start.png',
    icon: 'bi-gift',
    color: 'var(--green)',
  },
  lineup: {
    image: '/tutorial/02-lineup.png',
    icon: 'bi-people',
    color: 'var(--blue)',
  },
  checkin: {
    image: '/tutorial/03-checkin.png',
    icon: 'bi-calendar-check',
    color: 'var(--gold)',
  },
  patrocinios: {
    image: '/tutorial/04-patrocinios.png',
    icon: 'bi-cash-coin',
    color: '#f59e0b',
  },
  wallet: {
    image: '/tutorial/05-wallet.png',
    icon: 'bi-wallet2',
    color: 'var(--purple)',
  },
  scout: {
    image: '/tutorial/06-scout.png',
    icon: 'bi-binoculars',
    color: 'var(--green)',
  },
  office: {
    image: '/tutorial/07-escritorio.png',
    icon: 'bi-briefcase',
    color: '#38bdf8',
  },
  economy: {
    image: '/tutorial/08-economy.png',
    icon: 'bi-currency-exchange',
    color: 'var(--gold)',
  },
  referrals: {
    image: '/tutorial/09-referrals.png',
    icon: 'bi-share',
    color: 'var(--green)',
  },
  ready: {
    image: '/tutorial/10-ready.png',
    icon: 'bi-rocket-takeoff',
    color: 'var(--green)',
  },
};

const READABLE_FONT = 'var(--font-sans)';

function readStoredStep(userId: string): number {
  try {
    const raw = sessionStorage.getItem(`${STEP_STORAGE_KEY}:${userId}`);
    if (raw == null) return 0;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n)) return 0;
    return Math.min(Math.max(0, n), STEP_IDS.length - 1);
  } catch {
    return 0;
  }
}

function writeStoredStep(userId: string, index: number) {
  try {
    sessionStorage.setItem(`${STEP_STORAGE_KEY}:${userId}`, String(index));
  } catch {
    /* ignore quota / private mode */
  }
}

function clearStoredStep(userId: string) {
  try {
    sessionStorage.removeItem(`${STEP_STORAGE_KEY}:${userId}`);
  } catch {
    /* ignore */
  }
}

export function requestTutorialReplay() {
  window.dispatchEvent(new CustomEvent(REPLAY_TUTORIAL_EVENT));
}

export function OnboardingTutorial() {
  const { t } = useTranslation(['club', 'auth', 'common']);
  const { user, isAuthenticated, patchUser } = useAuth();
  const [replayOpen, setReplayOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState('');
  const [imageFailed, setImageFailed] = useState(false);

  const mandatory = Boolean(
    isAuthenticated && user && user.emailVerified && !user.tutorialCompleted,
  );
  const open = mandatory || replayOpen;

  useEffect(() => {
    const onReplay = () => {
      setStepIndex(0);
      setCompleteError('');
      setImageFailed(false);
      setReplayOpen(true);
    };
    window.addEventListener(REPLAY_TUTORIAL_EVENT, onReplay);
    return () => window.removeEventListener(REPLAY_TUTORIAL_EVENT, onReplay);
  }, []);

  useEffect(() => {
    if (!mandatory || !user?.id) return;
    setStepIndex(readStoredStep(user.id));
    setCompleteError('');
    setImageFailed(false);
  }, [mandatory, user?.id]);

  useEffect(() => {
    if (!mandatory || !user?.id || !open) return;
    writeStoredStep(user.id, stepIndex);
  }, [mandatory, user?.id, open, stepIndex]);

  useEffect(() => {
    setImageFailed(false);
  }, [stepIndex]);

  const steps = useMemo(
    () =>
      STEP_IDS.map((id) => {
        const bulletsRaw = t(`club:tutorial.steps.${id}.bullets`, {
          returnObjects: true,
        });
        const bullets = Array.isArray(bulletsRaw)
          ? (bulletsRaw as string[])
          : [];
        return {
          id,
          ...STEP_META[id],
          title: t(`club:tutorial.steps.${id}.title`),
          where: t(`club:tutorial.steps.${id}.where`),
          body: t(`club:tutorial.steps.${id}.body`),
          bullets,
        };
      }),
    [t],
  );

  const step = steps[stepIndex]!;
  const isLast = stepIndex >= steps.length - 1;
  const isFirst = stepIndex === 0;

  const goTo = useCallback((index: number) => {
    setStepIndex(Math.min(Math.max(0, index), STEP_IDS.length - 1));
  }, []);

  const handleCloseReplay = useCallback(() => {
    if (mandatory) return;
    setReplayOpen(false);
  }, [mandatory]);

  const handleComplete = async () => {
    if (completing) return;
    if (replayOpen && !mandatory) {
      setReplayOpen(false);
      return;
    }
    setCompleting(true);
    setCompleteError('');
    try {
      const { data } = await apiClient.post<AuthUserDTO>('/auth/complete-tutorial');
      if (user?.id) clearStoredStep(user.id);
      patchUser({
        tutorialCompleted: data.tutorialCompleted ?? true,
        emailVerified: data.emailVerified,
      });
      setReplayOpen(false);
    } catch (err) {
      setCompleteError(translateError(err, 'AUTH_REGISTER_FAILED'));
    } finally {
      setCompleting(false);
    }
  };

  if (!open || !user) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-6"
        style={{ background: 'rgba(0,0,0,0.88)' }}
        onClick={handleCloseReplay}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 20 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          className="relative w-full max-w-5xl overflow-hidden rounded-2xl border bg-[#0c1219] shadow-2xl"
          style={{
            borderColor: `color-mix(in srgb, ${step.color} 45%, transparent)`,
            boxShadow: `0 0 48px color-mix(in srgb, ${step.color} 28%, transparent)`,
            fontFamily: READABLE_FONT,
            letterSpacing: 'normal',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="h-1.5 w-full" style={{ background: step.color }} />

          {!mandatory && (
            <button
              type="button"
              onClick={handleCloseReplay}
              className="absolute top-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full text-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
              aria-label={t('club:tutorial.closeReplay')}
            >
              <i className="bi bi-x-lg" aria-hidden />
            </button>
          )}

          <div className="grid max-h-[min(92vh,900px)] grid-cols-1 md:grid-cols-[240px_1fr] lg:grid-cols-[260px_1fr]">
            <aside
              className="hidden border-r border-white/5 bg-black/25 p-4 md:flex md:flex-col"
              aria-label={t('club:tutorial.badge')}
            >
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t('club:tutorial.badge')}
              </p>
              <ol className="flex flex-1 flex-col gap-1 overflow-y-auto">
                {steps.map((s, i) => {
                  const active = i === stepIndex;
                  const done = i < stepIndex;
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        disabled={completing}
                        onClick={() => goTo(i)}
                        className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors"
                        style={{
                          background: active
                            ? `color-mix(in srgb, ${s.color} 16%, transparent)`
                            : 'transparent',
                          border: active
                            ? `1px solid color-mix(in srgb, ${s.color} 40%, transparent)`
                            : '1px solid transparent',
                        }}
                      >
                        <span
                          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                          style={{
                            background: active || done ? s.color : '#1e293b',
                            color: active || done ? '#0c1219' : '#94a3b8',
                          }}
                        >
                          {done ? <i className="bi bi-check-lg" aria-hidden /> : i + 1}
                        </span>
                        <span
                          className="text-[13px] font-medium leading-snug"
                          style={{
                            color: active ? '#f8fafc' : done ? '#cbd5e1' : '#94a3b8',
                          }}
                        >
                          {s.title}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </aside>

            <div className="flex min-h-0 flex-col overflow-y-auto p-4 sm:p-6 md:p-7">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-slate-400">
                  {t('club:tutorial.stepOf', {
                    current: stepIndex + 1,
                    total: steps.length,
                  })}
                </p>
                {mandatory && (
                  <button
                    type="button"
                    className="shrink-0 rounded-lg border border-slate-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-300 disabled:cursor-wait disabled:opacity-50"
                    disabled={completing}
                    aria-busy={completing}
                    onClick={() => void handleComplete()}
                  >
                    {completing ? t('club:tutorial.finishing') : t('club:tutorial.skip')}
                  </button>
                )}
              </div>

              <div className="mb-4 flex gap-1.5 md:hidden">
                {steps.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-label={s.title}
                    disabled={completing}
                    onClick={() => goTo(i)}
                    className="h-1.5 flex-1 rounded-full transition-colors"
                    style={{
                      background:
                        i <= stepIndex
                          ? step.color
                          : 'rgba(148, 163, 184, 0.25)',
                    }}
                  />
                ))}
              </div>

              <div
                className="relative mb-5 aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-[#080d14]"
                style={{
                  boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${step.color} 20%, transparent)`,
                }}
              >
                {!imageFailed ? (
                  <img
                    src={step.image}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={() => setImageFailed(true)}
                  />
                ) : (
                  <div
                    className="flex h-full w-full flex-col items-center justify-center gap-3"
                    style={{
                      background: `linear-gradient(145deg, color-mix(in srgb, ${step.color} 22%, #0c1219), #0c1219)`,
                    }}
                  >
                    <i
                      className={`bi ${step.icon} text-5xl sm:text-6xl`}
                      style={{ color: step.color }}
                      aria-hidden
                    />
                  </div>
                )}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                >
                  <div
                    className="mb-3 inline-flex max-w-full items-center gap-2 rounded-lg border px-3 py-1.5 text-[13px] font-semibold sm:text-sm"
                    style={{
                      color: step.color,
                      borderColor: `color-mix(in srgb, ${step.color} 45%, transparent)`,
                      background: `color-mix(in srgb, ${step.color} 12%, transparent)`,
                    }}
                  >
                    <i className="bi bi-geo-alt-fill shrink-0" aria-hidden />
                    <span className="truncate">{step.where}</span>
                  </div>

                  <h2
                    className="mb-2 text-xl font-bold leading-snug sm:text-2xl"
                    style={{ color: step.color }}
                  >
                    {step.title}
                  </h2>
                  <p className="mb-4 text-[15px] leading-relaxed text-slate-200 sm:text-base">
                    {step.body}
                  </p>
                  {step.bullets.length > 0 && (
                    <ol className="mb-6 list-none space-y-2.5">
                      {step.bullets.map((bullet, i) => (
                        <li
                          key={bullet}
                          className="flex gap-2.5 text-[14px] leading-snug text-slate-300 sm:text-[15px]"
                        >
                          <span
                            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                            style={{
                              background: `color-mix(in srgb, ${step.color} 22%, transparent)`,
                              color: step.color,
                            }}
                          >
                            {i + 1}
                          </span>
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </motion.div>
              </AnimatePresence>

              {completeError && (
                <p role="alert" className="mb-3 text-sm text-red-400">{completeError}</p>
              )}

              <div className="mt-auto flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                {!isFirst && (
                  <button
                    type="button"
                    className="rounded-lg border border-slate-600 px-5 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-800 sm:text-base"
                    disabled={completing}
                    onClick={() => goTo(stepIndex - 1)}
                  >
                    {t('club:tutorial.prev')}
                  </button>
                )}
                {!isLast ? (
                  <button
                    type="button"
                    className="rounded-lg px-5 py-2.5 text-sm font-semibold text-[#0c1219] transition-opacity hover:opacity-90 sm:text-base"
                    style={{ background: step.color }}
                    disabled={completing}
                    onClick={() => goTo(stepIndex + 1)}
                  >
                    {t('club:tutorial.next')}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="rounded-lg px-5 py-2.5 text-sm font-semibold text-[#0c1219] transition-opacity hover:opacity-90 disabled:opacity-50 sm:text-base"
                    style={{ background: 'var(--green)' }}
                    disabled={completing}
                    onClick={() => void handleComplete()}
                  >
                    {completing
                      ? t('club:tutorial.finishing')
                      : mandatory
                        ? t('club:tutorial.finish')
                        : t('club:tutorial.closeReplay')}
                  </button>
                )}
              </div>

              {mandatory && (
                <p className="mt-4 text-center text-xs text-slate-500 sm:text-sm">
                  {t('club:tutorial.mandatoryHint')}
                </p>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
