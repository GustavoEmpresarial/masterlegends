import { test, expect } from '@playwright/test';
import { registerLoginAndCreateClub, dismissTutorial } from './register';

test('register → settings logout clears session', async ({ page }) => {
  const unique = Date.now();
  const email = `e2e.logout.${unique}@gmail.com`;
  const username = `e2elog${unique}`.slice(0, 20);
  const password = 'Test.1!pass';
  const clubName = `FC Logout ${unique}`.slice(0, 32);

  await registerLoginAndCreateClub(page, { email, username, password, clubName });

  await page.goto('/settings');
  await dismissTutorial(page);
  const logoutBtn = page.getByRole('button', { name: /sair|logout|log out/i }).first();
  await expect(logoutBtn).toBeVisible({ timeout: 15_000 });
  await logoutBtn.click();

  await expect(page).toHaveURL(/\/(login|register|$)/, { timeout: 15_000 });
});
