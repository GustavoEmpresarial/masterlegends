import { test, expect } from '@playwright/test';
import { registerLoginAndCreateClub } from './register';

/**
 * Shop + elenco UI smoke without depending on gear seed.
 * Register flow may land on club create; inventory/shop must still load.
 */
test('shop loads and elenco opens player modal when cards exist', async ({ page }) => {
  const unique = Date.now();
  const email = `e2e.shop.${unique}@gmail.com`;
  const username = `e2eshop${unique}`.slice(0, 20);
  const password = 'Test.1!pass';
  const clubName = `FC Shop ${unique}`.slice(0, 32);

  await registerLoginAndCreateClub(page, { email, username, password, clubName });

  await page.goto('/club/shop');
  await expect(page.getByText(/Lojinha|SHOP|Tienda/i).first()).toBeVisible({ timeout: 15_000 });
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
