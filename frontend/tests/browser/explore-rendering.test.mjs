import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { productionFixture, ready, viewports } from './explore-performance.mjs';
import { preparedMapFixture } from './explore-map-api-fixture.mjs';

const out = '/tmp/plg-explore-regression';
let fixture, browser;
before(async () => {
  await mkdir(out, { recursive: true });
  fixture = await productionFixture(out, process.env.PLG_EXPLORE_BUILD_DIR);
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLG_CHROMIUM_EXECUTABLE });
});
after(async () => { await browser?.close(); await fixture?.close(); });

async function open(viewport, name = 'catalog') {
  const context = await browser.newContext({ viewport, hasTouch: true, extraHTTPHeaders: { 'x-explore-fixture': name } });
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.stack ?? e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${fixture.origin}/map`); await ready(page);
  await page.waitForTimeout(350); // Entrance animation must finish before hit-testing.
  return { context, page, errors };
}

async function controlsFit(page) {
  const failures = await page.evaluate(() => {
    const errors = [];
    if (document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight) errors.push('page scrolls');
    const controls = document.querySelectorAll('.explore-page button, .explore-page .kid-back, .ui-language button, .item-detail-titlebar button, .leaflet-popup-close-button');
    for (const button of controls) {
      if (!button.getClientRects().length) continue;
      const r = button.getBoundingClientRect();
      const name = button.getAttribute('aria-label') ?? button.textContent.trim();
      if (r.left < 0 || r.top < 0 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) errors.push(`${name}: outside viewport`);
      if (r.width < 43 || r.height < 43) errors.push(`${name}: small touch target ${r.width}x${r.height}`);
      const target = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      if (target && !button.contains(target)) errors.push(`${name}: covered by ${target.tagName}.${target.className}`);
    }
    return errors;
  });
  assert.deepEqual(failures, []);
}

async function startSurfaceWatch(page) {
  await page.evaluate(() => {
    const watch = window.surfaceWatch = { running: true, frames: 0, failures: [] };
    const tick = () => {
      if (!watch.running) return;
      const svg = document.querySelector('.illustrated-earth');
      const group = svg?.querySelector('[data-outline-bounds]');
      if (svg && group) {
        const matrix = svg.getScreenCTM().inverse();
        const a = new DOMPoint(0, 0).matrixTransform(matrix);
        const b = new DOMPoint(innerWidth, innerHeight).matrixTransform(matrix);
        const [left, top, right, bottom] = group.dataset.outlineBounds.split(' ').map(Number);
        const visible = { left: Math.max(0, a.x), top: Math.max(0, a.y), right: Math.min(720, b.x), bottom: Math.min(360, b.y) };
        if (visible.left < visible.right && visible.top < visible.bottom &&
          (left > visible.left + 1e-5 || top > visible.top + 1e-5 || right < visible.right - 1e-5 || bottom < visible.bottom - 1e-5)) {
          if (watch.failures.length < 5) watch.failures.push({ left, top, right, bottom, visible });
        }
        const clip = group.getAttribute('clip-path');
        const id = clip?.match(/#([^)]*)/)?.[1];
        const rect = document.getElementById(id)?.querySelector('rect');
        if (getComputedStyle(svg).overflow !== 'visible' || rect?.getAttribute('width') !== '720' || rect?.getAttribute('height') !== '360') {
          if (watch.failures.length < 5) watch.failures.push('canonical world clip or animation coverage missing');
        }
        watch.frames++;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

async function stopSurfaceWatch(page) {
  const watch = await page.evaluate(() => { window.surfaceWatch.running = false; return window.surfaceWatch; });
  assert.ok(watch.frames > 10, 'animation coverage must be sampled across real frames');
  assert.deepEqual(watch.failures, []);
}

for (const viewport of viewports) test(`Explore controls and geography remain usable at ${viewport.width}x${viewport.height}`, async () => {
  const { context, page, errors } = await open(viewport);
  try {
    await controlsFit(page);
    const countryPaint = await page.evaluate(() => {
      const fill = document.querySelector('.illustrated-earth__countries path');
      const stroke = fill.hasAttribute('stroke') ? fill : fill.nextElementSibling;
      return { order: getComputedStyle(fill).paintOrder, fill: fill.getAttribute('fill'),
        split: stroke !== fill, strokeFill: stroke.getAttribute('fill'), stroke: stroke.getAttribute('stroke') };
    });
    // The existing custom pane is outside .leaflet-overlay-pane: its scoped
    // stroke-first CSS does not apply. Preserve the actual fill-then-stroke art.
    assert.equal(countryPaint.order, 'normal');
    assert.notEqual(countryPaint.fill, 'none');
    if (countryPaint.split) assert.equal(countryPaint.strokeFill, 'none');
    assert.equal(countryPaint.stroke, '#64584f');
    await page.screenshot({ path: `${out}/overview-${viewport.width}.png` });
    await startSurfaceWatch(page);
    const singleId = await page.evaluate(() => [...document.querySelectorAll('.leaflet-marker-pane [data-item-id]')].find(node => {
      const r = node.getBoundingClientRect(); return r.x > 100 && r.right < innerWidth - 100 && r.y > 150 && r.bottom < innerHeight - 150;
    })?.getAttribute('data-item-id'));
    assert.ok(singleId, 'catalog must expose an isolated overview marker for preview fly-to');
    await page.locator(`[data-item-id="${singleId}"]`).dispatchEvent('click');
    await page.waitForFunction(() => window.exploreMap.getZoom() === 4);
    await page.waitForTimeout(100);
    assert.deepEqual(errors, [], 'overview fly-to');
    await page.waitForFunction(() => !window.exploreMap._panAnim?._inProgress);
    await page.waitForTimeout(100);
    await controlsFit(page);
    await page.locator('.leaflet-popup-close-button').click();
    await page.evaluate(() => { window.exploreMap.setView([20, 0], 11, { animate: false }); });
    await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
    await page.waitForTimeout(350);
    await page.mouse.move(viewport.width * .65, viewport.height * .55);
    await page.mouse.wheel(0, 96);
    await page.waitForTimeout(400);
    const cdp = await context.newCDPSession(page);
    const x = viewport.width * .65, y = viewport.height * .55;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x - 100, y, id: 0 }, { x: x + 100, y, id: 1 }] });
    for (let step = 1; step <= 20; step++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 100 + step * 2, y, id: 0 }, { x: x + 100 - step * 2, y, id: 1 }] });
      await page.waitForTimeout(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(400);
    await stopSurfaceWatch(page);
    assert.deepEqual(errors, [], 'zoom gestures');
    await page.getByRole('button', { name: 'Filter by Animal', exact: true }).click();
    await page.getByRole('button', { name: 'Filter by Food', exact: true }).click();
    assert.equal(await page.locator('.explore-category[aria-pressed=true]').count(), 2);
    await controlsFit(page);
    await page.getByRole('button', { name: 'Filter by Food', exact: true }).click();
    await page.getByRole('button', { name: 'Filter by Animal', exact: true }).click();
    await page.locator('.explore-timeline button[aria-expanded]').first().click();
    const year = page.locator('.era-expand button').first();
    const yearLabel = await year.getAttribute('aria-label');
    await year.click();
    assert.notEqual(await page.evaluate(() => window.exploreTest.filters.getState().activeYear), null, yearLabel);
    await controlsFit(page);
    await page.getByRole('button', { name: 'Clear era filter', exact: true }).click();
    assert.equal(await page.evaluate(() => window.exploreTest.filters.getState().activeYear), null);
    // Check geographic registration against Leaflet at fractional and deep zoom,
    // after large moves, at both date-line edges and near the Mercator poles.
    for (const [lat, lng, zoom] of [[20, 0, 2], [50, 12, 4.75], [20, 0, 11], [20, 0, 18], [70, 179, 5], [-70, -179, 5]]) {
      await page.evaluate(([lat, lng, zoom]) => { window.exploreMap.setView([lat, lng], zoom, { animate: false }); }, [lat, lng, zoom]);
      await page.waitForTimeout(50);
      const alignment = await page.evaluate(() => {
        const map = window.exploreMap, svg = document.querySelector('.illustrated-earth');
        const view = svg.viewBox.baseVal, rect = svg.getBoundingClientRect();
        const center = map.getCenter();
        const sine = Math.sin(center.lat * Math.PI / 180);
        const point = new DOMPoint((center.lng + 180) * 2, (.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * 360);
        const screen = point.matrixTransform(svg.getScreenCTM());
        const expected = map.latLngToContainerPoint(center), container = map.getContainer().getBoundingClientRect();
        return { width: rect.width, height: rect.height, xError: Math.abs(screen.x - expected.x - container.x),
          yError: Math.abs(screen.y - expected.y - container.y), valid: view.width > 0 && view.height > 0,
          cover: rect.left <= 0 && rect.right >= innerWidth && rect.top <= 0 && rect.bottom >= innerHeight };
      });
      assert.ok(alignment.width <= viewport.width + 514, `oversized SVG at zoom ${zoom}: ${alignment.width}px`);
      assert.ok(alignment.height <= viewport.height + 514, `oversized SVG at zoom ${zoom}: ${alignment.height}px`);
      // At z18 Chromium exposes a float32 SVG CTM with translations around
      // 33 million pixels; allow its <2px quantization only at that scale.
      const tolerance = zoom === 18 ? 2 : 1;
      assert.ok(alignment.valid && alignment.xError < tolerance && alignment.yError < tolerance, `${zoom}: ${JSON.stringify(alignment)}`);
      if (zoom >= 11) assert.ok(alignment.cover, 'deep-zoom artwork must cover the map after a move');
    }
    assert.deepEqual(errors, [], 'bounds registration');
    await page.screenshot({ path: `${out}/geography-${viewport.width}.png` });
    await page.evaluate(() => { window.exploreMap.setView([20, 0], 11, { animate: false }); });
    await startSurfaceWatch(page);
    await page.mouse.move(viewport.width * .85, viewport.height * .5);
    await page.mouse.down();
    for (let step = 1; step <= 20; step++) {
      await page.mouse.move(viewport.width * .85 - step * 25, viewport.height * .5);
      await page.waitForTimeout(16);
    }
    await page.mouse.up();
    await page.waitForTimeout(350);
    await stopSurfaceWatch(page);
    const anchor = await page.evaluate(({ x, y }) => window.exploreMap.containerPointToLatLng([x, y]), { x: viewport.width * .65, y: viewport.height * .5 });
    await page.mouse.move(viewport.width * .65, viewport.height * .5);
    await page.mouse.wheel(0, -96);
    await page.waitForFunction(() => window.exploreMap.getZoom() > 11);
    await page.waitForTimeout(300);
    const anchorError = await page.evaluate(({ anchor, x, y }) => window.exploreMap.latLngToContainerPoint(anchor).distanceTo([x, y]),
      { anchor, x: viewport.width * .65, y: viewport.height * .5 });
    assert.ok(anchorError < 2, `wheel anchor moved ${anchorError}px`);
    const item = fixture.fixtures.catalog[0];
    await page.evaluate(item => { window.exploreMap.setView([item.latitude, item.longitude], 18, { animate: false }); }, item);
    const marker = page.locator(`[data-item-id="${item.id}"]`); await marker.waitFor();
    await marker.dispatchEvent('click');
    await page.getByRole('button', { name: /View detail/i }).waitFor();
    await page.waitForFunction(() => Object.values(window.exploreMap._layers).some(layer => layer.getElement?.()?.classList.contains('map-item-preview-popup') && layer.options.autoPan));
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.leaflet-popup')).opacity) >= .99);
    await controlsFit(page);
    await page.screenshot({ path: `${out}/preview-${viewport.width}.png` });
    await page.getByRole('button', { name: /View detail/i }).click();
    await page.locator('.item-detail-titlebar').waitFor();
    await page.getByRole('img', { name: 'Completed', exact: true }).waitFor();
    await controlsFit(page);
    await page.screenshot({ path: `${out}/detail-${viewport.width}.png` });
    const requests = fixture.requests.filter(r => r.path === '/api/v1/items').length;
    await page.getByRole('button', { name: 'Back', exact: true }).click(); await ready(page);
    assert.equal(fixture.requests.filter(r => r.path === '/api/v1/items').length, requests);
    assert.equal(await page.evaluate(() => window.exploreMap.getZoom()), 18);
    // A real touch tap opens details directly, with no preview-only badge award.
    await page.locator(`[data-item-id="${item.id}"]`).tap();
    await page.locator('.item-detail-titlebar').waitFor();
    await page.getByRole('button', { name: 'Back', exact: true }).click(); await ready(page);
    // Each child's camera remains isolated across map remounts.
    await page.evaluate(() => { window.exploreMap.setView([40, -75], 6.25, { animate: false }); });
    await page.evaluate(() => { window.exploreTest.profiles.setState({ activeProfileId: 'kid-b' }); });
    await page.waitForFunction(() => window.exploreMap.getZoom() === 2);
    await page.evaluate(() => { window.exploreTest.profiles.setState({ activeProfileId: 'kid-a' }); });
    await page.waitForFunction(() => window.exploreMap.getZoom() === 6.25);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

for (const viewport of viewports) test(`dense cluster navigation works at ${viewport.width}x${viewport.height}`, async () => {
  const { context, page, errors } = await open(viewport, 'dense');
  try {
    const before = await page.evaluate(() => window.exploreMap.getZoom());
    const cluster = page.locator('.leaflet-marker-pane .map-cluster-marker').first();
    const box = await cluster.boundingBox();
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    assert.ok(await cluster.evaluate((el, point) => el.contains(document.elementFromPoint(point.x, point.y)), point), 'cluster must receive pointer input');
    // Hit-test and click viewport coordinates to exercise real pointer handling.
    await page.mouse.click(point.x, point.y);
    await page.waitForFunction(zoom => window.exploreMap.getZoom() > zoom, before);
    await page.waitForTimeout(350);
    await controlsFit(page);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('20 dense filter/pan/zoom cycles retain correct markers and bounded listeners/resources', async () => {
  const { context, page, errors } = await open(viewports[0], 'dense');
  const cdp = await context.newCDPSession(page);
  try {
    await page.evaluate(() => { window.exploreMap.setZoom(3, { animate: false }); window.exploreMap.setZoom(2, { animate: false }); });
    await ready(page);
    const snapshot = async () => {
      await cdp.send('HeapProfiler.collectGarbage');
      return { ...await cdp.send('Memory.getDOMCounters'), ...await page.evaluate(() => {
        const map = window.exploreMap;
        const markers = [...document.querySelectorAll('.leaflet-marker-pane > *')];
        return { layers: Object.keys(map._layers).length,
          handlers: Object.values(map._events).reduce((n, handlers) => n + handlers.length, 0),
          events: Object.fromEntries(Object.entries(map._events).map(([name, handlers]) => [name, handlers.map(h => h.fn.name)])),
          ids: markers.map(m => m.querySelector('[data-explore-node]')?.getAttribute('data-explore-node') ?? m.querySelector('[data-item-id]')?.getAttribute('data-item-id')).sort(),
          count: markers.reduce((n, m) => n + Number(m.querySelector('[data-cluster] > span[aria-hidden=true]')?.textContent ?? 1), 0) };
      }) };
    };
    const before = await snapshot();
    const filteredTotal = fixture.fixtures.dense.filter(item => item.category === 'animal' && item.start_year === 1500).length;
    for (let cycle = 0; cycle < 20; cycle++) {
      await page.evaluate(cycle => {
        window.exploreMap.setView([20.12, .1], cycle % 2 ? 11 : 5, { animate: false });
        window.exploreTest.filters.getState().toggleCategory('animal');
        window.exploreTest.filters.getState().setActiveYear(1500);
      }, cycle);
      await ready(page);
      // Check exact filtered membership in a full-world view; viewport views at
      // deep zoom intentionally contain only the visible prepared features.
      await page.evaluate(() => window.exploreMap.setView([20, 0], 2, { animate: false }));
      await page.waitForFunction(total => {
        const markers = [...document.querySelectorAll('.leaflet-marker-pane > *')];
        return !document.querySelector('.explore-map-status') && markers.reduce((n, m) => n + Number(m.querySelector('[data-cluster] > span[aria-hidden=true]')?.textContent ?? 1), 0) === total;
      }, filteredTotal);
      await page.evaluate(() => { window.exploreTest.filters.getState().clearFilters(); window.exploreTest.filters.getState().clearEra(); });
      await page.waitForFunction(() => document.querySelector('[data-cluster] > span[aria-hidden=true]')?.textContent === '4000');
    }
    await page.evaluate(() => { window.exploreMap.setView([20, 0], 2, { animate: false }); });
    await page.waitForTimeout(100);
    const after = await snapshot();
    await writeFile(`${out}/resource-cycles.json`, JSON.stringify({ before, after }, null, 2));
    assert.deepEqual(after.ids, before.ids);
    assert.equal(after.count, 4000);
    assert.equal(after.ids.length, 1, 'overview renders one prepared cluster rather than 4,000 item markers');
    assert.equal(after.handlers, before.handlers);
    assert.equal(after.layers, before.layers);
    assert.ok(after.nodes <= before.nodes + 500, `DOM nodes grew ${before.nodes} -> ${after.nodes}`);
    assert.ok(after.jsEventListeners <= before.jsEventListeners + 20, `listeners grew ${before.jsEventListeners} -> ${after.jsEventListeners}`);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('opening and closing a deep-zoom preview does not recreate prepared markers', async () => {
  const { context, page, errors } = await open(viewports[0]);
  try {
    const item = fixture.fixtures.catalog[0];
    await page.evaluate(item => window.exploreMap.setView([item.latitude, item.longitude], 18, { animate: false }), item);
    await ready(page);
    await page.locator(`[data-item-id="${item.id}"]`).waitFor();
    await page.evaluate(() => {
      window.markerBirths = 0;
      window.exploreTest.L.Marker.addInitHook(() => window.markerBirths++);
      window.previewMarkers = [...document.querySelectorAll('.leaflet-marker-pane > *')];
    });
    await page.locator(`[data-item-id="${item.id}"]`).dispatchEvent('click');
    await page.getByRole('button', { name: /View detail/i }).waitFor();
    await page.waitForFunction(() => !window.exploreMap._panAnim?._inProgress);
    await page.locator('.leaflet-popup-close-button').click();
    await ready(page);
    assert.equal(await page.evaluate(() => window.markerBirths), 0);
    assert.ok(await page.evaluate(() => window.previewMarkers.every(marker => marker.isConnected)));
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('late private views cannot cross child or family/session changes and never enter IndexedDB', async () => {
  const { context, page, errors } = await open(viewports[0]);
  let release;
  try {
    const pending = new Promise(resolve => { release = resolve; });
    await page.route('**/api/v1/items/map/views?*', async route => {
      const params = new URL(route.request().url()).searchParams, profile = params.get('profile_id');
      if (profile === 'kid-b') await pending;
      const id = profile === 'kid-b' ? 'private-late-b' : 'private-current-c';
      await route.fulfill({ json: { version: 'b'.repeat(64), validator: 'c'.repeat(64), shared: false, total: 1, zoom: 2, next_offset: null, timeline: [],
        features: [{ id: 0, count: 1, latitude: 20, longitude: 0, bounds: [0, 20, 0, 20], expansionZoom: 19,
          item: { id, title: id, category: 'food', latitude: 20, longitude: 0, icon_slug: 'food', has_quiz: false, quiz_required: false } }] } });
    });
    await page.evaluate(() => window.exploreTest.profiles.setState({ activeProfileId: 'kid-b' }));
    await page.locator('.explore-map-status').waitFor();
    assert.equal(await page.locator('.leaflet-marker-pane > *').count(), 0, 'old child map clears while current authorization is pending');
    await page.evaluate(() => {
      window.exploreTest.family.setState({ familyId: 'family-c', sessionGeneration: 2 });
      window.exploreTest.profiles.setState({ activeProfileId: 'kid-c' });
    });
    await page.locator('[data-item-id="private-current-c"]').waitFor();
    release();
    await ready(page);
    assert.equal(await page.locator('[data-item-id="private-late-b"]').count(), 0);
    const stored = await page.evaluate(() => new Promise((resolve, reject) => {
      const request = indexedDB.open('plg-explore-common-v1', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction('views'), rows = tx.objectStore('views').getAll();
        tx.oncomplete = () => { db.close(); resolve(rows.result); };
      };
    }));
    assert.ok(stored.length > 0 && stored.length <= 16);
    assert.ok(stored.every(row => row.value.shared === true));
    assert.doesNotMatch(JSON.stringify(stored), /private-late-b|private-current-c|kid-[abc]|family-[ac]|done_item_ids|wip_item_ids/);
    assert.deepEqual(errors, []);
  } finally { release?.(); await context.close(); }
});

for (const viewport of viewports) test(`coincident cluster pages fit and collapse when a leaf is selected at ${viewport.width}`, async () => {
  const { context, page, errors } = await open(viewport);
  try {
    const members = fixture.fixtures.catalog.filter(i => i.latitude === -25 && i.longitude === 133);
    assert.ok(members.length > 24);
    await page.evaluate(() => window.exploreMap.setView([-25, 133], 18, { animate: false }));
    await ready(page);
    const cluster = page.getByRole('button', { name: `Expand cluster with ${members.length} items`, exact: true });
    await cluster.waitFor();
    // Hit-test the rendered viewport position, then send a real pointer click.
    const point = await cluster.evaluate(el => { const r = el.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
      return { x, y, receives: el.contains(document.elementFromPoint(x, y)) }; });
    assert.ok(point.receives, 'coincident cluster must receive pointer input');
    await page.mouse.click(point.x, point.y);
    const pager = page.getByRole('group', { name: 'Map items', exact: true });
    await pager.waitFor(); await controlsFit(page);
    assert.ok((await pager.innerText()).includes(`1–12 / ${members.length}`));
    const first = await page.locator('.leaflet-marker-pane [data-item-id]').evaluateAll(nodes => nodes.map(n => n.getAttribute('data-item-id')));
    await pager.getByRole('button', { name: 'Next', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.explore-cluster-pages')?.textContent.includes('13–24'));
    await controlsFit(page);
    const second = await page.locator('.leaflet-marker-pane [data-item-id]').evaluateAll(nodes => nodes.map(n => n.getAttribute('data-item-id')));
    assert.equal(first.filter(id => second.includes(id)).length, 0, 'leaf pages do not repeat membership');
    await page.locator('.leaflet-marker-pane [data-item-id]').first().dispatchEvent('click');
    await page.getByRole('button', { name: /View detail/i }).waitFor();
    assert.equal(await pager.count(), 0);
    assert.equal(await page.locator('.leaflet-overlay-pane path').count(), 0, 'spider legs disappear on selection');
    await controlsFit(page);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('a preview stays on the selected adjacent world copy at either dateline edge', async () => {
  const { context, page, errors } = await open(viewports[0]);
  try {
    const items = [-179.5, 179.5].map((longitude, i) => ({ id: `seam-${i}`, latitude: 0, longitude, title: `Seam ${i}`, category: 'food', icon_slug: 'food', quiz_required: false }));
    await page.route('**/api/v1/items/map/views?*', async route => route.fulfill({ json: await preparedMapFixture(new URL(route.request().url()), items) }));
    for (const [center, id] of [[179, 'seam-0'], [-179, 'seam-1']]) {
      await page.evaluate(center => { window.exploreMap.setMaxBounds(null); window.exploreMap.setView([0, center], 8, { animate: false }); }, center);
      await ready(page);
      await page.locator(`[data-item-id="${id}"]`).dispatchEvent('click');
      await page.getByRole('button', { name: /View detail/i }).waitFor();
      await page.waitForFunction(() => !window.exploreMap._panAnim?._inProgress && !window.exploreMap._animatingZoom);
      assert.ok(Math.abs(await page.evaluate(() => window.exploreMap.getCenter().lng) - center) < 10, 'preview must not pan around the globe');
      await controlsFit(page);
      await page.locator('.leaflet-popup-close-button').click();
    }
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

for (const viewport of viewports) test(`canonical dateline previews fit with default world bounds at ${viewport.width}`, async () => {
  const { context, page, errors } = await open(viewport);
  try {
    const items = [-179.5, 179.5].map((longitude, i) => ({ id: `edge-${i}`, latitude: 0, longitude, title: `Edge ${i} ${'A long learning title '.repeat(20)}`, category: 'food', icon_slug: 'food', quiz_required: false }));
    await page.route('**/api/v1/items/map/views?*', async route => route.fulfill({ json: await preparedMapFixture(new URL(route.request().url()), items) }));
    for (const item of items) {
      await page.evaluate(item => window.exploreMap.setView([item.latitude, item.longitude], 8, { animate: false }), item);
      await page.locator(`[data-item-id="${item.id}"]`).waitFor();
      await page.locator(`[data-item-id="${item.id}"]`).dispatchEvent('click');
      await page.getByRole('button', { name: /View detail/i }).waitFor();
      await page.waitForFunction(() => Object.values(window.exploreMap._layers).some(layer => layer.getElement?.()?.classList.contains('map-item-preview-popup') && layer.options.autoPan));
      await page.evaluate(() => new Promise(resolve => {
        let stable = 0;
        const tick = () => { stable = !window.exploreMap._panAnim?._inProgress && !window.exploreMap._animatingZoom ? stable + 1 : 0; if (stable >= 4) resolve(); else requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
      }));
      await page.waitForFunction(() => {
        const button = document.querySelector('.map-item-preview-popup button');
        if (!button) return false;
        const r = button.getBoundingClientRect();
        return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight;
      });
      await controlsFit(page);
      await page.locator('.leaflet-popup-close-button').click();
    }
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});
