import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { MarkdownBody } from './MarkdownBody';

interface PixelContentCardProps {
  title: string;
  body?: string;
  imageUrl?: string | null;
  imageAlt?: string;
  date?: string;
  badges?: ReactNode;
  borderColor?: string;
  href?: string;
  footer?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function PixelContentCard({
  title,
  body,
  imageUrl,
  imageAlt,
  date,
  badges,
  borderColor = 'var(--bg-lighter)',
  href,
  footer,
  className = '',
  children,
}: PixelContentCardProps) {
  const cardStyle = { borderColor, '--surface-accent': borderColor } as CSSProperties;

  const inner = (
    <>
      {imageUrl && (
        <div className="-mx-[calc(1rem+4px)] sm:-mx-[calc(1.25rem+4px)] -mt-[calc(1rem+4px)] sm:-mt-[calc(1.25rem+4px)] mb-4 overflow-hidden max-h-48 sm:max-h-64 border-b-4" style={{ borderColor }}>
          <img
            src={imageUrl}
            alt={imageAlt ?? title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      {(badges || date) && (
        <div className="pixel-content-card__meta mb-3">
          {badges}
          {date && <span className="pixel-content-card__date">{date}</span>}
        </div>
      )}

      <h2 className="pixel-text text-sm sm:text-base md:text-lg leading-snug mb-3" style={{ color: 'var(--text-primary)' }}>
        {title}
      </h2>

      {body && <MarkdownBody markdown={body} />}
      {children}
      {footer}
    </>
  );

  const classes = `pixel-card pixel-card-fluid overflow-hidden ${className}`.trim();

  if (href) {
    return (
      <Link to={href} className={`${classes} block hover:opacity-95 transition-opacity`} style={cardStyle}>
        {inner}
      </Link>
    );
  }

  return (
    <article className={classes} style={cardStyle}>
      {inner}
    </article>
  );
}
