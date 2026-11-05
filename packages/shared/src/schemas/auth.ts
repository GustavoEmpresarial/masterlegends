import { z } from 'zod';
import { strongPasswordSchema } from './password.js';

export const ALLOWED_EMAIL_DOMAINS = [
  // Google
  'gmail.com',
  'googlemail.com',
  // Microsoft Outlook / Hotmail / Live
  'outlook.com',
  'outlook.com.br',
  'hotmail.com',
  'hotmail.com.br',
  'live.com',
  'live.com.br',
  'msn.com',
  // Yahoo
  'yahoo.com',
  'yahoo.com.br',
  'ymail.com',
  'rocketmail.com',
  // Apple iCloud
  'icloud.com',
  'me.com',
  'mac.com',
] as const;

const ALLOWED_DOMAIN_SET = new Set<string>(ALLOWED_EMAIL_DOMAINS);

export const allowlistedEmailSchema = z
  .string()
  .email()
  .refine(
    (email) => {
      const domain = email.toLowerCase().split('@')[1];
      return !!domain && ALLOWED_DOMAIN_SET.has(domain);
    },
    {
      message:
        'Use um e-mail de provedor permitido: Gmail, Outlook/Hotmail, Yahoo ou iCloud.',
    },
  )
  .refine(
    (email) => {
      const local = email.toLowerCase().split('@')[0] ?? '';
      // Bloqueia plus-aliases (gustavo+spam@gmail.com)
      return !local.includes('+');
    },
    { message: 'E-mails com "+" (aliases) não são permitidos.' },
  );

export const registerSchema = z.object({
  email: allowlistedEmailSchema,
  password: strongPasswordSchema,
  username: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username must be alphanumeric or underscore'),
  referralCode: z
    .string()
    .min(4)
    .max(8)
    .regex(/^[A-Z0-9]+$/)
    .optional(),
  acceptTerms: z.literal(true, { message: 'Terms must be accepted' }),
  turnstileToken: z.string().min(1).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
  turnstileToken: z.string().min(1).optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(32).max(128),
  newPassword: strongPasswordSchema,
});

export const verifyEmailSchema = z.object({
  token: z.string().min(32).max(128),
});

/** Public resend — same shape as forgot-password (email only, no auth). */
export const resendVerificationSchema = z.object({
  email: z.string().email(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: strongPasswordSchema,
});

export const changeUsernameSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username must be alphanumeric or underscore'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ChangeUsernameInput = z.infer<typeof changeUsernameSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;

export interface AuthUserDTO {
  id: string;
  email: string;
  username: string;
  referralCode?: string;
  hasClub?: boolean;
  wallet?: string | null;
  emailVerified?: boolean;
  /** True after the mandatory first-run tutorial is completed. */
  tutorialCompleted?: boolean;
  /** Telegram bot linked for DM notifications. */
  telegramLinked?: boolean;
  telegramNotifyEnabled?: boolean;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUserDTO;
}

/** Register does not start a session — user must verify email then log in. */
export interface RegisterResponse {
  ok: true;
  user: AuthUserDTO;
}
