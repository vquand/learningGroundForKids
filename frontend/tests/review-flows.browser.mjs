import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

// Run with the existing Playwright installation; no dependency download needed.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const base = process.env.REVIEW_BASE_URL ?? "http://127.0.0.1:5173";
const output = process.env.REVIEW_OUTPUT_DIR ?? "/tmp/plg-review-browser";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const profile = { id: "profile-1", name: "Learner", emoji: "🦊", color: "blue", total_done: 0, badge_count: 0, created_at: "2026-09-27T00:00:00Z" };
const user = { id: "family-1", email: "family@example.test", name: "Test Family" };
const audio = Buffer.alloc(44 + 8_000);
audio.write("RIFF", 0); audio.writeUInt32LE(audio.length - 8, 4); audio.write("WAVEfmt ", 8);
audio.writeUInt32LE(16, 16); audio.writeUInt16LE(1, 20); audio.writeUInt16LE(1, 22);
audio.writeUInt32LE(8_000, 24); audio.writeUInt32LE(8_000, 28); audio.writeUInt16LE(1, 32);
audio.writeUInt16LE(8, 34); audio.write("data", 36); audio.writeUInt32LE(8_000, 40); audio.fill(128, 44);

async function setup({ registration = false, authenticated = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const state = { registration, authenticated, registrations: [], donePosts: [], passed: false, done: false, delayItem: null };
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== new URL(base).origin) return route.fulfill({ status: 200, body: "" });
    if (url.pathname === "/test-audio.wav") return route.fulfill({ contentType: "audio/wav", body: audio });
    if (!url.pathname.startsWith("/api/")) return route.continue();
    const path = url.pathname;
    let json;
    if (path === "/api/v1/auth/session") json = state.authenticated ? { authenticated: true, user } : { authenticated: false };
    else if (path === "/api/v1/legal/version") json = { version: "test-legal-version" };
    else if (path === "/api/v1/auth/registration") json = { enabled: state.registration };
    else if (path === "/api/v1/auth/register") {
      state.registrations.push(request.postDataJSON());
      if (!state.registration) return route.fulfill({ status: 403, json: { error: { message: "Registration is disabled." } } });
      if (request.postDataJSON().email === "existing@example.test") return route.fulfill({ status: 409, json: { error: { code: "REGISTRATION_FAILED", message: "We could not create this account. Try signing in, or use a different email." } } });
      state.authenticated = true;
      return route.fulfill({ status: 201, json: { authenticated: true, user } });
    } else if (path === "/api/v1/health/ready") json = { status: "ready" };
    else if (path === "/api/v1/profiles") json = [profile];
    else if (path === "/api/v1/items") json = [];
    else if (/\/items\/[^/]+\/quiz$/.test(path)) json = { difficulty: "Easy", questions: [{ id: "q1", question_type: "single", question: "Choose an answer", options: ["Answer A", "Answer B"], answer_count: 1, sort_order: 0 }] };
    else if (path.endsWith("/status")) json = { passed: state.passed, attempt_count: state.passed ? 1 : 0, best_score: 1, best_total: 1, latest_score: 1, latest_total: 1 };
    else if (path.endsWith("/submit")) {
      state.passed = true;
      state.done = true;
      json = { score: 1, total: 1, passed: true };
    } else if (/\/progress\/[^/]+$/.test(path)) {
      if (request.method() === "POST") {
        state.donePosts.push(path);
        json = state.passed ? { status: "done", newly_earned_badges: [] } : { status: "quiz_required", newly_earned_badges: [] };
      } else json = { done: state.done && path.endsWith("/music-one") };
    } else if (path.endsWith("/progress")) json = { done_item_ids: state.done ? ["music-one"] : [], wip_item_ids: [] };
    else if (/^\/api\/v1\/items\/[^/]+$/.test(path)) {
      if (state.delayItem) await state.delayItem;
      const id = path.split("/").at(-1);
      json = { id, category: "music", latitude: 10, longitude: 106, translation: { lang: "en", title: id, description: "A short music lesson." }, available_languages: ["en"], media: [], audio_urls: [{ url: "/test-audio.wav", label: "Listen to the music" }], rich_fields: { related_movie_ids: ["music-two"] }, has_quiz: true, quiz_required: true };
    } else json = [];
    await route.fulfill({ json });
  });
  return { page, context, state, errors };
}

async function acceptConsent(page) {
  const consent = page.getByRole("dialog", { name: "Please read before continuing", exact: true });
  await consent.waitFor();
  const legalText = consent.getByRole("region", { name: "Privacy Policy and Terms of Use", exact: true });
  await legalText.evaluate((element) => { element.scrollTop = element.scrollHeight; element.dispatchEvent(new Event("scroll")); });
  await consent.getByRole("checkbox").check();
  await consent.getByRole("button", { name: "I agree & continue", exact: true }).click();
}

try {
  {
    const { page, context } = await setup({ registration: true });
    await page.route("**/src/pages/RegisterPage.tsx*", (route) => route.abort());
    await page.goto(`${base}/register`);
    await page.getByRole("heading", { name: "We couldn’t load this page" }).waitFor();
    await page.unroute("**/src/pages/RegisterPage.tsx*");
    await page.getByRole("button", { name: "Reload page" }).click();
    await page.getByRole("heading", { name: "Create your family account" }).waitFor();
    await context.close();
  }
  {
    const { page, context, state, errors } = await setup();
    await page.goto(`${base}/register`);
    await page.getByText("New family registration is currently closed.", { exact: false }).waitFor();
    assert.equal(await page.locator("form").count(), 0);
    assert.equal(state.registrations.length, 0);
    await page.screenshot({ path: `${output}/registration-closed.png` });
    assert.deepEqual(errors, []);
    await context.close();
  }
  {
    const { page, context, state, errors } = await setup({ registration: true });
    await page.goto(base);
    await page.getByRole("link", { name: "Create a family account" }).click();
    await page.getByLabel("Family name", { exact: true }).fill("Browser Family");
    await page.getByLabel("Email", { exact: true }).fill("existing@example.test");
    await page.getByLabel("Password", { exact: true }).fill("unique test password");
    await page.getByLabel("Confirm password", { exact: true }).fill("different test password");
    await page.getByRole("button", { name: "Create family account", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "Passwords do not match" }).waitFor();
    assert.equal(state.registrations.length, 0);
    await page.getByLabel("Confirm password", { exact: true }).fill("unique test password");
    await page.getByRole("button", { name: "Create family account", exact: true }).click();
    await acceptConsent(page);
    await page.getByRole("alert").filter({ hasText: "We could not create this account." }).waitFor();
    await page.setViewportSize({ width: 375, height: 812 });
    await page.screenshot({ path: `${output}/registration-mobile.png` });
    await page.getByLabel("Email", { exact: true }).fill("new@example.test");
    await page.getByRole("button", { name: "Create family account", exact: true }).click();
    await acceptConsent(page);
    await page.getByRole("heading", { name: "Who's exploring today?" }).waitFor();
    assert.equal(state.registrations.length, 2);
    assert.deepEqual(errors, []);
    await context.close();
  }
  {
    const { page, context, state, errors } = await setup({ authenticated: true });
    // Select the mocked child in memory, as on a fresh device load.
    await page.goto(base);
    await page.getByRole('button', { name: /Learner.*explored/ }).click();
    await page.clock.install();
    let releaseItem;
    state.delayItem = new Promise((resolve) => { releaseItem = resolve; });
    let releaseCategory;
    const categoryDelay = new Promise((resolve) => { releaseCategory = resolve; });
    await page.route("**/src/components/ItemDetail/MusicDetail.tsx*", async (route) => { await categoryDelay; await route.continue(); });
    await page.evaluate(() => { history.pushState({}, '', '/items/music-one'); dispatchEvent(new PopStateEvent('popstate')); });
    await delay(250);
    await page.clock.fastForward(20_000);
    assert.equal(state.donePosts.length, 0, "loading data cannot complete a lesson");
    releaseItem();
    state.delayItem = null;
    await page.getByRole("heading", { name: "music-one", exact: true }).waitFor();
    await page.clock.fastForward(20_000);
    assert.equal(state.donePosts.length, 0, "lazy content cannot bypass checkpoints");
    releaseCategory();
    await page.getByRole("button", { name: "Play", exact: true }).waitFor();
    await page.locator("[data-checkpoint=audio]").scrollIntoViewIfNeeded();
    await delay(100);
    await page.clock.fastForward(4_000);
    assert.equal(state.donePosts.length, 0, "media must be interacted with after data loads");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.locator("[data-checkpoint=description]").scrollIntoViewIfNeeded();
    await delay(100);
    await page.clock.fastForward(4_000);
    await page.getByText("Quiz time! Pass the quiz below to complete this item.").waitFor();
    assert.equal(state.donePosts.length, 1, "completion request is submitted once");
    await page.getByRole("button", { name: "Start Quiz" }).click();
    await page.getByRole("button", { name: /Answer A/ }).click();
    await page.getByText("Great job!", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Back to Item" }).click();
    await page.getByLabel("Completed", { exact: true }).waitFor();
    assert.equal(await page.getByText("Quiz time! Pass the quiz below to complete this item.").count(), 0);
    await page.screenshot({ path: `${output}/completed-item.png` });
    await page.getByRole("listitem").filter({ hasText: "Movie" }).click();
    await page.getByRole("heading", { name: "music-two", exact: true }).waitFor();
    assert.equal(await page.getByLabel("Completed", { exact: true }).count(), 0, "next item starts incomplete");
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log("PASS: closed/enabled registration, validation, duplicate error, mobile form, new session, delayed item/lazy content, media/scroll gates, quiz completion, linked-item reset; no page errors.");
} finally {
  await browser.close();
}
