import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLG_PLAYWRIGHT_MODULE || 'playwright');
let browser: any;
let server: Awaited<ReturnType<typeof createServer>>;
let origin: string;
before(async () => {
  server = await createServer({ configFile: false, plugins: [react()],
    root: fileURLToPath(new URL('../../', import.meta.url)), server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  const address = server.httpServer!.address();
  assert.ok(address && typeof address !== 'string');
  origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await server?.close(); });

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

async function setup(options: { flag?: unknown; hold?: boolean; failure?: boolean; equalFallback?: boolean; width?: number; app?: boolean } = {}) {
  const page = await browser.newPage({ viewport: { width: options.width ?? 1024, height: 768 } });
  page.setDefaultTimeout(5_000);
  let user: Record<string, unknown> | null = { id: 'root-user', name: 'Root', email: 'root@system.local',
    ...(Object.hasOwn(options, 'flag') ? { isRoot: options.flag } : { isRoot: true }) };
  const ready = deferred();
  const delivered = deferred();
  const patches: any[] = [];
  const logins: any[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error: Error) => errors.push(error.message));
  await page.route('**/api/v1/**', async (route: any) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/v1/auth/session') return route.fulfill({ json: user ? { authenticated: true, user } : { authenticated: false } });
    if (path === '/api/v1/auth/login') {
      logins.push(request.postDataJSON());
      user = { id: 'root-user', name: 'Root', email: 'root@system.local', isRoot: true };
      return route.fulfill({ status: 204 });
    }
    if (path === '/api/v1/admin/session') return route.fulfill({ status: user ? 200 : 401, json: { is_admin: Boolean(user) } });
    if (path === '/api/v1/admin/root/password') {
      patches.push({ method: request.method(), body: request.postDataJSON() });
      const submittingUser = user;
      if (options.hold) await ready.promise;
      const equalFallback = options.equalFallback && request.postDataJSON().newPassword === request.postDataJSON().fallbackPassword;
      if (!options.failure && !equalFallback && user === submittingUser) user = null;
      try {
        await route.fulfill(options.failure ? { status: 403, json: { error: { message: 'The fallback password is incorrect.' } } }
          : equalFallback ? { status: 422, json: { error: { message: 'The new password must differ from the fallback password.' } } } : { status: 204 });
      } catch { /* An aborted request can be discarded by Chromium. */ }
      delivered.resolve();
      return;
    }
    return route.fulfill({ json: path.endsWith('/registration') ? { enabled: false } : [] });
  });
  await page.goto(options.app ? `${origin}/admin` : `${origin}/tests/browser/root-password-harness.html`);
  await page.getByRole('heading', { name: options.app ? 'Admin Dashboard' : 'Family route', exact: true }).waitFor();
  return { page, patches, logins, errors, ready, delivered,
    replaceSession: async (sameRoot = false) => {
      user = sameRoot ? { id: 'root-user', name: 'Root', email: 'root@system.local', isRoot: true }
        : { id: 'other-user', name: 'Other', email: 'other@example.com' };
      await page.evaluate(() => (window as any).rootPasswordTest.refreshSession());
    }, signOut: async () => { user = null; await page.evaluate(() => (window as any).rootPasswordTest.refreshSession()); } };
}

async function open(page: any) {
  await page.getByRole('button', { name: 'Update root password', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Update root password' });
  await dialog.waitFor();
  assert.equal(await dialog.getByLabel('New password', { exact: true }).evaluate((el: HTMLElement) => el === document.activeElement), true, 'every opening focuses the new password');
  return dialog;
}
async function fill(dialog: any, newPassword = ' new-password-123 ', confirmPassword = newPassword, fallbackPassword = ' exact-fallback-password-123 ') {
  await dialog.getByLabel('New password', { exact: true }).fill(newPassword);
  await dialog.getByLabel('Retype new password', { exact: true }).fill(confirmPassword);
  await dialog.getByLabel('Fallback password', { exact: true }).fill(fallbackPassword);
}

test('only literal root can see the fixed control across routes', async () => {
  for (const flag of [undefined, false, 'true', 1]) {
    const t = await setup({ flag });
    try { assert.equal(await t.page.getByRole('button', { name: 'Update root password' }).count(), 0); }
    finally { await t.page.close(); }
  }
  const t = await setup();
  try {
    for (const name of ['Parent route', 'Admin route', 'Family login route']) {
      await t.page.getByRole('button', { name, exact: true }).click();
      const trigger = t.page.getByRole('button', { name: 'Update root password', exact: true });
      await trigger.waitFor();
      assert.equal(await trigger.evaluate((el: HTMLElement) => getComputedStyle(el).position), 'fixed');
    }
    assert.deepEqual(t.errors, []);
  } finally { await t.page.close(); }
});

test('the real App keeps the root control through route navigation and displays success after signout', async () => {
  const t = await setup({ app: true });
  try {
    await t.page.getByRole('link', { name: /Content Authoring/ }).click();
    await t.page.getByRole('button', { name: 'Update root password', exact: true }).waitFor();
    assert.equal(new URL(t.page.url()).pathname, '/admin/content');
    const dialog = await open(t.page);
    await fill(dialog);
    await dialog.getByRole('button', { name: 'Update password', exact: true }).click();
    await t.page.getByRole('heading', { name: 'Admin Login', exact: true }).waitFor();
    await t.page.getByRole('status').filter({ hasText: /new password or.*fallback password/i }).waitFor();
    await t.page.screenshot({ path: '/tmp/plg-root-password-success.png' });
    assert.equal(new URL(t.page.url()).pathname, '/admin');
    assert.equal(await t.page.getByRole('button', { name: 'Update root password' }).count(), 0);
    assert.deepEqual(t.errors, []);
  } finally { await t.page.close(); }
});

test('modal validates mismatch and lengths, preserves exact passwords, then signs out with visible success', async () => {
  const t = await setup();
  try {
    const dialog = await open(t.page);
    assert.equal(await dialog.evaluate((el: HTMLElement) => el.matches(':modal')), true);
    assert.equal(await dialog.getByLabel('New password', { exact: true }).getAttribute('minlength'), '12');
    assert.equal(await dialog.getByLabel('Fallback password', { exact: true }).getAttribute('minlength'), '20');
    for (const label of ['New password', 'Retype new password', 'Fallback password']) {
      assert.equal(await dialog.getByLabel(label, { exact: true }).getAttribute('maxlength'), '256');
    }
    await fill(dialog, 'new-password-123', 'other-password-123');
    await dialog.getByRole('button', { name: 'Update password', exact: true }).click();
    await dialog.getByRole('alert').filter({ hasText: /match/ }).waitFor();
    assert.equal(t.patches.length, 0);
    await fill(dialog);
    await dialog.getByRole('button', { name: 'Update password', exact: true }).click();
    await t.page.getByRole('heading', { name: 'Admin Login' }).waitFor();
    await t.page.getByRole('status').filter({ hasText: /new password or.*fallback password/i }).waitFor();
    assert.equal(await t.page.getByLabel('Current family').textContent(), 'signed-out');
    assert.equal(await t.page.getByLabel('Current route').textContent(), '/admin');
    assert.deepEqual(t.patches, [{ method: 'PATCH', body: { newPassword: ' new-password-123 ', confirmPassword: ' new-password-123 ', fallbackPassword: ' exact-fallback-password-123 ' } }]);
    assert.equal(await t.page.getByRole('button', { name: 'Update root password' }).count(), 0);
    assert.deepEqual(t.errors, []);
  } finally { await t.page.close(); }
});

test('Escape and cancel wipe fields and errors and restore trigger focus', async () => {
  const t = await setup({ failure: true });
  try {
    let dialog = await open(t.page);
    await fill(dialog);
    await dialog.getByRole('button', { name: 'Update password', exact: true }).click();
    await dialog.getByRole('alert').filter({ hasText: /fallback password is incorrect/ }).waitFor();
    await t.page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await t.page.getByRole('button', { name: 'Update root password', exact: true }).evaluate((el: HTMLElement) => el === document.activeElement), true);
    for (const label of ['New password', 'Retype new password', 'Fallback password']) assert.equal(await t.page.getByLabel(label, { exact: true }).inputValue(), '');
    dialog = await open(t.page);
    assert.equal(await dialog.getByRole('alert').count(), 0);
    await fill(dialog);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await t.page.getByRole('button', { name: 'Update root password', exact: true }).evaluate((el: HTMLElement) => el === document.activeElement), true);
    assert.equal(await t.page.getByLabel('Fallback password', { exact: true }).inputValue(), '');
  } finally { await t.page.close(); }
});

test('pending update rejects closing and duplicate submission', async () => {
  const t = await setup({ hold: true });
  try {
    const dialog = await open(t.page);
    await fill(dialog);
    await dialog.getByRole('button', { name: 'Update password', exact: true }).click();
    await t.page.waitForFunction(() => document.querySelector('dialog')?.getAttribute('aria-busy') === 'true');
    assert.equal(await dialog.getByRole('button', { name: 'Cancel', exact: true }).isDisabled(), true);
    await t.page.keyboard.press('Escape');
    assert.equal(await dialog.isVisible(), true);
    await t.page.keyboard.press('Enter');
    assert.equal(t.patches.length, 1);
    t.ready.resolve();
    await t.page.getByRole('heading', { name: 'Admin Login' }).waitFor();
  } finally { t.ready.resolve(); await t.page.close(); }
});

for (const sameRoot of [false, true]) {
  test(`late response cannot clear a replacement ${sameRoot ? 'root' : 'family'} session`, async () => {
    const t = await setup({ hold: true });
    try {
      const dialog = await open(t.page);
      await fill(dialog);
      await dialog.getByRole('button', { name: 'Update password', exact: true }).click();
      await t.page.waitForFunction(() => document.querySelector('dialog')?.getAttribute('aria-busy') === 'true');
      await t.replaceSession(sameRoot);
      await dialog.waitFor({ state: 'hidden' });
      t.ready.resolve();
      await t.delivered.promise;
      assert.equal(await t.page.getByLabel('Current family').textContent(), sameRoot ? 'root-user' : 'other-user');
      assert.equal(await t.page.getByLabel('Current route').textContent(), '/');
      if (sameRoot) {
        const fresh = await open(t.page);
        assert.equal(await fresh.getByLabel('New password', { exact: true }).inputValue(), '');
        assert.equal(await fresh.getByRole('alert').count(), 0);
      }
      assert.deepEqual(t.errors, []);
    } finally { t.ready.resolve(); await t.page.close(); }
  });
}

test('unmount aborts pending work and wipes password DOM without late errors', async () => {
  const t = await setup({ hold: true, failure: true });
  try {
    const dialog = await open(t.page);
    await fill(dialog);
    await dialog.getByRole('button', { name: 'Update password', exact: true }).click();
    await t.page.waitForFunction(() => document.querySelector('dialog')?.getAttribute('aria-busy') === 'true');
    await t.page.evaluate(() => (window as any).rootPasswordTest.unmount());
    t.ready.resolve();
    await t.delivered.promise;
    assert.equal(await t.page.locator('input[type="password"]').count(), 0);
    assert.equal(await t.page.locator('[role="alert"]').count(), 0);
    assert.deepEqual(t.errors, []);
  } finally { t.ready.resolve(); await t.page.close(); }
});

test('native modal fits 320, 768, 1024, and 1440px and keyboard focus cannot reach background controls', async () => {
  for (const width of [320, 768, 1024, 1440]) {
    const t = await setup({ width });
    try {
      const dialog = await open(t.page);
      const box = await dialog.boundingBox();
      assert.ok(box && box.x >= 0 && box.x + box.width <= width);
      assert.equal(await dialog.evaluate((el: HTMLElement) => el.scrollWidth <= el.clientWidth), true);
      for (let i = 0; i < 12; i++) {
        await t.page.keyboard.press(i < 6 ? 'Tab' : 'Shift+Tab');
        // Chromium may focus the browser chrome (represented by body) between
        // cycles. No background page control may receive keyboard focus.
        assert.equal(await dialog.evaluate((el: HTMLElement) => el.contains(document.activeElement) || document.activeElement === document.body), true);
      }
      await t.page.screenshot({ path: `/tmp/plg-root-password-${width}.png` });
      assert.deepEqual(t.errors, []);
    } finally { await t.page.close(); }
  }
});

test('short passwords never submit and a 422 error can be corrected without losing the session', async () => {
  const t = await setup({ equalFallback: true });
  try {
    const dialog = await open(t.page);
    await fill(dialog, 'too-short', 'too-short', 'short-fallback');
    await dialog.getByRole('button', { name: 'Update password', exact: true }).click();
    assert.equal(t.patches.length, 0);
    assert.equal(await t.page.getByLabel('Current family').textContent(), 'root-user');
    await fill(dialog, 'same-fallback-password-123', 'same-fallback-password-123', 'same-fallback-password-123');
    await dialog.getByRole('button', { name: 'Update password', exact: true }).click();
    await dialog.getByRole('alert').filter({ hasText: /must differ/ }).waitFor();
    assert.equal(await t.page.getByLabel('Current family').textContent(), 'root-user');
    assert.equal(await dialog.getByRole('button', { name: 'Update password', exact: true }).isEnabled(), true);
    await fill(dialog);
    await dialog.getByRole('button', { name: 'Update password', exact: true }).click();
    await t.page.getByRole('heading', { name: 'Admin Login' }).waitFor();
    assert.equal(t.patches.length, 2);
    assert.deepEqual(t.errors, []);
  } finally { await t.page.close(); }
});

test('a late error from the previous root session cannot reach a reopened dialog', async () => {
  const t = await setup({ hold: true, failure: true });
  try {
    const oldDialog = await open(t.page);
    await fill(oldDialog);
    await oldDialog.getByRole('button', { name: 'Update password', exact: true }).click();
    await t.page.waitForFunction(() => document.querySelector('dialog')?.getAttribute('aria-busy') === 'true');
    await t.replaceSession(true);
    await oldDialog.waitFor({ state: 'hidden' });
    const fresh = await open(t.page);
    t.ready.resolve();
    await t.delivered.promise;
    assert.equal(await fresh.getByRole('alert').count(), 0);
    assert.equal(await fresh.getByLabel('Fallback password', { exact: true }).inputValue(), '');
    assert.deepEqual(t.errors, []);
  } finally { t.ready.resolve(); await t.page.close(); }
});

test('admin accepts literal root with username autocomplete and unchanged email API key', async () => {
  const t = await setup();
  try {
    await t.signOut();
    await t.page.getByRole('button', { name: 'Admin route', exact: true }).click();
    const identifier = t.page.getByLabel('Email or root', { exact: true });
    await identifier.waitFor();
    assert.equal(await identifier.getAttribute('type'), 'text');
    assert.equal(await identifier.getAttribute('autocomplete'), 'username');
    assert.equal(await identifier.evaluate((input: HTMLInputElement) => input.classList.contains('caret-blue-600')), true);
    assert.deepEqual(await identifier.evaluate((input: HTMLInputElement) => ({ cursor: getComputedStyle(input).cursor, caretVisible: getComputedStyle(input).caretColor !== 'rgba(0, 0, 0, 0)' })), { cursor: 'text', caretVisible: true });
    await identifier.fill('root');
    const password = t.page.getByLabel('Password', { exact: true });
    await password.fill('root-login-password');
    assert.equal(await password.getAttribute('type'), 'password');
    await t.page.getByRole('button', { name: 'Show password', exact: true }).click();
    assert.equal(await password.getAttribute('type'), 'text');
    assert.equal(await password.inputValue(), 'root-login-password');
    await t.page.getByRole('button', { name: 'Hide password', exact: true }).click();
    assert.equal(await password.getAttribute('type'), 'password');
    await t.page.getByRole('button', { name: 'Log In', exact: true }).click();
    await t.page.getByRole('heading', { name: 'Admin dashboard' }).waitFor();
    assert.deepEqual(t.logins, [{ email: 'root', password: 'root-login-password' }]);
    await t.page.getByRole('button', { name: 'Update root password', exact: true }).waitFor();
    await t.page.getByRole('button', { name: 'Family login route', exact: true }).click();
    assert.equal(await t.page.getByLabel('Email', { exact: true }).getAttribute('type'), 'email');
    assert.deepEqual(t.errors, []);
  } finally { await t.page.close(); }
});
