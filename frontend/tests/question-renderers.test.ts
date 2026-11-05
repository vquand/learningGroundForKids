import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { createServer, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { equationCard } from '../../server/src/questions/equation.ts';
import { makeQuestion } from '../../server/src/questions/identity.ts';
import { publicQuestion } from '../../server/src/questions/projection.ts';
import type { PublicQuestion } from '../../server/src/questions/projection.ts';
import { compareCard } from '../../server/src/questions/compare.ts';
import { countingCard } from '../../server/src/questions/counting.ts';
import { pictureCard } from '../../server/src/questions/picture.ts';
import { vennCard } from '../../server/src/questions/venn.ts';
import type { ComponentType } from 'react';
import { setUiLanguage } from '../src/lib/uiLanguage.ts';

type Component = ComponentType<Record<string, unknown>>;
let server: ViteDevServer;
let EquationColumn: Component;
let QuestionView: Component;
let VennDiagram: Component;
let CountingStars: Component;
let loadUiLanguage: (language: 'en' | 'vi') => Promise<void>;

before(async () => {
  server = await createServer({ configFile: false, root: fileURLToPath(new URL('..', import.meta.url)), plugins: [react()], server: { middlewareMode: true, hmr: false, ws: false, watch: null }, optimizeDeps: { noDiscovery: true } });
  ({ EquationColumn, QuestionView, VennDiagram, CountingStars } = await server.ssrLoadModule('/src/components/questions/index.ts'));
  ({ loadUiLanguage } = await server.ssrLoadModule('/src/i18n/uiText.ts'));
});
after(async () => { await server.close(); });

const render = (component: Component, props: Record<string, unknown>) => renderToStaticMarkup(createElement(component, props));

test('EquationColumn renders public stacked equations and the typed blank', () => {
  const result = publicQuestion(makeQuestion(equationCard('chain-2d-3', [18, 3, 12], ['+', '+']), 'equation'));
  const resultMarkup = render(EquationColumn, { question: result });
  assert.match(resultMarkup, /question-equation-column/);
  assert.match(resultMarkup, />\?</);

  const missing = publicQuestion(makeQuestion(equationCard('addsub-2d1d', [24, 3], ['+'], 0), 'missing'));
  const missingMarkup = render(EquationColumn, { question: missing, input: '4' });
  assert.match(missingMarkup, /question-answer-line/);
  assert.match(missingMarkup, />4</);
  assert.doesNotMatch(missingMarkup, />24</);
});

test('EquationColumn places each public fishing blank in its intended row', () => {
  const scenarios = [
    { name: 'missing-left', level: 'add-2d', values: [null, 40], operators: ['+'], result: 70, row: 0 },
    { name: 'missing-right', level: 'add-2d', values: [30, null], operators: ['+'], result: 70, row: 1 },
    { name: 'large-question', level: 'addsub-3d1d', values: [900, 9], operators: ['+'], result: null, row: 2 },
  ] as const;
  for (const scenario of scenarios) {
    const question: PublicQuestion = {
      id: scenario.name,
      card: { kind: 'equation', level: scenario.level, values: scenario.values, operators: scenario.operators, result: scenario.result },
      response: { mode: 'typed' as const },
    };
    const markup = renderToString(createElement(EquationColumn, { question, input: '', language: 'en' }));
    const rows = [...markup.matchAll(/<div class="question-math-row[^>]*">([\s\S]*?)<\/div>/g)].map(match => match[1]!);
    assert.equal(rows.length, 3, scenario.name);
    assert.equal(rows.filter(row => row.includes('question-answer-line')).length, 1, scenario.name);
    assert.ok(rows[scenario.row]!.includes('question-answer-line'), scenario.name);
    assert.ok(!rows.filter((_row, index) => index !== scenario.row).some(row => row.includes('question-answer-line')), scenario.name);
  }
});

test('VennDiagram renders the shared friend faces, prompt and localized answer line from public data', async () => {
  const question = publicQuestion(makeQuestion(vennCard(6, () => .99, 'venn-large'), 'venn'));
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { documentElement: { lang: 'en' } } });
  try {
    await loadUiLanguage('vi');
    setUiLanguage('vi');
    const markup = render(VennDiagram, { question, input: '2' });
    assert.match(markup, /question-venn-svg/);
    assert.match(markup, /Đội A/);
    assert.match(markup, /How many/);
    assert.match(markup, /data-region=/);
    assert.match(markup, /Đáp án/);
    assert.match(markup, />2</);
    assert.doesNotMatch(markup, /"answer"/);
  } finally {
    setUiLanguage('en');
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});

test('CountingStars renders the localized content prompt and accessible star row', () => {
  const question = publicQuestion(makeQuestion(countingCard(5), 'counting'));
  const markup = render(CountingStars, { question, language: 'vi' });
  assert.equal((markup.match(/aria-hidden="true"/g) ?? []).length, 5);
  assert.match(markup, /aria-label="5 ngôi sao"/);
});

test('QuestionView dispatches all five shared card kinds', () => {
  const equation = publicQuestion(makeQuestion(equationCard('add-1d', [2, 3], ['+']), 'equation'));
  const venn = publicQuestion(makeQuestion(vennCard(1, () => .99, 'venn-small'), 'venn'));
  const compare = publicQuestion(makeQuestion(compareCard(3, 8), 'compare'));
  const picture = publicQuestion(makeQuestion(pictureCard('rabbit'), 'picture'));
  assert.match(render(QuestionView, { question: equation, input: '', language: 'en' }), /question-equation-column/);
  assert.match(render(QuestionView, { question: venn, input: '', language: 'vi' }), /question-venn/);
  assert.match(render(QuestionView, { question: compare, input: '', language: 'en' }), /question-compare-signs/);
  assert.match(render(QuestionView, { question: picture, input: '', language: 'en' }), /question-animal-picture/);
});
