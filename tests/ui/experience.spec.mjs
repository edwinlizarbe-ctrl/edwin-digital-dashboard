import { test, expect } from '@playwright/test';

const businessId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';

// Solo el navegador de test ve estos fixtures. No se crean datos en Supabase.
async function mockCrm(page, { signedIn = false } = {}) {
  await page.route('**/api/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    let status = 200, data = {};
    if (pathname === '/api/status') data = { configured: true };
    else if (pathname === '/api/me') {
      if (!signedIn) { status = 401; data = { error: 'Sesión no iniciada' }; }
      else data = { user: { id: userId, email: 'prueba@example.test', role: 'client' } };
    } else if (pathname === '/api/businesses') data = { businesses: [{ id: businessId, name: 'Estudio de Prueba', slug: 'estudio-de-prueba' }] };
    else if (pathname === '/api/sites') data = { sites: [] };
    else if (pathname === '/api/client/features') data = { features: { ga4: false, meta_ads: false, google_ads: false, search_console: false, business_profile: false } };
    else if (pathname === '/api/zernio/status') data = { configured: false, connected: false };
    else if (pathname === '/api/crm/leads') data = { leads: [] };
    await route.fulfill({ status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(data) });
  });
}
async function noOverflow(page) {
  const result = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: window.innerWidth + 2 }));
  expect(result.width, 'Evitar desbordamiento horizontal').toBeLessThanOrEqual(result.viewport);
}
test('inicio de sesión escritorio: jerarquía y navegación', async ({ page }, testInfo) => {
  await mockCrm(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Bienvenido a Edwin CRM/i })).toBeVisible();
  await expect(page.locator('#login-form input[name=email]')).toBeVisible();
  await expect(page.locator('#login-form input[name=password]')).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('login-escritorio.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByRole('heading', { name: /Empieza con Edwin CRM/i })).toBeVisible();
});
test('inicio de sesión móvil oscuro: legibilidad', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('ed-theme-v3', 'dark'));
  await mockCrm(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Bienvenido a Edwin CRM/i })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await noOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('login-movil-oscuro.png'), fullPage: true, animations: 'disabled' });
});
test('dashboard e integraciones: estados reales y botón deshabilitado', async ({ page }, testInfo) => {
  await mockCrm(page, { signedIn: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.ed-hero')).toBeVisible();
  await expect(page.locator('.ed-commerce')).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('dashboard-escritorio.png'), fullPage: true, animations: 'disabled' });
  await page.locator('.sidebar [data-page="integrations"]').click();
  await expect(page.getByRole('heading', { name: 'Integraciones de mi empresa' })).toBeVisible();
  await expect(page.locator('.wa-onboard')).toContainText('Pendiente de activación');
  await expect(page.locator('.wa-onboard [data-act="wa-connect-guide"]')).toBeDisabled();
  await noOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('integraciones-escritorio.png'), fullPage: true, animations: 'disabled' });
});
