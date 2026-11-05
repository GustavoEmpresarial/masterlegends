import * as dotenv from 'dotenv';
import { adminRoleSchema } from '@mll/shared';
import { z } from 'zod';

const adminUserEnvSchema = z.object({
  id: z.string().min(1).max(64),
  login: z.string().min(1).max(64),
  password: z.string().min(1).max(256),
  email: z.string().email(),
  role: adminRoleSchema,
});

if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '../../.env' });
  dotenv.config({ path: '.env' });
}

// Tests must not inherit production Turnstile secrets from local `.env`
// (unless a suite opts in via TURNSTILE_IN_TESTS=true).
if (
  (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') &&
  process.env.TURNSTILE_IN_TESTS !== 'true'
) {
  process.env.TURNSTILE_SECRET_KEY = '';
}

function resolveEthAddress(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed || trimmed === '0x...' || trimmed === '0x…') return fallback;
  if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) return fallback;
  return trimmed;
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  CORS_ORIGINS: z
    .string()
    .min(1, 'CORS_ORIGINS is required')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),

  DATABASE_URL: z.string().url().min(1),
  REDIS_URL: z.string().url().min(1),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  ADMIN_JWT_SECRET: z.string().min(32).optional().default(''),
  JWT_EXPIRY: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRY: z.string().default('30d'),
  REFRESH_TOKEN_MAX_AGE_SECONDS: z.coerce.number().int().min(60).default(60 * 60 * 24 * 30),

  COOKIE_SECRET: z.string().min(32).optional().default(''),

  POLYGON_RPC_URL: z.string().url().optional(),
  AMOY_RPC_URL: z.string().url().optional(),
  CHAIN_ID: z.coerce.number().int().default(137),
  POLYGONSCAN_API_KEY: z.string().optional().default(''),
  OPENROUTER_API_KEY: z.string().optional().default(''),
  OPENROUTER_IMAGE_MODEL: z
    .string()
    .optional()
    .default(
      'bytedance-seed/seedream-5-0-flash,recraft/recraft-v4.1-flash,inclusionai/ming-image-0.1-design',
    ),

  CONTRACT_MGT: z.string().optional().default(''),
  CONTRACT_PLAYER_NFT: z.string().optional().default(''),
  CONTRACT_SCOUT: z.string().optional().default(''),
  CONTRACT_BURN: z.string().optional().default(''),
  CONTRACT_MARKETPLACE: z.string().optional().default(''),
  CONTRACT_STAKING: z.string().optional().default(''),
  CONTRACT_REWARDS_POOL: z.string().optional().default(''),
  CONTRACT_USDC_VAULT: z
    .string()
    .optional()
    .default('')
    .transform((value) => resolveEthAddress(value, '0x967659a8Fe5C15728eD900eF9a90c44bE20190f3')),
  OPERATOR_PRIVATE_KEY: z.string().optional().default(''),
  USDC_ADDRESS: z.string().optional().default('0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359'),
  USDT_ADDRESS: z.string().optional().default('0xc2132D05D31c914a87C6611C10748AEb04B58e8F'),
  SATSPAY_API_BASE: z.string().url().optional().default('https://www.satspay.pro'),
  SATSPAY_API_KEY: z.string().optional().default(''),

  VRF_COORDINATOR: z.string().optional().default(''),
  VRF_KEY_HASH: z.string().optional().default(''),
  VRF_SUBSCRIPTION_ID: z.string().optional().default(''),

  PINATA_JWT: z.string().optional().default(''),
  PINATA_GATEWAY: z.string().optional().default('https://gateway.pinata.cloud'),

  SENTRY_DSN: z.string().optional().default(''),
  ENABLE_BULL_BOARD: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  BULL_BOARD_USER: z.string().optional().default(''),
  BULL_BOARD_PASSWORD: z.string().optional().default(''),
  GAME_ROLE_KEY: z.string().optional().default(''),

  WEB_URL: z.string().url().default('http://localhost:5173'),
  SOCKET_PATH: z.string().default('/socket.io'),

  SMTP_HOST: z.string().min(1).default('localhost'),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  SMTP_FROM: z.string().default('Master Legends League <no-reply@mll.local>'),
  /** Max marketing emails delivered per UTC day (Hostinger headroom for transactional). */
  EMAIL_MARKETING_DAILY_LIMIT: z.coerce.number().int().min(1).max(100_000).default(250),
  /** Max marketing emails sent per UTC minute. */
  EMAIL_MARKETING_PER_MINUTE: z.coerce.number().int().min(1).max(1000).default(8),

  MONGODB_URI: z.string().min(1).default('mongodb://localhost:27017/mll_logs'),
  LOG_MONGO_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  LOG_MONGO_TTL_DAYS: z.coerce.number().int().min(0).default(0),
  LOG_MONGO_BATCH_SIZE: z.coerce.number().int().min(1).default(100),
  LOG_MONGO_FLUSH_MS: z.coerce.number().int().min(100).default(2000),

  ENABLE_WEB3_AUTH: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  ADMIN_USERS: z
    .string()
    .default('[]')
    .transform((value, ctx) => {
      try {
        const parsed = JSON.parse(value) as unknown;
        return z.array(adminUserEnvSchema).parse(parsed);
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'ADMIN_USERS must be valid JSON array' });
        return z.NEVER;
      }
    }),
  ADMIN_ALLOW_PLAINTEXT_PASSWORDS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  ADMIN_2FA_DISABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  ADMIN_2FA_TTL_SECONDS: z.coerce.number().int().min(60).max(900).default(300),
  ADMIN_2FA_CODE_LENGTH: z.coerce.number().int().min(4).max(8).default(6),
  ADMIN_JWT_EXPIRY: z.string().default('15m'),
  ADMIN_REFRESH_MAX_AGE_SECONDS: z.coerce.number().int().min(300).default(60 * 60 * 8),

  TURNSTILE_SECRET_KEY: z.string().optional().default(''),
  SITE_LAUNCHED_AT: z.string().datetime().optional(),

  UPLOADS_DIR: z.string().default('./uploads'),
  UPLOADS_PUBLIC_PATH: z.string().default('/uploads'),
  UPLOAD_MAX_BYTES: z.coerce.number().int().min(1024).default(5 * 1024 * 1024),

  PRIVATE_UPLOADS_DIR: z.string().default('./private-uploads'),
  SUPPORT_UPLOAD_MAX_BYTES: z.coerce.number().int().min(1024).default(8 * 1024 * 1024),
  SUPPORT_UPLOAD_MAX_FILES: z.coerce.number().int().min(1).max(10).default(5),
  SUPPORT_IMAGE_MAX_PX: z.coerce.number().int().min(256).max(8192).default(2048),

  TELEGRAM_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  TELEGRAM_BOT_TOKEN: z.string().optional().default(''),
  TELEGRAM_BOT_USERNAME: z.string().optional().default(''),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional().default(''),
  TELEGRAM_GLOBAL_CHAT_ID: z.string().optional().default(''),
  /** Forum topic id inside the global group (Telegram message_thread_id). */
  TELEGRAM_GLOBAL_THREAD_ID: z
    .string()
    .optional()
    .default('')
    .transform((v) => {
      const n = Number(String(v ?? '').trim());
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
    }),
  /** polling = getUpdates (bypasses Cloudflare); webhook = HTTPS callback */
  TELEGRAM_UPDATES_MODE: z.enum(['polling', 'webhook']).default('polling'),

  /** Zerads PTC (paid-to-click) — recompensa em Overwall temporário por clique de anúncio. */
  OFFERWALL_ZERADS_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  OFFERWALL_ZERADS_SITE_ID: z.string().optional().default('11807'),
  /** Senha compartilhada no callback (`pwd=`) — única defesa real, não confiar em IP (Cloudflare fica na frente). */
  OFFERWALL_ZERADS_PTC_PASSWORD: z.string().optional().default(''),
  /** Overwall temporário concedido por 1 ZER ganho no PTC. */
  OFFERWALL_ZERADS_ZER_TO_OW: z.coerce.number().positive().default(500),
  /** Duração do bônus de Overwall do PTC (mesmo padrão do check-in: temporário). */
  OFFERWALL_ZERADS_OW_TTL_HOURS: z.coerce.number().int().positive().max(24 * 30).default(24),
}).superRefine((data, ctx) => {
  if (data.TELEGRAM_ENABLED) {
    if (!data.TELEGRAM_BOT_TOKEN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['TELEGRAM_BOT_TOKEN'],
        message: 'TELEGRAM_BOT_TOKEN is required when TELEGRAM_ENABLED=true',
      });
    }
    if (
      data.TELEGRAM_UPDATES_MODE === 'webhook' &&
      (!data.TELEGRAM_WEBHOOK_SECRET || data.TELEGRAM_WEBHOOK_SECRET.length < 16)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['TELEGRAM_WEBHOOK_SECRET'],
        message: 'TELEGRAM_WEBHOOK_SECRET (min 16 chars) is required when TELEGRAM_UPDATES_MODE=webhook',
      });
    }
  }

  if (data.NODE_ENV !== 'production') return;

  if (!data.COOKIE_SECRET || data.COOKIE_SECRET.length < 32) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['COOKIE_SECRET'],
      message: 'COOKIE_SECRET (min 32 chars) is required in production',
    });
  }

  if (!data.ADMIN_JWT_SECRET || data.ADMIN_JWT_SECRET.length < 32) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['ADMIN_JWT_SECRET'],
      message: 'ADMIN_JWT_SECRET (min 32 chars) is required in production',
    });
  } else if (data.ADMIN_JWT_SECRET === data.JWT_SECRET) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['ADMIN_JWT_SECRET'],
      message: 'ADMIN_JWT_SECRET must differ from JWT_SECRET in production',
    });
  }

  if (data.COOKIE_SECRET && data.COOKIE_SECRET === data.JWT_SECRET) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['COOKIE_SECRET'],
      message: 'COOKIE_SECRET must differ from JWT_SECRET in production',
    });
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:\n', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = Object.freeze({
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === 'production',
  isTest: parsed.data.NODE_ENV === 'test',
  turnstileEnabled: Boolean(parsed.data.TURNSTILE_SECRET_KEY),
  /** Match refresh_token cookie — Secure only when WEB_URL is HTTPS (VM demo uses HTTP). */
  cookieSecure: parsed.data.WEB_URL.startsWith('https://'),
  adminJwtSecret:
    parsed.data.NODE_ENV === 'production'
      ? parsed.data.ADMIN_JWT_SECRET
      : parsed.data.ADMIN_JWT_SECRET || parsed.data.JWT_SECRET,
});

export type AppConfig = typeof config;
