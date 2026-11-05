import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PixelCrest } from './PixelCrest';

interface BrandMarkProps {
  asLink?: boolean;
  compact?: boolean;
}

export function BrandMark({ asLink = false, compact = false }: BrandMarkProps) {
  const { t } = useTranslation('common');

  const content = (
    <div className="flex items-center gap-3">
      <PixelCrest letter="M" size={compact ? 40 : 52} />
      <div className="min-w-0 hidden min-[420px]:block">
        <p className="ui-label-sm leading-none text-gold whitespace-nowrap">{t('brand.master')}</p>
        <p className={`pixel-text leading-none whitespace-nowrap ${compact ? 'text-sm' : 'text-base'}`}>
          {t('brand.legendsLeague')}
        </p>
      </div>
    </div>
  );

  if (asLink) {
    return (
      <Link to="/" className="group inline-flex min-w-0 shrink-0">
        {content}
      </Link>
    );
  }

  return content;
}
