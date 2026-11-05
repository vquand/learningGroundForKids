import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { BAITS, COMPANIONS, FISH, LOCATIONS } from '../../server/src/fishing/catalog.ts';

// Include both branches of dynamic messages, dialog titles and success notices.
// Do not mistake comparison values such as 'pond' or command IDs for UI copy.
function interfaceLabels(source: string): string[] {
  const labels: string[] = [];
  const collect = (node: ts.Node | undefined) => {
    if (!node) return;
    if (ts.isStringLiteral(node) && node.text) labels.push(node.text);
    else if (ts.isConditionalExpression(node)) { collect(node.whenTrue); collect(node.whenFalse); }
    else if (ts.isJsxExpression(node) || ts.isParenthesizedExpression(node)) collect(node.expression);
  };
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && ['uiText', 'uiMessage', 'setNotice'].includes(node.expression.text)) collect(node.arguments[0]);
    if (ts.isJsxAttribute(node) && node.name.getText() === 'title') collect(node.initializer);
    ts.forEachChild(node, visit);
  };
  visit(ts.createSourceFile('fishing.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX));
  return labels;
}

test('fishing catalogs and authored interface templates have Vietnamese translations with intact values', async () => {
  const catalog = JSON.parse(await readFile(new URL('../src/i18n/vi.json', import.meta.url), 'utf8')) as Record<string, string>;
  const files = ['FishingPage.tsx', 'FishingPanels.tsx'];
  const sources = await Promise.all(files.map(file => readFile(new URL(`../src/features/fishing/${file}`, import.meta.url), 'utf8')));
  const achievements = await readFile(new URL('../../server/src/fishing/achievements.ts', import.meta.url), 'utf8');
  const labels = [
    ...Object.values(BAITS).flatMap(bait => [bait.name, bait.skill, bait.difficulty]),
    ...Object.values(COMPANIONS).map(friend => friend.name),
    ...Object.values(FISH).map(fish => fish.name),
    ...Object.values(LOCATIONS).map(location => location.name),
    ...sources.flatMap(interfaceLabels),
    ...[...achievements.matchAll(/(?:name|description): '([^']+)'/g)].map(match => match[1]!),
  ];
  const placeholders = (value: string) => [...value.matchAll(/\{\w+\}/g)].map(match => match[0]).sort();
  for (const label of new Set(labels)) {
    assert.ok(catalog[label], `Missing Vietnamese fishing label: ${label}`);
    assert.deepEqual(placeholders(catalog[label]!), placeholders(label), `Preserve values in ${label}`);
  }
});
