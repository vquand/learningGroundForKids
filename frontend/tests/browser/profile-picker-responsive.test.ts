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

const DEFAULT_PROFILE = {
  id: 'profile-1', name: 'Mun', emoji: '🌟', color: '#3B82F6', avatar_type: 'default',
  avatar_url: 'capybara-calm', avatar_frame: 'space', total_done: 0, native_country_code: 'VN', native_city: 'Hanoi',
};

before(async () => {
  server = await createServer({ configFile: false, cacheDir: '/tmp/plg-profile-order-cache', plugins: [react()],
    root: fileURLToPath(new URL('../../', import.meta.url)), server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  const address = server.httpServer!.address();
  assert.ok(address && typeof address !== 'string');
  origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true,
    ...(process.env.PLG_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLG_CHROMIUM_EXECUTABLE } : {}) });
});

after(async () => { await browser?.close(); await server?.close(); });

async function openPicker(width: number, profileFixtures = [DEFAULT_PROFILE]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const errors: string[] = [];
  const requests: Array<{ method: string; path: string; headers: Record<string, string>; body?: any }> = [];
  let currentProfile: any = profileFixtures[0];
  page.on('pageerror', (error: Error) => errors.push(error.message));
  await page.route('**/api/v1/**', async (route: any) => {
    const request = route.request();
    const path = new URL(route.request().url()).pathname;
    requests.push({ method: request.method(), path, headers: request.headers(), body: request.method() === 'PUT' ? request.postDataJSON() : undefined });
    if (path === '/api/v1/health/ready') return route.fulfill({ json: { status: 'ready' } });
    if (path === '/api/v1/auth/session') return route.fulfill({ json: { authenticated: true,
      user: { id: 'family-1', email: 'family@example.test', name: 'Family' } } });
    if (path === '/api/v1/profiles' && request.method() === 'GET') return route.fulfill({ json: currentProfile ? [currentProfile] : [] });
    if (path === '/api/v1/profiles/profile-1' && request.method() === 'PUT') {
      currentProfile = { ...currentProfile, ...request.postDataJSON() };
      return route.fulfill({ json: currentProfile });
    }
    if (path === '/api/v1/profiles/profile-1/town/name') {
      return route.fulfill({ json: { townName: { adjective: 'Sunny', noun: 'Meadow' } } });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto(origin);
  if (profileFixtures.length) await page.getByRole('button', { name: /Mun/ }).first().waitFor();
  else await page.getByRole('button', { name: /Keeper of the Castle/ }).waitFor();
  return { page, errors, requests };
}

async function openEditor(width: number) {
  const result = await openPicker(width);
  await result.page.getByRole('button', { name: /Mun/ }).first().click();
  await result.page.getByRole('heading', { name: /What do you feel like doing\?/ }).waitFor();
  const activities = result.page.locator('section[aria-labelledby="activity-hub-title"] > div.grid > button');
  assert.ok(await activities.count() >= 4);
  for (const [index, title] of ['Your avatar', 'Badges', 'Sunny Meadow', 'Explore'].entries()) {
    assert.equal(await activities.nth(index).getByText(title, { exact: true }).count(), 1, `activity card ${index + 1} should be ${title}`);
  }
  assert.equal(await activities.last().getByText('Road Racing', { exact: true }).count(), 1, 'Road Racing should be the final activity card');
  if (process.env.PLG_PROFILE_HUB_SCREENSHOT) await result.page.screenshot({ path: process.env.PLG_PROFILE_HUB_SCREENSHOT });
  await activities.first().click();
  await result.page.getByRole('heading', { name: 'Your avatar', exact: true }).waitFor();
  return { ...result, activities };
}

test('avatar card is first, opens the full editor, and saves through the same-origin profile API', async () => {
  const { page, errors, requests } = await openEditor(1024);
  try {
    await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('[aria-label="Choose an avatar frame"] img')].every((img) => img.complete));
    assert.equal(await page.locator('[aria-label="Choose an avatar frame"] img').evaluateAll((images: HTMLImageElement[]) => images.every((img) => img.naturalWidth > 0)), true);
    if (process.env.PLG_PROFILE_SCREENSHOT) {
      await page.waitForTimeout(150);
      await page.screenshot({ path: process.env.PLG_PROFILE_SCREENSHOT });
    }
    const preview = page.getByRole('img', { name: /Profile preview with Space/ });
    const previewBox = await preview.boundingBox();
    const avatarChoices = page.getByRole('group', { name: 'Choose an avatar', exact: true });
    const avatarBox = await avatarChoices.boundingBox();
    assert.ok(previewBox && avatarBox);
    assert.ok(previewBox.width >= 200);
    assert.ok(Math.abs(previewBox.width - previewBox.height) <= 2);
    assert.ok(previewBox.x < avatarBox.x);
    assert.equal(await page.getByText('Preview profile', { exact: true }).count(), 1);
    const firstChoice = await avatarChoices.getByRole('button').first().boundingBox();
    assert.ok(firstChoice && Math.abs(firstChoice.width - firstChoice.height) <= 2);
    await page.getByRole('group', { name: 'Choose an avatar frame' }).getByRole('button').nth(2).click();
    const putResponse = page.waitForResponse((response: any) => response.request().method() === 'PUT' && response.url().endsWith('/api/v1/profiles/profile-1'));
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await putResponse;
    const update = requests.find((request) => request.method === 'PUT' && request.path.endsWith('/profiles/profile-1'));
    assert.ok(update);
    assert.equal(update!.headers.accept, 'application/json');
    assert.equal(update!.headers['content-type'], 'application/json');
    assert.equal(update!.body.name, 'Mun');
    assert.equal(update!.body.avatar_frame, 'christmas');
    assert.ok(requests.some((request) => request.method === 'GET' && request.path === '/api/v1/profiles'));
    await page.getByRole('heading', { name: 'What do you feel like doing?' }).waitFor();
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('avatar editor stays usable on phone, tablet, and landscape desktop sizes', async () => {
  const { page, errors } = await openEditor(375);
  try {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.equal(await page.getByRole('img', { name: /Profile preview with Space/ }).count(), 1);
    for (const [width, height] of [[375, 812], [1024, 768], [1366, 768], [1180, 820]]) {
      await page.setViewportSize({ width, height });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('Escape cancels the avatar editor and restores focus to the avatar card', async () => {
  const { page, errors } = await openEditor(1024);
  try {
    await page.keyboard.press('Escape');
    await page.getByRole('heading', { name: 'What do you feel like doing?' }).waitFor();
    assert.equal(await page.locator('section[aria-labelledby="activity-hub-title"] > div.grid > button').first().evaluate((element: HTMLElement) => element === document.activeElement), true);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('zero-kid family members starts with Keeper of the Castle and does not invent a kid profile', async () => {
  const { page, errors } = await openPicker(375, []);
  try {
    const members = page.getByRole('group', { name: 'Family members', exact: true }).getByRole('button');
    assert.equal(await members.count(), 3);
    assert.equal(await members.first().getByText('Keeper of the Castle', { exact: true }).count(), 1);
    assert.equal(await members.getByText('Mun', { exact: true }).count(), 0);
    if (process.env.PLG_PROFILE_MEMBERS_SCREENSHOT) await page.screenshot({ path: process.env.PLG_PROFILE_MEMBERS_SCREENSHOT });
    await members.first().click();
    await page.waitForURL(/\/parent$/);
    assert.equal(new URL(page.url()).pathname, '/parent');
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('create explorer presents the same tablet layout and includes the original farm animal avatars', async () => {
  const { page, errors } = await openPicker(1024);
  try {
    await page.getByRole('button', { name: 'New Explorer' }).click();
    await page.getByRole('heading', { name: 'Create Explorer' }).waitFor();
    const preview = page.getByRole('img', { name: /Profile preview with No frame/ });
    const choices = page.getByRole('group', { name: 'Choose an avatar', exact: true });
    const previewBox = await preview.boundingBox();
    const choicesBox = await choices.boundingBox();
    assert.ok(previewBox && choicesBox && previewBox.x < choicesBox.x);
    for (const name of ['Dairy Cow', 'Highland Cow', 'Yellow Chick']) {
      assert.equal(await choices.getByRole('button', { name: `Select ${name} avatar` }).count(), 1);
    }
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});
