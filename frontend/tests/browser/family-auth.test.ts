import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
const { chromium } = createRequire(import.meta.url)('playwright');
let browser: any, server: Awaited<ReturnType<typeof createServer>>, origin: string;
before(async () => {
  server = await createServer({ configFile: false, cacheDir: '/tmp/plg-family-auth-cache', plugins: [react()], root: fileURLToPath(new URL('../../', import.meta.url)), server: { host: '127.0.0.1', port: 0 } });
  await server.listen(); const address = server.httpServer!.address(); assert.ok(address && typeof address !== 'string'); origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true, ...(process.env.PLG_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLG_CHROMIUM_EXECUTABLE } : {}) });
});
after(async () => { await browser?.close(); await server?.close(); });
async function fixture(viewport = { width: 1024, height: 768 }, options: { preferred?: boolean; registration?: boolean; failedAvailability?: boolean } = {}) {
  const page = await browser.newPage({ viewport, hasTouch: true }); page.setDefaultTimeout(7000);
  if (options.preferred) await page.context().addCookies([{ name: 'plg_passkey_preferred', value: 'true', url: origin }]);
  const errors: string[] = [], registrations: unknown[] = []; page.on('pageerror', (e: Error) => errors.push(e.message));
  let authenticated = false, newlyCreated = false, availabilityFailed = !!options.failedAvailability;
  await page.route('**/api/v1/**', async (route: any) => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (path.endsWith('/auth/registration')) {
      if (availabilityFailed) { availabilityFailed = false; return route.fulfill({ status: 503, json: { error: { message: 'Temporarily unavailable' } } }); }
      return route.fulfill({ json: { enabled: options.registration !== false } });
    }
    if (path.endsWith('/legal/version')) return route.fulfill({ json: { version: 'test-legal-version' } });
    if (path.endsWith('/auth/login')) { authenticated = true; return route.fulfill({ status: 204 }); }
    if (path.endsWith('/auth/logout')) { authenticated = false; return route.fulfill({ status: 204 }); }
    if (path.endsWith('/auth/register')) { registrations.push(request.postDataJSON()); authenticated = true; newlyCreated = true; return route.fulfill({ status: 201, json: {} }); }
    if (path.endsWith('/auth/session')) return route.fulfill({ json: { authenticated, ...(authenticated ? { user: { id: 'family-a', email: 'a@test.local', name: 'Test Family' }, ...(newlyCreated ? { onboarding: true } : {}) } : {}) } });
    if (path.endsWith('/auth/google/config')) return route.fulfill({ json: { enabled: false } });
    if (path.endsWith('/health/ready')) return route.fulfill({ json: { status: 'ready' } });
    if (path.endsWith('/family/onboarding')) return route.fulfill({ json: { dismissed: false, child_created: false, parent_visited: false, friend_request_created: false, passkey_created: false, passkeys_enabled: true } });
    return route.fulfill({ json: [] });
  });
  return { page, errors, registrations };
}
async function choices(page: any) {
  const card = page.locator('.family-login-card');
  await card.getByRole('heading', { name: 'Welcome back, explorer!', exact: true }).waitFor();
  assert.ok(await card.getByRole('link', { name: 'Create a family account', exact: true }).isVisible());
  assert.equal(await card.count(), 1);
  assert.equal(await page.getByRole('tab').count(), 0);
  assert.equal(await page.locator('.family-auth-choices').count(), 0);
  return card;
}
for (const preferred of [false, true]) test(`fresh visit and logout share the same family entry with passkey preference ${preferred}`, async () => {
  const { page, errors } = await fixture(undefined, { preferred });
  try {
    await page.goto(`${origin}/login`); await page.getByRole('heading', { name: 'Welcome back, explorer!', exact: true }).waitFor(); const nav = await choices(page);
    if (preferred) await page.getByRole('button', { name: 'Use password instead', exact: true }).tap();
    await page.getByLabel('Email', { exact: true }).fill('a@test.local'); await page.getByLabel('Password', { exact: true }).fill('test-family-password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).tap(); await page.getByRole('heading', { name: "Who's joining today?", exact: true }).waitFor();
    await page.getByRole('button', { name: 'Sign out', exact: true }).tap(); await page.goto(`${origin}/login`); await page.getByRole('heading', { name: 'Welcome back, explorer!', exact: true }).waitFor(); await choices(page);
    await page.reload(); await choices(page); await nav.getByRole('link', { name: 'Create a family account', exact: true }).tap();
    await page.getByRole('heading', { name: 'Create your family account', exact: true }).waitFor(); await page.getByLabel('Family name', { exact: true }).waitFor();
    await page.getByRole('link', { name: 'Back to sign in', exact: true }).tap(); await page.getByRole('heading', { name: 'Welcome back, explorer!', exact: true }).waitFor();
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});
for (const [width, height] of [[320, 667], [390, 844], [1024, 768], [1180, 820], [1366, 768]]) test(`original welcome and registration link remain usable at ${width}x${height}`, async () => {
  const { page, errors } = await fixture({ width, height });
  try {
    await page.goto(`${origin}/login`); const nav = await choices(page);
    for (const link of await nav.getByRole('link').all()) { const b = await link.boundingBox(); assert.ok(b && b.x >= 0 && b.y >= 0 && b.x + b.width <= width && b.height > 0); }
    await nav.getByRole('link', { name: 'Create a family account', exact: true }).tap(); await page.getByLabel('Family name', { exact: true }).waitFor(); assert.equal(await page.getByRole('link', { name: 'Back to sign in', exact: true }).count(), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `/tmp/plg-family-entry-${width}.png`, fullPage: true }); assert.deepEqual(errors, []);
  } finally { await page.close(); }
});
test('registration creates a family through the existing API and opens the new-family checklist', async () => {
  const { page, errors, registrations } = await fixture();
  try {
    await page.goto(`${origin}/register`); await page.getByLabel('Family name', { exact: true }).fill('Our Family'); await page.getByLabel('Email', { exact: true }).fill('new@test.local');
    await page.getByLabel('Password', { exact: true }).fill('new-family-password'); await page.getByLabel('Confirm password', { exact: true }).fill('new-family-password');
    await page.getByRole('button', { name: 'Create family account', exact: true }).tap();
    const consent = page.getByRole('dialog', { name: 'Please read before continuing', exact: true }); await consent.waitFor();
    const legalText = consent.getByRole('region', { name: 'Privacy Policy and Terms of Use', exact: true });
    await legalText.evaluate((element: HTMLElement) => { element.scrollTop = element.scrollHeight; element.dispatchEvent(new Event('scroll')); });
    await consent.getByRole('checkbox').check(); await consent.getByRole('button', { name: 'I agree & continue', exact: true }).tap();
    await page.waitForURL(origin + '/'); await page.locator('.family-onboarding ol').waitFor();
    assert.deepEqual(registrations, [{ name: 'Our Family', email: 'new@test.local', password: 'new-family-password', legalVersion: 'test-legal-version' }]); assert.deepEqual(errors, []);
  } finally { await page.close(); }
});
test('server-disabled registration remains explained on the same entry page and never submits', async () => {
  const { page, errors, registrations } = await fixture(undefined, { registration: false });
  try {
    await page.goto(`${origin}/login`); const nav = await choices(page); await nav.getByRole('link', { name: 'Create a family account', exact: true }).tap();
    await page.getByText('New family registration is currently closed. Please contact the administrator to get started.', { exact: true }).waitFor(); assert.ok(await page.getByRole('link', { name: 'Back to sign in', exact: true }).isVisible());
    assert.equal(await page.locator('form').count(), 0); assert.deepEqual(registrations, []); assert.deepEqual(errors, []);
  } finally { await page.close(); }
});
test('registration availability can be retried without losing the shared sign-in choice', async () => {
  const { page, errors } = await fixture(undefined, { failedAvailability: true });
  try {
    await page.goto(`${origin}/register`); await page.getByRole('alert').waitFor(); assert.ok(await page.getByRole('link', { name: 'Back to sign in', exact: true }).isVisible()); await page.getByRole('button', { name: 'Try again', exact: true }).tap(); await page.getByLabel('Family name', { exact: true }).waitFor(); assert.deepEqual(errors, []);
  } finally { await page.close(); }
});
