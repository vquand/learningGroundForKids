import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

// Uses an already installed Playwright, optionally supplied by the host. No
// package installation and no application/backend server are needed.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLG_PLAYWRIGHT_MODULE || 'playwright');
let browser: any;
let server: Awaited<ReturnType<typeof createServer>>;
let origin: string;

before(async () => {
  server = await createServer({
    configFile: false,
    plugins: [react()],
    root: fileURLToPath(new URL('../../', import.meta.url)),
    server: { host: '127.0.0.1', port: 0 },
  });
  await server.listen();
  const address = server.httpServer!.address();
  assert.ok(address && typeof address !== 'string');
  origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true, ...(process.env.PLG_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLG_CHROMIUM_EXECUTABLE } : {}) });
});
after(async () => { await browser?.close(); await server?.close(); });

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

async function setup(options: { hook?: boolean; quiz?: boolean; media?: boolean; delayedItem?: boolean; delayedDone?: boolean; failFirstPost?: boolean; failFirstRead?: boolean } = {}) {
  const page = await browser.newPage();
  await page.clock.install();
  const itemReady = deferred();
  const postReady = deferred();
  const quizReady = deferred();
  const doneReady = deferred();
  const calls: Array<{ path: string; method: string }> = [];
  const completed = new Set<string>();
  let passed = false;
  let postHeld = false;
  let quizHeld = false;
  let doneHeld = Boolean(options.delayedDone);
  let failFirstPost = Boolean(options.failFirstPost);
  let failFirstRead = Boolean(options.failFirstRead);
  const errors: string[] = [];
  page.on('pageerror', (error: Error) => errors.push(error.message));
  await page.route('**/api/v1/**', async (route: any) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    calls.push({ path, method });
    let body: unknown = [];
    if (/\/items\/item-[ab]$/.test(path)) {
      if (options.delayedItem) await itemReady.promise;
      body = { id: path.split('/').at(-1), category: 'animal', media: [],
        available_languages: ['en'], translation: { lang: 'en', title: path.endsWith('item-a') ? 'Item A' : 'Item B', description: 'Learn' },
        youtube_url: options.media ? 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' : null,
        has_quiz: Boolean(options.quiz), quiz_required: Boolean(options.quiz) };
    } else if (path.endsWith('/submit')) {
      if (quizHeld) await quizReady.promise;
      passed = true; completed.add(path.replace('/quiz/items/', '/progress/').replace('/submit', ''));
      body = { score: 1, total: 1, passed: true, new_badges: [] };
    } else if (path.endsWith('/status')) {
      body = { attempt_count: passed ? 1 : 0, passed, best_score: 1, best_total: 1, latest_score: 1, latest_total: 1 };
    } else if (path.endsWith('/quiz')) {
      body = { difficulty: 'Easy', questions: options.quiz ? [{ id: 'q1', question_type: 'single', question: 'Choose', options: ['Only answer'], sort_order: 0 }] : [] };
    } else if (/\/progress\/item-[ab]$/.test(path)) {
      if (method === 'POST') {
        if (failFirstPost) {
          failFirstPost = false;
          return route.fulfill({ status: 503, json: { error: { message: 'Temporary save failure.' } } });
        }
        if (postHeld) await postReady.promise;
        if (!options.quiz || passed) completed.add(path);
        body = options.quiz && !passed
          ? { status: 'quiz_required', already_done: false, newly_earned_badges: [] }
          : { status: 'done', already_done: false, newly_earned_badges: [{ id: 'b1', name: 'Test badge', badge_type: 'global', description: 'Earned' }] };
      } else {
        if (failFirstRead) {
          failFirstRead = false;
          return route.fulfill({ status: 503, json: { error: { message: 'Temporary read failure.' } } });
        }
        const result = completed.has(path);
        if (doneHeld) { doneHeld = false; await doneReady.promise; }
        body = { done: result };
      }
    } else if (path.endsWith('/progress')) {
      const done = completed.has(`${path}/item-a`);
      body = { done_item_ids: done ? ['item-a'] : [], wip_item_ids: done ? [] : ['item-a'] };
    }
    await route.fulfill({ json: body });
  });
  await page.goto(`${origin}/tests/browser/completion-harness.html${options.hook ? '?hook' : ''}`);
  try {
    await page.waitForFunction(() => Boolean((window as any).completionTest), undefined, { timeout: 5_000 });
  } catch (error) { throw new Error(`Harness did not load: ${errors.join('; ')}`, { cause: error }); }
  const advance = async (ms: number) => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    await page.clock.runFor(ms);
    await new Promise((resolve) => setTimeout(resolve, 50));
  };
  const posts = () => calls.filter((call) => call.method === 'POST' && /\/progress\//.test(call.path));
  const state = () => page.locator('output').textContent().then((text: string) => JSON.parse(text));
  if (options.hook) await page.locator('output').waitFor();
  return { page, calls, posts, state, advance, errors, itemReady, postReady, quizReady, doneReady,
    holdPost: () => { postHeld = true; }, holdQuiz: () => { quizHeld = true; } };
}

test('delayed item data and lazy category rendering cannot satisfy completion gates', async () => {
  const t = await setup({ delayedItem: true, media: true });
  try {
    await t.advance(20_000);
    assert.equal(t.posts().length, 0, 'no completion while item data loads');
    assert.ok(t.calls.some((call) => call.method === 'GET' && call.path.endsWith('/progress/item-a')), 'progress status is read before lazy content');
    t.itemReady.resolve();
    await t.page.getByRole('heading', { name: 'Item A' }).waitFor();
    await t.advance(20_000);
    assert.equal(t.posts().length, 0, 'no completion while category chunk loads');
    await t.page.evaluate(() => (window as any).completionTest.releaseCategory());
    await t.page.getByText('Loaded category').waitFor();
    await t.advance(16_000);
    assert.equal(t.posts().length, 0, 'media must be interacted with');
    await t.page.getByRole('button', { name: 'Play media' }).click();
    await t.page.getByLabel('Completed').waitFor();
    assert.equal(t.posts().length, 1);
    assert.deepEqual(t.errors, []);
  } finally { await t.page.close(); }
});

test('checkpoints added after mount need their own uninterrupted dwell', async () => {
  const t = await setup({ hook: true });
  try {
    await t.advance(3_500);
    assert.equal((await t.state()).gates.scroll, true);
    await t.page.evaluate(() => (window as any).completionTest.addCheckpoint());
    await t.advance(100);
    assert.equal((await t.state()).gates.scroll, false);
    await t.advance(3_100);
    assert.equal((await t.state()).gates.scroll, true);
  } finally { await t.page.close(); }
});

test('media arriving after mount closes the media gate', async () => {
  const t = await setup({ hook: true });
  try {
    await t.advance(4_000);
    await t.page.getByRole('button', { name: 'Load media' }).click();
    await t.advance(12_000);
    assert.equal(t.posts().length, 0);
    assert.equal((await t.state()).gates.media, false);
    await t.page.getByRole('button', { name: 'Play media' }).click();
    await t.page.waitForFunction(() => JSON.parse(document.querySelector('output')!.textContent!).isDone);
    assert.equal(t.posts().length, 1);
  } finally { await t.page.close(); }
});

test('passing a quiz synchronizes detail completion and matching profile caches', async () => {
  const t = await setup({ quiz: true });
  try {
    await t.page.evaluate(() => (window as any).completionTest.releaseCategory());
    await t.page.getByText('Loaded category').waitFor();
    await t.advance(16_000);
    await t.page.getByText('Quiz time! Pass the quiz below to complete this item.').waitFor();
    assert.equal(t.calls.filter((call) => call.method === 'GET' && call.path.endsWith('/quiz')).length, 0, 'quiz questions wait for Start Quiz');
    await t.page.evaluate(() => (window as any).completionTest.seedCaches());
    await t.page.getByRole('button', { name: 'Start Quiz →' }).click();
    await t.page.getByRole('button', { name: /Only answer/ }).waitFor();
    assert.equal(t.calls.filter((call) => call.method === 'GET' && call.path.endsWith('/quiz')).length, 1, 'Start Quiz fetches questions');
    await t.page.getByRole('button', { name: /Only answer/ }).click();
    await t.page.getByText('Great job!').waitFor();
    await t.page.getByRole('button', { name: 'Back to Item' }).click();
    await t.page.getByLabel('Completed').waitFor();
    assert.equal(await t.page.getByText('Quiz time! Pass the quiz below to complete this item.').count(), 0);
    await t.page.waitForFunction(() => (window as any).completionTest.cache().find((q: any) => q.key[0] === 'badges' && q.key[1] === 'family-a')?.invalidated);
    const caches = await t.page.evaluate(() => (window as any).completionTest.cache());
    assert.equal(caches.find((q: any) => q.key[0] === 'badges' && q.key[1] === 'family-b').invalidated, false);
    assert.equal(caches.find((q: any) => q.key[0] === 'profiles').invalidated, true);
    assert.equal(caches.find((q: any) => q.key[0] === 'achievements').invalidated, true);
  } finally { await t.page.close(); }
});

test('a quiz pass replaces a pending pre-pass completion read', async () => {
  const t = await setup({ quiz: true, delayedDone: true });
  try {
    await t.page.evaluate(() => (window as any).completionTest.releaseCategory());
    await t.page.getByText('Loaded category').waitFor();
    await t.advance(100);
    assert.ok(t.calls.some((call) => call.method === 'GET' && call.path.endsWith('/progress/item-a')));
    await t.page.getByRole('button', { name: 'Start Quiz →' }).click();
    await t.page.getByRole('button', { name: /Only answer/ }).click();
    await t.page.getByText('Great job!').waitFor();
    await t.page.getByRole('button', { name: 'Back to Item' }).click();
    await t.page.getByLabel('Completed').waitFor();
    t.doneReady.resolve();
    await t.advance(100);
    assert.equal(await t.page.getByLabel('Completed').count(), 1);
    assert.equal(t.posts().length, 0);
  } finally { t.doneReady.resolve(); await t.page.close(); }
});

test('failed progress saves offer an explicit retry without duplicate requests', async () => {
  const t = await setup({ failFirstPost: true });
  try {
    await t.page.evaluate(() => (window as any).completionTest.releaseCategory());
    await t.page.getByText('Loaded category').waitFor();
    await t.advance(16_000);
    await t.page.getByRole('alert').filter({ hasText: 'save your progress' }).waitFor();
    assert.equal(t.posts().length, 1);
    await t.page.getByRole('button', { name: 'Try saving again' }).click();
    await t.page.getByLabel('Completed').waitFor();
    assert.equal(t.posts().length, 2);
  } finally { await t.page.close(); }
});

test('failed initial progress reads can be retried without bypassing the time gate', async () => {
  const t = await setup({ failFirstRead: true });
  try {
    await t.page.evaluate(() => (window as any).completionTest.releaseCategory());
    await t.page.getByRole('alert').filter({ hasText: 'check your progress' }).waitFor();
    await t.advance(20_000);
    assert.equal(t.posts().length, 0);
    await t.page.getByRole('button', { name: 'Try checking again' }).click();
    await t.advance(4_000);
    assert.equal(t.posts().length, 0);
    await t.advance(12_000);
    await t.page.getByLabel('Completed').waitFor();
    assert.equal(t.posts().length, 1);
  } finally { await t.page.close(); }
});

test('a checkpoint taller than the viewport can satisfy visible dwell', async () => {
  const t = await setup({ hook: true });
  try {
    await t.page.evaluate(() => (window as any).completionTest.makeCheckpointTall());
    await t.advance(3_500);
    assert.equal((await t.state()).gates.scroll, true);
  } finally { await t.page.close(); }
});

for (const action of ['Next item', 'Next profile', 'Next family', 'New session', 'Unmount']) {
  test(`pending completion cannot update a new owner after ${action}`, async () => {
    const t = await setup();
    try {
      t.holdPost();
      await t.page.evaluate(() => { (window as any).completionTest.releaseCategory(); (window as any).completionTest.seedCaches(); });
      await t.page.getByText('Loaded category').waitFor();
      await t.advance(16_000);
      assert.equal(t.posts().length, 1);
      await t.page.getByRole('button', { name: action, exact: true }).click();
      await t.advance(100);
      t.postReady.resolve();
      await t.advance(100);
      assert.equal(await t.page.getByLabel('Completed').count(), 0);
      assert.equal(await t.page.getByText('Badge Earned!', { exact: true }).count(), 0);
      const cache = await t.page.evaluate(() => (window as any).completionTest.cache());
      assert.equal(cache.find((q: any) => q.key[0] === 'badges' && q.key[1] === 'family-a').invalidated, false);
    } finally { await t.page.close(); }
  });
}

test('changing gates during persistence does not send duplicate completion requests', async () => {
  const t = await setup({ hook: true });
  try {
    t.holdPost();
    await t.advance(16_000);
    assert.equal(t.posts().length, 1);
    await t.page.evaluate(() => (window as any).completionTest.addCheckpoint());
    await t.advance(3_500);
    assert.equal(t.posts().length, 1);
    t.postReady.resolve();
  } finally { await t.page.close(); }
});

for (const action of ['Next profile', 'Next family', 'New session', 'Unmount']) {
  test(`pending quiz submission cannot refresh an inactive owner after ${action}`, async () => {
    const t = await setup({ quiz: true });
    try {
      t.holdQuiz();
      await t.page.evaluate(() => { (window as any).completionTest.releaseCategory(); (window as any).completionTest.seedCaches(); });
      await t.page.getByRole('button', { name: 'Start Quiz →' }).click();
      await t.page.getByRole('button', { name: /Only answer/ }).click();
      await t.page.waitForFunction(() => true);
      await t.page.getByRole('button', { name: action, exact: true }).click();
      // Allow new-owner queries to settle before delivering the old submission.
      await t.advance(100);
      const count = t.calls.length;
      t.quizReady.resolve();
      await t.advance(100);
      assert.equal(t.calls.length, count, 'no old-owner refetch after late submission');
      assert.equal(await t.page.getByLabel('Completed').count(), 0);
    } finally { await t.page.close(); }
  });
}
