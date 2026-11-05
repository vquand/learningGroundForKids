// Isolated synthetic API, shared by independent browser sessions to model two devices.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

const exec = promisify(execFile);
const sessions = [`calendar-pc-${process.pid}`, `calendar-ipad-${process.pid}`];
let session = sessions[0];
const library = [], writes = [];
let nextMealId = 0;
const areas = ['study_morning', 'study_afternoon', 'study_extra', 'meal_breakfast', 'meal_lunch', 'meal_snack', 'meal_dinner', 'medicine'];
const emptyLists = () => Object.fromEntries(areas.map(area => [area, { id: null, items: [], revision: 0, source: 'empty' }]));
const days = Array.from({ length: 14 }, (_, i) => ({ date: new Date(Date.UTC(2026, 9, 26 + i)).toISOString().slice(0, 10), weekday: i % 7 + 1, is_past: false, lists: emptyLists() }));
let failSave = false, failRead = false, saveGate = null;
const studyLibrary = Array.from({ length: 12 }, (_, i) => ({ id: `subject-${i}`, subject: 'math', name: `Toán tiếng Việt cùng gia đình số ${i + 1}` }));
const api = { name: 'calendar-meals-test-api', configureServer(server) {
  server.middlewares.use(async (req, res, next) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (!path.startsWith('/api/')) return next();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    const send = value => res.end(JSON.stringify(value));
    if (path.includes('/calendar/meals/') && ['PUT', 'DELETE'].includes(req.method)) {
      const index = library.findIndex(item => item.id === path.split('/').at(-1));
      assert.ok(index >= 0);
      if (req.method === 'DELETE') { library.splice(index, 1); res.statusCode = 204; return res.end(); }
      let raw = ''; for await (const chunk of req) raw += chunk;
      const body = JSON.parse(raw);
      library[index] = { id: library[index].id, food_key: body.food, custom_name: body.custom_name ?? null };
      return send(library[index]);
    }
    if (path.endsWith('/calendar/meals') && req.method === 'POST') {
      let raw = ''; for await (const chunk of req) raw += chunk;
      const body = JSON.parse(raw); writes.push(body);
      if (saveGate) await saveGate;
      if (failSave) { res.statusCode = 503; return send({ error: { code: 'CALENDAR_UNAVAILABLE', message: 'Unavailable' } }); }
      let item = library.find(item => item.food_key === body.food && item.custom_name === (body.custom_name ?? null));
      if (!item) { item = { id: `meal-${nextMealId++}`, food_key: body.food, custom_name: body.custom_name ?? null }; library.push(item); }
      res.statusCode = 201; return send(item);
    }
    if (path.includes('/calendar/subjects/') && ['PUT', 'DELETE'].includes(req.method)) {
      const index = studyLibrary.findIndex(item => item.id === path.split('/').at(-1));
      assert.ok(index >= 0);
      if (saveGate) await saveGate;
      if (req.method === 'DELETE') { studyLibrary.splice(index, 1); res.statusCode = 204; return res.end(); }
      let raw = ''; for await (const chunk of req) raw += chunk;
      const body = JSON.parse(raw);
      studyLibrary[index] = { id: studyLibrary[index].id, subject: body.subject, name: body.name };
      return send(studyLibrary[index]);
    }
    if (path.endsWith('/calendar')) {
      if (failRead) { res.statusCode = 503; return send({ error: { code: 'CALENDAR_UNAVAILABLE', message: 'Unavailable' } }); }
      return send({ today: '2026-10-26', timezone: 'Asia/Ho_Chi_Minh', weeks: [{ start: days[0].date, days: days.slice(0, 7) }, { start: days[7].date, days: days.slice(7) }], templates: Object.fromEntries(Array.from({ length: 7 }, (_, i) => [String(i + 1), emptyLists()])), meal_library: library, study_library: studyLibrary, events: [], system_events: [] });
    }
    if (path.endsWith('/weather')) return send({ status: 'unavailable', location_label: null, updated_at: null, days: [] });
    if (path.endsWith('/notifications')) return send({ items: [] });
    send({});
  });
} };
const server = await createServer({ configFile: false, root: fileURLToPath(new URL('..', import.meta.url)), cacheDir: '/tmp/calendar-meals-vite-cache', plugins: [react(), api], server: { host: '127.0.0.1', port: 5191, strictPort: true }, optimizeDeps: { include: ['react', 'react-dom/client', 'react/jsx-dev-runtime', 'react-router-dom', '@tanstack/react-query', 'zustand'] } });
const ab = async (...args) => (await exec('agent-browser', ['--session', session, ...args], { maxBuffer: 3e6 })).stdout.trim();
const inspect = async code => JSON.parse(await ab('eval', code));
async function click(name, role = 'button') {
  await ab('wait', '--fn', `[...document.querySelectorAll('button')].some(b=>b.checkVisibility()&&(b.getAttribute('aria-label')||b.textContent).trim()===${JSON.stringify(name)})`);
  const { data } = JSON.parse(await ab('snapshot', '-i', '--json'));
  const found = Object.entries(data.refs).find(([, ref]) => ref.name === name && ref.role === role);
  assert.ok(found, `Missing ${name}`);
  await ab('scrollintoview', `@${found[0]}`);
  await ab('click', `@${found[0]}`);
}
async function openMeals() {
  await ab('open', 'http://127.0.0.1:5191/tests/fixtures/calendar-meals.html');
  await ab('snapshot', '-i');
  await click('Meals', 'tab');
  await click('My favorites');
}
async function fill(name, value) {
  const { data } = JSON.parse(await ab('snapshot', '-i', '--json'));
  const found = Object.entries(data.refs).find(([, ref]) => ref.name.startsWith(name) && ref.role === 'textbox');
  assert.ok(found, `Missing ${name}`); await ab('fill', `@${found[0]}`, value);
}
async function bounds(label) {
  await ab('screenshot', `/tmp/calendar-meals-${label}.png`);
  const result = await inspect(`(() => {
    const dialog = document.querySelector('.meal-dialog');
    const outside = [...dialog.querySelectorAll('button,input,select')].filter(e => {
      if (!e.checkVisibility() || e.closest('.calendar-scroll-frame')) return false;
      const r = e.getBoundingClientRect();
      if (r.left < 0 || r.top < 0 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) return true;
      for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
        const s = getComputedStyle(p), c = p.getBoundingClientRect();
        if (/(auto|hidden|scroll)/.test(s.overflowY) && (r.top < c.top - 1 || r.bottom > c.bottom + 1)) return true;
        // The viewport-fixed backdrop escapes ordinary overflow on the drawer behind it.
        if (s.position === 'fixed') break;
      }
      return false;
    }).map(e => e.getAttribute('aria-label') || e.textContent);
    return { outside, scroll: [document.documentElement.scrollWidth > innerWidth, document.documentElement.scrollHeight > innerHeight] };
  })()`);
  assert.deepEqual(result.outside, [], label);
  assert.deepEqual(result.scroll, [false, false], label);
}
async function scrollPanels(label, expected) {
  const panels = await inspect(`Array.from(document.querySelectorAll('.calendar-scroll-panel')).map(panel => {
    const style = getComputedStyle(panel), rect = panel.getBoundingClientRect();
    const initial = panel.scrollTop;
    panel.scrollTop = panel.scrollHeight;
    const moved = panel.scrollTop;
    panel.scrollTop = initial;
    return { height: rect.height, fits: rect.top >= 0 && rect.bottom <= innerHeight && rect.right <= innerWidth, scrollbar: style.overflowY, gutter: style.scrollbarGutter, canScroll: panel.scrollHeight > panel.clientHeight, moved };
  })`);
  assert.equal(panels.length, expected, label);
  for (const panel of panels) {
    assert.ok(panel.height > 44 && panel.fits, `${label}: bounded list viewport`);
    assert.equal(panel.scrollbar, 'scroll', `${label}: visible scrollbar track`);
    assert.equal(await inspect(`document.querySelectorAll('input.calendar-scrollbar, [role=slider]').length`), 0, 'Native scrolling avoids a second, direction-dependent slider');
    assert.ok(await inspect(`Array.from(document.querySelectorAll('.calendar-scroll-panel')).every(panel => getComputedStyle(panel).scrollbarWidth !== 'none')`), 'Native scrollbar is not hidden');
    if (panel.canScroll) assert.ok(panel.moved > 0, `${label}: list can scroll to the bottom`);
  }
  return panels;
}
async function mealRowBounds(label, expected) {
  const rows = await inspect(`Array.from(document.querySelectorAll('.meal-entry')).map(row => {
    const button = row.querySelector('.calendar-icon-button--remove'), r = row.getBoundingClientRect(), b = button.getBoundingClientRect();
    const face = getComputedStyle(button, '::before');
    return { right: r.right - b.right, top: b.top - r.top, bottom: r.bottom - b.bottom, width: b.width, height: b.height, faceWidth: parseFloat(face.width), faceHeight: parseFloat(face.height), inset: parseFloat(face.top) };
  })`);
  assert.equal(rows.length, expected, label);
  for (const row of rows) {
    assert.ok(row.right >= 1 && row.right <= 6, `${label}: remove control aligned to the row's right edge`);
    assert.ok(row.top >= 1 && row.bottom >= 1, `${label}: control stays inside its own row`);
    assert.ok(row.width >= 44 && row.height >= 44, `${label}: usable touch target`);
    assert.ok(row.faceWidth <= 34 && row.faceHeight <= 38 && row.inset >= 4, `${label}: compact visible button with vertical padding`);
  }
  await ab('screenshot', `/tmp/calendar-meal-rows-${label}.png`);
}
try {
  await server.listen();
  await openMeals();
  await click('Choose Rice');
  assert.equal(writes.length, 0, 'choosing an icon never saves');
  await click('Mark as favorite');
  await ab('wait', '--text', '1 of 60 saved');
  assert.deepEqual(library, [{ id: 'meal-0', food_key: 'rice', custom_name: null }]);
  console.log('PC: explicitly saved meal appears in the library.');
  session = sessions[1];
  await ab('set', 'viewport', '1024', '768');
  await openMeals();
  await ab('wait', '--text', '1 of 60 saved');
  await click('Choose Eggs');
  await click('Mark as favorite');
  await ab('wait', '--text', '2 of 60 saved');
  await ab('screenshot', '/tmp/calendar-meals-ipad-saved.png');
  console.log('Independent iPad-sized session: PC favorite is present, new favorite saves.');
  failRead = true;
  await click('Choose Porridge');
  await click('Mark as favorite');
  await ab('wait', '--text', '3 of 60 saved');
  await ab('wait', '--fn', `!!document.querySelector('.calendar-refresh-retry')`);
  assert.equal(await inspect(`!!document.querySelector('[role="dialog"]')`), true, 'refresh failure must not close the draft/dialog');
  assert.equal(await inspect(`!![...document.querySelectorAll('[role="status"]')].find(e=>e.textContent==='Favorite saved.')`), true);
  console.log('A committed favorite stays visible even if the following calendar refresh fails.');
  failRead = false;
  await click('Could not refresh the calendar. Try again.');
  await ab('wait', '--fn', `!document.querySelector('.meal-dialog-footer button[disabled]') && !document.querySelector('.calendar-refresh-retry')`);
  await click('Done');
  await click('My favorites');
  failSave = true;
  await click('Choose Pho');
  await click('Mark as favorite');
  await ab('wait', '--text', 'Could not update My favorites. Please try again.');
  assert.equal(library.length, 3, 'failed save never invents a favorite');
  assert.equal(await inspect(`document.querySelector('.meal-library-dialog input[maxlength="40"]').value`), 'Pho');
  failSave = false;
  let releaseSave;
  saveGate = new Promise(resolve => { releaseSave = resolve; });
  await click('Mark as favorite');
  await ab('press', 'Escape');
  await ab('mouse', 'move', '2', '2'); await ab('mouse', 'down'); await ab('mouse', 'up');
  assert.equal(await inspect(`!!document.querySelector('.meal-library-dialog')`), true, 'pending save keeps dialog and feedback mounted');
  releaseSave(); saveGate = null;
  await ab('wait', '--text', '4 of 60 saved');
  for (const food of ['Noodles', 'Fried rice', 'Banh mi', 'Sandwich']) {
    await click(`Choose ${food}`); await click('Mark as favorite');
    await ab('wait', '--fn', `!![...document.querySelectorAll('button')].find(e=>e.textContent==='Already in favorites'&&e.disabled)`);
  }
  assert.equal(library.length, 8);
  assert.equal(await inspect(`!![...document.querySelectorAll('.meal-saved-row')].find(e=>e.textContent.includes('Sandwich'))`), true, 'new favorites remain in the scrollable saved list');
  await click('Done');
  await ab('reload'); await ab('snapshot', '-i'); await click('Meals', 'tab'); await click('My favorites');
  await ab('wait', '--text', '8 of 60 saved');
  console.log('Failed saves retain the draft; retries, scrolling and reload preserve confirmed favorites.');
  for (const [w, h] of [[1366, 768], [1024, 768], [1180, 820], [1495, 1288]]) {
    await ab('set', 'viewport', String(w), String(h)); await bounds(`favorites-${w}`);
    const panels = await scrollPanels(`favorites-${w}`, 2);
    assert.ok(panels[0].canScroll, "Full food catalog scrolls");
    if (h <= 820) assert.ok(panels[1].canScroll, "Saved favorites scroll independently");
  }
  for (let i = 0; i < 2; i++) {
    await click('Edit favorite Sandwich');
    await inspect(`document.querySelector('.meal-saved-list').closest('.calendar-scroll-panel').scrollTop = 0`);
    await click('Save favorite');
    await ab('wait', '--fn', `(() => { const row=document.querySelector('[data-scroll-key="meal-7"]'); const panel=row.closest('.calendar-scroll-panel'); const r=row.getBoundingClientRect(),p=panel.getBoundingClientRect(); return r.top>=p.top && r.bottom<=p.bottom && !document.querySelector('.meal-dialog-footer button[disabled]'); })()`);
  }
  await click('Edit favorite Rice');
  await fill('Meal name', 'Rice bowl');
  failRead = true;
  await click('Save favorite');
  await ab('wait', '--fn', `!!document.querySelector('.calendar-refresh-retry')`);
  await ab('wait', '--text', 'Rice bowl');
  assert.equal(library.length, 8);
  await click('Remove Rice bowl from My favorites');
  await ab('wait', '--text', '7 of 60 saved');
  assert.equal(await inspect(`!![...document.querySelectorAll('.meal-saved-row')].find(e=>e.textContent.includes('Rice bowl'))`), false);
  failRead = false;
  await click('Done'); await click('Could not refresh the calendar. Try again.');
  await ab('wait', '--fn', `!document.querySelector('.calendar-refresh-retry')`);
  session = sessions[0];
  await ab('reload'); await ab('snapshot', '-i'); await click('Meals', 'tab'); await click('My favorites');
  await ab('wait', '--text', '7 of 60 saved');
  console.log('Edits/deletes stay visible through read failures and sync back to the PC session.');
  await click('Choose Grilled chicken'); await fill('Meal name', 'Chicken Honey 2');
  await click('Mark as favorite'); await ab('wait', '--text', '8 of 60 saved');
  await click('Done');
  await click(await inspect(`document.querySelector('.meal-row:not(.meal-row--medicine) button').getAttribute('aria-label')`));
  for (let i = 0; i < 7; i++) await click('Add Eggs to this meal');
  await click('Add Chicken Honey 2 to this meal');
  for (const [w, h] of [[1366, 768], [1024, 768], [1180, 820]]) {
    await ab('set', 'viewport', String(w), String(h)); await mealRowBounds(`meal-${w}`, 8); await scrollPanels(`meal-editor-${w}`, 1);
  }
  await click('Remove Eggs');
  assert.equal(await inspect(`document.querySelectorAll('.meal-entry').length`), 7);
  await click('Close meal editor');
  const medicineLabel = await inspect(`document.querySelectorAll('.meal-row--medicine button')[2].getAttribute('aria-label')`);
  await click(medicineLabel);
  await click('Add medicine');
  assert.deepEqual(await inspect(`Array.from(document.querySelectorAll('.meal-medicine-dialog .calendar-group-button[aria-pressed=true]'), e=>e.getAttribute('aria-label'))`), ['Wednesday']);
  await click('Eye / nose drops', 'radio');
  await ab('wait', '--fn', `document.querySelector('.meal-method-choice[aria-checked="true"] img')?.naturalWidth === 256`);
  assert.equal(await inspect(`document.querySelector('.meal-method-choice[aria-checked="true"] img').naturalWidth`), 256);
  for (const [w, h] of [[1366, 768], [1024, 768], [1180, 820]]) {
    await ab('set', 'viewport', String(w), String(h)); await bounds(`medicine-${w}`);
  }
  await click('Add medicine');
  for (const [w, h] of [[1366, 768], [1024, 768], [1180, 820]]) {
    await ab('set', 'viewport', String(w), String(h)); await mealRowBounds(`medicine-${w}`, 1);
  }
  await click('Close meal editor');
  // The same controls must fit in Timetable and Events as well as Meals.
  await click('Study', 'tab');
  await click(await inspect(`document.querySelector('button.calendar-study-cell').getAttribute('aria-label')`));
  for (let i = 0; i < 2; i++) await click(await inspect(`document.querySelector('.calendar-palette-choice[aria-pressed=false]:not(:disabled)').getAttribute('aria-label')`));
  for (const [w, h] of [[1366, 768], [1024, 768], [1180, 820]]) {
    await ab('set', 'viewport', String(w), String(h));
    const controls = await inspect(`Array.from(document.querySelectorAll('.calendar-icon-button, .calendar-group-button, .calendar-group-tabs button')).filter(b => b.checkVisibility()).map(b => { const r = b.getBoundingClientRect(); return r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; })`);
    assert.ok(controls.length >= 6 && controls.every(Boolean), `Study controls fit at ${w}`);
    await scrollPanels(`study-${w}`, 1);
    await ab('screenshot', `/tmp/calendar-study-controls-${w}.png`);
  }
  await click('Manage favorite subjects');
  for (const [w, h] of [[1366, 768], [1024, 768], [1180, 820]]) {
    await ab('set', 'viewport', String(w), String(h));
    await bounds(`subjects-${w}`);
    const panels = await scrollPanels(`subjects-${w}`, 3);
    assert.ok(panels[1].canScroll && panels[2].canScroll, 'Subject icons and saved favorites scroll');
    assert.equal(await inspect(`document.querySelectorAll('.meal-saved-list li').length`), 12, 'All saved subjects rendered');
    assert.equal(await inspect(`document.querySelectorAll('.calendar-pager').length`), 0, 'No subject pagination');
  }
  assert.ok(await inspect(`Array.from(document.querySelectorAll('.meal-saved-row')).every(row=>{const b=row.querySelector('.calendar-item-name').getBoundingClientRect(),r=row.getBoundingClientRect();return b.top>=r.top && b.bottom<=r.bottom;})`), 'two-line Vietnamese names fit their rows');
  failRead = true;
  await click('Edit favorite Toán tiếng Việt cùng gia đình số 12');
  await fill('Subject name', 'Toán vui'); await click('Save favorite');
  await ab('wait', '--text', 'Could not refresh the calendar. Try again.');
  assert.equal(await inspect(`document.querySelector('.meal-library-dialog').textContent.includes('Toán vui')`), true, 'Study committed save survives failed refresh');
  failRead = false; await click('Could not refresh the calendar. Try again.');
  await ab('wait', '--fn', `!document.querySelector('.calendar-refresh-retry')`);
  failRead = true; await click('Remove Toán vui');
  await ab('wait', '--text', 'Could not refresh the calendar. Try again.');
  assert.equal(await inspect(`document.querySelector('.meal-library-dialog').textContent.includes('Toán vui')`), false, 'Study committed removal survives failed refresh');
  failRead = false; await click('Could not refresh the calendar. Try again.');
  await ab('wait', '--fn', `!document.querySelector('.calendar-refresh-retry')`);
  await click('Close');
  await click(await inspect(`document.querySelector('.calendar-icon-button--close').getAttribute('aria-label')`));
  await click('Events', 'tab');
  const eventSnapshot = JSON.parse(await ab('snapshot', '-i', '--json'));
  const addEventRef = Object.entries(eventSnapshot.data.refs).find(([, ref]) => ref.name === 'Add event' && ref.role === 'button');
  assert.ok(addEventRef, 'Add event control');
  await ab('click', `@${addEventRef[0]}`);
  for (const [w, h] of [[1366, 768], [1024, 768], [1180, 820]]) {
    await ab('set', 'viewport', String(w), String(h));
    assert.ok(await inspect(`Array.from(document.querySelectorAll('.calendar-icon-button, .calendar-group-button, .calendar-group-tabs button')).filter(b => b.checkVisibility()).every(b => { const r = b.getBoundingClientRect(); return r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; })`), `Event controls fit at ${w}`);
    await scrollPanels(`events-${w}`, 1);
    await ab('screenshot', `/tmp/calendar-event-controls-${w}.png`);
  }
  await click('Close event editor'); await click('Meals', 'tab');
  await click('Change interface language'); await click('Tiếng Việt');
  await click('Món yêu thích'); await click('Chọn Cơm');
  await click('Đánh dấu yêu thích'); await ab('wait', '--text', 'Đã lưu món yêu thích.');
  for (const [w, h] of [[1024, 768], [1180, 820], [820, 1180]]) {
    await ab('set', 'viewport', String(w), String(h)); await bounds(`favorites-vi-${w}`);
  }
  await click('Xong');
  const medicineVi = await inspect(`document.querySelector('.meal-row--medicine button').getAttribute('aria-label')`);
  await click(medicineVi); await click('Thêm thuốc'); await click('Thuốc nhỏ mắt / mũi', 'radio');
  await bounds('medicine-vi-820');
  assert.equal(await ab('errors'), '', 'no browser page errors');
  console.log('Favorites and all medicine methods fit the required laptop/iPad viewports.');
} catch (error) {
  console.error(await ab('snapshot', '-i'));
  await ab('screenshot', '/tmp/calendar-meals-failure.png');
  throw error;
} finally {
  for (session of sessions) await ab('close').catch(() => {});
  await server.close();
}
