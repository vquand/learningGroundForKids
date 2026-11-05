import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

const { chromium } = createRequire(import.meta.url)("playwright");

type MapHarnessWindow = Window & {
  testMap: {
    counts: { setIcon: number; setLatLng: number };
    navigation: string[];
    resetCounters: () => void;
  };
};

let browser: any;
let server: Awaited<ReturnType<typeof createServer>>;
let origin = "";
const mapViewports = [
  { width: 1366, height: 768 },
  { width: 1024, height: 768 },
  { width: 1180, height: 820 },
];

before(async () => {
  await mkdir("/tmp/plg-map-performance", { recursive: true });
  server = await createServer({
    configFile: false,
    cacheDir: "/tmp/plg-map-performance/vite-cache",
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
    ...(process.env.PLG_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLG_CHROMIUM_EXECUTABLE } : {}),
  });
});

after(async () => {
  await browser?.close();
  await server?.close();
});

async function openMap(viewport = mapViewports[0]!) {
  const context = await browser.newContext({ viewport, hasTouch: true });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error: Error) => errors.push(error.message));
  await page.goto(`${origin}/tests/browser/map-performance-harness.html`);
  await page.locator('[data-item-id="isolated-item"]').waitFor();
  return { context, page, errors };
}

for (const viewport of mapViewports) test(`opening and closing an isolated mouse preview leaves existing markers untouched at ${viewport.width}x${viewport.height}`, async () => {
  const { context, page, errors } = await openMap(viewport);
  try {
    const markerImage = page.locator('.leaflet-marker-pane img[src="/map/animal-paw.svg"]').first();
    await markerImage.waitFor();
    const markerImageMetrics = await markerImage.evaluate((image: HTMLImageElement) => ({
      complete: image.complete,
      naturalWidth: image.naturalWidth,
      width: image.getBoundingClientRect().width,
      height: image.getBoundingClientRect().height,
    }));
    assert.equal(markerImageMetrics.complete, true, "animal marker image should finish loading");
    assert.ok(markerImageMetrics.naturalWidth > 0, "animal marker image should have intrinsic pixels");
    assert.equal(markerImageMetrics.width, 32, "animal marker image should render at 32px wide");
    assert.equal(markerImageMetrics.height, 32, "animal marker image should render at 32px high");

    await page.evaluate(() => (window as unknown as MapHarnessWindow).testMap.resetCounters());
    await page.locator('[data-item-id="isolated-item"]').dispatchEvent("click");
    await page.getByText("Isolated polar fox", { exact: true }).waitFor();
    const popupImage = page.locator('.leaflet-popup-content img[src="/map/animal-paw.svg"]');
    await popupImage.waitFor();
    const popupImageMetrics = await popupImage.evaluate((image: HTMLImageElement) => ({
      complete: image.complete,
      naturalWidth: image.naturalWidth,
      width: image.getBoundingClientRect().width,
      height: image.getBoundingClientRect().height,
    }));
    assert.equal(popupImageMetrics.complete, true, "animal popup image should finish loading");
    assert.ok(popupImageMetrics.naturalWidth > 0, "animal popup image should have intrinsic pixels");
    assert.equal(popupImageMetrics.width, 32, "animal popup image should render at 32px wide");
    assert.equal(popupImageMetrics.height, 32, "animal popup image should render at 32px high");
    await page.locator(".leaflet-popup-close-button").click();
    await page.waitForTimeout(50);
    const counters = await page.evaluate(() => ({ ...(window as unknown as MapHarnessWindow).testMap.counts }));
    assert.equal(counters.setIcon, 0, `preview changed ${counters.setIcon} marker icons`);
    assert.equal(counters.setLatLng, 0, `preview repositioned ${counters.setLatLng} markers`);
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
});

test("progress state updates the isolated marker and filters change the item set", async () => {
  const { context, page, errors } = await openMap();
  try {
    const initialCount = Number(await page.getByTestId("filtered-count").textContent());
    await page.getByTestId("mark-isolated-done").click();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-item-id="isolated-item"]')!).borderTopColor === "rgb(34, 197, 94)");
    await page.getByTestId("mark-isolated-wip").click();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-item-id="isolated-item"]')!).borderTopColor === "rgb(245, 158, 11)");

    await page.getByTestId("filter-food").click();
    const foodCount = Number(await page.getByTestId("filtered-count").textContent());
    assert.ok(foodCount > 0 && foodCount < initialCount, `food filter count ${foodCount} should reduce ${initialCount}`);
    await page.getByTestId("clear-filters").click();
    await page.getByTestId("filter-ancient").click();
    const ancientCount = Number(await page.getByTestId("filtered-count").textContent());
    assert.ok(ancientCount > 0 && ancientCount < initialCount, `timeline count ${ancientCount} should reduce ${initialCount}`);
    assert.equal(await page.locator('[data-item-id="isolated-item"]').count(), 0, "modern isolated item should be hidden by 1500 filter");
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
});

test("touching the isolated marker invokes detail navigation and optimized earth has no turbulence filter", async () => {
  const { context, page, errors } = await openMap();
  try {
    await page.getByTestId("enable-detail-navigation").click();
    const isolated = page.locator('[data-item-id="isolated-item"]');
    await isolated.dispatchEvent("pointerdown", { bubbles: true, pointerType: "touch", isPrimary: true, clientX: 1, clientY: 1 });
    await isolated.dispatchEvent("pointerup", { bubbles: true, pointerType: "touch", isPrimary: true, clientX: 1, clientY: 1 });
    await page.waitForFunction(() => (window as unknown as MapHarnessWindow).testMap.navigation.includes("isolated-item"));
    const navigation = await page.evaluate(() => [...(window as unknown as MapHarnessWindow).testMap.navigation]);
    assert.deepEqual(navigation, ["isolated-item"]);
    assert.equal(await page.locator(".illustrated-earth feTurbulence").count(), 0);
    assert.equal(await page.locator(".illustrated-earth [filter]").count(), 0);
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
});
