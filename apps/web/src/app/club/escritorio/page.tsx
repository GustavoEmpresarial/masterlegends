import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isOfficeStaffImageAvatar } from '@mll/shared';
import {
  useOffice,
  useOfficeAction,
  useClub,
  useOfficeAfflictions,
  useCoachFeeReport,
  type OfficeAfflictionDTO,
} from '../../../hooks/useApi';
import { resolveUploadUrl } from '../../../lib/resolveUploadUrl';
import { PageContentShell } from '../../../components/content';
import { StadiumLicensesPanel } from '../../../components/office/StadiumLicensesPanel';

const OFFICE_PORTRAIT = {
  treasurer: '/ui/pixel/office-treasurer.png',
  coach: '/ui/pixel/office-coach.png',
} as const;

const OFFICE_EVENT_POPUP_KEY = 'mll_office_event_seen';

const AFFLICTION_LABELS: Record<string, { icon: string; label: string }> = {
  stomachache: { icon: 'bi-emoji-frown', label: 'Dor de barriga' },
  injury: { icon: 'bi-bandaid-fill', label: 'Lesão' },
  fatigue: { icon: 'bi-moon-stars-fill', label: 'Fadiga extrema' },
  suspension: { icon: 'bi-slash-circle-fill', label: 'Suspensão' },
  personal_issues: { icon: 'bi-emoji-frown-fill', label: 'Problemas pessoais' },
};

const TARGET_LABELS: Record<string, { icon: string; label: string }> = {
  coach: { icon: 'bi-person-video3', label: 'Treinador' },
  treasurer: { icon: 'bi-briefcase-fill', label: 'Tesoureiro' },
};

function OfficeEventPopup({
  afflictions,
  onClose,
}: {
  afflictions: OfficeAfflictionDTO[];
  onClose: () => void;
}) {
  const staffEvents = afflictions.filter((a) => a.targetKind === 'coach');
  if (staffEvents.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="office-event-popup"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.75)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.85, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 22 }}
          className="pixel-card max-w-sm w-full space-y-4"
          style={{ borderColor: 'var(--red)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-center space-y-1">
            <p className="pixel-text text-2xl" style={{ color: 'var(--red)' }}><i className="bi bi-exclamation-triangle-fill" aria-hidden /> EVENTO ATIVO</p>
            <p className="retro-text text-sm" style={{ color: 'var(--text-muted)' }}>
              Seu staff está afetado. Confira abaixo:
            </p>
          </div>

          <div className="space-y-3">
            {staffEvents.map((a) => {
              const expires = new Date(a.expiresAt);
              const diffMs = expires.getTime() - Date.now();
              const diffH = Math.floor(diffMs / 3_600_000);
              const diffM = Math.floor((diffMs % 3_600_000) / 60_000);
              const timeLeft = diffH > 0 ? `${diffH}h ${diffM}min` : `${diffM}min`;
              return (
                <div
                  key={a.id}
                  className="pixel-box-light p-3 space-y-1"
                  style={{ borderColor: 'var(--red)' }}
                >
                  <p className="retro-text text-sm font-bold" style={{ color: 'var(--red)' }}>
                    {TARGET_LABELS[a.targetKind] ? (<><i className={`bi ${TARGET_LABELS[a.targetKind].icon}`} aria-hidden /> {TARGET_LABELS[a.targetKind].label}</>) : a.targetKind}
                  </p>
                  <p className="retro-text text-sm" style={{ color: '#ffffff' }}>
                    {AFFLICTION_LABELS[a.code] ? (<><i className={`bi ${AFFLICTION_LABELS[a.code].icon}`} aria-hidden /> {AFFLICTION_LABELS[a.code].label}</>) : a.code}
                  </p>
                  {a.note && (
                    <p className="retro-text text-xs" style={{ color: 'var(--text-muted)' }}>
                      {a.note}
                    </p>
                  )}
                  <p className="retro-text text-xs" style={{ color: 'var(--gold)' }}>
                    <i className="bi bi-stopwatch-fill" aria-hidden /> Expira em {timeLeft}
                  </p>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            className="pixel-btn pixel-btn-md w-full"
            style={{ borderColor: 'var(--text-muted)', color: '#ffffff' }}
            onClick={onClose}
          >
            FECHAR
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—';

const fmtDateTime = (s: string | null) =>
  s
    ? new Date(s).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

/** USDC — enough decimals so micro taxas (2% de cotas pequenas) não viram "0,00". */
const fmtUSD = (n: number) => {
  if (!Number.isFinite(n) || n === 0) return '0,00';
  const abs = Math.abs(n);
  const maxFrac = abs >= 1 ? 2 : abs >= 0.01 ? 4 : abs >= 0.0001 ? 6 : 8;
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: maxFrac,
  });
};

interface StaffCardProps {
  kind: 'coach' | 'treasurer';
  name: string;
  role: string;
  avatar: string;
  accent: string;
  perks: { icon: string; text: string }[];
  hired: boolean;
  enabled: boolean;
  weekly: number;
  nextBilling: string | null;
  balance: number;
  pending: boolean;
  afflicted: boolean;
  afflictionExpiresAt: string | null;
  /** Coach only — yield fee fraction 0–1 */
  miningFeePct?: number;
  onHire: () => void;
  onFire: () => void;
}

function StaffCard({
  kind,
  name,
  role,
  avatar,
  accent,
  perks,
  hired,
  enabled,
  weekly,
  nextBilling,
  balance,
  pending,
  afflicted,
  afflictionExpiresAt,
  miningFeePct,
  onHire,
  onFire,
}: StaffCardProps) {
  const hasWeekly = weekly > 0;
  const canAfford = !hasWeekly || balance >= weekly;
  const effectiveAccent = afflicted ? '#666666' : accent;
  const showYieldFee = miningFeePct !== undefined;

  const afflictionTimeLeft = afflictionExpiresAt ? (() => {
    const diffMs = new Date(afflictionExpiresAt).getTime() - Date.now();
    const h = Math.floor(diffMs / 3_600_000);
    const m = Math.floor((diffMs % 3_600_000) / 60_000);
    return h > 0 ? `${h}h ${m}min` : `${m}min`;
  })() : null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 220, damping: 22 }}
      className="pixel-card relative overflow-hidden"
      style={{
        borderColor: effectiveAccent,
        filter: afflicted ? 'saturate(0.65)' : undefined,
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 30% 0%, ${effectiveAccent}, transparent 60%)`,
        }}
      />

      <div className="relative space-y-4">
        <div
          className="mx-auto pixel-box-light flex items-center justify-center overflow-hidden"
          style={{
            width: '100%',
            maxWidth: 220,
            aspectRatio: '1',
            borderColor: effectiveAccent,
            boxShadow: `0 0 24px color-mix(in srgb, ${effectiveAccent} 35%, transparent), inset 0 0 0 2px rgba(0,0,0,0.25)`,
            background: `linear-gradient(180deg, color-mix(in srgb, ${effectiveAccent} 18%, var(--bg-medium)) 0%, var(--bg-dark) 100%)`,
          }}
        >
          {isOfficeStaffImageAvatar(avatar) ? (
            <img
              src={resolveUploadUrl(avatar)}
              alt={name}
              className="w-[88%] h-[88%] object-contain drop-shadow-lg"
              style={{
                imageRendering: 'pixelated',
                filter: `drop-shadow(0 8px 16px color-mix(in srgb, ${accent} 50%, transparent))`,
              }}
            />
          ) : (
            <img
              src={OFFICE_PORTRAIT[kind]}
              alt={name}
              className="w-[88%] h-[88%] object-contain"
              style={{ imageRendering: 'pixelated' }}
            />
          )}
        </div>

        <div className="min-w-0 text-center sm:text-left">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="pixel-text text-lg sm:text-xl" style={{ color: effectiveAccent }}>
                {name}
              </h2>
              <p className="retro-text text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                {role}
              </p>
            </div>
            <span
              className="ui-label-sm shrink-0 px-2 py-1 self-center sm:self-start"
              style={{
                background: hired
                  ? 'rgba(98,200,98,0.22)'
                  : afflicted
                    ? 'rgba(224,88,88,0.22)'
                    : 'rgba(255,255,255,0.12)',
                color: hired && !afflicted ? 'var(--green-light)' : afflicted ? 'var(--red-light)' : '#ffffff',
                borderRadius: 2,
                border: `1px solid ${hired && !afflicted ? 'var(--green)' : afflicted ? 'var(--red)' : 'rgba(255,255,255,0.25)'}`,
              }}
            >
              {hired && !afflicted ? '● CONTRATADO' : afflicted ? <><i className="bi bi-exclamation-triangle-fill" aria-hidden /> INDISPOSTO</> : enabled ? '○ DISPONÍVEL' : '○ INDISPONÍVEL'}
            </span>
          </div>
        </div>

        {afflicted && (
          <div
            className="retro-text text-sm text-center py-2 px-3"
            style={{
              background: 'rgba(224,88,88,0.2)',
              border: '1px solid var(--red)',
              color: '#ffc9c9',
            }}
          >
            <i className="bi bi-exclamation-triangle-fill" aria-hidden /> EVENTO ATIVO — staff indisposto por {afflictionTimeLeft ?? '...'}
          </div>
        )}

        <ul className="space-y-2">
          {perks.map((p) => (
            <li key={p.text} className="retro-text text-base flex items-start gap-2 leading-snug" style={{ color: '#ffffff' }}>
              <span className="text-lg shrink-0" style={{ color: effectiveAccent }}>{p.icon}</span>
              <span>{p.text}</span>
            </li>
          ))}
        </ul>

        <div className="pixel-box-light p-4 grid grid-cols-2 gap-3 retro-text text-base">
          {showYieldFee ? (
            <div>
              <p className="mb-1" style={{ color: 'var(--text-secondary)' }}>Taxa s/ patrocínio</p>
              <p className="pixel-text text-xl" style={{ color: 'var(--gold)' }}>
                {((miningFeePct ?? 0) * 100).toFixed(1)}%
              </p>
            </div>
          ) : hasWeekly ? (
            <div>
              <p className="mb-1" style={{ color: 'var(--text-secondary)' }}>Mensalidade</p>
              <p className="pixel-text text-xl" style={{ color: 'var(--gold)' }}>
                {fmtUSD(weekly)} <span className="text-sm" style={{ color: '#ffffff' }}>USDC/sem</span>
              </p>
            </div>
          ) : (
            <div>
              <p className="mb-1" style={{ color: 'var(--text-secondary)' }}>Cobrança</p>
              <p className="pixel-text text-xl" style={{ color: '#ffffff' }}>
                Grátis
              </p>
            </div>
          )}
          <div className="text-right">
            {hasWeekly ? (
              <>
                <p className="mb-1" style={{ color: 'var(--text-secondary)' }}>
                  {hired ? 'Próxima cobrança' : 'Status'}
                </p>
                <p className="pixel-text text-xl" style={{ color: hired ? effectiveAccent : '#ffffff' }}>
                  {hired ? fmtDate(nextBilling) : '—'}
                </p>
              </>
            ) : (
              <>
                <p className="mb-1" style={{ color: 'var(--text-secondary)' }}>Status</p>
                <p className="pixel-text text-xl" style={{ color: hired ? effectiveAccent : '#ffffff' }}>
                  {hired ? 'Ativo' : '—'}
                </p>
              </>
            )}
          </div>
        </div>

        {!enabled ? (
          <p className="retro-text text-sm text-center py-2" style={{ color: '#ffffff' }}>
            Contratação temporariamente desativada pelo clube.
          </p>
        ) : hired ? (
          <button
            type="button"
            className="pixel-btn pixel-btn-md w-full disabled:opacity-50"
            style={{ borderColor: 'var(--red)', color: '#ffffff' }}
            disabled={pending}
            onClick={onFire}
          >
            DEMITIR
          </button>
        ) : (
          <button
            type="button"
            className="pixel-btn pixel-btn-md w-full disabled:opacity-50"
            style={{
              borderColor: canAfford ? accent : 'var(--text-muted)',
              color: '#ffffff',
            }}
            disabled={pending || !canAfford}
            onClick={onHire}
          >
            {hasWeekly
              ? canAfford
                ? `CONTRATAR · ${fmtUSD(weekly)} USDC`
                : 'SALDO INSUFICIENTE'
              : 'CONTRATAR'}
          </button>
        )}
      </div>
    </motion.section>
  );
}

type EscritorioTab = 'diretoria' | 'licencas';

export function EscritorioPage() {
  const { t } = useTranslation(['club', 'common']);
  const { data: club, isLoading: clubLoading } = useClub();
  const { data: office, isLoading } = useOffice();
  const { data: feeReport } = useCoachFeeReport();
  const { data: afflictionsData } = useOfficeAfflictions();
  const action = useOfficeAction();
  const [showEventPopup, setShowEventPopup] = useState(false);
  const [tab, setTab] = useState<EscritorioTab>('diretoria');

  const activeStaffEvents = (afflictionsData?.items ?? []).filter(
    (a) => a.targetKind === 'coach',
  );

  useEffect(() => {
    if (activeStaffEvents.length > 0 && !sessionStorage.getItem(OFFICE_EVENT_POPUP_KEY)) {
      setShowEventPopup(true);
    }
  }, [activeStaffEvents.length]);

  const handleCloseEventPopup = () => {
    sessionStorage.setItem(OFFICE_EVENT_POPUP_KEY, '1');
    setShowEventPopup(false);
  };

  if (clubLoading || isLoading) {
    return (
      <div className="pixel-card text-center py-16">
        <p className="retro-text text-xl" style={{ color: 'var(--text-muted)' }}>
          {t('common:labels.status.loading')}
        </p>
      </div>
    );
  }

  if (!club) {
    return (
      <div className="pixel-card text-center py-12">
        <p className="retro-text mb-4">{t('club:create.subtitle')}</p>
        <Link to="/club" className="pixel-btn pixel-btn-green pixel-btn-md">
          {t('club:create.title')}
        </Link>
      </div>
    );
  }
  if (!office) return null;

  const balance = office.usdcBalance;
  const totalWeekly =
    (office.treasurer.hired ? office.treasurer.weeklyUsdc : 0) +
    (office.coach.hired ? office.coach.weeklyUsdc : 0);
  const feePctLabel = `${(office.coach.miningFeePct * 100).toFixed(1)}%`;

  return (
    <PageContentShell>
      {showEventPopup && (
        <OfficeEventPopup
          afflictions={activeStaffEvents}
          onClose={handleCloseEventPopup}
        />
      )}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="pixel-card pixel-card-fluid w-full min-w-0 relative overflow-hidden"
        style={{ borderColor: 'var(--purple)' }}
      >
        <div
          aria-hidden
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{ background: 'radial-gradient(circle at 80% -20%, var(--purple), transparent 50%)' }}
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="pixel-text text-xl sm:text-2xl" style={{ color: 'var(--purple-light)' }}>
              <i className="bi bi-building-fill" aria-hidden /> Escritório
            </h1>
            <p className="retro-text text-base mt-2 leading-relaxed" style={{ color: '#ffffff' }}>
              O treinador cobra {feePctLabel} sobre cada cota de patrocínio enquanto contratado.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full min-w-0 shrink-0">
            <div className="pixel-box-light px-3 py-2 text-center min-w-0 flex-1">
              <p className="retro-text text-sm" style={{ color: 'var(--text-secondary)' }}>Saldo USDC</p>
              <p className="pixel-text text-base" style={{ color: 'var(--gold)' }}>
                {fmtUSD(balance)}
              </p>
            </div>
            {totalWeekly > 0 ? (
              <div className="pixel-box-light px-3 py-2 text-center min-w-0 flex-1">
                <p className="retro-text text-sm" style={{ color: 'var(--text-secondary)' }}>Folha/sem</p>
                <p className="pixel-text text-base" style={{ color: 'var(--red-light)' }}>
                  -{fmtUSD(totalWeekly)}
                </p>
              </div>
            ) : (
              <div className="pixel-box-light px-3 py-2 text-center min-w-0 flex-1">
                <p className="retro-text text-sm" style={{ color: 'var(--text-secondary)' }}>Taxa coach</p>
                <p className="pixel-text text-base" style={{ color: office.coach.hired ? 'var(--gold)' : '#ffffff' }}>
                  {office.coach.hired ? feePctLabel : '—'}
                </p>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      <div
        className="grid grid-cols-2 gap-3 sm:gap-4"
        role="tablist"
        aria-label="Seções do Escritório"
      >
        {(
          [
            { id: 'diretoria' as const, label: 'Diretoria', icon: 'bi-briefcase-fill' },
            { id: 'licencas' as const, label: 'Licenças', icon: 'bi-file-earmark-text-fill' },
          ] as const
        ).map((tb) => {
          const active = tab === tb.id;
          return (
            <button
              key={tb.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(tb.id)}
              className="pixel-text w-full px-3 py-3 text-center text-xs tracking-widest sm:px-4 sm:py-3.5 sm:text-sm"
              style={{
                background: active ? 'color-mix(in srgb, var(--gold) 22%, var(--bg-medium))' : 'var(--bg-medium)',
                border: active ? '3px solid var(--gold)' : '3px solid var(--bg-lighter)',
                boxShadow: active
                  ? '3px 3px 0 #000, 0 0 14px color-mix(in srgb, var(--gold) 35%, transparent)'
                  : '3px 3px 0 #000',
                color: active ? 'var(--gold)' : '#ffffff',
                cursor: 'pointer',
                imageRendering: 'pixelated',
              }}
            >
              <span className="mr-2" aria-hidden>
                <i className={`bi ${tb.icon}`} />
              </span>
              {tb.label}
            </button>
          );
        })}
      </div>

      {tab === 'licencas' && <StadiumLicensesPanel />}

      {tab === 'diretoria' && (
      <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StaffCard
          kind="coach"
          name={office.coach.name}
          role={office.coach.roleLabel}
          avatar={office.coach.avatar}
          accent={office.coach.accent}
          perks={office.coach.perks}
          hired={office.coach.hired}
          enabled={office.coach.enabled}
          weekly={office.coach.weeklyUsdc}
          nextBilling={office.coach.nextBillingAt}
          balance={balance}
          pending={action.isPending}
          afflicted={office.coach.afflicted}
          afflictionExpiresAt={office.coach.afflictionExpiresAt}
          miningFeePct={office.coach.miningFeePct}
          onHire={() => void action.mutateAsync({ kind: 'coach', action: 'hire' })}
          onFire={() => void action.mutateAsync({ kind: 'coach', action: 'fire' })}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="pixel-card space-y-5"
        style={{ borderColor: 'var(--gold)' }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 max-w-xl">
            <h2 className="pixel-text text-xl sm:text-2xl" style={{ color: 'var(--gold)' }}>
              Relatório — Taxa do treinador
            </h2>
            <p className="retro-text text-base mt-2 leading-relaxed" style={{ color: '#ffffff' }}>
              Debitada automaticamente sobre cada cota de patrocínio enquanto o treinador está contratado.
            </p>
          </div>
          <Link
            to="/wallet"
            className="retro-text text-base font-semibold underline shrink-0"
            style={{ color: 'var(--blue-light)' }}
          >
            Ver extrato na Wallet →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="pixel-box-light px-4 py-4 text-center">
            <p className="retro-text text-base mb-1" style={{ color: 'var(--text-secondary)' }}>
              Total debitado
            </p>
            <p className="pixel-text text-2xl" style={{ color: 'var(--red-light)' }}>
              {fmtUSD(feeReport?.totalFees ?? 0)}
            </p>
          </div>
          <div className="pixel-box-light px-4 py-4 text-center">
            <p className="retro-text text-base mb-1" style={{ color: 'var(--text-secondary)' }}>
              Cobranças
            </p>
            <p className="pixel-text text-2xl" style={{ color: '#ffffff' }}>
              {feeReport?.txCount ?? 0}
            </p>
          </div>
          <div className="pixel-box-light px-4 py-4 text-center">
            <p className="retro-text text-base mb-1" style={{ color: 'var(--text-secondary)' }}>
              Última
            </p>
            <p className="pixel-text text-lg sm:text-xl" style={{ color: '#ffffff' }}>
              {fmtDateTime(feeReport?.lastAt ?? null)}
            </p>
          </div>
        </div>

        {(feeReport?.recent?.length ?? 0) > 0 ? (
          <div className="space-y-2">
            <p className="retro-text text-base uppercase tracking-wide" style={{ color: '#ffffff' }}>
              Última cobrança
            </p>
            {/* Mobile: cards — only the latest entry */}
            <ul className="space-y-2 sm:hidden">
              {feeReport!.recent.slice(0, 1).map((row) => (
                <li
                  key={row.id}
                  className="pixel-box-light px-4 py-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="retro-text text-base font-semibold" style={{ color: '#f8fafc' }}>
                      {fmtDateTime(row.createdAt)}
                    </span>
                    <span className="pixel-text text-lg" style={{ color: '#f87171' }}>
                      -{fmtUSD(row.amount)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2 retro-text text-base" style={{ color: 'var(--text-secondary)' }}>
                    <span>Bloco {row.blockNumber ?? '—'}</span>
                    <span>Bruto {row.gross != null ? fmtUSD(row.gross) : '—'}</span>
                  </div>
                </li>
              ))}
            </ul>
            {/* Desktop: table */}
            <div className="hidden sm:block overflow-x-auto rounded-sm" style={{ background: 'rgba(0,0,0,0.35)' }}>
              <table className="w-full retro-text text-base">
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.1)' }}>
                    <th className="text-left py-3 px-4" style={{ color: '#ffffff' }}>Data</th>
                    <th className="text-left py-3 px-4" style={{ color: '#ffffff' }}>Bloco</th>
                    <th className="text-right py-3 px-4" style={{ color: '#ffffff' }}>Bruto</th>
                    <th className="text-right py-3 px-4" style={{ color: '#ffffff' }}>Taxa</th>
                  </tr>
                </thead>
                <tbody>
                  {feeReport!.recent.slice(0, 1).map((row) => (
                    <tr key={row.id} style={{ borderTop: '1px solid rgba(255,255,255,0.14)' }}>
                      <td className="py-3.5 px-4" style={{ color: '#ffffff' }}>
                        {fmtDateTime(row.createdAt)}
                      </td>
                      <td className="py-3.5 px-4 font-mono" style={{ color: 'var(--text-secondary)' }}>
                        {row.blockNumber ?? '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right" style={{ color: '#ffffff' }}>
                        {row.gross != null ? fmtUSD(row.gross) : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right pixel-text text-base" style={{ color: 'var(--red-light)' }}>
                        -{fmtUSD(row.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="retro-text text-base text-center py-6 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Nenhuma taxa registrada ainda. Aparece após cotas de patrocínio com o treinador contratado.
          </p>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="pixel-card"
        style={{ borderColor: 'rgba(255,255,255,0.28)' }}
      >
        <p className="retro-text text-base leading-relaxed" style={{ color: '#ffffff' }}>
          <i className="bi bi-lightbulb-fill" aria-hidden /> Com o treinador contratado, <strong style={{ color: 'var(--gold)' }}>{feePctLabel}</strong> de cada
          cota de patrocínio é debitada como taxa (visível no relatório acima e no extrato da Wallet).
          Sem mensalidade semanal em USDC.
        </p>
      </motion.div>
      </>
      )}
    </PageContentShell>
  );
}
