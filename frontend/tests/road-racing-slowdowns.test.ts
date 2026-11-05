import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

test('Road Racing retry choices render a red tried mark and forced feedback', async () => {
  const server = await createServer({ configFile: false, root: fileURLToPath(new URL('..', import.meta.url)), plugins: [react()], server: { middlewareMode: true, hmr: false, ws: false, watch: null }, optimizeDeps: { noDiscovery: true } });
  try {
    const { RacingQuiz } = await server.ssrLoadModule('/src/features/animal-racing/RacingQuiz.tsx');
    const { act, emptyProgress, publicState, startRace } = await server.ssrLoadModule('../server/src/road-racing/game.ts');
    const p = startRace(emptyProgress(), { animal: 'capybara', language: 'en', difficulty: 'easy' }, 1000, () => 0, 'render-test');
    p.race!.questionAt = 1000;
    const first = p.race!.question;
    assert.equal(first.response.mode, 'choice');
    const wrong = (first.response.correct + 1) % 3;
    const retry = act(p, { type: 'answer', questionId: first.id, choice: wrong }, 1200, () => 0);
    const retryHtml = renderToStaticMarkup(createElement(RacingQuiz, { race: publicState(retry, 1200).race!, busy: false, answer: () => {} }));
    assert.match(retryHtml, /is-tried-wrong/);
    assert.match(retryHtml, /Tried, not correct/);
    assert.match(retryHtml, /Try again!/);
    assert.equal((retryHtml.match(/class="racing-answers/g) ?? []).length, 1);
    const forced = act(retry, { type: 'answer', questionId: first.id, choice: wrong }, 1400, () => 0);
    const forcedHtml = renderToStaticMarkup(createElement(RacingQuiz, { race: publicState(forced, 1400).race!, busy: false, answer: () => {} }));
    assert.match(forcedHtml, /Now you know!/);
    assert.match(forcedHtml, /Slowed down!/);
    const retryCorrectStart = startRace(emptyProgress(), { animal: 'capybara', language: 'en', difficulty: 'easy' }, 1000, () => 0, 'retry-correct');
    const retryCorrectQuestion = retryCorrectStart.race!.question;
    const retryCorrectRetry = act(retryCorrectStart, { type: 'answer', questionId: retryCorrectQuestion.id, choice: (retryCorrectQuestion.response.correct + 1) % 3 }, 1200, () => 0);
    const retryCorrect = act(retryCorrectRetry, { type: 'answer', questionId: retryCorrectQuestion.id, choice: retryCorrectQuestion.response.correct }, 1400, () => 0);
    const retryCorrectHtml = renderToStaticMarkup(createElement(RacingQuiz, { race: publicState(retryCorrect, 1400).race!, busy: false, answer: () => {} }));
    assert.match(retryCorrectHtml, /Got it!/);
    assert.doesNotMatch(retryCorrectHtml, /A little push!/);
  } finally {
    await server.close();
  }
});

test('Road Racing scene renders three mixed effect slots with localized labels', async () => {
  const server = await createServer({ configFile: false, root: fileURLToPath(new URL('..', import.meta.url)), plugins: [react()], server: { middlewareMode: true, hmr: false, ws: false, watch: null }, optimizeDeps: { noDiscovery: true } });
  const previousWindow = (globalThis as unknown as { window?: unknown }).window;
  (globalThis as unknown as { window: { innerWidth: number } }).window = { innerWidth: 1366 };
  try {
    const { RacingScene } = await server.ssrLoadModule('/src/features/animal-racing/RacingScene.tsx');
    const { emptyProgress, publicState, startRace } = await server.ssrLoadModule('../server/src/road-racing/game.ts');
    const { makeQuestion } = await server.ssrLoadModule('../server/src/road-racing/questions.ts');
    const p = startRace(emptyProgress(), { animal: 'capybara', language: 'en', difficulty: 'easy' }, 1000, () => 0, 'scene-test');
    p.race!.question = makeQuestion('en', 0, [], () => 0);
    p.race!.updatedAt = 1000;// Far-future expiries keep the render independent of how long the SSR server takes to load.
    p.race!.stacks = [1e12, 1e12 + 100];p.race!.slows = [1e12 + 300, 1e12 + 400];
    const html = renderToStaticMarkup(createElement(RacingScene, { race: publicState(p, 1000).race!, receivedAt: 0 }));
    const runnerRows = [...html.matchAll(/<span class="racing-buffs"[^>]*>.*?<\/span>/g)].map(match => match[0]);
    const playerRow = runnerRows.find(row => row.includes('2 boost stacks, 2 slowdown stacks')) ?? '';
    const slotKinds = (row: string) => [...row.matchAll(/<i[^>]*class="([^"]*)"[^>]*>(.*?)<\/i>/g)].map(([, classes, icon]) => ({ classes, icon }));
    assert.equal(runnerRows.length, 6);
    assert.ok(runnerRows.every(row => slotKinds(row).length === 3));
    assert.ok(runnerRows.filter(row => row !== playerRow).every(row => !row.includes('slowdown stacks')));
    assert.deepEqual(slotKinds(playerRow).map(({ classes, icon }) => [classes, icon]), [
      ['is-active is-speed', '⚡'], ['is-active is-speed', '⚡'], ['is-active is-slow', '🐌'],
    ]);
    assert.equal((playerRow.match(/aria-hidden="true"/g) ?? []).length, 3);
    const meter = html.match(/<span class="racing-stack-meter"[^>]*>.*?<\/span>/)?.[0] ?? '';
    assert.match(meter, /2 boost stacks, 2 slowdown stacks/);
    assert.deepEqual(slotKinds(meter).map(({ classes, icon }) => [classes, icon]), [
      ['is-active is-speed', '⚡'], ['is-active is-speed', '⚡'], ['is-active is-slow', '🐌'],
    ]);

    p.race!.stacks = [];
    p.race!.slows = [];
    const emptyHtml = renderToStaticMarkup(createElement(RacingScene, { race: publicState(p, 1000).race!, receivedAt: 0 }));
    const emptyRows = [...emptyHtml.matchAll(/<span class="racing-buffs"[^>]*>.*?<\/span>/g)].map(match => match[0]);
    assert.ok(emptyRows.every(row => slotKinds(row).length === 3 && slotKinds(row).every(({ classes, icon }) => classes === 'is-empty' && icon === '⚡')));
    const emptyMeter = emptyHtml.match(/<span class="racing-stack-meter"[^>]*>.*?<\/span>/)?.[0] ?? '';
    assert.equal(slotKinds(emptyMeter).length, 3);
    assert.match(emptyMeter, /0 boost stacks/);
  } finally {
    if (previousWindow === undefined) delete (globalThis as unknown as { window?: unknown }).window;
    else (globalThis as unknown as { window?: unknown }).window = previousWindow;
    await server.close();
  }
});
