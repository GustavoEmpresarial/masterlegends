import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../../../config/env.js';

let transporter: Transporter | null = null;

export function getSmtpTransport(): Transporter {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    auth:
      config.SMTP_USER || config.SMTP_PASS
        ? { user: config.SMTP_USER, pass: config.SMTP_PASS }
        : undefined,
  });

  return transporter;
}
