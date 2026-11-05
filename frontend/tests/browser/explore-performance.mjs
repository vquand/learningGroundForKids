import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, readdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';
import { exploreFixtures, apiFixture } from './explore-performance-fixtures.mjs';
import { preparedMapFixture } from './explore-map-api-fixture.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
export const viewports = [{ width: 1366, height: 768 }, { width: 1024, height: 768 }, { width: 1180, height: 820 }];
export const percentile = (samples, p) => {
  if (!samples.length) return null;
  return [...samples].sort((a, b) => a - b)[Math.ceil(p * samples.length) - 1];
};

export async function buildHash(dist) {
  const hash = createHash('sha256');
  for (const file of (await readdir(dist, { recursive: true, withFileTypes: true })).filter(f => f.isFile())
    .map(f => resolve(f.parentPath, f.name)).sort()) {
    hash.update(file.slice(dist.length)); hash.update(await readFile(file));
  }
  return hash.digest('hex');
}

export async function productionFixture(out, existingBuild) {
  const dist = existingBuild ?? resolve(out, 'build');
  if (!existingBuild) await build({ root, configFile: false, plugins: [react()], logLevel: 'warn',
    build: { outDir: dist, emptyOutDir: true, copyPublicDir: false,
      rollupOptions: { input: resolve(root, 'tests/browser/explore-performance-harness.html') } } });
  const fixtures = await exploreFixtures();
  const files = new Map();
  const requests = [];
  const server = createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url, 'http://localhost'), path = requestUrl.pathname;
      const fixture = req.headers['x-explore-fixture'] ?? 'catalog';
      requests.push({ path, fixture, time: Date.now() });
      if (path === '/favicon.ico') { res.writeHead(204).end(); return; }
      if (path.startsWith('/api/')) {
        const response = path.startsWith('/api/v1/items/map/') ? await preparedMapFixture(requestUrl, fixtures[fixture]) : apiFixture(path, fixtures[fixture]);
        const body = gzipSync(JSON.stringify(response));
        res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip', 'Cache-Control': 'no-store' });
        res.end(body); return;
      }
      const asset = path.includes('.') ? path : '/tests/browser/explore-performance-harness.html';
      if (!files.has(asset)) {
        let file = resolve(dist, `.${asset}`);
        assert.ok(file.startsWith(dist + sep));
        let body;
        try { body = await readFile(file); }
        catch { file = resolve(root, 'public', `.${asset}`); assert.ok(file.startsWith(resolve(root, 'public') + sep)); body = await readFile(file); }
        files.set(asset, gzipSync(body));
      }
      const types = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp' };
      res.writeHead(200, { 'Content-Type': types[extname(asset)] ?? 'application/octet-stream', 'Content-Encoding': 'gzip', 'Cache-Control': 'public, max-age=3600' });
      res.end(files.get(asset));
    } catch (error) { res.writeHead(500).end(String(error)); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { origin: `http://127.0.0.1:${server.address().port}`, fixtures, requests, buildHash: await buildHash(dist),
    close: () => new Promise(resolve => server.close(resolve)) };
}

export async function ready(page) {
  await page.waitForFunction(() => {
    const map = window.exploreMap;
    if (!map || !document.querySelector('.illustrated-earth') || !document.querySelector('.map-zoom-controls')) return false;
    const controls = [...document.querySelectorAll('.explore-page button, .explore-page .kid-back')].filter(el => el.getClientRects().length);
    if (!controls.length || controls.some(el => {
      const r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return r.left < 0 || r.top < 0 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || !hit || !el.contains(hit);
    })) return false;
    const group = Object.values(map._layers).find(l => l.getLayers && l.getVisibleParent);
    return (group ? group.getLayers().length > 0 : !document.querySelector('.explore-map-status')) && document.querySelector('.leaflet-marker-pane > *') &&
      [...document.querySelectorAll('.leaflet-marker-pane img')].every(img => img.complete && img.naturalWidth);
  });
  return page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now())))));
}

function installProbe() {
  const probe = window.exploreProbe = { frames: [], frameIntervals: [], windows: [], inputPaintProxy: [], tasks: [], active: false, start: 0, end: 0, sequence: 0, markerBirths: { item: 0, cluster: 0, all: 0 } };
  // The same init probe works with the preserved prebuilt baseline and current
  // harness. Count constructed markers, including ones never added to the DOM.
  let harness;
  Object.defineProperty(window, 'exploreTest', { configurable: true, get: () => harness, set(value) {
    harness = value;
    value.L.Marker.addInitHook(function () {
      probe.markerBirths.all++;
      const name = this.options.icon?.options.className ?? '';
      if (name.includes('map-item-marker')) probe.markerBirths.item++;
      if (name.includes('map-cluster-marker')) probe.markerBirths.cluster++;
    });
  } });
  new PerformanceObserver(list => { probe.tasks.push(...list.getEntries().map(e => ({ start: e.startTime, duration: e.duration }))); }).observe({ type: 'longtask', buffered: true });
  function tick(now) {
    if (probe.active && probe.lastFrame) { probe.frames.push(now - probe.lastFrame); probe.frameIntervals.push({ start: probe.lastFrame, end: now, duration: now - probe.lastFrame }); }
    probe.lastFrame = probe.active ? now : 0;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  // Conservative scheduling proxy: second animation frame after an input.
  // This is NOT Event Timing INP or a guarantee of compositor presentation.
  for (const name of ['pointerdown', 'pointermove', 'pointerup', 'wheel', 'touchmove', 'click']) {
    addEventListener(name, () => {
      if (!probe.active) return;
      const start = performance.now(), segment = probe.windowSequence;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (probe.active && probe.windowSequence === segment) probe.inputPaintProxy.push(performance.now() - start);
      }));
    }, { passive: true, capture: true });
  }
}

async function setView(page, dense) {
  await page.evaluate(dense => { window.exploreMap.setView([20.12, .1], dense ? 11 : 2, { animate: false }); }, dense);
  await page.waitForTimeout(400);
}

async function gesture(page, cdp, name) {
  const { width, height } = page.viewportSize();
  const x = Math.round(width * .64), y = Math.round(height * .56);
  const before = await page.evaluate(() => ({ zoom: window.exploreMap.getZoom(), center: window.exploreMap.getCenter() }));
  await page.evaluate(() => {
    const p = window.exploreProbe;
    p.sequence++;
    Object.assign(p, { frames: [], frameIntervals: [], windows: [], inputPaintProxy: [], tasks: [], active: false, start: performance.now(), zooms: [] });
    p.zoomListener = () => p.zooms.push(window.exploreMap.getZoom());
    window.exploreMap.on('zoomend', p.zoomListener);
    performance.mark(`explore-gesture-${p.sequence}-start`);
  });
  const begin = async (zoom = false) => page.evaluate(zoom => {
    const p = window.exploreProbe;
    p.active = true; p.lastFrame = 0; p.windowSequence = (p.windowSequence ?? 0) + 1; p.segmentDone = false; p.windowStart = performance.now();
    if (zoom) window.exploreMap.once('zoomend', () => requestAnimationFrame(() => requestAnimationFrame(() => {
      p.windows.push({ start: p.windowStart, end: performance.now() }); p.active = false; p.segmentDone = true;
    })));
  }, zoom);
  const end = async () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => {
    const p = window.exploreProbe;
    if (p.active) p.windows.push({ start: p.windowStart, end: performance.now() });
    p.active = false; resolve();
  }))));
  if (!['wheel', 'buttons'].includes(name)) await begin();
  if (name === 'drag') {
    await page.mouse.move(x, y); await page.mouse.down();
    for (let i = 1; i <= 24; i++) { await page.mouse.move(x - i * 20, y + Math.sin(i / 6) * 16); await page.waitForTimeout(16); }
    await page.mouse.up();
  } else if (name === 'wheel') {
    await page.mouse.move(x, y);
    for (const delta of [-96, -96, 96, 96]) {
      await begin(true); await page.mouse.wheel(0, delta);
      await page.waitForFunction(() => window.exploreProbe.segmentDone);
    }
  } else if (name === 'buttons') {
    for (const label of ['Zoom in', 'Zoom in', 'Zoom out', 'Zoom out']) {
      await begin(true); await page.getByRole('button', { name: label, exact: true }).click();
      await page.waitForFunction(() => window.exploreProbe.segmentDone);
    }
  } else {
    const pinch = name.startsWith('pinch');
    const direction = name === 'pinch-out' ? -1 : 1;
    const points = i => pinch
      ? [{ x: x - 75 - i * 2 * direction, y, id: 0 }, { x: x + 75 + i * 2 * direction, y, id: 1 }]
      : [{ x: x - i * 20, y: y + i, id: 0 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(0) });
    for (let i = 1; i <= 24; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(i) }); await page.waitForTimeout(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  // Include the animation/inertia tail, not an arbitrary idle sleep.
  await page.waitForFunction(() => !window.exploreMap._animatingZoom && !window.exploreMap._panAnim?._inProgress);
  await end();
  const data = await page.evaluate(() => {
    const p = window.exploreProbe; p.active = false; p.end = performance.now();
    window.exploreMap.off('zoomend', p.zoomListener);
    performance.mark(`explore-gesture-${p.sequence}-end`);
    const { zoomListener, ...serializable } = p;
    return { ...serializable, tasks: p.tasks.filter(t => p.windows.some(w => t.start < w.end && t.start + t.duration > w.start)),
      after: { zoom: window.exploreMap.getZoom(), center: window.exploreMap.getCenter() } };
  });
  if (['drag', 'touch'].includes(name)) assert.notDeepEqual(data.after.center, before.center, `${name} must pan`);
  if (name === 'pinch') assert.ok(data.after.zoom > before.zoom, 'pinch must zoom in');
  if (name === 'pinch-out') assert.ok(data.after.zoom < before.zoom, 'pinch must zoom out');
  if (['wheel', 'buttons'].includes(name)) assert.ok(data.zooms.some(z => z !== before.zoom), `${name} must change zoom`);
  return { name, before, ...data, frameP95: percentile(data.frames, .95), inputProxyP95: percentile(data.inputPaintProxy, .95),
    longestTask: Math.max(0, ...data.tasks.map(t => t.duration)) };
}

async function saveTrace(cdp, path) {
  const done = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve));
  await cdp.send('Tracing.end'); const { stream } = await done;
  let trace = '';
  while (true) { const chunk = await cdp.send('IO.read', { handle: stream }); trace += chunk.data; if (chunk.eof) break; }
  await cdp.send('IO.close', { handle: stream });
  if (path) await writeFile(path, trace);
  return JSON.parse(trace).traceEvents;
}

export function inputLatencies(name, samples) {
  const types = name === 'wheel' ? ['MOUSE_WHEEL'] : name === 'buttons' ? ['MOUSE_RELEASED'] :
    name === 'drag' ? ['MOUSE_DRAGGED'] : ['TOUCH_MOVED', 'TOUCH_RELEASED'];
  return samples.filter(sample => types.includes(sample.type));
}

export function traceLatencies(events, gestures) {
  const starts = new Map(), latencies = [];
  for (const e of events.filter(e => e.name === 'EventLatency')) {
    const key = `${e.pid}:${e.id2?.local ?? e.id}`;
    if (e.ph === 'b') starts.set(key, e);
    if (e.ph === 'e' && starts.has(key)) {
      const start = starts.get(key); starts.delete(key);
      const info = start.args.event_latency;
      // Only events linked by Chromium to a presented surface frame.
      if (info.surface_frame_trace_id !== undefined) latencies.push({ time: start.ts, ms: (e.ts - start.ts) / 1000, type: info.event_type });
    }
  }
  for (const gesture of gestures) {
    const start = events.find(e => e.name === `explore-gesture-${gesture.sequence}-start`)?.ts;
    const end = events.find(e => e.name === `explore-gesture-${gesture.sequence}-end`)?.ts;
    gesture.presentationLatencies = inputLatencies(gesture.name, latencies.filter(l => l.time >= start && l.time <= end));
    gesture.presentationP95 = percentile(gesture.presentationLatencies.map(l => l.ms), .95);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
  const out = resolve(option('--out', '/tmp/plg-explore-performance'));
  const runs = Number(option('--runs', '5'));
  const widths = option('--widths', '1366,1024,1180').split(',').map(Number);
  const names = option('--fixtures', 'catalog,dense').split(',');
  const experiment = option('--experiment', 'none');
  const levels = option('--levels', 'overview,dense').split(',');
  const inputs = option('--inputs', 'drag,wheel,buttons,touch,pinch,pinch-out').split(',');
  await mkdir(out, { recursive: true });
  const fixture = await productionFixture(out, option('--build-dir', undefined));
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLG_CHROMIUM_EXECUTABLE });
  const result = { metadata: { protocol: 2, sha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    dirty: execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim(), buildHash: fixture.buildHash, reusedBuild: option('--build-dir', null),
    browser: browser.version(), platform: `${os.platform()} ${os.release()} ${os.arch()}`, cpu: os.cpus()[0].model,
    cpuCount: os.cpus().length, profile: { cpuSlowdown: 4, downloadMbps: 10, uploadMbps: 10, latencyMs: 100, deviceScaleFactor: 1 },
    fixtureCounts: Object.fromEntries(Object.entries(fixture.fixtures).map(([k, v]) => [k, v.length])), experiment,
    note: 'Production-built route harness; fixed local API, gzip HTTP, cold fresh contexts, warm same-query-client detail return. rAF intervals are main-thread frame scheduling; inputProxy is second-rAF scheduling, not presentation latency or INP.' }, samples: [] };
  try {
    for (const viewport of viewports.filter(v => widths.includes(v.width))) for (const name of names) for (let run = 0; run < runs; run++) {
      const context = await browser.newContext({ viewport, hasTouch: true, deviceScaleFactor: 1, extraHTTPHeaders: { 'x-explore-fixture': name } });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      await page.addInitScript(installProbe);
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 100, downloadThroughput: 10e6 / 8, uploadThroughput: 10e6 / 8 });
      await cdp.send('Tracing.start', { categories: 'devtools.timeline,v8.execute,blink.user_timing,input,latencyInfo', transferMode: 'ReturnAsStream' });
      if (args.includes('--profile') && run === 0) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.start'); }
      try {
        await page.goto(`${fixture.origin}/map`);
        const coldMs = await ready(page);
        if (experiment !== 'none') await page.evaluate(experiment => {
          const style = document.createElement('style');
          if (experiment === 'hide-earth') style.textContent = '.illustrated-earth {display:none !important}';
          else if (experiment === 'hide-hatching') style.textContent = '.illustrated-earth path[fill*="hatching"] {display:none !important}';
          else if (experiment === 'scaling-strokes') style.textContent = '.illustrated-earth [vector-effect] {vector-effect:none !important}';
          else if (experiment === 'hide-country-coast-strokes') style.textContent = '.illustrated-earth__countries path,.illustrated-earth__shallows path,.illustrated-earth__coast-shadow,.illustrated-earth__coast-ink {stroke:none !important}';
          else if (experiment === 'hide-biome-borders') style.textContent = '.illustrated-earth__biome-border {stroke:none !important}';
          else if (experiment === 'remove-redundant-world-clip') document.querySelector('[data-outline-bounds]').removeAttribute('clip-path');
          else throw new Error(`Unknown experiment ${experiment}`);
          document.head.appendChild(style);
        }, experiment);
        console.log(`${name}/${viewport.width}/${run}: cold ready ${Math.round(coldMs)}ms`);
        const loading = await page.evaluate(() => ({ tasks: window.exploreProbe.tasks,
          markerBirths: { ...window.exploreProbe.markerBirths }, visibleMarkers: document.querySelectorAll('.leaflet-marker-pane > *').length,
          resources: performance.getEntriesByType('resource').map(r => ({ name: new URL(r.name).pathname, bytes: r.transferSize, duration: r.duration })) }));
        await page.screenshot({ path: `${out}/${name}-${viewport.width}-overview.png` });
        const gestures = [];
        for (const dense of [false, true].filter(dense => levels.includes(dense ? 'dense' : 'overview'))) for (const input of inputs) {
          await setView(page, dense);
          if (!dense && input === 'pinch-out') { await page.evaluate(() => { window.exploreMap.setZoom(3, { animate: false }); }); await page.waitForTimeout(400); }
          gestures.push({ level: dense ? 'dense' : 'overview', ...await gesture(page, cdp, input) });
          const g = gestures.at(-1);
          console.log(`  ${g.level}/${input}: p95 frame ${g.frameP95?.toFixed(1)}ms; longest task ${g.longestTask}ms`);
        }
        const sample = { fixture: name, viewport, run, coldMs, loading, gestures, errors };
        result.samples.push(sample);
        await writeFile(`${out}/results.json`, JSON.stringify(result, null, 2));
        // Open a real item through its mouse preview; back uses the real detail header.
        const item = fixture.fixtures[name][0];
        await page.evaluate(item => { window.exploreMap.setView([item.latitude, item.longitude], 18, { animate: false }); }, item);
        await page.locator(`[data-item-id="${item.id}"]`).waitFor();
        await page.locator(`[data-item-id="${item.id}"]`).dispatchEvent('click');
        await page.getByRole('button', { name: /View detail/i }).click();
        await page.locator('.item-detail-titlebar').waitFor();
        const requestsBefore = fixture.requests.filter(r => r.path === '/api/v1/items').length;
        const warmStart = await page.evaluate(() => performance.now());
        await page.getByRole('button', { name: 'Back', exact: true }).click();
        const warmMs = await ready(page) - warmStart;
        assert.equal(fixture.requests.filter(r => r.path === '/api/v1/items').length, requestsBefore, 'warm return must reuse fresh catalog');
        sample.warmMs = warmMs;
        assert.deepEqual(errors, []);
        console.log(JSON.stringify({ fixture: name, width: viewport.width, run, coldMs: Math.round(coldMs), warmMs: Math.round(warmMs),
          frameP95: gestures.map(g => [g.level, g.name, g.frameP95, g.longestTask]) }));
      } finally {
        const events = await saveTrace(cdp, args.includes('--trace') && run === 0 ? `${out}/${name}-${viewport.width}.trace.json` : null);
        const sample = result.samples.at(-1);
        if (sample?.fixture === name && sample?.viewport === viewport && sample?.run === run) traceLatencies(events, sample.gestures);
        if (args.includes('--profile') && run === 0) {
          const { profile } = await cdp.send('Profiler.stop');
          await writeFile(`${out}/${name}-${viewport.width}.cpuprofile`, JSON.stringify(profile));
        }
        await writeFile(`${out}/results.json`, JSON.stringify(result, null, 2));
        await context.close();
      }
    }
  } finally { await browser.close(); await fixture.close(); }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
