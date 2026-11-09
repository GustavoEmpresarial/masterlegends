import { defineConfig, devices } from '@playwright/test';

const apiUrl = process.env.E2E_API_URL ?? 'http://127.0.0.1:3001';
const webUrl = process.env.E2E_WEB_URL ?? 'http://127.0.0.1:5173';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 60_000,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: webUrl,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command:
        'npm run db:generate && npm run db:migrate && npm run dev -w @mll/api',
      cwd: '..',
      url: `${apiUrl}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        NODE_ENV: 'development',
        PORT: '3001',
        HOST: '127.0.0.1',
        DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/mll_test',
        REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379/2',
        JWT_SECRET: process.env.JWT_SECRET ?? 'test-jwt-secret-with-at-least-32-characters!!',
        CORS_ORIGINS: webUrl,
        WEB_URL: webUrl,
        LOG_MONGO_ENABLED: 'false',
        LOG_LEVEL: 'silent',
        SMTP_HOST: 'localhost',
        SMTP_PORT: '1025',
        E2E_AUTO_VERIFY_EMAIL: 'true',
      },
    },
    {
      command: 'npm run dev -w @mll/web -- --host 127.0.0.1 --port 5173 --strictPort',
      cwd: '..',
      url: webUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        VITE_API_URL: apiUrl,
      },
    },
  ],
});
