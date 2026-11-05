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

for (const authenticated of [false, true]) {
  test(`${authenticated ? 'unverified session' : 'signed-out admin route'} keeps login inputs available when admin verification fails`, async () => {
    const page = await browser.newPage();
    page.setDefaultTimeout(3000);
    let user = authenticated ? { id: 'family-1', name: 'Family', email: 'family@example.test' } : null;
    let checks = 0;
    let logins = 0;
    await page.route('**/api/v1/**', async (route: any) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/v1/auth/session') return route.fulfill({ json: { authenticated: Boolean(user), user } });
      if (path === '/api/v1/admin/session') {
        checks++;
        return logins ? route.fulfill({ json: { is_admin: true } }) : route.fulfill({ status: 503, json: { error: { message: 'Unavailable' } } });
      }
      if (path === '/api/v1/auth/login') {
        logins++;
        user = { id: 'root', name: 'Root', email: 'root@system.local' };
        return route.fulfill({ status: 204 });
      }
      return route.fulfill({ json: path.endsWith('/registration') ? { enabled: false } : [] });
    });
    try {
      await page.goto(`${origin}/admin`);
      await page.getByRole('heading', { name: 'Admin Login', exact: true }).waitFor();
      if (!authenticated) assert.equal(checks, 0, 'signed-out visitors must not need an admin access check');
      else {
        await page.getByRole('button', { name: 'Try again' }).waitFor();
        await page.getByRole('button', { name: 'Try again' }).click();
      }
      await page.getByLabel('Email or root', { exact: true }).fill('root');
      await page.getByLabel('Password', { exact: true }).fill('local-fixture-password');
      await page.getByRole('button', { name: 'Log In', exact: true }).click();
      await page.getByRole('heading', { name: 'Admin Dashboard', exact: true }).waitFor();
      assert.equal(logins, 1);
    } finally { await page.close(); }
  });
}
