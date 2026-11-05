import { test, expect } from '@playwright/test';

const unique = Date.now();

test('register → create club → scout mint', async ({ page }) => {
  const email = `e2e-${unique}@test.local`;
  const username = `e2e${unique}`.slice(0, 20);
  const password = 'Test.1!pass';
  const clubName = `FC E2E ${unique}`.slice(0, 32);

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

  await page.goto('/scout');
  const mintButton = page.locator('button').filter({ hasText: /mint|recrut|scout|⚽/i }).last();
  await expect(mintButton).toBeVisible({ timeout: 10_000 });
  await mintButton.click();

  await expect(page.locator('.player-card, [class*="player"]').first()).toBeVisible({
    timeout: 25_000,
  });

  await page.goto('/club/inventory');
  await expect(page.getByText(/ELENCO|SQUAD|PLANTILLA/i).first()).toBeVisible({ timeout: 10_000 });

  await page.goto('/pass');
  await expect(page.getByText(/PASSE|SEASON PASS|PASE/i).first()).toBeVisible({ timeout: 10_000 });
});
