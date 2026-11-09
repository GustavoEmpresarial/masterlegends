import { expect, type Page } from '@playwright/test';

export async function registerLoginAndCreateClub(
  page: Page,
  opts: { email: string; username: string; password: string; clubName: string },
) {
  await page.goto('/register');
  await page.locator('#register-username').fill(opts.username);
  await page.locator('#register-email').fill(opts.email);
  await page.locator('#register-password').fill(opts.password);
  await page.locator('#register-confirm-password').fill(opts.password);
  await page.locator('input[type="checkbox"]').check();
  await page.locator('button[type="submit"]').click();

  await page.getByRole('button', { name: /IR PARA O LOGIN|GO TO LOGIN|IR AL LOGIN/i }).click();
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  await page.locator('input[type="email"]').fill(opts.email);
  await page.locator('input[type="password"]').fill(opts.password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/club/, { timeout: 20_000 });

  const clubInput = page.locator('form input[type="text"]').first();
  if (await clubInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await clubInput.fill(opts.clubName);
    await page.locator('form button[type="submit"]').click();
    await expect(page.getByText(opts.clubName)).toBeVisible({ timeout: 15_000 });
  }
}
