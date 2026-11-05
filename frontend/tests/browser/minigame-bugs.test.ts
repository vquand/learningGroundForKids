import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
const { chromium } = createRequire(import.meta.url)(process.env.PLG_PLAYWRIGHT_MODULE || "playwright");
let browser: any;
let server: Awaited<ReturnType<typeof createServer>>;
let origin: string;
const browserErrors: string[] = [];
before(async () => {
  server = await createServer({ configFile: false, plugins: [react()], root: fileURLToPath(new URL("../../", import.meta.url)), server: { host: "127.0.0.1", port: 0 } });
  await server.listen();
  const address = server.httpServer!.address();
  assert.ok(address && typeof address !== "string");
  origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true, ...(process.env.PLG_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLG_CHROMIUM_EXECUTABLE } : {}) });
});
after(async () => { await browser?.close(); await server?.close(); assert.deepEqual(browserErrors, []); });
async function open(scene: string, width = 1280) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  page.on("response", (response: any) => { if (response.url().includes("/minigames/cooking/grill/") && response.status() >= 400) browserErrors.push(`Asset HTTP ${response.status()}: ${response.url()}`); });
  page.on("pageerror", (error: Error) => browserErrors.push(error.message));
  await page.addInitScript(() => {
    (window as any).__grillAudioNotes = 0;
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function(when?: number) {
      (window as any).__grillAudioNotes++;
      start.call(this, when);
    };
  });
  await page.goto(`${origin}/tests/browser/minigame-bugs-harness.html?scene=${scene}`);
  return page;
}
for (const width of [1280, 375]) {
  test(`steak accepts herbs on occupied steak cells at ${width}px`, async () => {
    const page = await open("steak", width);
    try {
      await page.getByRole("gridcell", { name: "Place at row 3, column 3", exact: true }).click();
      await page.getByRole("gridcell", { name: "Place at row 4, column 3", exact: true }).click();
      await page.getByRole("button", { name: "Melt butter", exact: true }).click();
      await page.getByRole("gridcell", { name: "Place at row 3, column 3", exact: true }).click();
      await page.getByRole("button", { name: "Start searing", exact: true }).click();
      await page.getByRole("gridcell", { name: "Place at row 3, column 3", exact: true }).click({ timeout: 2000 });
      await page.getByRole("button", { name: "Drag to reposition or click to remove Herbs", exact: true }).click();
      await page.getByRole("button", { name: "Herbs, 2 by 1 squares", exact: true }).dragTo(
        page.getByRole("gridcell", { name: "Place at row 3, column 3", exact: true }),
      );
      await page.getByRole("button", { name: "Baste the steak", exact: true }).click();
      await page.getByRole("heading", { name: "Choose the heat" }).waitFor();
      await page.screenshot({ path: `/tmp/plg-herbs-${width}.png` });
    } finally { await page.close(); }
  });
}
for (const viewport of [{ width: 1366, height: 768 }, { width: 1280, height: 600 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 1180, height: 820 }]) {
  test(`grill and controls fit without scrolling at ${viewport.width}×${viewport.height}`, async () => {
    const page = await open("grilled-steak", viewport.width);
    await page.setViewportSize(viewport);
    async function fits() {
      assert.equal(await page.locator(".app-shell").evaluate((element: HTMLElement) => element.scrollHeight <= element.clientHeight + 1), true, "no vertical scrolling");
      for (const selector of [".cooking-grill-visual", ".cooking-action-prompt", ".cooking-heat__choices", ".cooking-grill-rotation-wheel", ".cooking-seasoning-options"]) {
        const element = page.locator(selector);
        if (!await element.count()) continue;
        const bounds = await element.boundingBox(); assert.ok(bounds);
        assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width + 1 && bounds.y + bounds.height <= viewport.height, `${selector} fits`);
      }
    }
    try {
      await fits();
      await page.getByRole("button", { name: "Medium heat", exact: true }).click();
      await page.screenshot({ path: `/tmp/plg-grill-fit-${viewport.width}-${viewport.height}.png` });
      await page.getByRole("button", { name: "Heat OK", exact: true }).click();
      await fits();
      await page.getByRole("button", { name: "Turn handle with drag or arrow keys" }).focus();
      for (let i = 0; i < 14 * 8; i++) await page.keyboard.press("ArrowRight");
      await page.getByRole("button", { name: "Done grilling", exact: true }).click();
      await fits();
      await page.getByRole("button", { name: "Butter" }).click();
      await page.getByRole("button", { name: "Done seasoning", exact: true }).click();
      await fits();
      await page.getByRole("button", { name: "Serve pork", exact: true }).click();
      await page.getByRole("heading", { name: "Golden from every side!" }).waitFor();
      await fits();
    } finally { await page.close(); }
  });
}

test("heat previews different flames and waits for Next", async () => {
  const page = await open("grilled-steak");
  try {
    const next = page.getByRole("button", { name: "Heat OK", exact: true });
    assert.equal(await next.isEnabled(), false);
    const prompt = page.getByRole("region", { name: "Cooking action prompt" });
    const promptBounds = await prompt.boundingBox(); assert.ok(promptBounds && promptBounds.y >= 0 && promptBounds.y + promptBounds.height <= 900);
    const sizes: number[] = [];
    for (const level of ["low", "medium", "high", "extreme"]) {
      await page.getByRole("button", { name: `${level[0].toUpperCase()}${level.slice(1)} heat`, exact: true }).click();
      const flame = page.getByRole("img", { name: `${level} flame under the pig`, exact: true });
      const bounds = await flame.boundingBox(); assert.ok(bounds); sizes.push(bounds.height);
      const arena = await page.locator(".cooking-grill-visual").boundingBox(); assert.ok(arena);
      assert.ok(bounds.y + bounds.height < arena.y + arena.height * .7, "fire stays in pit behind front stones");
      assert.equal(await page.locator(".cooking-grill-rotation-wheel").count(), 0);
      assert.equal(await next.isEnabled(), level === "medium");
    }
    assert.ok(sizes.every((size, index) => index === 0 || size > sizes[index - 1]));
    await page.getByRole("button", { name: "Medium heat", exact: true }).click();
    await page.screenshot({ path: "/tmp/plg-grill-heat.png", fullPage: true });
    await next.click();
    await page.locator(".cooking-grill-rotation-wheel").waitFor();
    assert.equal(await page.getByRole("img", { name: "medium flame under the pig" }).count(), 1);
  } finally { await page.close(); }
});

test("grill flames stretch with the responsive pit instead of using SVG meet letterboxing", async () => {
  const page = await open("grilled-steak", 1366);
  try {
    await page.setViewportSize({ width: 1366, height: 768 });
    const paintedBases: number[] = [], paintedTops: number[][] = [];
    for (const level of ["low", "medium", "high", "extreme"]) {
      await page.getByRole("button", { name: `${level[0].toUpperCase()}${level.slice(1)} heat`, exact: true }).click();
      const flame = page.locator(".cooking-grill-fire svg").first();
      paintedBases.push(await flame.locator("path").first().evaluate((path: SVGPathElement) => path.getBoundingClientRect().bottom));
      paintedTops.push(await flamesRectTops(page));
    }
    const flames = page.locator(".cooking-grill-fire svg");
    assert.equal(await flames.count(), 3);
    assert.deepEqual(await flames.evaluateAll((elements: SVGSVGElement[]) => elements.map((element: SVGSVGElement) => element.getAttribute("preserveAspectRatio"))), ["none", "none", "none"]);
    const pit = await page.locator(".cooking-grill-visual").boundingBox();
    const fire = await page.locator(".cooking-grill-fire").boundingBox();
    assert.ok(pit && fire);
    assert.ok(paintedBases.every((bottom) => Math.abs(bottom - paintedBases[0]!) <= 1), "all heat levels share one painted flame baseline");
    assert.ok(paintedTops.slice(1).every((tops, index) => tops.every((top, flameIndex) => top < paintedTops[index]![flameIndex]!), "higher heat grows upward for every flame"));
    assert.ok(Math.abs(paintedBases[0]! - (pit.y + pit.height * .65)) <= 2, "fire remains anchored to the coals inside the pit");
    for (const viewport of [{ width: 1024, height: 768 }, { width: 1180, height: 820 }]) {
      await page.setViewportSize(viewport);
      const resizedPit = await page.locator(".cooking-grill-visual").boundingBox();
      const resizedBase = await page.locator(".cooking-grill-fire svg").first().locator("path").first().evaluate((path: SVGPathElement) => path.getBoundingClientRect().bottom);
      assert.ok(resizedPit);
      assert.ok(Math.abs(resizedBase - (resizedPit.y + resizedPit.height * .65)) <= 2, `${viewport.width}×${viewport.height} fire remains bottom anchored`);
    }
  } finally { await page.close(); }
});

async function flamesRectTops(page: any): Promise<number[]> {
  return page.locator(".cooking-grill-fire svg path").evaluateAll((paths: SVGPathElement[]) => paths.map((path) => path.getBoundingClientRect().top));
}

test("six drawn pig views cycle without flipping a single image", async () => {
  const page = await open("grilled-steak");
  try {
    await page.getByRole("button", { name: "Medium heat", exact: true }).click();
    await page.getByRole("button", { name: "Heat OK", exact: true }).click();
    await page.waitForLoadState("networkidle");
    const handle = page.getByRole("button", { name: "Turn handle with drag or arrow keys" });
    await handle.focus();
    const seen = new Set<string>();
    for (let i = 0; i < 8; i++) {
      const pig = page.getByRole("img", { name: "Uncooked pig", exact: true });
      const frame = await pig.getAttribute("data-frame"); assert.ok(frame); seen.add(frame);
      assert.equal(await pig.evaluate((element: Element) => element.tagName.toLowerCase()), "svg");
      assert.equal(await pig.evaluate((element: HTMLElement) => element.style.transform), "translate(-50%, -50%)");
      await pig.screenshot({ path: `/tmp/plg-grill-frame-${frame}.png` });
      await page.keyboard.press("ArrowRight");
    }
    assert.equal(seen.size, 6);
    assert.equal(await page.getByRole("img", { name: "Uncooked pig", exact: true }).getAttribute("data-frame"), "0");
  } finally { await page.close(); }
});

test("counted pointer turns stop on release and serve after choosing a glaze", async () => {
  const page = await open("grilled-steak");
  try {
    await page.getByRole("button", { name: "Medium heat", exact: true }).click();
    await page.getByRole("button", { name: "Heat OK", exact: true }).click();
    await page.locator(".cooking-grill-rotation-wheel").scrollIntoViewIfNeeded();
    const wheel = await page.locator(".cooking-grill-rotation-wheel").boundingBox();
    assert.ok(wheel);
    const cx = wheel.x + wheel.width / 2, cy = wheel.y + wheel.height / 2, radius = wheel.width * .36;
    await page.mouse.move(cx + radius, cy); await page.mouse.down();
    for (let i = 1; i <= 14 * 32; i++) {
      const angle = i * Math.PI * 2 / 32;
      await page.mouse.move(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    }
    await page.mouse.up();
    const roast = page.getByRole("img", { name: "Golden roasted pig", exact: true });
    await roast.waitFor();
    const stopped = await roast.getAttribute("data-frame");
    await page.waitForTimeout(400);
    assert.equal(await roast.getAttribute("data-frame"), stopped);
    assert.equal(await page.getByRole("progressbar", { name: "Grilling rounds" }).count(), 0);
    assert.equal(await page.getByText(/rounds ·|Golden at|Stop by round/).count(), 0);
    await page.getByRole("button", { name: "Done grilling", exact: true }).click();
    await page.getByRole("button", { name: "Honey" }).click();
    await page.getByRole("button", { name: "Done seasoning", exact: true }).click();
    await page.getByRole("button", { name: "Serve pork" }).click();
    await page.locator(".cooking-grill-visual__food--serving").waitFor();
    await page.screenshot({ path: "/tmp/plg-grill-serving.png", fullPage: true });
    await page.getByRole("heading", { name: "Golden from every side!" }).waitFor();
    await page.waitForFunction(() => Array.from(document.querySelectorAll<HTMLImageElement>(".cooking-served-roast img")).every((img) => img.complete && img.naturalWidth > 0));
    await page.screenshot({ path: "/tmp/plg-grill-finished.png", fullPage: true });
    assert.equal(await page.evaluate(() => (window as any).__grillAudioNotes), 6, "success plays its melody");
  } finally { await page.close(); }
});

test("keyboard turning burns at the limit and restart resets the roast", async () => {
  const page = await open("grilled-steak", 375);
  try {
    await page.getByRole("button", { name: "Medium heat", exact: true }).click();
    await page.getByRole("button", { name: "Heat OK", exact: true }).click();
    const handle = page.getByRole("button", { name: "Turn handle with drag or arrow keys" });
    await handle.focus();
    for (let i = 0; i < 25 * 8; i++) await page.keyboard.press("ArrowRight");
    await page.getByRole("alert").filter({ hasText: "Ohhh! A little too crispy." }).waitFor();
    assert.equal(await page.locator(".cooking-grill-rotation-wheel").count(), 0);
    await page.waitForFunction(() => { const img = document.querySelector<HTMLImageElement>(".cooking-grill-visual__food--burnt"); return img?.complete && img.naturalWidth > 0; });
    assert.equal(await page.evaluate(() => (window as any).__grillAudioNotes), 2, "failure plays the ohhh sound");
    await page.screenshot({ path: "/tmp/plg-grill-burnt-mobile.png", fullPage: true });
    await page.getByRole("button", { name: "Replay", exact: true }).click();
    await page.getByAltText("Uncooked pig").waitFor();
    await page.getByRole("button", { name: "Medium heat", exact: true }).click();
    await page.getByRole("button", { name: "Heat OK", exact: true }).click();
    assert.equal(await page.getByRole("button", { name: "Done grilling", exact: true }).isEnabled(), false);
  } finally { await page.close(); }
});

for (const width of [1280, 375]) {
  test(`finished tall lemonade fills from the base and keeps mint at the rim at ${width}px`, async () => {
    const page = await open("drink", width);
    try {
      await page.getByRole("button", { name: "Tall aqua glass", exact: true }).click();
      for (const name of ["Lemon", "Ice", "Water", "Sugar", "Mint leaf"]) {
        await page.getByRole("button", { name: new RegExp(`^${name}:`) }).click();
      }
      await page.getByRole("heading", { name: "Your Lemonade is ready!" }).waitFor();
      const cup = await page.locator(".food-drink-cup").boundingBox();
      const glass = await page.locator(".food-drink-cup__glass").boundingBox();
      const fill = await page.locator(".food-drink-cup__fill").boundingBox();
      const garnish = await page.locator(".food-drink-cup__garnish").boundingBox();
      assert.ok(cup && glass && fill && garnish);
      assert.ok(Math.abs(glass.height - cup.height) < 1, "glass artwork fits the fill coordinate container");
      assert.ok(fill.height > cup.height * 0.55, "a full tall glass covers its bowl");
      assert.ok(fill.y + fill.height > cup.y + cup.height * 0.78, "liquid rests at the base");
      assert.ok(garnish.y < cup.y + cup.height * 0.25, "mint stays near the rim");
      assert.equal(await page.locator(".food-drink-cup__garnish").evaluate((el: Element) => getComputedStyle(el).position), "absolute");
      await page.screenshot({ path: `/tmp/plg-tall-lemonade-${width}.png` });
    } finally { await page.close(); }
  });

}

test("all drinks keep their garnish near each cup rim", async () => {
  const page = await open("cups");
  try {
    assert.equal(await page.locator(".food-drink-cup").count(), 15);
    for (const cup of await page.locator(".food-drink-cup").all()) {
      const bounds = await cup.boundingBox();
      const garnish = await cup.locator(".food-drink-cup__garnish").boundingBox();
      assert.ok(bounds && garnish);
      assert.ok(garnish.y < bounds.y + bounds.height * 0.25, "garnish sits at the rim");
      assert.ok(garnish.x + garnish.width <= bounds.x + bounds.width, "garnish stays over the cup");
    }
    await page.screenshot({ path: "/tmp/plg-all-cups.png", fullPage: true });
  } finally { await page.close(); }
});
