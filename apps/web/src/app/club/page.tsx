import { useState, useEffect, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useClub, useCreateClub, useScoutRules, useOfficeAfflictions, useCheckInStatus, useClaimCheckIn, type OfficeAfflictionDTO } from '../../hooks/useApi';
import { useAuth } from '../../hooks/useAuth';
import { apiClient } from '../../lib/api/client';
import { translateError } from '../../lib/apiError';
import { PageContentShell } from '../../components/content';
import { ClubHomeDashboard } from '../../components/club/ClubHomeDashboard';

const SCOUT_POPUP_KEY = 'mll_scout_discount_seen';
const CHECKIN_REMINDER_KEY = 'mll_checkin_reminder_seen';

/** Data UTC atual (YYYY-MM-DD) — usada para lembrar 1x por dia UTC. */
function utcDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function popupStorageKey(base: string, userId: string | undefined): string {
  return userId ? `${base}:${userId}` : base;
}

const AFFLICTION_META: Record<string, { label: string; icon: string; color: string }> = {
  stomachache:    { label: 'DOR DE BARRIGA',   icon: 'bi-emoji-frown', color: '#a8ff40' },
  dor_de_barriga: { label: 'DOR DE BARRIGA',   icon: 'bi-emoji-frown', color: '#a8ff40' },
  injury:         { label: 'LESÃO',             icon: 'bi-bandaid-fill', color: '#ff6060' },
  fatigue:        { label: 'FADIGA EXTREMA',    icon: 'bi-moon-stars-fill', color: '#8888ff' },
  suspension:     { label: 'SUSPENSÃO',         icon: 'bi-slash-circle-fill', color: '#ff4444' },
  personal_issues:{ label: 'PROBLEMAS PESSOAIS',icon: 'bi-emoji-neutral', color: '#aaaaaa' },
};

const TARGET_META: Record<string, { label: string; icon: string }> = {
  coach:     { label: 'TREINADOR',  icon: 'bi-person-video3' },
  treasurer: { label: 'TESOUREIRO', icon: 'bi-briefcase-fill' },
};

function OfficeEventPopup({
  afflictions,
  onClose,
}: {
  afflictions: OfficeAfflictionDTO[];
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      <motion.div
        key="office-event-popup"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.88)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 24 }}
          className="w-full max-w-lg"
          onClick={(e) => e.stopPropagation()}
          style={{
            border: '4px solid #ff4444',
            boxShadow: '6px 6px 0px #000, 0 0 0 1px #000',
            background: '#0d0d0d',
            imageRendering: 'pixelated',
          }}
        >
          {/* Header bar */}
          <div
            className="flex items-center justify-between px-4 py-2"
            style={{ background: '#ff4444', borderBottom: '4px solid #000' }}
          >
            <span className="pixel-text text-base text-black tracking-widest">
              <i className="bi bi-exclamation-triangle-fill" aria-hidden /> ALERTA DO CLUBE
            </span>
            <button
              onClick={onClose}
              className="pixel-text text-black text-sm leading-none"
              style={{ lineHeight: 1 }}
            >
              [X]
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            <p className="pixel-text text-center text-sm tracking-widest" style={{ color: '#ff4444' }}>
              !! SEU STAFF FOI AFETADO !!
            </p>

            {afflictions.map((a) => {
              const diffMs = new Date(a.expiresAt).getTime() - Date.now();
              const diffH = Math.floor(diffMs / 3_600_000);
              const diffM = Math.floor((diffMs % 3_600_000) / 60_000);
              const timeLeft = diffH > 0 ? `${diffH}H ${diffM}MIN` : `${diffM}MIN`;
              const afl = AFFLICTION_META[a.code] ?? { label: a.code.toUpperCase(), icon: 'bi-exclamation-lg', color: '#ff4444' };
              const tgt = TARGET_META[a.targetKind] ?? { label: a.targetKind.toUpperCase(), icon: 'bi-question-lg' };
              return (
                <div
                  key={a.id}
                  style={{
                    border: `2px solid ${afl.color}`,
                    boxShadow: `3px 3px 0 #000`,
                    background: '#1a1a1a',
                    padding: '10px 12px',
                  }}
                >
                  {/* Staff alvo */}
                  <div className="flex items-center gap-3 mb-3">
                    <i className={`bi ${tgt.icon}`} style={{ fontSize: 28 }} aria-hidden />
                    <span className="pixel-text text-sm tracking-widest" style={{ color: afl.color }}>
                      {tgt.label}
                    </span>
                  </div>

                  <div style={{ height: 2, background: '#333', margin: '8px 0' }} />

                  <div className="flex items-center gap-3">
                    <i className={`bi ${afl.icon}`} style={{ fontSize: 26 }} aria-hidden />
                    <span className="pixel-text text-sm" style={{ color: '#ffffff' }}>{afl.label}</span>
                  </div>

                  {a.note && (
                    <p className="retro-text text-sm mt-2" style={{ color: '#888', fontStyle: 'italic' }}>
                      &quot;{a.note}&quot;
                    </p>
                  )}

                  <div className="flex items-center justify-end gap-1 mt-3">
                    <span className="pixel-text text-sm" style={{ color: '#ffcc00' }}>
                      <i className="bi bi-stopwatch-fill" aria-hidden /> {timeLeft}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Nota */}
            <p className="retro-text text-sm text-center" style={{ color: '#666' }}>
              O staff afetado não cumpre suas funções enquanto o evento estiver ativo.
            </p>

            <button
              type="button"
              onClick={onClose}
              className="w-full pixel-text text-base tracking-widest py-3"
              style={{
                background: '#ff4444',
                border: '2px solid #000',
                boxShadow: '3px 3px 0 #000',
                color: '#000',
                cursor: 'pointer',
                letterSpacing: '0.1em',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#cc0000'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#ff4444'; }}
            >
              [ OK, ENTENDIDO ]
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function DiscountPromoPopup({
  discountPct,
  onClose,
  emoji,
  title,
  body,
  ctaLabel,
  ctaPath,
}: {
  discountPct: number;
  onClose: () => void;
  emoji: string;
  title: string;
  body: string;
  ctaLabel: ReactNode;
  ctaPath: string;
}) {
  const navigate = useNavigate();
  const pct = Math.round(discountPct * 100);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.88)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 30 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          className="pixel-card max-w-sm w-full text-center relative"
          style={{
            borderColor: 'var(--gold)',
            boxShadow: '0 0 60px rgba(255,200,0,0.35), 0 0 0 1px var(--gold)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 retro-text text-lg"
            style={{ color: 'var(--text-muted)' }}
          >
            <i className="bi bi-x-lg" aria-hidden />
          </button>

          <div className="text-6xl mb-3"><i className={`bi ${emoji}`} aria-hidden /></div>

          <h2 className="pixel-text text-xl mb-1" style={{ color: 'var(--gold)' }}>
            {title}
          </h2>

          <div
            className="pixel-text text-5xl my-4"
            style={{ color: 'var(--green)', textShadow: '0 0 20px rgba(0,255,100,0.6)' }}
          >
            -{pct}%
          </div>

          <p className="retro-text text-lg mb-2" style={{ color: 'var(--text-secondary)' }}>
            {body}
          </p>
          <p className="retro-text text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            Aproveite agora e fortaleça seu clube gastando menos!
          </p>

          <div className="flex flex-col gap-3">
            <button
              className="pixel-btn pixel-btn-gold pixel-btn-md w-full"
              onClick={() => { onClose(); navigate(ctaPath); }}
            >
              {ctaLabel}
            </button>
            <button
              className="pixel-btn pixel-btn-md w-full"
              onClick={onClose}
              style={{ borderColor: 'var(--text-muted)', color: 'var(--text-muted)' }}
            >
              FECHAR
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function CheckInReminderPopup({
  activeOverwall,
  onClaim,
  onClose,
  claiming,
  error,
}: {
  activeOverwall: number;
  onClaim: () => void;
  onClose: () => void;
  claiming: boolean;
  error: string;
}) {
  const { t, i18n } = useTranslation('club');

  return (
    <AnimatePresence>
      <motion.div
        key="checkin-reminder-popup"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.88)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 30 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          className="pixel-card max-w-sm w-full text-center relative"
          style={{
            borderColor: 'var(--gold)',
            boxShadow: '0 0 60px rgba(255,200,0,0.35), 0 0 0 1px var(--gold)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 retro-text text-lg"
            style={{ color: 'var(--text-muted)' }}
          >
            <i className="bi bi-x-lg" aria-hidden />
          </button>

          <div className="text-6xl mb-3"><i className="bi bi-calendar-event-fill" aria-hidden /></div>

          <h2 className="pixel-text text-xl mb-1" style={{ color: 'var(--gold)' }}>
            {t('checkin.popup.title')}
          </h2>

          <div
            className="pixel-text text-5xl my-4"
            style={{ color: 'var(--green)', textShadow: '0 0 20px rgba(0,255,100,0.6)' }}
          >
            {t('checkin.popup.bonusAmount')}
          </div>

          <p className="retro-text text-lg mb-2" style={{ color: 'var(--text-secondary)' }}>
            {t('checkin.popup.notCheckedIn')}
          </p>
          <p className="retro-text text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            {t('checkin.popup.description', {
              amount: activeOverwall.toLocaleString(i18n.language),
            })}
          </p>

          {error && (
            <p className="retro-text text-sm mb-4" style={{ color: 'var(--orange)' }}>
              {error}
            </p>
          )}

          <div className="flex flex-col gap-3">
            <button
              className="pixel-btn pixel-btn-gold pixel-btn-md w-full"
              onClick={onClaim}
              disabled={claiming}
            >
              {claiming ? t('checkin.popup.claiming') : t('checkin.popup.claim')}
            </button>
            <button
              className="pixel-btn pixel-btn-md w-full"
              onClick={onClose}
              disabled={claiming}
              style={{ borderColor: 'var(--text-muted)', color: 'var(--text-muted)' }}
            >
              {t('checkin.popup.later')}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export function ClubPage() {
  const { t } = useTranslation(['club', 'common']);
  const { user } = useAuth();
  const { data: club, isLoading, isError, error, refetch } = useClub();
  const { data: checkInStatus } = useCheckInStatus();
  const claimCheckIn = useClaimCheckIn();
  const createClub = useCreateClub();
  const [clubName, setClubName] = useState('');
  const [createError, setCreateError] = useState('');

  const { data: scoutRules } = useScoutRules();
  const { data: afflictionsData } = useOfficeAfflictions();
  const [showScoutPopup, setShowScoutPopup] = useState(false);
  const [showOfficeEventPopup, setShowOfficeEventPopup] = useState(false);
  const [showCheckInPopup, setShowCheckInPopup] = useState(false);
  const [checkInError, setCheckInError] = useState('');
  const [emailResendMsg, setEmailResendMsg] = useState('');
  const [emailResending, setEmailResending] = useState(false);

  const tutorialDone = Boolean(user?.tutorialCompleted);
  const needsEmailVerify = Boolean(user && !user.emailVerified);
  const activeScoutDiscountPct = scoutRules?.discountPct ?? 0;
  const activeStaffEvents = (afflictionsData?.items ?? []).filter(
    (a) => a.targetKind === 'coach',
  );

  const scoutKey = popupStorageKey(SCOUT_POPUP_KEY, user?.id);
  const checkInKey = popupStorageKey(CHECKIN_REMINDER_KEY, user?.id);

  useEffect(() => {
    if (!tutorialDone || !user?.id) return;
    if (activeScoutDiscountPct > 0 && localStorage.getItem(scoutKey) !== utcDateKey()) {
      setShowScoutPopup(true);
    }
  }, [activeScoutDiscountPct, tutorialDone, user?.id, scoutKey]);

  useEffect(() => {
    if (!tutorialDone) return;
    if (activeStaffEvents.length > 0) {
      setShowOfficeEventPopup(true);
    }
  }, [activeStaffEvents.length, tutorialDone]);

  useEffect(() => {
    if (!tutorialDone || !user?.id) return;
    if (checkInStatus?.canClaimToday && localStorage.getItem(checkInKey) !== utcDateKey()) {
      setShowCheckInPopup(true);
    }
  }, [checkInStatus?.canClaimToday, tutorialDone, user?.id, checkInKey]);

  const handleCloseScoutPopup = () => {
    localStorage.setItem(scoutKey, utcDateKey());
    setShowScoutPopup(false);
  };

  const handleCloseOfficeEventPopup = () => {
    setShowOfficeEventPopup(false);
  };

  const handleCloseCheckInPopup = () => {
    localStorage.setItem(checkInKey, utcDateKey());
    setShowCheckInPopup(false);
    setCheckInError('');
  };

  const handleClaimCheckIn = async () => {
    setCheckInError('');
    try {
      await claimCheckIn.mutateAsync();
      handleCloseCheckInPopup();
    } catch (e) {
      setCheckInError(translateError(e, 'CHECKIN_ALREADY_CLAIMED'));
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    try {
      await createClub.mutateAsync(clubName.trim());
    } catch (err: unknown) {
      setCreateError(translateError(err, 'CLUB_CREATE_FAILED'));
    }
  };

  if (isLoading) {
    return (
      <div className="pixel-card text-center py-16">
        <p className="retro-text text-xl" style={{ color: 'var(--text-muted)' }}>
          {t('common:labels.status.loading')}
        </p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-lg pt-4 lg:pt-8">
        <div className="pixel-card text-center py-8" style={{ borderColor: 'var(--red)' }}>
          <p className="retro-text text-red mb-4">{translateError(error, 'CLUB_LOAD_FAILED')}</p>
          <button type="button" onClick={() => void refetch()} className="pixel-btn pixel-btn-blue pixel-btn-md">
            {t('common:actions.retry', { defaultValue: 'TENTAR DE NOVO' })}
          </button>
        </div>
      </div>
    );
  }

  if (!club) {
    return (
      <div className="max-w-lg pt-4 lg:pt-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="pixel-card"
          style={{ borderColor: 'var(--green)' }}
        >
          <h1 className="pixel-text text-xl sm:text-2xl mb-4 text-center" style={{ color: 'var(--green)' }}>
            <i className="bi bi-shield-fill" aria-hidden /> {t('club:create.title')}
          </h1>
          <p className="retro-text text-lg mb-6 text-center" style={{ color: 'var(--text-secondary)' }}>
            {t('club:create.subtitle')}
          </p>
          {createError && (
            <div className="pixel-box-light p-3 mb-4 border-red">
              <p className="retro-text text-red text-center">{createError}</p>
            </div>
          )}
          <form onSubmit={handleCreate} className="space-y-4">
            <input
              type="text"
              value={clubName}
              onChange={(e) => setClubName(e.target.value)}
              className="pixel-input w-full"
              minLength={3}
              maxLength={32}
              placeholder={t('club:create.placeholder')}
              required
              disabled={createClub.isPending}
            />
            <button
              type="submit"
              className="pixel-btn pixel-btn-green pixel-btn-md w-full"
              disabled={createClub.isPending}
            >
              {createClub.isPending
                ? t('common:labels.status.loading')
                : t('club:create.submit')}
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <>
    {showScoutPopup && (
      <DiscountPromoPopup
        discountPct={activeScoutDiscountPct}
        onClose={handleCloseScoutPopup}
        emoji="bi-coin"
        title="DESCONTO NO MINT!"
        body="Desconto ativo no Scout — recrute atletas pagando menos GMT."
        ctaLabel={<><i className="bi bi-coin" aria-hidden /> IR PARA SCOUT</>}
        ctaPath="/scout"
      />
    )}
    {showOfficeEventPopup && (
      <OfficeEventPopup afflictions={activeStaffEvents} onClose={handleCloseOfficeEventPopup} />
    )}
    {showCheckInPopup && (
      <CheckInReminderPopup
        activeOverwall={checkInStatus?.activeOverwall ?? 0}
        onClaim={() => void handleClaimCheckIn()}
        onClose={handleCloseCheckInPopup}
        claiming={claimCheckIn.isPending}
        error={checkInError}
      />
    )}
    <PageContentShell className="space-y-4">
      {needsEmailVerify && (
        <div
          className="pixel-card flex flex-col sm:flex-row sm:items-center gap-4"
          style={{ borderColor: 'var(--gold)' }}
        >
          <div className="flex-1">
            <p className="score-label mb-2">CONFIRME SEU E-MAIL</p>
            <p className="retro-text text-lg" style={{ color: 'var(--text-secondary)' }}>
              Enviamos um link para {user?.email}. Sem confirmação, saques ficam bloqueados.
            </p>
            {emailResendMsg && (
              <p className="retro-text text-base mt-2" style={{ color: 'var(--green)' }}>
                {emailResendMsg}
              </p>
            )}
          </div>
          <button
            type="button"
            className="pixel-btn pixel-btn-gold pixel-btn-md shrink-0"
            disabled={emailResending}
            onClick={() => {
              void (async () => {
                setEmailResending(true);
                setEmailResendMsg('');
                try {
                  const { data } = await apiClient.post<{ ok: true; alreadyVerified?: boolean }>(
                    '/auth/resend-verification',
                  );
                  setEmailResendMsg(
                    data.alreadyVerified
                      ? t('club:tutorial.email.alreadyVerified')
                      : t('club:tutorial.email.resent'),
                  );
                } catch (err) {
                  setEmailResendMsg(translateError(err, 'AUTH_REGISTER_FAILED'));
                } finally {
                  setEmailResending(false);
                }
              })();
            }}
          >
            {emailResending ? t('club:tutorial.email.resending') : t('club:tutorial.email.resend')}
          </button>
        </div>
      )}
      <ClubHomeDashboard club={club} canClaimCheckIn={Boolean(checkInStatus?.canClaimToday)} />
    </PageContentShell>
    </>
  );
}
