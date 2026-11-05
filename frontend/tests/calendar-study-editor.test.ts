import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { CALENDAR_AREAS, type CalendarDay, type CalendarList } from '../src/types/calendar.ts';
import { addStudy, hasStudy, toggleStudy } from '../src/lib/calendarHelpers.ts';

test('a palette toggle removes only the last matching study entry and preserves other languages', () => {
  const choice = { subject: 'math' as const, name: 'Math A+' };
  const english = { ...choice, teaching_language: 'en' as const, series_id: 'english' };
  const vietnamese = { ...choice, teaching_language: 'vi' as const, series_id: 'vietnamese' };
  const other = { subject: 'art' as const };
  assert.equal(hasStudy([english, vietnamese], choice), true);
  assert.deepEqual(toggleStudy([english, other, vietnamese], choice), [english, other]);
  assert.deepEqual(toggleStudy([english, { ...choice, series_id: 'plain' }, vietnamese], choice), [english, vietnamese], 'prefer the matching plain entry over customized languages');
  assert.deepEqual(toggleStudy([english, vietnamese], english), [vietnamese], 'an explicit language toggles only that language');
});

test('study additions keep the eight-item cap and prevent exact subject/name/language duplicates', () => {
  const choice = { subject: 'math' as const, name: 'Math A+' };
  const english = { ...choice, teaching_language: 'en' as const };
  const vietnamese = { ...choice, teaching_language: 'vi' as const };
  assert.deepEqual(addStudy([english], { ...english, series_id: 'new-lineage' }), [english]);
  assert.deepEqual(addStudy([english], vietnamese), [english, vietnamese], 'distinct teaching languages remain distinct entries');
  const full = Array.from({ length: 8 }, (_, index) => ({ ...choice, name: `Subject ${index}` }));
  assert.deepEqual(addStudy(full, english), full);
  assert.deepEqual(toggleStudy(full, english), full);
});

const list: CalendarList = { id: 'plan', source: 'template', revision: 1, items: [{ subject: 'math', teaching_language: 'en' }] };
const lists = Object.fromEntries(CALENDAR_AREAS.map(area => [area, list])) as CalendarDay['lists'];

test('past Study has rename and Done but no palette, scope, language selector or Save; editable Study defaults to populated Favorites', async () => {
  const server = await createServer({ configFile: false, root: fileURLToPath(new URL('..', import.meta.url)), plugins: [react()], server: { middlewareMode: true, hmr: false, ws: false, watch: null }, optimizeDeps: { noDiscovery: true } });
  try {
    const { ListEditorDrawer } = await server.ssrLoadModule('/src/components/Calendar/ListEditorDrawer.tsx');
    const render = (past: boolean, library = [{ id: 'favorite', subject: 'math', name: 'Math A+' }], currentList = list) => renderToStaticMarkup(createElement(ListEditorDrawer, {
      profileId: 'child', library, day: { date: '2026-10-29', weekday: 4, is_past: past, lists }, area: 'study_extra', list: currentList, returnFocus: null,
      onClose() {}, onSave: async () => {}, onRestore: async () => {}, onLibraryChanged: async () => {}, onRename: async () => list,
    }));
    const past = render(true);
    assert.doesNotMatch(past, /calendar-palette|calendar-scope-choice|<select|calendar-save-button/);
    assert.match(past, /aria-label="Rename Math"/);
    assert.match(past, />Done<\/button>/);
    assert.match(past, /calendar-language-medal/);
    const editable = render(false);
    assert.match(editable, /aria-selected="true" class="is-active">Favorites<\/button>/);
    assert.match(editable, /Manage favorite subjects/);
    assert.match(editable, /Search subjects/);
    assert.doesNotMatch(editable, />My subjects<\/button>/);
    assert.match(editable, /Teaching language for Math/);
    assert.doesNotMatch(editable, /<select/);
    const languageGroup = /<div[^>]*class="calendar-button-group"[\s\S]*?<\/div>/.exec(editable)?.[0];
    assert.ok(languageGroup, 'teaching language is a shared inline button group');
    assert.match(languageGroup, /aria-label="Teaching language for Math"/);
    const actionGroup = /<div class="calendar-button-group" role="group" aria-label="Math">[\s\S]*?<\/div>/.exec(editable)?.[0];
    assert.ok(actionGroup, 'order actions use exactly the same group class');
    for (const group of [languageGroup, actionGroup]) {
      assert.equal(group.match(/class="calendar-group-button"/g)?.length, 3, 'all grouped buttons use the same class');
    }
    assert.doesNotMatch(editable, /calendar-order-actions|calendar-inline-choices/);
    assert.equal(languageGroup.match(/<button/g)?.length, 3);
    assert.match(languageGroup, /aria-label="Unspecified"[^>]*aria-pressed="false"[^>]*>N\/A<\/button>/);
    assert.match(languageGroup, /aria-label="English"[^>]*aria-pressed="true"[^>]*>EN<\/button>/);
    assert.match(languageGroup, /aria-label="Vietnamese"[^>]*aria-pressed="false"[^>]*>VI<\/button>/);
    assert.match(editable, /Edit Extra plan/);
    const noFavorites = render(false, []);
    assert.match(noFavorites, /aria-selected="true" class="is-active">Subjects<\/button>/);
    assert.doesNotMatch(noFavorites, /Manage favorite subjects/);
    const full = render(false, undefined, { ...list, items: Array.from({ length: 8 }, (_, i) => ({ subject: 'math', name: i ? `Math ${i}` : 'Math A+', teaching_language: 'vi' })) });
    const favorite = /<button[^>]*title="Math A\+"[^>]*>/.exec(full)?.[0];
    assert.ok(favorite);
    assert.match(favorite, /aria-pressed="true"/);
    assert.doesNotMatch(favorite, /disabled/, 'a taught favorite stays selected and can toggle off even at the cap');
    const { MedicineDialog } = await server.ssrLoadModule('/src/components/Calendar/MedicineDialog.tsx');
    const medicine = renderToStaticMarkup(createElement(MedicineDialog, { weekday: 4, onCancel() {}, onSave() {} }));
    assert.match(medicine, /aria-label="Thursday"[^>]*aria-pressed="true"/);
    assert.match(medicine, /aria-label="Monday"[^>]*aria-pressed="false"/);
    const { CalendarScrollPanel } = await server.ssrLoadModule('/src/components/Calendar/CalendarScrollPanel.tsx');
    const panel = renderToStaticMarkup(createElement(CalendarScrollPanel, { label: 'Saved favorites' }, createElement('button', {}, 'Edit favorite')));
    assert.match(panel, /role="region" aria-label="Saved favorites"/);
    assert.doesNotMatch(panel, /type="range"|role="slider"/);
    assert.equal(panel.match(/tabindex="0"/g)?.length, 1, 'native scrolling has one keyboard stop');
  } finally { await server.close(); }
});
