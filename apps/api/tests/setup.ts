import * as dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
dotenv.config({ path: path.join(root, '.env.test') });
dotenv.config({ path: path.join(root, '.env') });

process.env.NODE_ENV = 'test';
process.env.LOG_MONGO_ENABLED = process.env.LOG_MONGO_ENABLED ?? 'false';
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'silent';
// Local `.env` may enable Turnstile; integration register/login must stay captcha-free
// unless a test opts in (see auth.routes.test turnstile case).
if (process.env.TURNSTILE_IN_TESTS !== 'true') {
  delete process.env.TURNSTILE_SECRET_KEY;
}
