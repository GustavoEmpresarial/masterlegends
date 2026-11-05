import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { stakeExitSplit } from '@mll/shared';

interface StakeConfirmDialogProps {
  mode: 'stake' | 'unstake';
  playerName: string;
  stakeGmt: number;
  stakedAt?: string | null;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function formatStakeGmt(value: number | string): string {
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount)) return '0';
  const cents = Math.round(amount * 100) / 100;
  const fractional = Math.abs(cents - Math.trunc(cents)) > 1e-8;
  return cents.toLocaleString('pt-BR', {
    minimumFractionDigits: fractional ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

function heldLabel(days: number): string {
  if (days <= 0) return 'hoje';
  if (days === 1) return 'há 1 dia';
  return `há ${days} dias`;
}

export function StakeConfirmDialog({
  mode,
  playerName,
  stakeGmt,
  stakedAt,
  pending = false,
  onCancel,
  onConfirm,
}: StakeConfirmDialogProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, pending]);

  const previewAt = mode === 'unstake' ? stakedAt || Date.now() : Date.now();
  const split = stakeExitSplit(stakeGmt, previewAt);
  const penalty = formatStakeGmt(split.penaltyGmt);
  const returned = formatStakeGmt(split.returnedGmt);
  const locked = formatStakeGmt(stakeGmt);

  return createPortal(
    <div
      className="fixed inset-x-0 bottom-0 z-[97] flex items-center justify-center overflow-y-auto p-4"
      style={{ top: 'var(--app-header-h)', background: 'rgba(0,0,0,0.72)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="stake-confirm-title"
      onClick={() => {
        if (!pending) onCancel();
      }}
    >
      <div
        className="pixel-card w-full max-w-md max-h-full overflow-y-auto space-y-4"
        style={{ borderColor: 'var(--gold)' }}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="stake-confirm-title" className="pixel-text text-lg text-center" style={{ color: 'var(--gold)' }}>
          {mode === 'stake' ? 'CONFIRMAR STAKE' : 'TIRAR STAKE'}
        </h2>
        <p className="retro-text text-sm text-center" style={{ color: '#fff' }}>
          {mode === 'stake'
            ? `Travar ${locked} GMT em ${playerName}.`
            : `${playerName} está em stake ${heldLabel(split.daysHeld)}.`}
        </p>
        <div className="space-y-1 px-3 py-3" style={{ border: '1px solid rgba(255,196,0,0.35)' }}>
          {mode === 'stake' ? (
            <p className="retro-text text-sm" style={{ color: 'var(--text-secondary)' }}>
              Se tirar hoje, perde {penalty} GMT (30%) e voltam {returned} GMT.
            </p>
          ) : split.penaltyPercent > 0 ? (
            <p className="retro-text text-sm" style={{ color: 'var(--text-secondary)' }}>
              Penalidade {split.penaltyPercent}%: perde {penalty} GMT. Voltam {returned} GMT.
            </p>
          ) : (
            <p className="retro-text text-sm" style={{ color: 'var(--text-secondary)' }}>
              30 dias completos. Os {locked} GMT voltam inteiros.
            </p>
          )}
          <p className="retro-text text-[11px]" style={{ color: 'var(--text-muted)' }}>
            A penalidade começa em 30% e cai 1% por dia. No 30º dia o GMT volta inteiro.
          </p>
        </div>
        <div className="flex gap-3">
          <button type="button" className="pixel-btn pixel-btn-md flex-1" disabled={pending} onClick={onCancel}>
            CANCELAR
          </button>
          <button
            type="button"
            className={`pixel-btn pixel-btn-md flex-1 ${mode === 'stake' ? 'pixel-btn-gold' : 'pixel-btn-red'}`}
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? '…' : mode === 'stake' ? `TRAVA ${locked} GMT` : 'TIRAR'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
