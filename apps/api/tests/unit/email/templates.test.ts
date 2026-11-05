import { describe, it, expect } from 'vitest';
import { escapeHtml, renderTemplate } from '../../../src/modules/email/templates.js';

describe('email templates', () => {
  it('escapes HTML in output', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });

  it('renders verify-email template', () => {
    const out = renderTemplate('verify-email', {
      username: 'alice',
      link: 'http://localhost/verify',
    });
    expect(out.subject).toContain('Verify');
    expect(out.html).not.toContain('<script>');
    expect(out.text).toContain('http://localhost/verify');
  });

  it('renders reset-password template', () => {
    const out = renderTemplate('reset-password', {
      username: 'bob',
      link: 'http://localhost/reset',
      expiresInMin: 30,
    });
    expect(out.subject.toLowerCase()).toContain('redefinir');
    expect(out.html).toContain('30');
  });

  it('renders password-changed template', () => {
    const out = renderTemplate('password-changed', { username: 'carol' });
    expect(out.text).toContain('carol');
  });
});
