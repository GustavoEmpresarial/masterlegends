import { test, expect } from '@playwright/test';

test('register → settings logout clears session', async ({ page }) => {
  const unique = Date.now();
  const email = `e2e-logout-${unique}@gmail.com`;
  const username = `e2elog${unique}`.slice(0, 20);
  const password = 'Test.1!pass';
  const clubName = `FC Logout ${unique}`.slice(0, 32);

  await page.goto('/register');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="text"]').fill(username);
  const passwordFields = page.locator('input[type="password"]');
  await passwordFields.nth(0).fill(password);
  await passwordFields.nth(1).fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/club/, { timeout: 20_000 });

  const clubInput = page.locator('form input[type="text"]').first();
  if (await clubInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await clubInput.fill(clubName);
    await page.locator('form button[type="submit"]').click();
    await expect(page.getByText(clubName)).toBeVisible({ timeout: 15_000 });
  }

  await page.goto('/settings');
  const logoutBtn = page.getByRole('button', { name: /sair|logout|log out/i }).first();
  await expect(logoutBtn).toBeVisible({ timeout: 15_000 });
  await logoutBtn.click();

  await expect(page).toHaveURL(/\/(login|register|$)/, { timeout: 15_000 });
});
