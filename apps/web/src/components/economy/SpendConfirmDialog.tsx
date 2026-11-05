import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

export type SpendChannel = 'p2p' | 'shop' | 'pass';

interface SpendConfirmDialogProps {
  mode: 'confirm' | 'receipt';
  channel: SpendChannel;
  itemName: string;
  amountGmt: number;
  /** Saldo atual. No modo confirm o diálogo calcula o saldo depois. */
  balanceGmt?: number | null;
  /** Saldo depois do débito. Usado no comprovante. */
  balanceAfter?: number | null;
  pending?: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function formatSpendGmt(value: number, locale = 'pt-BR'): string {
  if (!Number.isFinite(value)) return '0';
  const cents = Math.round(value * 100) / 100;
  const fractional = Math.abs(cents - Math.trunc(cents)) > 1e-8;
  return cents.toLocaleString(locale, {
    minimumFractionDigits: fractional ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

export function SpendConfirmDialog({
  mode,
  channel,
  itemName,
  amountGmt,
  balanceGmt = null,
  balanceAfter = null,
  pending = false,
  error = '',
  onCancel,
  onConfirm,
}: SpendConfirmDialogProps) {
  const { t, i18n } = useTranslation('market');
  const locale = i18n.resolvedLanguage || i18n.language || 'pt-BR';
  const amountLabel = formatSpendGmt(amountGmt, locale);
  const isReceipt = mode === 'receipt';
  const insufficient = !isReceipt && balanceGmt != null && balanceGmt < amountGmt;
  const nextBalance = isReceipt
    ? balanceAfter
    : balanceGmt != null
      ? balanceGmt - amountGmt
      : null;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) onCancel();
    };
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onCancel, pending]);

  const accent = isReceipt ? 'var(--green)' : 'var(--red)';
  const title = isReceipt
    ? t('spendConfirm.receiptTitle')
    : channel === 'p2p'
      ? t('spendConfirm.titleP2p')
      : channel === 'pass'
        ? t('spendConfirm.titlePass')
        : t('spendConfirm.titleShop');

  return createPortal(
    <div
      className="fixed inset-x-0 bottom-0 z-[97] flex items-center justify-center overflow-y-auto p-3 sm:p-6"
      style={{ top: 'var(--app-header-h)', background: 'rgba(0,0,0,0.86)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="spend-confirm-title"
      data-testid="spend-confirm-dialog"
      onClick={() => {
        if (!pending) onCancel();
      }}
    >
      <div
        className="pixel-card w-full max-w-3xl max-h-full overflow-y-auto space-y-5"
        style={{
          borderColor: accent,
          borderWidth: 4,
          padding: '28px 22px',
          boxShadow: `0 0 0 6px ${accent}33, 0 24px 60px rgba(0,0,0,0.55)`,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <p
          className="pixel-text text-center text-sm sm:text-base tracking-wide"
          style={{ color: accent }}
        >
          {isReceipt ? t('spendConfirm.receiptEyebrow') : t('spendConfirm.eyebrow')}
        </p>
        <h2
          id="spend-confirm-title"
          className="pixel-text text-center leading-tight"
          style={{ color: 'var(--gold)', fontSize: 'clamp(1.6rem, 4vw, 2.6rem)' }}
        >
          {title}
        </h2>
        <p className="retro-text text-center text-base sm:text-lg" style={{ color: '#fff' }}>
          <span style={{ color: 'var(--text-muted)' }}>
            {channel === 'p2p'
              ? t('spendConfirm.channelP2p')
              : channel === 'pass'
                ? t('spendConfirm.channelPass')
                : t('spendConfirm.channelShop')}
            {' · '}
          </span>
          {itemName}
        </p>

        <div
          className="pixel-box px-4 py-6 text-center"
          style={{
            borderColor: accent,
            borderWidth: 4,
            background: isReceipt ? 'rgba(34,197,94,0.14)' : 'rgba(220,38,38,0.16)',
          }}
        >
          <div className="pixel-text text-sm sm:text-base mb-2" style={{ color: '#fff' }}>
            {isReceipt ? t('spendConfirm.youSpent') : t('spendConfirm.youSpend')}
          </div>
          <div
            className="pixel-text leading-none"
            data-testid="spend-amount"
            style={{ color: 'var(--gold)', fontSize: 'clamp(2.8rem, 9vw, 5.5rem)' }}
          >
            {isReceipt ? '−' : ''}
            {amountLabel}
          </div>
          <div className="pixel-text text-2xl sm:text-4xl mt-2" style={{ color: 'var(--gold)' }}>
            GMT
          </div>
        </div>

        {(balanceGmt != null || nextBalance != null) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {!isReceipt && balanceGmt != null && (
              <BalanceCell
                label={t('spendConfirm.balanceNow')}
                value={`${formatSpendGmt(balanceGmt, locale)} GMT`}
              />
            )}
            {nextBalance != null && !insufficient && (
              <BalanceCell
                label={t('spendConfirm.balanceAfter')}
                value={`${formatSpendGmt(nextBalance, locale)} GMT`}
                emphasize
              />
            )}
          </div>
        )}

        <p
          className="retro-text text-base sm:text-xl text-center leading-snug"
          style={{ color: isReceipt ? '#bbf7d0' : '#fecaca' }}
        >
          {isReceipt ? t('spendConfirm.receiptHint') : t('spendConfirm.warning')}
        </p>

        {insufficient && (
          <p className="retro-text text-center text-lg" style={{ color: 'var(--red)' }} role="alert">
            {t('spendConfirm.insufficient')}
          </p>
        )}
        {error && (
          <p className="retro-text text-center text-lg" style={{ color: 'var(--red)' }} role="alert">
            {error}
          </p>
        )}

        {isReceipt ? (
          <button
            type="button"
            className="pixel-btn pixel-btn-green pixel-btn-lg w-full whitespace-normal leading-tight"
            style={{ height: 'auto', minHeight: '4.5rem', padding: '14px 16px' }}
            onClick={onConfirm}
            autoFocus
          >
            {t('spendConfirm.close')}
          </button>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              className="pixel-btn pixel-btn-lg w-full whitespace-normal leading-tight"
              style={{
                height: 'auto',
                minHeight: '4.5rem',
                padding: '14px 16px',
                background: 'var(--bg-light)',
                borderColor: '#fff',
              }}
              disabled={pending}
              onClick={onCancel}
              autoFocus
            >
              {t('spendConfirm.cancel')}
            </button>
            <button
              type="button"
              className="pixel-btn pixel-btn-red pixel-btn-lg w-full whitespace-normal leading-tight"
              style={{ height: 'auto', minHeight: '4.5rem', padding: '14px 16px' }}
              data-testid="spend-confirm"
              disabled={pending || insufficient}
              onClick={onConfirm}
            >
              {pending
                ? t('spendConfirm.confirming')
                : insufficient
                  ? t('spendConfirm.insufficient')
                  : t('spendConfirm.confirm', { amount: amountLabel })}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function BalanceCell({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div
      className="px-4 py-3 text-center"
      style={{ border: `2px solid ${emphasize ? 'var(--green)' : 'rgba(255,255,255,0.2)'}` }}
    >
      <div className="retro-text text-sm" style={{ color: 'var(--text-muted)' }}>
        {label}
      </div>
      <div
        className="pixel-text text-xl sm:text-2xl mt-1"
        style={{ color: emphasize ? 'var(--green)' : '#fff' }}
      >
        {value}
      </div>
    </div>
  );
}
