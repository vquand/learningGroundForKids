import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

const { chromium } = createRequire(import.meta.url)(process.env.PLG_PLAYWRIGHT_MODULE || "playwright");
let browser: any;
let server: Awaited<ReturnType<typeof createServer>>;
let origin = "";

const initialProfile = {
  id: "profile-a", name: "Mun", emoji: "🌟", color: "#3B82F6", avatar_type: "default",
  avatar_url: "capybara-calm", avatar_frame: "space", total_done: 0, native_country_code: "VN", native_city: "Hanoi",
  public_id: "B3F98B7BB1",
};

before(async () => {
  server = await createServer({ configFile: false, plugins: [react()], root: fileURLToPath(new URL("../../", import.meta.url)), server: { host: "127.0.0.1", port: 0 } });
  await server.listen();
  const address = server.httpServer!.address();
  assert.ok(address && typeof address !== "string");
  origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true, ...(process.env.PLG_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLG_CHROMIUM_EXECUTABLE } : {}) });
});

after(async () => { await browser?.close(); await server?.close(); });

async function openHub(viewport: { width: number; height: number }, overrides: Partial<typeof initialProfile> = {}) {
  const page = await browser!.newPage({ viewport });
  const errors: string[] = [];
  const requests: Array<{ method: string; path: string; body?: Record<string, unknown> }> = [];
  let profile = { ...initialProfile, ...overrides };
  page.on("pageerror", (error: Error) => errors.push(error.message));
  await page.route("**/api/v1/**", async (route: any) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    requests.push({ method: request.method(), path, body: request.method() === "PUT" ? request.postDataJSON() : undefined });
    if (path === "/api/v1/profiles" && request.method() === "GET") return route.fulfill({ json: [profile] });
    if (path === "/api/v1/profiles/profile-a" && request.method() === "PUT") {
      profile = { ...profile, ...request.postDataJSON() };
      return route.fulfill({ json: profile });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto(`${origin}/tests/browser/kid-profile-background-harness.html`);
  await page.getByRole("heading", { name: /Hi, Mun!/ }).waitFor();
  await waitForVisualStability(page);
  return { page, errors, requests };
}

async function waitForVisualStability(page: any) {
  await page.waitForSelector(".kid-profile-background__face image[href]");
  await page.evaluate(async () => {
    await document.fonts.ready;
    const face = document.querySelector<SVGImageElement>(".kid-profile-background__face image")!;
    const portrait = new Image(); portrait.src = face.href.baseVal; await portrait.decode();
    const scenery = document.querySelector<HTMLElement>(".kid-profile-background__scene")!;
    const source = getComputedStyle(scenery).backgroundImage.match(/url\(["\']?(.*?)["\']?\)/)?.[1];
    if (source) { const image = new Image(); image.src = source; await image.decode(); }
    await Promise.all([...document.images].map((image) => image.decode().catch(() => undefined)));
  });
  await page.waitForFunction(() => {
    const button = [...document.querySelectorAll("button")].find((node) => node.textContent?.includes("Your avatar"));
    return button && getComputedStyle(button).opacity === "1";
  });
}

test("personalization updates the exact chosen face and single opposite-side theme", async () => {
  const { page, errors, requests } = await openHub({ width: 1366, height: 768 });
  try {
    assert.equal(await page.locator(".kid-profile-background__face").getAttribute("data-avatar"), "capybara-calm");
    assert.equal(await page.locator(".kid-profile-background__face").getAttribute("viewBox"), "0 0 512 512");
    assert.match(await page.locator(".kid-profile-background__face image").getAttribute("href"), /^data:image\/png;base64,/);
    assert.equal(await page.locator(".kid-profile-background__scene").count(), 1);
    assert.equal(await page.locator(".kid-profile-background__scene-panel, .kid-profile-background__animal").count(), 0);
    await page.getByRole("button", { name: /Your avatar/ }).click();
    await page.getByRole("heading", { name: "Your avatar", exact: true }).waitFor();
    await page.getByRole("button", { name: "Select Panda Bear avatar", exact: true }).click();
    await page.getByRole("button", { name: "Flowers", exact: true }).click();
    await page.getByRole("button", { name: "Select #F59E0B background color", exact: true }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.locator(".kid-profile-background__face[data-avatar=\'bear-panda\']").waitFor();
    await waitForVisualStability(page);
    assert.equal(await page.locator(".kid-profile-background__scene").getAttribute("data-theme"), "flowers");
    const update = requests.find((request) => request.method === "PUT");
    assert.deepEqual(update?.body && { avatar_url: update.body.avatar_url, avatar_frame: update.body.avatar_frame, color: update.body.color }, { avatar_url: "bear-panda", avatar_frame: "flowers", color: "#F59E0B" });
    await page.screenshot({ path: "/tmp/kid-profile-peeking-panda-flowers.png" });
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('Playground copies the selected child friend code and reports clipboard failure', async () => {
  const { page, errors } = await openHub({ width: 1024, height: 768 });
  try {
    await page.evaluate(`Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text) => { window.copiedFriendCode = text; } } });`);
    const button = page.getByRole('button', { name: 'Copy Mun’s friend code', exact: true });
    await button.click({ timeout: 2000 });
    assert.equal(await page.evaluate(() => (window as any).copiedFriendCode), 'B3F98B7BB1');
    await page.getByRole('status').filter({ hasText: 'Code copied!' }).waitFor();
    await page.evaluate(`Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Permission denied'); } } });`);
    await button.focus(); await page.keyboard.press('Enter');
    await page.getByRole('status').filter({ hasText: 'Could not copy. Select the code to copy it.' }).waitFor();
    assert.ok(await page.getByText('B3F98B7BB1', { exact: true }).isVisible());
    await page.screenshot({ path: '/tmp/plg-friend-code-playground.png' });
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('a legacy child without a public friend code never exposes their internal ID as a code', async () => {
  const { page, errors } = await openHub({ width: 390, height: 844 }, { public_id: undefined });
  try {
    assert.equal(await page.getByRole('button', { name: /friend code/ }).count(), 0);
    assert.equal(await page.getByText('profile-a', { exact: true }).count(), 0);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test("face peeks from the left at 70% and untiled theme sits on the right at 50%", async () => {
  for (const [width, height] of [[2050, 1172], [1366, 768], [1024, 768], [1180, 820], [390, 844]]) {
    const { page, errors } = await openHub({ width, height }, { avatar_url: "lavender-bunny", avatar_frame: "tank" });
    try {
      const face = page.locator(".kid-profile-background__face");
      const theme = page.locator(".kid-profile-background__scene");
      const faceBox = await face.boundingBox(), themeBox = await theme.boundingBox();
      assert.ok(faceBox && themeBox);
      assert.ok(faceBox!.x < 0 && faceBox!.x + faceBox!.width > 0);
      assert.ok(faceBox!.y + faceBox!.height > height);
      assert.ok(themeBox!.x + themeBox!.width > width);
      assert.ok(themeBox!.x + themeBox!.width / 2 > faceBox!.x + faceBox!.width / 2);
      assert.equal(await face.evaluate((node: Element) => getComputedStyle(node).opacity), "0.7");
      const angle = await face.evaluate((node: Element) => {
        const matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform);
        return Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
      });
      assert.ok(Math.abs(angle - 45) < 0.01);
      assert.equal(await theme.evaluate((node: Element) => getComputedStyle(node).opacity), "0.5");
      assert.equal(await theme.evaluate((node: Element) => getComputedStyle(node).backgroundRepeat), "no-repeat");
      assert.equal(await theme.count(), 1);
      assert.equal(await page.locator(".kid-profile-background__scene-panel").count(), 0);
      assert.equal(await page.locator(".kid-profile-background__face, .kid-profile-background__scene").evaluateAll((nodes: Element[]) => nodes.every((node) => getComputedStyle(node).pointerEvents === "none")), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.getByRole("button", { name: /Your avatar/ }).click();
      await page.getByRole("heading", { name: "Your avatar", exact: true }).waitFor();
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await page.screenshot({ path: `/tmp/kid-profile-peeking-left-${width}.png` });
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  }
});

test("neck and body illustrations use their face-only rendering window", async () => {
  for (const avatar_url of ["snake", "swan", "spider", "fish"]) {
    const { page, errors } = await openHub({ width: 1366, height: 768 }, { avatar_url });
    try {
      assert.notEqual(await page.locator(".kid-profile-background__face").getAttribute("viewBox"), "0 0 512 512");
      assert.equal(await page.locator(".kid-profile-background__face image").getAttribute("href"), `/avatars/kids/${avatar_url}.webp`);
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  }
});

test('saved licensed-character choices now show original farm animals and keep personalization',async()=>{
 for(const [oldId,newId,label] of [['kuromi','dairy-cow','Dairy Cow'],['my-melody','highland-cow','Highland Cow'],['hello-kitty','yellow-chick','Yellow Chick']]){
  const {page,errors}=await openHub({width:1024,height:768},{avatar_url:oldId!});
  try{
   assert.equal(await page.locator('.kid-profile-background__face').getAttribute('data-avatar'),newId);
   assert.equal(await page.locator('.kid-profile-background__face image').getAttribute('href'),`/avatars/kids/${newId}.webp`);
   await page.getByRole('button',{name:/Your avatar/}).click();await page.getByRole('heading',{name:'Your avatar',exact:true}).waitFor();
   assert.ok(await page.getByRole('button',{name:`Select ${label} avatar`,exact:true}).count());
   for(const old of ['Kuromi','My Melody','Hello Kitty'])assert.equal(await page.getByRole('button',{name:`Select ${old} avatar`,exact:true}).count(),0);
   await page.screenshot({path:`/tmp/plg-avatar-${newId}.png`});await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.deepEqual(errors,[]);
  }finally{await page.close();}
 }
});

test('avatar title and actions stay visible while options scroll on phones and tablets', async () => {
  for (const [width, height] of [[320, 667], [390, 844], [768, 600], [768, 1024], [1024, 768], [1180, 820], [1366, 768]]) {
    const { page, errors } = await openHub({ width: width!, height: height! });
    try {
      await page.getByRole('button', { name: /Your avatar/ }).click();
      const dialog = page.getByRole('dialog', { name: 'Your avatar', exact: true });
      const header = dialog.locator('header');
      const footer = dialog.locator('footer');
      const initialHeader = await header.boundingBox(), initialFooter = await footer.boundingBox();
      assert.ok(initialHeader && initialFooter);
      for (const position of [1, 0]) {
        const scroll = await dialog.evaluate((node: HTMLDialogElement, position: number) => {
          const body = node.children[1] as HTMLElement;
          body.scrollTop = position ? body.scrollHeight : 0;
          return { top: body.scrollTop, max: body.scrollHeight - body.clientHeight, overflow: node.scrollWidth > node.clientWidth };
        }, position);
        if (width! < 800) assert.ok(scroll.max > 0, 'narrow options should scroll within the dialog');
        assert.equal(scroll.overflow, false);
        assert.equal(Math.abs(scroll.top - (position ? scroll.max : 0)) < 2, true);
        assert.deepEqual(await header.boundingBox(), initialHeader);
        assert.deepEqual(await footer.boundingBox(), initialFooter);
        for (const button of [dialog.getByRole('button', { name: 'Cancel', exact: true }), dialog.getByRole('button', { name: 'Save', exact: true })]) {
          const box = await button.boundingBox();
          assert.ok(box && box.y >= 0 && box.y + box.height <= height! && box.height >= 48);
          assert.ok(await button.evaluate((node: HTMLElement) => {
            const box = node.getBoundingClientRect();
            const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
            return hit === node || node.contains(hit);
          }));
        }
      }
      await page.screenshot({ path: `/tmp/plg-avatar-sticky-${width}-${height}.png` });
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  }
});
