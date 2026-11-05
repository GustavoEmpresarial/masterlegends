import * as dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: '../../.env' });
dotenv.config({ path: '.env' });

function resolveEthAddress(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed || trimmed === '0x...' || trimmed === '0x…') return fallback;
  if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) return fallback;
  return trimmed;
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  DATABASE_URL: z.string().url().min(1),
  REDIS_URL: z.string().url().min(1),

  MONGODB_URI: z.string().min(1).default('mongodb://localhost:27017/mll_logs'),
  LOG_MONGO_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  LOG_MONGO_TTL_DAYS: z.coerce.number().int().min(0).default(0),
  LOG_MONGO_BATCH_SIZE: z.coerce.number().int().min(1).default(100),
  LOG_MONGO_FLUSH_MS: z.coerce.number().int().min(100).default(2000),

  SMTP_HOST: z.string().min(1).default('localhost'),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  SMTP_FROM: z.string().default('Master Legends League <no-reply@mll.local>'),
  EMAIL_MARKETING_DAILY_LIMIT: z.coerce.number().int().min(1).max(100_000).default(250),
  EMAIL_MARKETING_PER_MINUTE: z.coerce.number().int().min(1).max(1000).default(8),

  TELEGRAM_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  TELEGRAM_BOT_TOKEN: z.string().optional().default(''),

  POLYGONSCAN_API_KEY: z.string().optional().default(''),
  POLYGON_RPC_URL: z.string().url().optional().default('https://polygon-bor-rpc.publicnode.com'),
  AMOY_RPC_URL: z.string().url().optional().default(''),
  CONTRACT_USDC_VAULT: z
    .string()
    .optional()
    .default('')
    .transform((value) => resolveEthAddress(value, '0x967659a8Fe5C15728eD900eF9a90c44bE20190f3')),
  USDC_ADDRESS: z.string().optional().default('0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359'),
  USDT_ADDRESS: z.string().optional().default('0xc2132D05D31c914a87C6611C10748AEb04B58e8F'),
  CHAIN_ID: z.coerce.number().int().default(137),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid worker environment:\n', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = Object.freeze({
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === 'production',
  isTest: parsed.data.NODE_ENV === 'test',
});
