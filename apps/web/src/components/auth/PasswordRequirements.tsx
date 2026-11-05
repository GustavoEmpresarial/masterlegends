import { useTranslation } from 'react-i18next';
import {
  checkPasswordStrength,
  type PasswordRuleKey,
} from '@mll/shared';

const RULE_KEYS: PasswordRuleKey[] = [
  'minLength',
  'uppercase',
  'lowercase',
  'number',
  'special',
];

interface PasswordRequirementsProps {
  password: string;
  confirmPassword?: string;
  showMatch?: boolean;
}

export function PasswordRequirements({
  password,
  confirmPassword = '',
  showMatch = true,
}: PasswordRequirementsProps) {
  const { t } = useTranslation('auth');
  const rules = checkPasswordStrength(password);
  const passwordsMatch =
    confirmPassword.length > 0 && password.length > 0 && password === confirmPassword;

  return (
    <div className="pixel-box-light p-3 space-y-1.5">
      <p className="ui-label-sm mb-2" style={{ color: 'var(--text-muted)' }}>
        {t('validation.passwordRulesTitle')}
      </p>
      <ul className="space-y-1">
        {RULE_KEYS.map((key) => {
          const ok = rules[key];
          return (
            <li
              key={key}
              className="retro-text text-sm flex items-center gap-2"
              style={{ color: ok ? 'var(--green)' : 'var(--text-muted)' }}
            >
              <span aria-hidden>{ok ? <i className="bi bi-check-lg" aria-hidden /> : '○'}</span>
              {t(`validation.passwordRules.${key}`)}
            </li>
          );
        })}
        {showMatch && (
          <li
            className="retro-text text-sm flex items-center gap-2"
            style={{ color: passwordsMatch ? 'var(--green)' : 'var(--text-muted)' }}
          >
            <span aria-hidden>{passwordsMatch ? <i className="bi bi-check-lg" aria-hidden /> : '○'}</span>
            {t('validation.passwordRules.match')}
          </li>
        )}
      </ul>
    </div>
  );
}
