interface WalletMinAmountCalloutProps {
  badgeLabel: string;
  hintLabel?: string;
  accent?: 'gold' | 'green';
}

export function WalletMinAmountCallout({
  badgeLabel,
  hintLabel,
  accent = 'gold',
}: WalletMinAmountCalloutProps) {
  const borderColor = accent === 'gold' ? 'var(--gold)' : 'var(--green)';

  return (
    <div className="pixel-box-light px-4 py-3" style={{ borderColor }}>
      <p className="retro-text text-base sm:text-lg font-bold" style={{ color: borderColor }}>
        <i className="bi bi-cash-stack" aria-hidden /> {badgeLabel}
      </p>
      {hintLabel && (
        <p className="retro-text mt-1 text-sm sm:text-base" style={{ color: 'var(--text-secondary)' }}>
          {hintLabel}
        </p>
      )}
    </div>
  );
}
