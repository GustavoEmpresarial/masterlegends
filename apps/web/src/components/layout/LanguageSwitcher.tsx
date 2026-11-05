import { useTranslation } from 'react-i18next';

const LOCALES = [
  { code: 'pt-BR', label: 'Português' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
] as const;

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <select
      className="pixel-select pixel-select-md pixel-select-lang shrink-0"
      value={i18n.language}
      onChange={(e) => void i18n.changeLanguage(e.target.value)}
      aria-label="Language"
    >
      {LOCALES.map(({ code, label }) => (
        <option key={code} value={code}>
          {label}
        </option>
      ))}
    </select>
  );
}
