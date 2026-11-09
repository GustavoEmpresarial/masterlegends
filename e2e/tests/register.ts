import { expect, type Page } from '@playwright/test';

export async function dismissLifetimeNotice(page: Page) {
  const dialog = page.getByRole('dialog', { name: /JOGADORES TÊM TEMPO DE VIDA/i });
  if (await dialog.isVisible({ timeout: 4_000 }).catch(() => false)) {
    await dialog.getByRole('button', { name: 'Fechar' }).click();
    await expect(dialog).toBeHidden({ timeout: 10_000 });
  }
}

export async function dismissTutorial(page: Page) {
  const skip = page.getByRole('button', { name: /pular tutorial|skip tutorial|saltar tutorial/i });
  if (await skip.isVisible({ timeout: 4_000 }).catch(() => false)) {
    await skip.click();
    await expect(page.locator('aside[aria-label="Tutorial"]')).toBeHidden({ timeout: 10_000 });
  }
}

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
  await dismissTutorial(page);
  await dismissLifetimeNotice(page);

  const clubInput = page.locator('form input[type="text"]').first();
  if (await clubInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await clubInput.fill(opts.clubName);
    await dismissLifetimeNotice(page);
    await page.locator('form button[type="submit"]').click();
    await expect(page.getByRole('heading', { name: opts.clubName })).toBeVisible({ timeout: 15_000 });
  }
}

