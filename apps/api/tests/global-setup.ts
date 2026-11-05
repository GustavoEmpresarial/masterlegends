import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isIntegrationEnabled } from './helpers/integration-env.js';

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export default async function globalSetup(): Promise<void> {
  if (!isIntegrationEnabled()) return;

  execSync('npx prisma generate && npx prisma migrate deploy', {
    cwd: apiRoot,
    env: process.env,
    stdio: 'inherit',
  });
}
