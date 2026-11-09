import type { CSSProperties } from 'react';

/** Remove tags e atributos que executam código antes de mostrar HTML gerado. */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<\/?(?:iframe|object|embed|link|meta)[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript:/gi, '');
}

export function SanitizedHtml({
  html,
  className,
  style,
}: {
  html: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={className}
      style={style}
      // eslint-disable-next-line no-restricted-syntax -- markup already passed through sanitizeHtml
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
    />
  );
}
