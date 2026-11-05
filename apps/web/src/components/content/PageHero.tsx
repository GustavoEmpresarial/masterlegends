import type { ReactNode } from 'react';

interface PageHeroProps {
  title: ReactNode;
  subtitle?: ReactNode;
  titleColor?: string;
  align?: 'center' | 'left';
}

export function PageHero({
  title,
  subtitle,
  titleColor = 'var(--green)',
  align = 'center',
}: PageHeroProps) {
  return (
    <div className={`page-hero ${align === 'center' ? 'text-center space-y-2 sm:space-y-3' : 'space-y-2 sm:space-y-3'}`}>
      <h1 className="pixel-text text-xl sm:text-2xl md:text-3xl" style={{ color: titleColor }}>
        {title}
      </h1>
      {subtitle && (
        <p className="retro-text text-base sm:text-lg" style={{ color: 'var(--text-secondary)' }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
