/** Escape HTML text + attribute values for lightweight markdown renderers. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Allow only http(s) and site-relative paths. Blocks javascript:/data:/etc. */
export function sanitizeHref(raw: string): string | null {
  const href = raw.trim();
  if (!href) return null;
  if (href.startsWith('/') && !href.startsWith('//')) return href;
  try {
    const u = new URL(href);
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.toString();
  } catch {
    return null;
  }
  return null;
}

export function markdownLinkHtml(label: string, hrefRaw: string, className?: string): string {
  const href = sanitizeHref(hrefRaw);
  const text = escapeHtml(label);
  if (!href) return text;
  const cls = className ? ` class="${escapeHtml(className)}"` : '';
  return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"${cls}>${text}</a>`;
}

export function markdownImageHtml(alt: string, srcRaw: string, className?: string): string {
  const src = sanitizeHref(srcRaw);
  if (!src) return '';
  const cls = className ? ` class="${escapeHtml(className)}"` : '';
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"${cls} />`;
}
