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

const PROFILE = {
  id: "profile-1", name: "Mun", emoji: "🌟", color: "#3B82F6", avatar_type: "default",
  avatar_url: "capybara-calm", avatar_frame: "space", total_done: 0,
};

before(async () => {
  server = await createServer({
    configFile: false,
    cacheDir: "/tmp/plg-language-picker-tour-cache",
    plugins: [react()],
    root: fileURLToPath(new URL("../../", import.meta.url)),
    server: { host: "127.0.0.1", port: 0 },
  });
  await server.listen();
  const address = server.httpServer!.address();
  assert.ok(address && typeof address !== "string");
  origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true,
    ...(process.env.PLG_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLG_CHROMIUM_EXECUTABLE } : {}) });
});

after(async () => { await browser?.close(); await server?.close(); });

async function fixture(options: { authenticated?: boolean; tourCompleted?: boolean; pendingPicker?: boolean } = {}) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 }, hasTouch: true });
  page.setDefaultTimeout(7000);
  const requests: Array<{ method: string; path: string }> = [];
  let authenticated = options.authenticated === true;
  let tourCompleted = options.tourCompleted === true;
  await page.addInitScript(({ pendingPicker }: { pendingPicker: boolean }) => {
    localStorage.removeItem("plg-google-signup-intent");
    if (pendingPicker) localStorage.setItem("plg-language-picker-pending", "true");
    else localStorage.removeItem("plg-language-picker-pending");
    localStorage.removeItem("plg-ui-language");
  }, { pendingPicker: options.pendingPicker === true });
  await page.route("**/api/v1/**", async (route: any) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    requests.push({ method: request.method(), path });
    if (path.endsWith("/auth/registration")) return route.fulfill({ json: { enabled: true } });
    if (path.endsWith("/legal/version")) return route.fulfill({ json: { version: "test-legal-version" } });
    if (path.endsWith("/auth/register")) { authenticated = true; return route.fulfill({ status: 201, json: {} }); }
    if (path.endsWith("/auth/login")) { authenticated = true; return route.fulfill({ status: 204 }); }
    if (path.endsWith("/auth/session")) return route.fulfill({ json: authenticated ? {
      authenticated: true, user: { id: "family-1", email: "family@example.test", name: "Family" },
    } : { authenticated: false } });
    if (path.endsWith("/auth/google/config")) return route.fulfill({ json: { enabled: false } });
    if (path === "/api/v1/profiles" && request.method() === "GET") return route.fulfill({ json: authenticated ? [PROFILE] : [] });
    if (path === "/api/v1/profiles/profile-1/town/name") return route.fulfill({ json: { townName: { adjective: "Sunny", noun: "Meadow" } } });
    if (path === "/api/v1/profiles/profile-1/tour" && request.method() === "GET") return route.fulfill({ json: { completed: tourCompleted } });
    if (path === "/api/v1/profiles/profile-1/tour/complete" && request.method() === "POST") {
      tourCompleted = true;
      return route.fulfill({ json: { completed: true } });
    }
    if (path.endsWith("/health/ready")) return route.fulfill({ json: { status: "ready" } });
    if (path.endsWith("/family/onboarding")) return route.fulfill({ json: { dismissed: true, child_created: true, parent_visited: true, friend_request_created: false, passkey_created: false, passkeys_enabled: true } });
    return route.fulfill({ json: [] });
  });
  return { page, requests };
}

test("plain login has no picker, while a successful password signup opens it", async () => {
  const { page } = await fixture();
  try {
    await page.goto(`${origin}/login`);
    await page.getByRole("heading", { name: "Welcome back, explorer!", exact: true }).waitFor();
    assert.equal(await page.getByRole("radiogroup").count(), 0);
    await page.goto(`${origin}/register`);
    await page.getByLabel("Family name", { exact: true }).fill("Our Family");
    await page.getByLabel("Email", { exact: true }).fill("new@example.test");
    await page.getByLabel("Password", { exact: true }).fill("new-family-password");
    await page.getByLabel("Confirm password", { exact: true }).fill("new-family-password");
    await page.getByRole("button", { name: "Create family account", exact: true }).click();
    const consent = page.getByRole("dialog", { name: "Please read before continuing", exact: true });
    await consent.waitFor();
    const legalText = consent.getByRole("region", { name: "Privacy Policy and Terms of Use", exact: true });
    await legalText.evaluate((element: HTMLElement) => { element.scrollTop = element.scrollHeight; element.dispatchEvent(new Event("scroll")); });
    await consent.getByRole("checkbox").check();
    await consent.getByRole("button", { name: "I agree & continue", exact: true }).click();
    await page.getByRole("radiogroup", { name: "Interface language", exact: true }).waitFor();
  } finally { await page.close(); }
});

for (const language of ["vi", "en"] as const) test(`picker flag ${language} shows exact confirmation and persists the UI language`, async () => {
  const { page } = await fixture({ authenticated: true, pendingPicker: true });
  try {
    await page.goto(origin);
    const choice = page.getByRole("radio", { name: language === "vi" ? /Tiếng Việt/ : /English/ });
    await choice.click();
    const confirmation = page.getByText(language === "vi" ? "Lựa chọn ngôn ngữ: Tiếng Việt" : "Selecting language: English", { exact: true });
    await confirmation.waitFor();
    assert.equal(await confirmation.count(), 1);
    assert.equal(await page.locator("html").getAttribute("lang"), language);
    await page.getByRole("button", { name: language === "vi" ? "Tiếp tục" : "Continue", exact: true }).click();
    assert.equal(await page.evaluate(() => localStorage.getItem("plg-language-picker-pending")), null);
  } finally { await page.close(); }
});

for (const [width, height] of [[1366, 768], [1024, 768], [1180, 820]]) test(`picker fits ${width}x${height} with all controls in view`, async () => {
  const { page } = await fixture({ authenticated: true, pendingPicker: true });
  try {
    await page.setViewportSize({ width, height });
    await page.goto(origin);
    await page.getByRole("radiogroup").waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight), false);
    for (const button of await page.getByRole("radio").all()) {
      const box = await button.boundingBox(); assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= height);
    }
    const continueButton = await page.getByRole("button", { name: "Continue", exact: true }).boundingBox();
    assert.ok(continueButton && continueButton.x >= 0 && continueButton.y >= 0 && continueButton.x + continueButton.width <= width && continueButton.y + continueButton.height <= height);
  } finally { await page.close(); }
});

async function openPlayground(options: { tourCompleted?: boolean } = {}) {
  const result = await fixture({ authenticated: true, tourCompleted: options.tourCompleted });
  await result.page.goto(origin);
  await result.page.getByRole("button", { name: /Mun/ }).first().click();
  await result.page.getByRole("heading", { name: "What do you feel like doing?", exact: true }).waitFor();
  return result;
}

test("Playground tour supports Next, Back, and finishing with one completion POST", async () => {
  const { page, requests } = await openPlayground();
  try {
    await page.getByRole("dialog", { name: "Playground guide" }).waitFor();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByText("Finish minigames to earn badges and materials.", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.getByText("These are minigames. Pick one and play!", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await page.getByRole("button", { name: "Replay playground guide", exact: true }).waitFor();
    assert.equal(requests.filter((request) => request.path.endsWith("/tour/complete")).length, 1);
  } finally { await page.close(); }
});

test("Skip closes the tour, completed profiles do not auto-open, and ? replays locally", async () => {
  const skipped = await openPlayground();
  try {
    await skipped.page.getByRole("dialog", { name: "Playground guide" }).waitFor();
    await skipped.page.getByRole("button", { name: "Skip", exact: true }).click();
    await skipped.page.getByRole("button", { name: "Replay playground guide", exact: true }).waitFor();
    assert.equal(skipped.requests.filter((request) => request.path.endsWith("/tour/complete")).length, 1);
  } finally { await skipped.page.close(); }

  const completed = await openPlayground({ tourCompleted: true });
  try {
    assert.equal(await completed.page.getByRole("dialog", { name: "Playground guide" }).count(), 0);
    await completed.page.getByRole("button", { name: "Replay playground guide", exact: true }).click();
    await completed.page.getByRole("dialog", { name: "Playground guide" }).waitFor();
    assert.equal(completed.requests.filter((request) => request.path.endsWith("/tour/complete")).length, 0);
    await completed.page.keyboard.press("Escape");
  } finally { await completed.page.close(); }
});

for (const [width, height] of [[1366, 768], [1024, 768], [1180, 820]]) test(`tour popover and controls fit ${width}x${height}`, async () => {
  const { page } = await openPlayground();
  try {
    await page.setViewportSize({ width, height });
    await page.getByRole("dialog", { name: "Playground guide" }).waitFor();
    for (const button of await page.getByRole("dialog").getByRole("button").all()) {
      const box = await button.boundingBox(); assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= height);
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  } finally { await page.close(); }
});
