import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  sanitizeHref,
  markdownLinkHtml,
  markdownImageHtml,
} from '../../src/lib/safeMarkdown';

describe('safeMarkdown XSS hardening', () => {
  it('escapeHtml encodes attribute breakout characters', () => {
    expect(escapeHtml(`a" onclick="alert(1)`)).toContain('&quot;');
    expect(escapeHtml(`<script>`)).toBe('&lt;script&gt;');
    expect(escapeHtml(`&`)).toBe('&amp;');
    expect(escapeHtml(`'`)).toBe('&#39;');
  });

  it('sanitizeHref blocks javascript: and data:', () => {
    expect(sanitizeHref('javascript:alert(1)')).toBeNull();
    expect(sanitizeHref('JaVaScRiPt:alert(1)')).toBeNull();
    expect(sanitizeHref('data:text/html,hi')).toBeNull();
    expect(sanitizeHref('//evil.example')).toBeNull();
  });

  it('sanitizeHref trims whitespace before allowlisting', () => {
    expect(sanitizeHref('  /uploads/x.png  ')).toBe('/uploads/x.png');
    expect(sanitizeHref('   ')).toBeNull();
  });

  it('sanitizeHref allows relative and http(s)', () => {
    expect(sanitizeHref('/uploads/x.png')).toBe('/uploads/x.png');
    expect(sanitizeHref('https://example.com/a')).toMatch(/^https:/);
    expect(sanitizeHref('http://example.com/a')).toMatch(/^http:/);
  });

  it('sanitizeHref rejects malformed absolute URLs', () => {
    expect(sanitizeHref('http://%')).toBeNull();
    expect(sanitizeHref('not-a-url')).toBeNull();
  });

  it('markdownLinkHtml drops unsafe href and keeps escaped label', () => {
    const html = markdownLinkHtml('Click "me"', 'javascript:alert(1)');
    expect(html).not.toContain('<a ');
    expect(html).toContain('&quot;');
    expect(html).not.toContain('javascript:');
  });

  it('markdownLinkHtml escapes safe href attributes', () => {
    const html = markdownLinkHtml('ok', 'https://example.com/"onmouseover=alert(1)', 'md-link');
    expect(html).toContain('<a href=');
    expect(html).toContain('class="md-link"');
    expect(html.includes('%22') || html.includes('&quot;')).toBe(true);
    expect(html).not.toMatch(/href="[^"]*"onmouseover/);
  });

  it('markdownImageHtml returns empty for unsafe src', () => {
    expect(markdownImageHtml('x', 'javascript:alert(1)')).toBe('');
  });

  it('markdownImageHtml renders safe image', () => {
    const html = markdownImageHtml('alt "x"', '/uploads/a.png', 'pic');
    expect(html).toContain('<img ');
    expect(html).toContain('src="/uploads/a.png"');
    expect(html).toContain('alt="alt &quot;x&quot;"');
    expect(html).toContain('class="pic"');
  });
});
