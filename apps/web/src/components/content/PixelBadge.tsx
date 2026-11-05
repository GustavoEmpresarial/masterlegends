import type { ReactNode } from 'react';

export type PixelBadgeVariant =
  | 'green'
  | 'purple'
  | 'orange'
  | 'blue'
  | 'gold'
  | 'red'
  | 'muted';

interface PixelBadgeProps {
  children: ReactNode;
  variant?: PixelBadgeVariant;
}

export function PixelBadge({ children, variant = 'muted' }: PixelBadgeProps) {
  return <span className={`pixel-badge pixel-badge--${variant}`}>{children}</span>;
}
