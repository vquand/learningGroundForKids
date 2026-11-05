// Synthetic API only: no real accounts, data or provider requests.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
const exec = promisify(execFile);
const session = `calendar-editor-${process.pid}`;
const areas = ['study_morning', 'study_afternoon', 'study_extra', 'meal_breakfast', 'meal_lunch', 'meal_snack', 'meal_dinner', 'medicine'];
const empty = () => ({ id: null, items: [], revision: 0, source: 'empty' });
const emptyLists = () => Object.fromEntries(areas.map(area => [area, empty()]));
const templates = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [String(i + 1), emptyLists()]));
const subjects = ['math', 'vietnamese', 'english', 'science', 'art', 'music'];
const days = Array.from({ length: 14 }, (_, i) => {
  const date = new Date(Date.UTC(2026, 9, 26 + i)).toISOString().slice(0, 10);
  const lists = emptyLists();
  for (const area of ['study_morning', 'study_afternoon']) {
    const items = [...subjects.map(subject => ({ subject, teaching_language: 'en' })), ...Array.from({ length: i % 3 }, (_, j) => ({ subject: j ? 'club_coding' : 'club_chess' }))];
    lists[area] = { id: `${date}:${area}`, revision: 1, source: 'template', items };
    templates[String(i % 7 + 1)][area] = lists[area];
  }
  lists.meal_dinner = {id:`dinner-${i}`,revision:1,source:'template',items:[{food:'rice'},{food:'vegetables'},{food:'custom',icon:'fish',name:'Cá kho nhà làm'}]};
  return { date, weekday: i % 7 + 1, is_past: date < '2026-10-29', lists };
});
const events = [{ event_id: 'test-event', date: '2026-10-29', start_date: '2026-10-29', title: 'Chess class', icon_key: 'club_chess', repeat: 'none', repeat_ended_on: null, revision: 1 }];
const writes = [];
let peopleSettings={disabled_roles:[],revision:0};
const api = { name: 'calendar-editor-fixture', configureServer(server) {
  server.middlewares.use(async (req, res, next) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (!path.startsWith('/api/')) return next();
    res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
    const send = value => res.end(JSON.stringify(value));
    if (path.endsWith('/calendar/lists') && req.method === 'PUT') {
      let raw = ''; for await (const chunk of req) raw += chunk;
      const body = JSON.parse(raw); writes.push(body);
      const list = { id: 'saved', source: body.scope === 'template' ? 'template' : 'override', revision: 2, items: body.items };
      if (body.scope === 'template') templates[String(body.weekday)][body.area] = list;
      days.filter(day => body.scope === 'template' ? day.weekday === body.weekday && !day.is_past : day.date === body.date).forEach(day => { day.lists[body.area] = list; });
      for (const repeat of body.medicine_repeats ?? []) {
        for (const weekday of repeat.weekdays) {
          const previous = templates[String(weekday)][body.area];
          templates[String(weekday)][body.area] = { id: `repeat-${weekday}`, source: 'template', revision: previous.revision + 1, items: [...previous.items, repeat.item] };
          days.filter(day => day.weekday === weekday && !day.is_past).forEach(day => {
            const old = day.lists[body.area];
            day.lists[body.area] = { ...old, id: `repeat-${day.date}`, source: 'template', revision: old.revision + 1, items: [...old.items, repeat.item] };
          });
        }
      }
      return send(list);
    }
    if (path.endsWith('/parent/calendar-settings')) {
      if(req.method==='PUT'){let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw);peopleSettings={disabled_roles:body.disabled_roles,revision:peopleSettings.revision+1};}return send(peopleSettings);
    }
    if (path.endsWith('/calendar/participants')) return send({roles:['dad','mom','paternal_grandpa','paternal_grandma','maternal_grandpa','maternal_grandma','friend'].filter(key=>!peopleSettings.disabled_roles.includes(key)),profiles:[{profile_id:'sibling-1',name:'Bé Na',source:'family'},{profile_id:'friend-1',name:'Minh',source:'friend'}].filter(p => p.name.toLowerCase().includes(new URL(req.url,'http://localhost').searchParams.get('q')?.toLowerCase() ?? '')),has_more:false});
    if (path.endsWith('/calendar/events') && req.method === 'POST') {
      let raw = ''; for await (const chunk of req) raw += chunk;
      const body = JSON.parse(raw); writes.push(body);
      const event = { ...body, participants:body.participants?.map(p=>p.kind==='profile'?{...p,name:p.profile_id==='sibling-1'?'Bé Na':'Minh'}:p), event_id: `new-event-${events.length}`, date: body.start_date, revision: 1, repeat_ended_on: null }; events.push(event); res.statusCode = 201; return send(event);
    }
    if (path.endsWith('/calendar')) return send({ today: '2026-10-29', timezone: 'Asia/Ho_Chi_Minh', weeks: [{ start: days[0].date, days: days.slice(0, 7) }, { start: days[7].date, days: days.slice(7) }], templates, meal_library: [], study_library: [{ id: 'math-favorite', subject: 'math', name: 'Math A+' }], events, system_events: [{key:'halloween',date:'2026-10-31'}] });
    if (path.endsWith('/weather')) return send({ status: 'unavailable', location_label: null, updated_at: null, days: [] });
    if (path.endsWith('/notifications')) return send({ items: [] });
    return send({});
  });
} };
const server = await createServer({ configFile: false, root: fileURLToPath(new URL('..', import.meta.url)), cacheDir: '/tmp/calendar-editor-vite-cache', plugins: [react(), api], server: { host: '127.0.0.1', port: 5192, strictPort: true }, optimizeDeps: { include: ['react', 'react-dom/client', 'react/jsx-dev-runtime', 'react-router-dom', '@tanstack/react-query', 'zustand'] } });
const ab = async (...args) => (await exec('agent-browser', ['--session', session, ...args], { maxBuffer: 3e6 })).stdout.trim();
const inspect = async code => JSON.parse(await ab('eval', code));
async function ref(name, role = 'button', selector) {
  const { data } = JSON.parse(await ab('snapshot', '-i', ...(selector ? ['-s', selector] : []), '--json'));
  // refs also contains cached entries outside a scoped snapshot; follow the current tree's order only.
  const currentRefs = Object.entries(data.refs).filter(([key]) => data.snapshot.includes('ref=' + key + ']'));
  const found = currentRefs.find(([, r]) => r?.name.includes(name) && r.role === role);
  assert.ok(found, `Missing ${role} ${name}: ${data.snapshot}`); return `@${found[0]}`;
}
const click = async (name, role) => ab('click', await ref(name, role));
const chooseMathLanguage = async name => ab('click', await ref(name, 'button', '.calendar-button-group[aria-label="Teaching language for Math"]'));
async function bounds(label) {
  await ab('wait','--fn',`document.getAnimations().every(animation => animation.playState !== 'running')`);
  const bad = await inspect(`Array.from(document.querySelectorAll('button,input,select')).filter(e => {
    if (!e.checkVisibility() || getComputedStyle(e).opacity === '0' || e.closest('[inert]') || e.closest('.calendar-scroll-panel')) return false;
    const r = e.getBoundingClientRect(); if (r.width === 0 || r.height === 0) return false;
    if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) return true;
    const form = e.closest('.events-editor-form');
    if (form) {const box=form.getBoundingClientRect();if(r.bottom>box.bottom+1 || r.top<box.top-1)return true;}
    if (e.closest('[role=dialog]')) {
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (hit && !e.contains(hit)) return true;
    }
    return false;
  }).map(e => e.getAttribute('aria-label') || e.textContent)`);
  assert.deepEqual(bad, [], label);
  assert.equal(await inspect('document.documentElement.scrollHeight > innerHeight || document.documentElement.scrollWidth > innerWidth'), false, label);
  const overflowing=await inspect(`Array.from(document.querySelectorAll('.events-people-content > section,.events-people-content > .events-people-grid')).filter(e=>e.scrollHeight>e.clientHeight+1).map(e=>({text:e.textContent,height:e.clientHeight,content:e.scrollHeight}))`);
  assert.deepEqual(overflowing,[],`${label}: people sections contain their controls`);
  const overlaps=await inspect(`Array.from(document.querySelectorAll('.events-people-content')).flatMap(content=>{const rows=Array.from(content.children).map(e=>e.getBoundingClientRect()).filter(r=>r.height>0);return rows.slice(1).flatMap((r,i)=>r.top<rows[i].bottom-1?[{previous:rows[i].bottom,next:r.top}]:[]);})`);
  assert.deepEqual(overlaps,[],`${label}: people sections must not overlap`);
  await ab('screenshot', `/tmp/calendar-editor-${label}.png`);
}
async function rail(label) {
  const delta = await inspect(`(() => {
    const grid = document.querySelector('.calendar-study-grid,.meal-grid,.events-week');
    const week = document.querySelector('.calendar-week-toggle'), action = document.querySelector('.calendar-toolbar-button');
    const g = grid.getBoundingClientRect(), w = week.getBoundingClientRect();
    return { top: Math.abs(g.top-w.top), bottom: action ? Math.abs(g.bottom-action.getBoundingClientRect().bottom) : 0 };
  })()`);
  assert.ok(delta.top <= 1 && delta.bottom <= 1, `${label}: aligned rail ${JSON.stringify(delta)}`);
}
try {
  await server.listen();
  await ab('open', 'http://127.0.0.1:5192/tests/fixtures/calendar-meals.html'); await ab('snapshot', '-i');
  await ab('wait', '--text', 'My calendar');
  for (const [width, height] of [[1366,768],[1024,768],[1180,820],[1830,1330]]) {
    const size = `${width}x${height}`; await ab('set', 'viewport', String(width), String(height));
    await click('Study', 'tab'); await bounds(`study-${size}`); await rail(`study-${size}`);
    assert.equal(await inspect(`document.querySelector('.calendar-study-cell').querySelector('.calendar-club-section') === null`), true, 'a day without clubs keeps its full subject stack');
    const clubHeights = await inspect(`Array.from(document.querySelectorAll('.calendar-study-row')).slice(0,2).map(row => Array.from(row.querySelectorAll('.calendar-club-section.has-divider'), e=>e.getBoundingClientRect().height))`);
    assert.equal(await inspect(`Array.from(document.querySelectorAll('.calendar-club-section.has-divider')).every(section => Math.abs(section.getBoundingClientRect().bottom - section.lastElementChild.getBoundingClientRect().bottom) <= 1)`), true, 'club activities sit at the bottom of their shared section');
    for (const heights of clubHeights) assert.ok(Math.max(...heights) - Math.min(...heights) <= 1, 'club sections share one row height');
    await click('Edit Morning plan for 26 Oct');
    assert.equal(await inspect("!!document.querySelector('.calendar-palette,.calendar-scope-choice,.calendar-editor-actions .calendar-save-button')"), false, 'past dates hide all plan-edit controls');
    await bounds(`past-${size}`); await click('Done');
    await click('Edit Morning plan for 31 Oct');
    assert.equal(await inspect("document.querySelector('.calendar-group-tabs [aria-selected=true]').textContent"), 'Favorites');
    await click('Manage favorite subjects'); await bounds(`favorites-${size}`); await click('Done');
    await click('Subjects','tab'); await ab('fill', await ref('Search subjects','searchbox'), 'toan');
    assert.equal(await inspect("document.querySelectorAll('.calendar-palette-choice').length"), 1, 'accent insensitive search');
    await chooseMathLanguage('Unspecified');
    assert.equal(await inspect(`document.querySelector('.calendar-button-group [aria-pressed=true]').textContent`), 'N/A');
    await chooseMathLanguage('English'); await chooseMathLanguage('Vietnamese');
    assert.equal(await inspect(`document.querySelector('.calendar-button-group [aria-pressed=true]').textContent`), 'VI');
    assert.equal(await inspect(`Array.from(document.querySelectorAll('.calendar-button-group button')).every(button => {
      const r = button.getBoundingClientRect(), row = button.closest('li').getBoundingClientRect();
      return r.width >= 44 && r.height >= 44 && r.top >= row.top && r.bottom <= row.bottom && r.left >= row.left && r.right <= row.right;
    })`), true, 'all grouped buttons retain identical targets inside every subject row');
    assert.equal(await inspect(`Array.from(document.querySelectorAll('.calendar-study-order > li')).every(row => {
      const groups = Array.from(row.querySelectorAll('[role=group]'));
      return groups.length === 2 && groups[0].className === groups[1].className &&
        Array.from(row.querySelectorAll('button[aria-pressed], button[title]')).filter(button => button.closest('.calendar-button-group')).every(button => button.className === 'calendar-group-button');
    })`), true, 'language and arrow/remove groups use identical styling classes');
    await bounds(`editor-${size}`); await click('Save'); await ab('wait','--fn',`!document.querySelector('.calendar-editor')`);
    assert.equal(writes.at(-1).items[0].teaching_language, 'vi');
    await click('Edit Extra plan for 31 Oct'); await click('Subjects','tab');
    if (!await inspect(`!!document.querySelector('.calendar-study-order')`)) await click('Add Math to the list');
    await chooseMathLanguage('Unspecified');
    await click('Save'); await ab('wait','--fn',`!document.querySelector('.calendar-editor')`);
    assert.equal(writes.at(-1).area, 'study_extra');
    assert.equal(Object.hasOwn(writes.at(-1).items[0], 'teaching_language'), false);
    await click('Meals','tab'); await bounds(`meals-${size}`); await rail(`meals-${size}`);
    await click('Edit Medicine for 29 Oct'); await click('Add medicine');
    assert.equal(await inspect(`document.querySelector('.meal-medicine-dialog .calendar-group-button[aria-pressed=true]').textContent`), 'THU', 'the tapped weekday is initially selected');
    await click('Thursday');
    assert.equal(await inspect(`document.querySelector('.meal-medicine-dialog .calendar-save-button').disabled`), true, 'empty weekday selection cannot be added');
    await click('Monday'); await click('Wednesday'); await click('Friday');
    assert.equal(await inspect(`document.querySelectorAll('.meal-medicine-dialog .calendar-group-button[aria-pressed=true]').length`), 3, 'weekday selections are independent');
    await bounds(`medicine-weekdays-${size}`);
    const previousWrites = writes.length;
    await click('Add medicine');
    assert.equal(writes.length, previousWrites, 'the inner dialog only changes the draft');
    await click('Save'); await ab('wait','--fn',`!document.querySelector('.calendar-editor')`);
    assert.equal(writes.at(-1).area, 'medicine');
    assert.deepEqual(writes.at(-1).medicine_repeats[0].weekdays, [1,3,5]);
    assert.deepEqual(writes.at(-1).expected_medicine_revisions.map(row => row.weekday), [1,3,5]);
    await click('Next week','tab'); await bounds(`medicine-next-week-${size}`);
    assert.ok(await inspect(`Array.from(document.querySelectorAll('.meal-row--medicine button')).filter(button => /2 Nov|4 Nov|6 Nov/.test(button.getAttribute('aria-label'))).every(button => button.getAttribute('aria-label').includes('Tablet'))`), 'selected weekdays show the reminder in next week');
    await click('This week','tab');
    await click('Events','tab'); await bounds(`events-${size}`); await rail(`events-${size}`);
    await click('Arrange events for 29 Oct'); await bounds(`arrange-${size}`);
    await click('Chess class'); await bounds(`event-editor-${size}`);
    assert.equal(await inspect(`document.querySelector('.events-repeat')?.nextElementSibling?.matches('.events-people-picker')`),true,'Participant(s) follows Repeat inside the editor form');
    assert.equal(await inspect(`(() => { const e=document.querySelector('.events-icon-choice[aria-pressed=true]'), p=e.closest('.calendar-scroll-panel'), r=e.getBoundingClientRect(), b=p.getBoundingClientRect(); return r.top >= b.top-1 && r.bottom <= b.bottom+1; })()`), true, 'selected icon revealed');
    assert.equal(await inspect(`document.querySelectorAll('[role=dialog]').length`),1,'the event editor replaces the day prompt');
    await ab('wait','--fn',`Array.from(document.querySelectorAll('.events-people-picker button')).some(e=>e.textContent==='Dad')`);
    await bounds(`people-${size}`);
    await click('Dad'); await click('Mom'); await click('Mom'); await click('A friend');
    await click('Friends'); await bounds(`friends-${size}`);
    assert.equal(await inspect(`document.querySelectorAll('[role=dialog]').length`),1,'Friends expands inline without another popup');
    await click('Bé Na');
    await ab('fill', await ref('Find a child by name','searchbox'), 'Minh');
    await ab('wait','--fn',`document.querySelector('.events-friend-choices')?.textContent.includes('Minh') && !document.querySelector('.events-friend-choices')?.textContent.includes('Bé Na')`);
    await click('Minh');
    assert.equal(await inspect(`document.querySelector('.events-people-picker h3').textContent`),'Participant(s)');
    assert.equal(await inspect(`document.querySelectorAll('.events-people-options button[aria-pressed=true]:not([aria-expanded])').length`),4,'selected participants stay in the draft');
    await bounds(`selected-participants-${size}`);
    assert.equal(await inspect(`new Set(Array.from(document.querySelectorAll('.events-people-picker button[aria-pressed]'),e=>e.className)).size`),1,'relative, child and Friends chips share exactly one class');
    await ab('press','Escape');
    assert.equal(await inspect(`!!document.querySelector('.events-editor') && !document.querySelector('.events-people-friends')`),true,'Escape collapses the inline Friends list and keeps the draft');
    await click('Cancel');
    await click('Arrange events for 29 Oct');await click('Add event');
    assert.equal(await inspect("document.querySelector('input[type=date]').value"), '2026-10-29', 'Add event uses the tapped date');
    assert.equal(await inspect(`document.querySelector('.events-day-dialog') === null`),true,'Add event dismisses the day manager before opening the editor');
    if (width === 1830) {
      await ab('fill', await ref('Event name','textbox'), 'At home practice');
      await click('Study','tab'); await click('Math');
      await click('Dad');await click('Friends');await click('Bé Na');
      await click('Save');
      await ab('wait','--fn',`!document.querySelector('.events-editor')`);
      assert.equal(writes.at(-1).start_date, '2026-10-29');
      assert.deepEqual(writes.at(-1).participants,[{kind:'role',key:'dad'},{kind:'profile',profile_id:'sibling-1'}]);
      assert.equal(await inspect(`document.querySelector('.events-day[data-day="2026-10-29"]').textContent.includes('At home practice')`), true, 'new event appears on the calendar');
    } else await click('Cancel');
    await ab('wait','--fn',`document.activeElement?.getAttribute('aria-label') === 'Arrange events for 29 Oct'`);
    await click('Arrange events for 30 Oct');await ab('wait','--text','Empty day');
    await click('Add event');
    assert.equal(await inspect(`document.querySelector('.events-day-dialog') === null && document.querySelector('.events-editor input[type=date]').value === '2026-10-30'`),true,'empty day prompt is replaced by the editor for that date');
    await click('Cancel');
    await ab('wait','--fn',`document.activeElement?.getAttribute('aria-label') === 'Arrange events for 30 Oct'`);
    console.log(`${size}: rail, grouped clubs, past date, favorites, search, language, Extra and event dialogs pass`);
  }
  await click('Next week','tab'); await click('Study','tab'); await bounds('next-week'); await rail('next-week');
  await click('Edit Extra plan for 7 Nov'); await bounds('next-week-extra'); await click('Cancel');
  await ab('download',await ref('Share'),'/tmp/calendar-share-uat.pdf');
  await ab('open','http://127.0.0.1:5192/tests/fixtures/calendar-meals.html?parent=1');await ab('snapshot','-i');
  await ab('wait','--text','Family members in events');await click('Family members in events');
  await ab('wait','--text','Paternal grandfather');
  for(const [width,height] of [[1366,768],[1024,768],[1180,820],[1830,1330]]) {await ab('set','viewport',String(width),String(height));await bounds(`parent-people-settings-${width}x${height}`);}
  await click('Dad');await click('Maternal grandmother');await click('Save');
  await ab('wait','--fn',`!document.querySelector('.events-people-dialog')`);
  assert.deepEqual(peopleSettings.disabled_roles,['dad','maternal_grandma']);
  await click('Family members in events');
  assert.equal(await inspect(`Array.from(document.querySelectorAll('.events-people-grid button[aria-pressed=false]')).map(e=>e.textContent).join(',')`),'Dad,Maternal grandmother');
  await click('Cancel');
  await ab('open','http://127.0.0.1:5192/tests/fixtures/calendar-meals.html');await ab('snapshot','-i');await ab('wait','--text','My calendar');
  await click('Events','tab');await click('Add event');await ab('wait','--fn',`Array.from(document.querySelectorAll('.events-people-picker button')).some(e=>e.textContent==='Mom')`);
  assert.equal(await inspect(`Array.from(document.querySelectorAll('.events-people-options button')).some(e=>e.textContent==='Dad'||e.textContent==='Maternal grandmother')`),false);
  await click('Friends');await ab('press','Escape');
  assert.equal(await inspect(`!!document.querySelector('.events-editor') && !document.querySelector('.events-people-friends')`),true,'Escape closes the inline friends list');
  await click('Cancel');
  const consoleLog = await ab('console'); assert.ok(!consoleLog.includes('[error]'), consoleLog);
  const errors = await ab('errors'); assert.ok(!errors || /No page errors/.test(errors), errors);
  const requests = await ab('network','requests'); assert.ok(!requests.includes('open-meteo'), 'no browser provider traffic');
  console.log('Calendar browser checks passed.');
} finally { await ab('close').catch(() => {}); await server.close(); }
