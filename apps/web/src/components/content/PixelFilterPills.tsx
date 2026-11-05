interface FilterOption {
  value: string;
  label: string;
  variant?: 'green' | 'purple' | 'orange' | 'blue' | 'gold' | 'red' | 'muted';
}

interface PixelFilterPillsProps {
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  allLabel?: string;
}

export function PixelFilterPills({
  options,
  value,
  onChange,
  allLabel = 'Todos',
}: PixelFilterPillsProps) {
  return (
    <div className="pixel-filter-row" role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={!value}
        onClick={() => onChange('')}
        className={`pixel-btn pixel-btn-sm ${!value ? 'pixel-btn-green' : ''}`}
        style={!value ? undefined : { background: 'var(--bg-light)', color: 'var(--text-secondary)' }}
      >
        {allLabel}
      </button>
      {options.map((opt) => {
        const active = value === opt.value;
        const activeClass =
          opt.variant === 'purple'
            ? 'pixel-btn-purple'
            : opt.variant === 'orange'
              ? ''
              : opt.variant === 'blue'
                ? 'pixel-btn-blue'
                : active
                  ? 'pixel-btn-green'
                  : '';
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(active ? '' : opt.value)}
            className={`pixel-btn pixel-btn-sm ${activeClass}`}
            style={
              active && opt.variant === 'orange'
                ? { background: 'var(--orange)', color: 'var(--bg-dark)' }
                : !active
                  ? { background: 'var(--bg-light)', color: 'var(--text-secondary)' }
                  : undefined
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
