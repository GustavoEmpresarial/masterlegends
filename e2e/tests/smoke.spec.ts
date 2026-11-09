import { test, expect } from '@playwright/test';
import { registerLoginAndCreateClub } from './register';

const unique = Date.now();

test('register → create club → scout page', async ({ page }) => {
  const email = `e2e.${unique}@gmail.com`;
  const username = `e2e${unique}`.slice(0, 20);
  const password = 'Test.1!pass';
  const clubName = `FC E2E ${unique}`.slice(0, 32);

  await registerLoginAndCreateClub(page, { email, username, password, clubName });

  await page.goto('/scout');
  await expect(page.locator('button').filter({ hasText: /mint|recrut|scout|⚽/i }).last()).toBeVisible({
    timeout: 10_000,
  });

  await page.goto('/club/inventory');
  await expect(page.getByText(/ELENCO|SQUAD|PLANTILLA/i).first()).toBeVisible({ timeout: 10_000 });

  await page.goto('/pass');
  await expect(page.getByText(/PASSE|SEASON PASS|PASE/i).first()).toBeVisible({ timeout: 10_000 });
});
