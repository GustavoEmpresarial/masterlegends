import { describe, it, expect } from 'vitest';
import { escapeHtml, renderTemplate } from '../../../src/modules/email/templates.js';

describe('worker email templates', () => {
  it('escapes HTML', () => {
    expect(escapeHtml('"bad"')).toContain('&quot;');
  });

  it('renders verify-email', () => {
    const out = renderTemplate('verify-email', {
      username: 'alice',
      link: 'http://localhost/verify',
    });
    expect(out.subject).toContain('Verify');
  });

  it('renders reset-password', () => {
    const out = renderTemplate('reset-password', {
      username: 'bob',
      link: 'http://localhost/reset',
      expiresInMin: 30,
    });
    expect(out.html).toContain('Redefinir senha');
  });

  it('renders password-changed', () => {
    const out = renderTemplate('password-changed', { username: 'carol' });
    expect(out.text).toContain('carol');
  });
});
