import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

const { chromium } = createRequire(import.meta.url)(process.env.PLG_PLAYWRIGHT_MODULE || 'playwright');
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

const rootFamily = { id: 'root', display_name: 'Root', email: 'root@system.local', role: 'admin', is_active: true,
  created_at: '2026-09-27T00:00:00Z', profile_count: 0, profiles: [], friend_requests: [],
  accepted_request_count: 0, pending_incoming_count: 0, pending_outgoing_count: 0, rejected_request_count: 0 };
async function setup(options: { root?: boolean; failure?: boolean; passwordFailure?: boolean; width?: number } = {}) {
  const page = await browser.newPage({ viewport: { width: options.width ?? 1145, height: 811 } });
  page.setDefaultTimeout(5000);
  const posts: any[] = [];
  const passwordChanges: any[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error: Error) => errors.push(error.message));
  const families = [rootFamily];
  await page.route('**/api/v1/**', async (route: any) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/v1/auth/session') return route.fulfill({ json: { authenticated: true,
      user: { id: options.root === false ? 'other-admin' : 'root', name: 'Admin', email: 'admin@example.test', isRoot: options.root !== false } } });
    if (path === '/api/v1/admin/session') return route.fulfill({ json: { is_admin: true } });
    if (path === '/api/v1/admin/families/new-family/password' && request.method() === 'PUT') {
      passwordChanges.push(request.postDataJSON());
      if (options.passwordFailure) return route.fulfill({ status: 500, json: { error: { message: 'Unable to update password.' } } });
      return route.fulfill({ status: 204, body: '' });
    }
    if (path === '/api/v1/admin/families') {
      if (request.method() === 'POST') {
        const body = request.postDataJSON();
        posts.push(body);
        if (options.failure) return route.fulfill({ status: 409, json: { error: { message: 'An account with that email already exists.' } } });
        families.push({ ...rootFamily, id: 'new-family', display_name: body.name, email: body.email, role: 'family' });
        return route.fulfill({ status: 201, json: { id: 'new-family', display_name: body.name, email: body.email } });
      }
      return route.fulfill({ json: families });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto(`${origin}/admin/families`);
  await page.getByRole('button', { name: 'Detail', exact: true }).waitFor();
  return { page, posts, passwordChanges, errors };
}
async function fill(page: any) {
  await page.getByLabel('Family name', { exact: true }).fill('New family');
  await page.getByLabel('Family email', { exact: true }).fill('new@example.test');
  await page.getByLabel('Initial password', { exact: true }).fill('local-family-password');
  await page.getByLabel('Retype password', { exact: true }).fill('local-family-password');
}

test('root can create a family, remains signed in, and opens its empty details', async () => {
  const t = await setup();
  try {
    await t.page.getByRole('button', { name: 'Create family', exact: true }).click();
    await fill(t.page);
    await t.page.getByRole('button', { name: 'Save family', exact: true }).click();
    await t.page.getByRole('heading', { name: 'New family', exact: true }).waitFor();
    assert.match(t.page.url(), /\/admin\/families\/new-family$/);
    assert.deepEqual(t.posts, [{ name: 'New family', email: 'new@example.test', password: 'local-family-password' }]);
    assert.equal(await t.page.getByRole('button', { name: 'Update root password' }).count(), 1);
    await t.page.getByText('No kids found in this family.', { exact: true }).waitFor();
    await t.page.getByText('new@example.test', { exact: true }).waitFor();
    await t.page.reload();
    await t.page.getByRole('heading', { name: 'New family', exact: true }).waitFor();
    assert.deepEqual(t.errors, []);
  } finally { await t.page.close(); }
});
test('root Detail works without learners and can return to the family list', async () => {
  const t = await setup();
  try {
    await t.page.getByRole('button', { name: 'Detail', exact: true }).click();
    await t.page.getByRole('heading', { name: 'Root', exact: true }).waitFor();
    await t.page.getByText('No kids found in this family.', { exact: true }).waitFor();
    await t.page.getByRole('button', { name: 'Close', exact: true }).click();
    await t.page.getByRole('button', { name: 'Detail', exact: true }).waitFor();
  } finally { await t.page.close(); }
});
test('non-root administrators can create a normal family', async () => {
  const t = await setup({ root: false });
  try {
    await t.page.getByRole('button', { name: 'Create family', exact: true }).click();
    await fill(t.page);
    await t.page.getByRole('button', { name: 'Save family', exact: true }).click();
    await t.page.getByRole('heading', { name: 'New family', exact: true }).waitFor();
    assert.equal(t.posts.length, 1);
    assert.equal(await t.page.getByRole('button', { name: 'Update root password' }).count(), 0);
  }
  finally { await t.page.close(); }
});
test('normal family detail sets an ongoing password and clears it after a failed attempt', async () => {
  const t = await setup({ passwordFailure: true });
  try {
    await t.page.getByRole('button', { name: 'Create family', exact: true }).click();
    await fill(t.page);
    await t.page.getByRole('button', { name: 'Save family', exact: true }).click();
    await t.page.getByRole('heading', { name: 'New family', exact: true }).waitFor();
    await t.page.getByRole('button', { name: 'Set password', exact: true }).click();
    await t.page.getByRole('heading', { name: 'Set password for New family' }).waitFor();
    const dialog = t.page.getByRole('dialog');
    await dialog.getByLabel('New password', { exact: true }).fill('fresh-local-password');
    await dialog.getByLabel('Confirm new password', { exact: true }).fill('mismatched-password');
    await dialog.getByLabel('Support reason').fill('Owner request');
    await dialog.getByRole('button', { name: 'Set password' }).click();
    await t.page.getByText('Passwords must match.').waitFor();
    assert.equal(t.passwordChanges.length, 0);
    await dialog.getByLabel('Confirm new password', { exact: true }).fill('fresh-local-password');
    await dialog.getByRole('button', { name: 'Set password' }).click();
    await t.page.getByText('Unable to update password.').waitFor();
    assert.equal(await dialog.getByLabel('New password', { exact: true }).inputValue(), '');
    assert.deepEqual(t.passwordChanges, [{ new_password: 'fresh-local-password', reason: 'Owner request' }]);
    assert.deepEqual(t.errors, []);
  } finally { await t.page.close(); }
});
test('root detail never offers the ordinary-family password action', async () => {
  const t = await setup();
  try {
    await t.page.getByRole('button', { name: 'Detail', exact: true }).click();
    assert.equal(await t.page.getByRole('button', { name: 'Set password', exact: true }).count(), 0);
  } finally { await t.page.close(); }
});
test('password change succeeds at narrow width without exposing the new password', async () => {
  const t = await setup({ width: 320 });
  try {
    await t.page.getByRole('button', { name: 'Create family', exact: true }).click();
    await fill(t.page);
    await t.page.getByRole('button', { name: 'Save family', exact: true }).click();
    await t.page.getByRole('button', { name: 'Set password', exact: true }).click();
    const dialog = t.page.getByRole('dialog');
    assert.equal(await t.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await dialog.getByLabel('New password', { exact: true }).fill('fresh-local-password');
    await dialog.getByLabel('Confirm new password', { exact: true }).fill('fresh-local-password');
    await dialog.getByLabel('Support reason').fill('Owner request');
    await dialog.getByRole('button', { name: 'Set password' }).click();
    await t.page.getByRole('status').getByText(/Password updated for New family/).waitFor();
    assert.equal(await dialog.count(), 0);
    assert.equal(await t.page.getByText('fresh-local-password').count(), 0);
    assert.deepEqual(t.passwordChanges, [{ new_password: 'fresh-local-password', reason: 'Owner request' }]);
    assert.deepEqual(t.errors, []);
  } finally { await t.page.close(); }
});
test('mismatched passwords never submit, cancellation clears credentials, and duplicate email stays editable', async () => {
  const t = await setup({ failure: true });
  try {
    await t.page.getByRole('button', { name: 'Create family', exact: true }).click();
    await fill(t.page);
    await t.page.getByLabel('Retype password', { exact: true }).fill('different-password');
    await t.page.getByRole('button', { name: 'Save family', exact: true }).click();
    await t.page.getByText('Passwords must match.', { exact: true }).waitFor();
    assert.equal(t.posts.length, 0);
    await t.page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await t.page.getByRole('button', { name: 'Create family', exact: true }).click();
    assert.equal(await t.page.getByLabel('Initial password', { exact: true }).inputValue(), '');
    await fill(t.page);
    await t.page.getByRole('button', { name: 'Save family', exact: true }).click();
    await t.page.getByText('An account with that email already exists.', { exact: true }).waitFor();
    assert.equal(await t.page.getByLabel('Family email', { exact: true }).inputValue(), 'new@example.test');
  } finally { await t.page.close(); }
});
for (const width of [320, 768, 1024, 1440]) {
  test(`create family form fits ${width}px`, async () => {
    const t = await setup({ width });
    try {
      await t.page.getByRole('button', { name: 'Create family', exact: true }).click();
      await fill(t.page);
      assert.equal(await t.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await t.page.screenshot({ path: `/tmp/plg-family-create-${width}.png`, fullPage: true });
    } finally { await t.page.close(); }
  });
}
