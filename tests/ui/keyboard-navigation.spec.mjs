import { test, expect } from '@playwright/test';

test('C49: keyboard can skip navigation to the application content', async ({ page }) => {
  await page.goto('/');
  const skip = page.getByRole('link', { name: 'Saltar al contenido principal' });
  await expect(skip).toHaveAttribute('href', '#app');
  await page.keyboard.press('Tab');
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('#app')).toBeFocused();
  await expect(page).toHaveURL(/#app$/);
});

test('C49: the skip link is exposed in a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Saltar al contenido principal' })).toBeFocused();
});
