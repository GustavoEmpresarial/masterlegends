import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface PasswordInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  minLength?: number;
  autoComplete?: string;
  showToggle?: boolean;
}

export function PasswordInput({
  id,
  label,
  value,
  onChange,
  disabled = false,
  minLength,
  autoComplete,
  showToggle = true,
}: PasswordInputProps) {
  const { t } = useTranslation('auth');
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="ui-label-sm block mb-2">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`pixel-input w-full ${showToggle ? 'pr-11' : ''}`}
          minLength={minLength}
          autoComplete={autoComplete}
          required
          disabled={disabled}
        />
        {showToggle && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded border border-transparent text-base leading-none opacity-70 transition-opacity hover:opacity-100 disabled:opacity-40"
            style={{ color: 'var(--text-secondary)' }}
            onClick={() => setVisible((v) => !v)}
            disabled={disabled}
            aria-label={visible ? t('fields.hidePassword') : t('fields.showPassword')}
            aria-pressed={visible}
          >
            <i className={`bi ${visible ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
