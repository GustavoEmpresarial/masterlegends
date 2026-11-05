const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch] ?? ch);
}

/** Allow safe HTML tags for marketing email body. */
export function sanitizeEmailHtml(input: string): string {
  const withoutDanger = input
    .replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/?(script|style|iframe|object|embed)[^>]*>/gi, '');

  let out = escapeHtml(withoutDanger);

  for (const tag of ['b', 'strong', 'i', 'em', 'u', 's', 'code', 'p', 'ul', 'ol', 'li', 'h1', 'h2', 'h3']) {
    out = out
      .replace(new RegExp(`&lt;${tag}&gt;`, 'gi'), `<${tag}>`)
      .replace(new RegExp(`&lt;/${tag}&gt;`, 'gi'), `</${tag}>`);
  }
  out = out.replace(/&lt;br\s*\/?&gt;/gi, '<br>');
  out = out.replace(
    /&lt;a\s+href=&quot;(https?:\/\/[^&]+)&quot;&gt;/gi,
    '<a href="$1" style="color:#00ff88;">',
  );
  out = out.replace(/&lt;\/a&gt;/gi, '</a>');
  return out;
}

function stripHtmlToText(input: string): string {
  return input
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

export type EmailTemplateId =
  | 'verify-email'
  | 'reset-password'
  | 'password-changed'
  | 'welcome'
  | 'admin-2fa'
  | 'marketing';

export interface EmailTemplateVars {
  'verify-email': { username: string; link: string };
  'reset-password': { username: string; link: string; expiresInMin: number };
  'password-changed': { username: string };
  welcome: { username: string };
  'admin-2fa': { login: string; code: string; expiresInMin: number };
  marketing: {
    username: string;
    subject: string;
    body: string;
    /** plain = escape + newlines; html = sanitized rich HTML */
    format?: 'plain' | 'html';
    /** Absolute https URL for hero image */
    imageUrl?: string;
    buttons?: Array<{ text: string; url: string }>;
  };
}

export interface EmailJob<K extends EmailTemplateId = EmailTemplateId> {
  to: string;
  template: K;
  vars: EmailTemplateVars[K];
}

function layout(title: string, body: string, footer?: string): string {
  const foot =
    footer ??
    'Se você não solicitou isso, ignore este e-mail.';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
</head>
<body style="font-family: system-ui, sans-serif; background:#0a0a0a; color:#e6e6e6; padding:24px;">
  <div style="max-width:560px; margin: 0 auto; background:#111; padding:32px; border:1px solid #2a2a2a; border-radius:8px;">
    <h1 style="color:#00ff88; font-size:20px; margin:0 0 16px;">Master Legends League</h1>
    ${body}
    <p style="margin-top:32px; font-size:12px; color:#666;">${foot}</p>
  </div>
</body>
</html>`;
}

export function renderEmailTemplate<K extends EmailTemplateId>(
  id: K,
  vars: EmailTemplateVars[K],
): EmailContent {
  switch (id) {
    case 'verify-email': {
      const v = vars as EmailTemplateVars['verify-email'];
      const user = escapeHtml(v.username);
      const link = escapeHtml(v.link);
      return {
        subject: 'Verify your Master Legends League email',
        html: layout(
          'Verify your email',
          `<p>Hi <strong>${user}</strong>,</p>
           <p>Confirm your email to finish creating your account:</p>
           <p><a href="${link}" style="display:inline-block; padding:12px 20px; background:#00ff88; color:#000; text-decoration:none; border-radius:4px;">Verify email</a></p>
           <p style="font-size:12px; color:#888;">Or paste this link into your browser: ${link}</p>`,
        ),
        text: `Hi ${v.username}, verify your email: ${v.link}`,
      };
    }
    case 'reset-password': {
      const v = vars as EmailTemplateVars['reset-password'];
      const user = escapeHtml(v.username);
      const link = escapeHtml(v.link);
      return {
        subject: 'Redefinir senha — Master Legends League',
        html: layout(
          'Redefinir senha',
          `<p>Olá, <strong>${user}</strong>,</p>
           <p>Recebemos um pedido para redefinir sua senha. Este link expira em ${v.expiresInMin} minutos.</p>
           <p><a href="${link}" style="display:inline-block; padding:12px 20px; background:#ffd700; color:#000; text-decoration:none; border-radius:4px; font-weight:bold;">Redefinir senha</a></p>
           <p style="font-size:12px; color:#888;">Se o botão não funcionar, copie e cole no navegador:<br>${link}</p>`,
        ),
        text: `Olá ${v.username}, redefina sua senha (expira em ${v.expiresInMin} min): ${v.link}`,
      };
    }
    case 'password-changed': {
      const v = vars as EmailTemplateVars['password-changed'];
      const user = escapeHtml(v.username);
      return {
        subject: 'Sua senha foi alterada — Master Legends League',
        html: layout(
          'Senha alterada',
          `<p>Olá, <strong>${user}</strong>,</p>
           <p>Sua senha foi alterada com sucesso. Todas as sessões foram encerradas.</p>
           <p>Se não foi você, entre em contato com o suporte imediatamente.</p>`,
        ),
        text: `Olá ${v.username}, sua senha foi alterada. Se não foi você, contacte o suporte.`,
      };
    }
    case 'welcome': {
      const v = vars as EmailTemplateVars['welcome'];
      const user = escapeHtml(v.username);
      return {
        subject: 'Welcome to Master Legends League',
        html: layout(
          'Welcome',
          `<p>Welcome, <strong>${user}</strong>!</p><p>Your club is ready.</p>`,
        ),
        text: `Welcome, ${v.username}! Your club is ready.`,
      };
    }
    case 'admin-2fa': {
      const v = vars as EmailTemplateVars['admin-2fa'];
      const login = escapeHtml(v.login);
      const code = escapeHtml(v.code);
      return {
        subject: 'Your Master Legends League admin verification code',
        html: layout(
          'Admin verification',
          `<p>Hi <strong>${login}</strong>,</p>
           <p>Your admin login verification code:</p>
           <p style="font-size:28px; letter-spacing:6px; font-weight:bold; color:#00ff88;">${code}</p>
           <p style="font-size:12px; color:#888;">Expires in ${v.expiresInMin} minutes. Do not share this code.</p>`,
        ),
        text: `Admin verification code for ${v.login}: ${v.code} (expires in ${v.expiresInMin} min)`,
      };
    }
    case 'marketing': {
      const v = vars as EmailTemplateVars['marketing'];
      const user = escapeHtml(v.username);
      const subject = v.subject.trim().slice(0, 200);
      const format = v.format === 'html' ? 'html' : 'plain';
      const bodyHtml =
        format === 'html'
          ? sanitizeEmailHtml(v.body.trim())
          : escapeHtml(v.body.trim()).replace(/\r\n/g, '\n').replace(/\n/g, '<br>');

      const imageBlock =
        v.imageUrl && /^https?:\/\//i.test(v.imageUrl)
          ? `<p style="margin:16px 0 0;"><img src="${escapeHtml(v.imageUrl)}" alt="" style="max-width:100%; border-radius:8px; display:block;" /></p>`
          : '';

      const buttons = (v.buttons ?? [])
        .filter((b) => b.text.trim() && /^https?:\/\//i.test(b.url.trim()))
        .slice(0, 6);
      const buttonsBlock =
        buttons.length > 0
          ? `<p style="margin:24px 0 0;">${buttons
              .map(
                (b) =>
                  `<a href="${escapeHtml(b.url.trim())}" style="display:inline-block; margin:0 8px 8px 0; padding:12px 18px; background:#00ff88; color:#000; text-decoration:none; border-radius:6px; font-weight:600;">${escapeHtml(b.text.trim().slice(0, 64))}</a>`,
              )
              .join('')}</p>`
          : '';

      const textButtons =
        buttons.length > 0
          ? `\n\n${buttons.map((b) => `${b.text.trim()}: ${b.url.trim()}`).join('\n')}`
          : '';

      return {
        subject,
        html: layout(
          subject,
          `<p>Olá, <strong>${user}</strong>,</p>
           ${imageBlock}
           <div style="margin-top:16px; line-height:1.55;">${bodyHtml}</div>
           ${buttonsBlock}`,
          'Você recebeu este e-mail porque tem conta verificada na Master Legends League.',
        ),
        text: `Olá ${v.username},\n\n${stripHtmlToText(v.body.trim())}${textButtons}\n\nVocê recebeu este e-mail porque tem conta verificada na Master Legends League.`,
      };
    }
    default: {
      const _exhaustive: never = id;
      throw new Error(`Unknown template: ${_exhaustive as string}`);
    }
  }
}
