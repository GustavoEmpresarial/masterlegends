import type { ReactNode } from 'react';

interface PageContentShellProps {
  children: ReactNode;
  className?: string;
  /** Wider content column (fills more of the main area between side bands). */
  wide?: boolean;
}

export function PageContentShell({ children, className = '', wide = false }: PageContentShellProps) {
  return (
    <div
      className={`page-content-shell w-full min-w-0 ${wide ? 'page-content-shell--wide' : ''} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
