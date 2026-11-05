import { test, expect } from '@playwright/test';

/**
 * Shop + elenco UI smoke without depending on gear seed.
 * Register flow may land on club create; inventory/shop must still load.
 */
test('shop loads and elenco opens player modal when cards exist', async ({ page }) => {
  const unique = Date.now();
  const email = `e2e-shop-${unique}@test.local`;
  const username = `e2eshop${unique}`.slice(0, 20);
  const password = 'Test.1!pass';
  const clubName = `FC Shop ${unique}`.slice(0, 32);

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

  await page.goto('/club/shop');
  await expect(page.getByText(/Lojinha|SHOP|Tienda/i).first()).toBeVisible({ timeout: 15_000 });
  // Gear catalog may be empty — page still renders stamina shop shell.
  await expect(page.locator('body')).toContainText(/stamina|lojinha|equip|GMT|USDC/i);

  await page.goto('/club/inventory');
  await expect(page.getByText(/ELENCO|SQUAD|PLANTILLA/i).first()).toBeVisible({ timeout: 10_000 });

  const card = page.locator('.pixel-card-grid button, button:has(.scout-reveal-card)').first();
  if (await card.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await card.click();
    await expect(page.getByRole('button', { name: /Fechar/i })).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: /Fechar/i }).click();
  }
});
