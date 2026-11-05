import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWalletSummary, useWalletSwap } from '../../hooks/useApi';
import { translateError } from '../../lib/apiError';
import { formatGmtAmount, formatStableAmount } from '../../lib/formatUsdc';

type SwapFrom = 'usdc' | 'usdt';

export function WalletSwapForm() {
  const { t } = useTranslation('common');
  const { data: summary } = useWalletSummary();
  const swap = useWalletSwap();
  const [from, setFrom] = useState<SwapFrom>('usdt');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  const gmtBalance = summary?.gmtBalance ?? 0;
  const usdcBalance = summary?.usdcBalance ?? 0;
  const usdtBalance = summary?.usdtBalance ?? 0;
  const rate = summary?.swapRate ?? 1;
  const sourceBalance = from === 'usdt' ? usdtBalance : usdcBalance;
  const parsed = Number(amount);
  const gmtPreview = Number.isFinite(parsed) && parsed > 0 ? parsed * rate : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError(t('wallet.swap.invalidAmount'));
      return;
    }
    if (value > sourceBalance) {
      setError(
        from === 'usdt' ? t('wallet.swap.insufficientUsdt') : t('wallet.swap.insufficientUsdc'),
      );
      return;
    }
    try {
      await swap.mutateAsync({ amount: value, from });
      setAmount('');
    } catch (err) {
      setError(translateError(err, 'UNKNOWN'));
    }
  }

  function setMax() {
    setAmount(String(sourceBalance));
  }

  function selectFrom(next: SwapFrom) {
    setFrom(next);
    setAmount('');
    setError('');
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="mx-auto w-full max-w-2xl space-y-6">
      <div className="pixel-box-light px-5 py-4 sm:px-6 sm:py-5" style={{ borderColor: 'var(--gold)' }}>
        <p className="pixel-text text-lg sm:text-xl" style={{ color: 'var(--gold)' }}>
          <i className="bi bi-lightning-charge-fill" aria-hidden /> {t('wallet.swap.hint', { rate })}
        </p>
        <p className="retro-text mt-2 text-sm sm:text-base" style={{ color: 'var(--text-secondary)' }}>
          {t('wallet.swap.oneWayNote')}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="pixel-box-light p-5 sm:p-6" style={{ borderColor: 'var(--gold)' }}>
          <div className="mb-3 flex items-center gap-3">
            <i className="bi bi-coin text-3xl" aria-hidden />
            <p className="ui-label-sm text-sm sm:text-base" style={{ color: 'var(--text-muted)' }}>
              GMT
            </p>
          </div>
          <p className="pixel-text text-2xl sm:text-3xl" style={{ color: 'var(--gold)' }}>
            {formatGmtAmount(gmtBalance)}
          </p>
          <p className="retro-text mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t('wallet.balances.gmt')}
          </p>
        </div>
        <div className="pixel-box-light p-5 sm:p-6" style={{ borderColor: 'var(--green)' }}>
          <div className="mb-3 flex items-center gap-3">
            <i className="bi bi-cash-stack text-3xl" aria-hidden />
            <p className="ui-label-sm text-sm sm:text-base" style={{ color: 'var(--text-muted)' }}>
              USDC
            </p>
          </div>
          <p className="pixel-text text-2xl sm:text-3xl" style={{ color: 'var(--green)' }}>
            {formatStableAmount(usdcBalance)}
          </p>
          <p className="retro-text mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t('wallet.balances.usdcVault')}
          </p>
        </div>
        <div className="pixel-box-light p-5 sm:p-6" style={{ borderColor: 'var(--blue)' }}>
          <div className="mb-3 flex items-center gap-3">
            <i className="bi bi-currency-dollar text-3xl" aria-hidden />
            <p className="ui-label-sm text-sm sm:text-base" style={{ color: 'var(--text-muted)' }}>
              USDT
            </p>
          </div>
          <p className="pixel-text text-2xl sm:text-3xl" style={{ color: 'var(--blue)' }}>
            {formatStableAmount(usdtBalance)}
          </p>
          <p className="retro-text mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t('wallet.balances.usdt', { defaultValue: 'USDT (saque / mineração)' })}
          </p>
        </div>
      </div>

      <div className="pixel-box-light p-5 sm:p-6 space-y-4" style={{ borderColor: 'var(--purple)' }}>
        <div>
          <span className="ui-label-sm mb-3 block text-sm sm:text-base" style={{ color: 'var(--text-secondary)' }}>
            {t('wallet.swap.fromLabel')}
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`pixel-btn pixel-btn-md min-h-[44px] px-6 ${from === 'usdt' ? 'pixel-btn-gold' : ''}`}
              onClick={() => selectFrom('usdt')}
            >
              USDT → GMT
            </button>
            <button
              type="button"
              className={`pixel-btn pixel-btn-md min-h-[44px] px-6 ${from === 'usdc' ? 'pixel-btn-gold' : ''}`}
              onClick={() => selectFrom('usdc')}
            >
              USDC → GMT
            </button>
          </div>
        </div>

        <label className="block">
          <span className="ui-label-sm mb-3 block text-sm sm:text-base" style={{ color: 'var(--text-secondary)' }}>
            {from === 'usdt' ? t('wallet.swap.amountUsdt') : t('wallet.swap.amountUsdc')}
          </span>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <input
              type="number"
              min={0}
              step="0.01"
              max={sourceBalance}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="pixel-input min-h-[52px] flex-1 text-lg sm:text-xl px-4 py-3"
              placeholder="0.00"
            />
            <button
              type="button"
              className="pixel-btn pixel-btn-md min-h-[52px] px-8 text-base sm:text-lg shrink-0"
              onClick={setMax}
            >
              MAX
            </button>
          </div>
        </label>

        {gmtPreview > 0 && (
          <div
            className="rounded border-2 border-dashed px-4 py-4 sm:px-5 sm:py-5"
            style={{ borderColor: 'var(--gold)', background: 'rgba(255, 200, 50, 0.06)' }}
          >
            <p className="retro-text text-sm sm:text-base" style={{ color: 'var(--text-muted)' }}>
              {t('wallet.swap.youReceive')}
            </p>
            <p className="pixel-text mt-1 text-2xl sm:text-3xl" style={{ color: 'var(--gold)' }}>
              +{formatGmtAmount(gmtPreview)} GMT
            </p>
          </div>
        )}
      </div>

      {error && (
        <p className="retro-text text-center text-sm sm:text-base" style={{ color: 'var(--red)' }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={swap.isPending || !gmtPreview}
        className="pixel-btn pixel-btn-gold pixel-btn-lg w-full min-h-[56px] text-base sm:text-lg"
      >
        {swap.isPending ? t('wallet.tx.pending') : t('wallet.swap.submit')}
      </button>
    </form>
  );
}
