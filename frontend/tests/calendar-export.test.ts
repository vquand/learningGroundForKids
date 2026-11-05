import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { calendarPdfFile } from '../src/lib/calendarPdfFile.ts';
import { CALENDAR_AREAS, type CalendarWindow } from '../src/types/calendar.ts';
const days = Array.from({ length: 14 }, (_, i) => ({ date: `2026-11-${String(i + 2).padStart(2, '0')}`, weekday: i % 7 + 1, is_past: false, lists: Object.fromEntries(CALENDAR_AREAS.map(area => [area, { id: null, items: [], revision: 0, source: 'empty' }])) }));
const data = { today: '2026-11-02', weeks: [{ start: days[0]!.date, days: days.slice(0, 7) }, { start: days[7]!.date, days: days.slice(7) }], events: [], system_events: [] } as unknown as CalendarWindow;
test('export contains six ordered pages, full custom names, language and participants in either interface language', async () => {
  const server = await createServer({ configFile: false, root: fileURLToPath(new URL('..', import.meta.url)), server: { middlewareMode: true, hmr: false, ws: false, watch: null }, optimizeDeps: { noDiscovery: true } });
  try {
    const { buildCalendarExportPages } = await server.ssrLoadModule('/src/lib/calendarExportModel.ts') as typeof import('../src/lib/calendarExportModel.ts');
    const { loadUiLanguage } = await server.ssrLoadModule('/src/i18n/uiText.ts'); await loadUiLanguage('vi');
    data.weeks[0]!.days[0]!.lists.study_morning.items = [{ subject: 'math', name: 'Toán A+', teaching_language: 'vi' }, { subject: 'club_chess' }];
    data.weeks[0]!.days[0]!.lists.meal_dinner.items = [{ food: 'custom', icon: 'rice', name: 'Cơm nhà' }, { medicine: { method: 'syrup', color: 'red', qty: 2, dose: '10 ml' } }];
    data.events = [{ event_id: 'e', date: days[0]!.date, title: 'Đi chơi', icon_key: 'birthday', repeat: 'none', repeat_ended_on: null, start_date: days[0]!.date, revision: 1, participants: [{ kind: 'role', key: 'dad' }, { kind: 'profile', profile_id: 'kid', name: 'Bé Na' }] }];
    for (const language of ['en', 'vi'] as const) {
      const pages = buildCalendarExportPages(data, language);
      assert.equal(pages.length, 6); assert.deepEqual(pages.map(p => p.start), Array(3).fill('2026-11-02').concat(Array(3).fill('2026-11-09')));
      assert.equal(pages[0]!.rows[0]!.cells[0]![0]!.label, 'Toán A+ (VI)');
      assert.equal(pages[1]!.rows[3]!.cells[0]![0]!.label, 'Cơm nhà');
      assert.match(pages[1]!.rows[3]!.cells[0]![1]!.label, /×2 · 10 ml/);
      assert.match(pages[2]!.rows[0]!.cells[0]![0]!.label, language === 'vi' ? /Đi chơi\nBố, Bé Na/ : /Đi chơi\nDad, Bé Na/);
      assert.ok(pages.flatMap(p => p.rows.flatMap(r => r.cells.flat())).every(e => e.art.startsWith('/calendar/icons/') && e.label));
    }
  } finally { await server.close(); }
});
test('PDF has exactly six landscape image pages and correct binary object offsets', async () => {
  const pages = Array.from({ length: 6 }, () => ({ bytes: new Uint8Array([255, 216, 255, 217]), width: 10, height: 7 }));
  const blob = calendarPdfFile(pages, 842, 595); const text = await blob.text();
  assert.equal(blob.type, 'application/pdf'); assert.equal((text.match(/\/Type \/Page /g) ?? []).length, 6); assert.match(text, /\/MediaBox \[0 0 842.00 595.00\]/);
  const bytes = new Uint8Array(await blob.arrayBuffer()); const start = Number(text.match(/startxref\n(\d+)/)?.[1]);
  assert.equal(new TextDecoder().decode(bytes.slice(start, start + 4)), 'xref');
  const rows = text.slice(text.indexOf('xref\n')).split('\n').slice(3, 23);
  for (const [i, row] of rows.entries()) { const offset = Number(row!.slice(0, 10)); assert.ok(new TextDecoder().decode(bytes.slice(offset, offset + 12)).startsWith(`${i + 1} 0 obj`)); }
  assert.throws(() => calendarPdfFile(pages.slice(1), 842, 595));
});
