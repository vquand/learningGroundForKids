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
before(async () => {
  server = await createServer({ configFile: false, plugins: [react()],
    root: fileURLToPath(new URL("../../", import.meta.url)), server: { host: "127.0.0.1", port: 0 } });
  await server.listen();
  const address = server.httpServer!.address();
  assert.ok(address && typeof address !== "string");
  origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true,
    ...(process.env.PLG_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLG_CHROMIUM_EXECUTABLE } : {}) });
});
after(async () => { await browser?.close(); await server?.close(); });

async function assertFits(page: any) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "no horizontal overflow");
  const panel = await page.locator(".burger-controls").boundingBox();
  const preview = await page.locator(".burger-preview").boundingBox();
  const next = await page.locator(".burger-next").boundingBox();
  const viewport = page.viewportSize();
  assert.ok(panel && preview && next);
  const tabletPortrait = viewport.width >= 700 && viewport.height >= 850 && viewport.height > viewport.width;
  const fittedLayout = tabletPortrait || (viewport.width >= 900 && viewport.width > viewport.height);
  if (fittedLayout) {
    assert.ok(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight), "no vertical scrolling");
    assert.ok(panel.y + panel.height <= viewport.height + 1, `controls fit without vertical scrolling: ${JSON.stringify({panel,viewport,heading:await page.locator('#burger-step-title').textContent()})}`);
    assert.ok(next.y + next.height <= viewport.height, "Next stays in view");
    const scene = await page.locator(".burger-raster-scene").boundingBox();
    assert.ok(scene);
    assert.ok(Math.abs(scene.width / scene.height - 620 / 450) < .01, "scene preserves artwork proportions");
    assert.ok(scene.x >= preview.x && scene.y >= preview.y && scene.x + scene.width <= preview.x + preview.width && scene.y + scene.height <= preview.y + preview.height, "entire scene stays within the preview");
    for (const button of await page.locator(".burger-page button").all()) {
      const box = await button.boundingBox();
      assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1, "every game control stays in the viewport");
    }
  }
  if (tabletPortrait) {
    assert.ok(preview.y + preview.height <= panel.y, "animation sits above the controls");
    assert.ok(Math.abs(panel.y - viewport.height / 2) <= 20, "controls begin near the screen midpoint");
  } else if (fittedLayout) {
    assert.ok(preview.x + preview.width <= panel.x, "scene and controls sit side by side");
    assert.ok(Math.abs(preview.width / panel.width - 1.5) < .01, "animation and controls use a 60/40 split");
  }
  assert.ok(next.height >= 48);
  for (const button of await page.locator(".burger-choice").all()) {
    const box = await button.boundingBox();
    assert.ok(box && box.width >= 48 && box.height >= 48);
  }
}

for (const [width, height, topping, reduced] of [
  [1366, 768, "Tomato", false], [1024, 768, "Pickles", false],
  [1080, 810, "Tomato", false], [1180, 820, "Pickles", false],
  [1080, 650, "Tomato", true], [1180, 650, "Lettuce", false],
  [1024, 600, "Tomato", false], [375, 812, "Lettuce", true],
  [768, 1024, "Tomato", false], [820, 1180, "Pickles", false],
  [1024, 1366, "Lettuce", false], [768, 900, "Tomato", true],
] as const) {
  test(`burger completes at ${width}×${height} with ${topping}${reduced ? " and reduced motion" : ""}`, async () => {
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: true,
      deviceScaleFactor: 2, reducedMotion: reduced ? "reduce" : "no-preference" });
    const errors: string[] = [];
    page.on("pageerror", (error: Error) => errors.push(error.message));
    page.on("response", (response: any) => {
      if (response.url().includes("/minigames/cooking/burger/") && !response.ok()) errors.push(`Asset failed: ${response.url()}`);
    });
    async function tap(name: string) { await page.getByRole("button", { name, exact: true }).tap(); }
    async function next() { await assertFits(page); await tap("Next →"); }
    try {
      await page.goto(`${origin}/uat/cooking`);
      await page.getByRole("button", { name: "Cook Cozy cheeseburger" }).tap();
      await page.getByRole("heading", { name: "What shape shall we bake?" }).waitFor();
      assert.equal(await page.locator(".burger-preview svg").count(), 0, "game artwork uses raster sprites");
      assert.equal(await page.locator(".burger-next").isDisabled(), true);
      for (const shape of ["Round", "Heart", "Flower", "Star", "Soft square"]) {
        await tap(shape);
        assert.equal(await page.getByRole("button", { name: shape, exact: true }).getAttribute("aria-pressed"), "true");
      }
      const [chosenShape, shapeName] = width === 1080 ? ["Heart", "heart"]
        : width === 1024 ? ["Round", "round"]
        : width === 1180 && height === 820 ? ["Star", "star"]
        : width === 1180 ? ["Flower", "flower"] : ["Soft square", "square"];
      await tap(chosenShape);
      if (reduced) assert.equal(await page.locator(".burger-shape-animation").evaluate((el: Element) => getComputedStyle(el).animationName), "none");
      await page.screenshot({ path: `/tmp/plg-burger-shape-${width}-${height}.png` });
      await next();
      await tap("Too toasty");
      assert.equal(await page.locator(".burger-next").isDisabled(), true);
      await tap("Golden");
      await page.screenshot({ path: `/tmp/plg-burger-toast-${width}-${height}.png`, animations: "disabled" });
      const toastingBun = await page.locator(`.burger-scene-art [data-burger-sprite="bun-${shapeName}"]`).boundingBox();
      const toaster = await page.locator('[data-burger-sprite="toaster"]').first().boundingBox();
      assert.ok(toastingBun && toaster);
      const frontLip = toaster.y + toaster.height * .15;
      assert.ok(toastingBun.y < frontLip && toastingBun.y + toastingBun.height > frontLip, "bun straddles the toaster's front lip");
      await next();
      await tap("High heat");
      assert.equal(await page.getByRole("button", { name: "Flip the patty" }).isDisabled(), true);
      await tap("Medium heat");
      await tap("Flip the patty");
      await next();
      await tap("Add & melt cheese");
      await page.screenshot({ path: `/tmp/plg-burger-pan-${width}-${height}.png`, animations: "disabled" });
      await next();
      await tap("Ketchup"); await tap("Mayo"); await tap("Burger sauce");
      await next();
      for (const choice of ["Tomato", "Pickles", "Lettuce", topping]) {
        await tap(choice);
        assert.equal(await page.locator("[data-burger-topping]").count(), 1);
        assert.equal(await page.locator("[data-burger-topping]").getAttribute("data-burger-topping"), choice.toLowerCase());
      }
      await page.screenshot({ path: `/tmp/plg-burger-topping-${width}-${height}.png` });
      await next();
      let thickness: number | undefined;
      if (topping === "Tomato") {
        const question = await page.locator(".burger-math").innerText();
        thickness = Number(question.match(/(\d) cm thick/)?.[1]);
        assert.ok(thickness >= 3 && thickness <= 6);
        const wrong = page.getByRole("button", { name: /^\d slices$/ }).filter({ hasText: `${thickness + 1} slices` });
        await wrong.tap();
        assert.equal(await page.locator(".burger-next").isDisabled(), true);
        await tap(`${thickness} slices`);
        assert.equal(await page.locator("[data-tomato-slice]").count(), thickness);
        await next();
      } else {
        assert.equal(await page.locator(".burger-math").count(), 0);
      }
      await tap("Flower");
      await assertFits(page);
      await tap("Serve my burger ✦");
      await page.getByRole("heading", { name: "Made by you. Loved by Chef Capy!" }).waitFor();
      await assertFits(page);
      const topBun = await page.locator(".burger-top-bun .burger-sprite").boundingBox();
      const filling = await page.locator("[data-burger-topping] .burger-sprite").boundingBox();
      const lowerBun = await page.locator('[data-burger-sprite="bottom-bun"]').boundingBox();
      const patty = await page.locator('[data-burger-sprite="patty"]').boundingBox();
      assert.ok(topBun && filling && lowerBun && patty);
      assert.ok(topBun.y + topBun.height > filling.y + filling.height / 2, "top bun rests into the filling");
      assert.ok(topBun.y + topBun.height < filling.y + filling.height, "filling remains visible below the top bun");
      assert.ok(lowerBun.y < patty.y + patty.height && lowerBun.y + lowerBun.height > patty.y + patty.height, "lower bun touches the patty and remains visible");
      assert.match(await page.locator(".burger-scene-art").getAttribute("aria-label"), new RegExp(`Finished ${shapeName} cheeseburger.*burger-sauce`));
      assert.equal(await page.locator(".burger-flower-burst").count(), 1);
      const rasterImages = await page.locator(".burger-sprite").evaluateAll(async (elements: Element[]) => {
        const urls = [...new Set(elements.map((el) => getComputedStyle(el).backgroundImage.slice(5, -2)))];
        return Promise.all(urls.map((url) => new Promise<boolean>((resolve) => {
          const image = new Image(); image.onload = () => resolve(image.naturalWidth > 0); image.onerror = () => resolve(false); image.src = url;
        })));
      });
      assert.ok(rasterImages.every(Boolean), "all PNG sheets decode correctly");
      await page.screenshot({ path: `/tmp/plg-burger-serve-${width}-${height}.png`, animations: "disabled" });
      await tap("Make another burger ↻");
      assert.equal(await page.locator(".burger-next").isDisabled(), true);
      assert.equal(await page.locator(".burger-choice[aria-pressed=true]").count(), 0);
      if (thickness !== undefined) {
        await tap("Round"); await next(); await tap("Golden"); await next();
        await tap("Medium heat"); await tap("Flip the patty"); await next();
        await tap("Add & melt cheese"); await next(); await tap("Mayo"); await next();
        await tap("Tomato"); await next();
        assert.notEqual(Number((await page.locator(".burger-math").innerText()).match(/(\d) cm thick/)?.[1]), thickness);
      }
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  });
}

test("step transitions move keyboard focus to the new heading", async () => {
  const page = await browser.newPage({ viewport: { width: 1080, height: 810 } });
  try {
    await page.goto(`${origin}/uat/cooking/hamburger`);
    await page.getByRole("heading", { name: "What shape shall we bake?" }).waitFor();
    await page.keyboard.press("Tab");
    assert.equal(await page.getByRole("button", { name: "Round", exact: true }).evaluate((el: Element) => el === document.activeElement), true);
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Next →", exact: true }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("heading", { name: "Toast those little buns" }).waitFor();
    assert.equal(await page.locator("#burger-step-title").evaluate((el: Element) => el === document.activeElement), true);
  } finally { await page.close(); }
});

test("only food jiggles on canvas taps, without changing choices", async () => {
  const page = await browser.newPage({ viewport: { width: 1080, height: 810 }, hasTouch: true });
  try {
    await page.goto(`${origin}/uat/cooking/hamburger`);
    const dough = page.getByRole("button", { name: "Jiggle dough round", exact: true });
    await dough.waitFor();
    assert.equal(await page.locator(".burger-scene-art button").count(), 1);
    for (const name of ["board", "rolling-pin"]) {
      const tool = page.locator(`[data-burger-sprite="${name}"]`);
      assert.equal(await tool.evaluate((el: Element) => el.closest("button")), null);
      const box = await tool.boundingBox();
      assert.ok(box);
      await page.touchscreen.tap(box.x + box.width * .85, box.y + box.height * .8);
      assert.equal(await dough.evaluate((el: Element) => el.getAnimations().length), 0);
    }
    await dough.tap();
    assert.equal(await dough.evaluate((el: Element) => el.getAnimations().length), 1);
    await dough.tap({ force: true });
    assert.equal(await dough.evaluate((el: Element) => el.getAnimations().length), 1);
    assert.equal(await page.locator(".burger-next").isDisabled(), true);
    assert.equal(await page.locator(".burger-choice[aria-pressed=true]").count(), 0);
    await dough.focus(); await page.keyboard.press("Space");
    assert.equal(await dough.evaluate((el: Element) => el.getAnimations().length), 1);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await dough.evaluate((el: Element) => el.getAnimations().forEach((animation) => animation.finish()));
    await dough.tap();
    assert.equal(await dough.evaluate((el: Element) => el.getAnimations().length), 0);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.getByRole("button", { name: "Heart", exact: true }).tap();
    await page.getByRole("button", { name: "Next →", exact: true }).tap();
    await page.getByRole("button", { name: "Golden", exact: true }).tap();
    await page.screenshot({ path: "/tmp/plg-burger-food-only-toast.png", animations: "disabled" });
    const bun = page.getByRole("button", { name: "Jiggle bun heart", exact: true });
    assert.equal(await page.locator(".burger-scene-art button").count(), 1);
    const toaster = page.locator('[data-burger-sprite="toaster"]').first();
    const toasterBox = await toaster.boundingBox();
    const bunBox = await bun.boundingBox();
    assert.ok(toasterBox && bunBox);
    // This part of the toaster covers the bun's hidden lower half.
    await page.touchscreen.tap(bunBox.x + bunBox.width / 2, bunBox.y + bunBox.height * .9);
    assert.equal(await bun.evaluate((el: Element) => el.getAnimations().length), 0);
    await bun.tap({ position: { x: bunBox.width / 2, y: bunBox.height * .25 } });
    assert.equal(await bun.evaluate((el: Element) => el.getAnimations().length), 1);
    assert.equal(await toaster.evaluate((el: Element) => el.closest(".burger-scene-item")!.getAnimations().length), 0);
    assert.equal(await page.getByRole("button", { name: "Golden", exact: true }).getAttribute("aria-pressed"), "true");
  } finally { await page.close(); }
});
