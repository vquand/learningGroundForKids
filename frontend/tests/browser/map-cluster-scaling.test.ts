import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { preparedMapFixture } from './explore-map-api-fixture.mjs';
import { apiFixture } from './explore-performance-fixtures.mjs';

const { chromium } = createRequire(import.meta.url)(
  process.env.PLG_PLAYWRIGHT_MODULE || "playwright",
);

const profile = {
  id: "profile-1",
  name: "Explorer",
  emoji: "🦊",
  color: "blue",
  total_done: 0,
  badge_count: 0,
  created_at: "2026-09-29T00:00:00.000Z",
};

const regionLongitudes = [-104, -98, -92];
const subgroupOffsets = [-1.4, -0.7, 0, 0.7, 1.4];
const items = regionLongitudes.flatMap((regionLongitude, regionIndex) =>
  subgroupOffsets.flatMap((subgroupOffset, subgroupIndex) =>
    Array.from({ length: 5 }, (_, itemIndex) => ({
      id: `region-${regionIndex}-group-${subgroupIndex}-item-${itemIndex}`,
      category: "animal" as const,
      title: `Animal ${regionIndex}-${subgroupIndex}-${itemIndex}`,
      latitude: 39.8,
      longitude: regionLongitude + subgroupOffset,
      icon_slug: "animal",
      quiz_required: false,
    })),
  ),
);

async function numberedClusterCounts(page: any): Promise<number[]> {
  return (await page
    .locator("[data-cluster] > span[aria-hidden=true]")
    .allTextContents())
    .map(Number)
    .sort((left: number, right: number) => right - left);
}

let browser: any;
let server: Awaited<ReturnType<typeof createServer>>;
let origin: string;

before(async () => {
  server = await createServer({
    configFile: false,
    cacheDir: "/tmp/plg-map-cluster-vite-cache",
    plugins: [react()],
    root: fileURLToPath(new URL("../../", import.meta.url)),
    server: { host: "127.0.0.1", port: 0 },
  });
  await server.listen();
  const address = server.httpServer!.address();
  assert.ok(address && typeof address !== "string");
  origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLG_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLG_CHROMIUM_EXECUTABLE }
      : {}),
  });
});

after(async () => {
  await browser?.close();
  await server?.close();
});

async function mockAPI(page: any) {
  await page.route("**/api/v1/**", async (route: any) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/health/ready") {
      return route.fulfill({ json: { status: "ready" } });
    }
    if (path === "/api/v1/auth/session") {
      return route.fulfill({
        json: {
          authenticated: true,
          user: { id: "family-1", email: "family@example.test", name: "Family" },
        },
      });
    }
    if (path === "/api/v1/profiles") return route.fulfill({ json: [profile] });
    if (path === '/api/v1/auth/login') return route.fulfill({ status: 204 });
    if (path === '/api/v1/auth/google/config') return route.fulfill({ json: { enabled: false } });
    if (path === '/api/v1/auth/registration') return route.fulfill({ json: { enabled: true } });
    if (path.startsWith('/api/v1/items/map/')) return route.fulfill({ json: await preparedMapFixture(new URL(route.request().url()), items) });
    if (path === "/api/v1/items") return route.fulfill({ json: items });
    if (path === "/api/v1/profiles/profile-1/progress") {
      return route.fulfill({ json: { done_item_ids: [], wip_item_ids: [] } });
    }
    if (path === "/api/v1/profiles/profile-1/town/name") {
      return route.fulfill({ json: { townName: "Explorer's town" } });
    }
    if (path.includes('/progress/')) return route.fulfill({ json: apiFixture(path, items) });
    if (path.startsWith('/api/v1/items/')) return route.fulfill({ json: apiFixture(path, items) });
    return route.fulfill({ json: [] });
  });
}

test("numbered clusters split from big to medium to small across successive taps", async () => {
  const context = await browser.newContext({
    viewport: { width: 834, height: 1194 },
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error: Error) => errors.push(error.message));
  await mockAPI(page);

  try {
    await page.goto(origin);
    await page.getByRole("button", { name: /Explorer 0 explored/ }).click();
    await page.getByRole("button", { name: /^Explore\b/ }).click();
    await page.waitForURL((url: URL) => url.pathname === "/map");
    await page.locator(".leaflet-container").waitFor();
    assert.equal(await page.getByRole("button", { name: /Kitchen/ }).count(), 0, "Exploring map should not expose the Kitchen button");

    const bigCluster = page.getByRole("button", {
      name: "Expand cluster with 75 items",
    });
    await bigCluster.waitFor();
    await bigCluster.tap();

    await page.waitForFunction(() => {
      const counts = [...document.querySelectorAll<HTMLElement>('[data-cluster] > span[aria-hidden=true]')].map(element => Number(element.textContent));
      return !document.querySelector('.explore-map-status') && counts.length > 1 && counts.reduce((n, count) => n + count, 0) === 75 && counts.every(count => count < 75);
    });
    const mediumCounts = await numberedClusterCounts(page);
    assert.ok(mediumCounts.length >= 2);
    assert.equal(mediumCounts.reduce((total, count) => total + count, 0), 75);
    assert.ok(mediumCounts.every((count) => count < 75));

    const largestMediumCount = mediumCounts[0];
    await page.getByRole("button", {
      name: `Expand cluster with ${largestMediumCount} items`,
    }).first().tap();
    await page.waitForFunction(
      (previousLargest: number) => {
        const counts = [...document.querySelectorAll<HTMLElement>('[data-cluster] > span[aria-hidden=true]')].map(element => Number(element.textContent));
        return !document.querySelector('.explore-map-status') && counts.length > 0 && counts.reduce((n, count) => n + count, 0) === 75 && counts.every(count => count < previousLargest);
      },
      largestMediumCount,
    );

    const smallCounts = await numberedClusterCounts(page);
    assert.ok(smallCounts.length > mediumCounts.length);
    assert.equal(smallCounts.reduce((total, count) => total + count, 0), 75);
    assert.ok(Math.max(...smallCounts) < largestMediumCount);
    assert.deepEqual(errors, []);

    const profileButton = page.getByRole("button", { name: /Explorer/ }).last();
    await profileButton.click();
    await page.waitForURL((url: URL) => url.pathname === "/playground");
    await page.getByRole("heading", { name: "What do you feel like doing?", exact: true }).waitFor();
    await page.getByRole("heading", { name: "Hi, Explorer!", exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: /Kitchen/ }).count(), 1, "Kitchen remains available from the Playground");
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
});

for (const path of ['/map', `/items/${items[0]!.id}`]) test(`fresh child selection preserves the deep link ${path}`, async () => {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  const errors: string[] = [], catalogRequests: string[] = [];
  page.on('pageerror', (error: Error) => errors.push(error.message));
  page.on('console', (message: any) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', (request: any) => { if (new URL(request.url()).pathname === '/api/v1/items') catalogRequests.push(request.url()); });
  await mockAPI(page);
  try {
    await page.goto(origin + path);
    await page.getByRole('button', { name: /Explorer 0 explored/ }).waitFor();
    assert.deepEqual(catalogRequests, [], 'profile selection does not prefetch the unused full map catalog');
    await page.getByRole('button', { name: /Explorer 0 explored/ }).click();
    await page.locator(path === '/map' ? '.leaflet-container' : '.item-detail-titlebar').waitFor();
    assert.equal(new URL(page.url()).pathname, path);
    if (path === '/map') assert.deepEqual(catalogRequests, [], 'the prepared map uses bounded views instead of the catalog list');
    await page.evaluate(async () => {
      const modulePath = '/src/stores/familyStore.ts';
      const { useFamilyStore } = await import(modulePath);
      useFamilyStore.getState().clearSession();
    });
    await page.getByRole('heading', { name: 'Welcome back, explorer!', exact: true }).waitFor();
    await page.getByLabel('Email', { exact: true }).fill('family@example.test');
    await page.getByLabel('Password', { exact: true }).fill('fixture-only-password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByRole('button', { name: /Explorer 0 explored/ }).waitFor();
    assert.equal(await page.evaluate(async () => { const modulePath = '/src/stores/profileStore.ts'; return (await import(modulePath)).useProfileStore.getState().activeProfileId; }), null, 'same-family relogin must choose a child again');
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('creating a child from a cold map link survives a stale cached list and delayed reconciliation', async () => {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  const errors: string[] = []; page.on('pageerror', (error: Error) => errors.push(error.message));
  page.on('console', (message: any) => { if (message.type() === 'error') errors.push(message.text()); });
  await mockAPI(page);
  let created = false, release!: () => void;
  const delayed = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/v1/profiles', async (route: any) => {
    if (route.request().method() === 'POST') { created = true; return route.fulfill({ status: 201, json: profile }); }
    if (created) await delayed;
    return route.fulfill({ json: created ? [profile] : [] });
  });
  try {
    await page.goto(origin + '/map');
    await page.getByRole('button', { name: /New Explorer/ }).click();
    await page.getByLabel('Name', { exact: true }).fill('Explorer');
    await page.getByRole('button', { name: "Let's Go!", exact: true }).click();
    await page.locator('.leaflet-container').waitFor();
    assert.equal(new URL(page.url()).pathname, '/map');
    assert.equal(await page.evaluate(async () => { const modulePath = '/src/stores/profileStore.ts'; return (await import(modulePath)).useProfileStore.getState().activeProfileId; }), profile.id);
    release();
    await page.getByRole('button', { name: 'Expand cluster with 75 items', exact: true }).waitFor();
    assert.deepEqual(errors, []);
  } finally { release(); await page.close(); }
});
