import { test, expect } from '@playwright/test';
import { loginAsLocalDev, loginAsLocalAdmin } from '../helpers/auth';

// The app is called Notably Better (docs/app-name.md). It was "The Music Ledger" until October 2026, and for
// two days before the rename a super admin could switch the name on screen between three (ML-484) - that
// switch has gone. This checks the name everywhere a member meets it, and that the switch is not there.

const NAME = 'Notably Better';

test('signed out: the sign-in screen, the tab and the installed app all say Notably Better', async ({ page }) => {
  await page.goto('/');
  const splash = page.locator('#splashImage');
  await expect(splash).toHaveAttribute('alt', NAME);
  await expect(splash).toHaveAttribute('src', 'images/brands/notably-better-splash.jpg');
  await expect(splash).toBeVisible(); // nothing holds the picture back
  expect(await splash.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0), 'the sign-in picture loaded').toBe(true);
  await expect(page).toHaveTitle(NAME);
  await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute('href', 'images/brands/notably-better-tab.svg');
  const manifest = await (await page.request.get('/manifest.json')).json();
  expect(manifest.name).toBe(NAME);
  expect(manifest.short_name).toBe(NAME);
  for (const icon of manifest.icons) expect((await page.request.get(`/${icon.src}`)).status(), icon.src).toBe(200);
});

test('the name trial has gone: no route and no admin page', async ({ page }) => {
  // an address the server no longer knows gets the app's page like any other unknown address - never the old answer
  const old = await page.request.get('/api/brand');
  expect(old.headers()['content-type'] || '').not.toContain('json');
  expect(await old.text()).not.toContain('"brand"');
  await loginAsLocalAdmin(page);
  const token = await page.evaluate(() => localStorage.getItem('authToken'));
  const put = await page.request.put('/api/admin/brand', { headers: { Authorization: `Bearer ${token}` }, data: { brand: 'fivetto' } });
  expect(put.status()).toBe(404);
  await page.setViewportSize({ width: 1280, height: 800 }); // the admin panel is desktop first
  await page.goto('/admin.html');
  await expect(page.locator('#adminShell')).toBeVisible();
  await expect(page).toHaveTitle(`${NAME} Admin`);
  await expect(page.locator('.admin-nav-item[data-section="brand"]')).toHaveCount(0);
  await expect(page.locator('.admin-nav-item', { hasText: 'App name' })).toHaveCount(0);
});

test('signed in on a phone: the name and its mark at the top of Home, and the name on the tab', async ({ page }) => {
  await loginAsLocalDev(page);
  await expect(page.locator('#topTitle')).toHaveText(NAME);
  await expect(page.locator('#topBrandMark')).toBeVisible();
  await expect(page.locator('#topBrandMark')).toHaveAttribute('src', 'images/brands/notably-better-mark.svg');
  await page.evaluate(() => (window as any).switchView('settingsView'));
  await expect(page.locator('#topTitle')).toHaveText('Settings');
  await expect(page.locator('#topBrandMark')).toBeHidden();
  await expect(page).toHaveTitle(`Settings - ${NAME}`);
});

test('on a wide screen the rail\'s head carries the mark and the name; folded, the mark alone', async ({ browser }) => {
  const wide = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const desk = await wide.newPage();
  await loginAsLocalDev(desk);
  await expect(desk.locator('#railBrandName')).toHaveText(NAME);
  await expect(desk.locator('#railBrandMark')).toBeVisible();
  await expect(desk.locator('#topBrandMark')).toBeHidden();
  await expect(desk.locator('#topTitle')).toHaveText('Home');
  expect(await desk.locator('#railBrandName').evaluate((el) => el.scrollWidth <= el.clientWidth), 'the name fits in the rail').toBe(true);
  await desk.locator('#navRailFoldBtn').click();
  await expect(desk.locator('#railBrandName')).toBeHidden();
  await expect(desk.locator('#railBrandMark')).toBeVisible();
  await desk.locator('#navRailFoldBtn').click(); // leave the rail open, as it was found
  await wide.close();
});

test('the privacy policy and the terms carry the new name, the new address, and say what the app was called', async ({ page }) => {
  await page.goto('/privacy.html');
  await expect(page).toHaveTitle(`Privacy policy - ${NAME}`);
  const policy = page.locator('body');
  await expect(policy).toContainText('Until October 2026 the app was called The Music Ledger.');
  await expect(policy).toContainText('hello@notablybetter.com');
  await expect(policy).not.toContainText('gmail.com');
  await expect(policy).toContainText('Brevo');
  await expect(policy).toContainText('Fasthosts');
  await page.goto('/terms.html');
  await expect(page).toHaveTitle(`Terms of use - ${NAME}`);
  await expect(page.locator('body')).toContainText('Until October 2026 the app was called The Music Ledger.');
  await expect(page.locator('body')).toContainText('hello@notablybetter.com');
  await expect(page.locator('body')).not.toContainText('gmail.com');
});
