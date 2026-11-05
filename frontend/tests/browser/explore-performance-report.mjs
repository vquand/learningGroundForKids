import { readFile, writeFile } from 'node:fs/promises';
import { percentile, inputLatencies } from './explore-performance.mjs';

const [afterPath, beforePath] = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
if (!afterPath) throw new Error('Usage: node tests/browser/explore-performance-report.mjs results.json [baseline.json]');

function summarize(result) {
  const groups = new Map();
  for (const sample of result.samples) {
    const key = `${sample.fixture}/${sample.viewport.width}x${sample.viewport.height}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(sample);
  }
  return Object.fromEntries([...groups].map(([key, samples]) => {
    const gestures = {};
    for (const { level, name } of samples[0].gestures) {
      const all = samples.flatMap(s => s.gestures.filter(g => g.level === level && g.name === name)).map(g => {
        const presented = inputLatencies(name, g.presentationLatencies ?? []);
        return { ...g, presentationLatencies: presented, presentationP95: percentile(presented.map(l => l.ms), .95) };
      });
      gestures[`${level}/${name}`] = {
        frameP95: percentile(all.flatMap(g => g.frames), .95),
        presentationRuns: all.filter(g => g.presentationLatencies.length > 0).length,
        presentationP95: percentile(all.flatMap(g => g.presentationLatencies?.map(l => l.ms) ?? []), .95),
        inputProxyP95: percentile(all.flatMap(g => g.inputPaintProxy), .95),
        runFrameP95Median: percentile(all.map(g => g.frameP95), .5),
        runFrameP95P95: percentile(all.map(g => g.frameP95), .95),
        runPresentationP95Median: percentile(all.map(g => g.presentationP95).filter(v => v != null), .5),
        runPresentationP95P95: percentile(all.map(g => g.presentationP95).filter(v => v != null), .95),
        longestTask: Math.max(...all.map(g => g.longestTask)),
      };
    }
    return [key, { runs: samples.length, coldMedian: percentile(samples.map(s => s.coldMs), .5),
      coldP95: percentile(samples.map(s => s.coldMs), .95), warmMedian: percentile(samples.map(s => s.warmMs), .5),
      warmP95: percentile(samples.map(s => s.warmMs), .95),
      coldBytesMedian: percentile(samples.map(s => s.loading.resources.reduce((a, r) => a + r.bytes, 0)), .5),
      requestCountMedian: percentile(samples.map(s => s.loading.resources.length), .5),
      catalogTransferBytesMedian: percentile(samples.map(s => s.loading.resources.filter(r => typeof r.name === 'string' && (r.name === '/api/v1/items' || r.name.startsWith('/api/v1/items/map/'))).reduce((n, r) => n + r.bytes, 0)), .5),
      catalogRequestCountMedian: percentile(samples.map(s => s.loading.resources.filter(r => typeof r.name === 'string' && (r.name === '/api/v1/items' || r.name.startsWith('/api/v1/items/map/'))).length), .5),
      itemMarkerBirthsMedian: percentile(samples.map(s => s.loading.markerBirths?.item).filter(Number.isFinite), .5),
      allMarkerBirthsMedian: percentile(samples.map(s => s.loading.markerBirths?.all).filter(Number.isFinite), .5),
      visibleMarkersMedian: percentile(samples.map(s => s.loading.visibleMarkers).filter(Number.isFinite), .5), gestures }];
  }));
}
const afterRaw = JSON.parse(await readFile(afterPath, 'utf8'));
const beforeRaw = beforePath ? JSON.parse(await readFile(beforePath, 'utf8')) : null;
const after = summarize(afterRaw);
const before = beforeRaw ? summarize(beforeRaw) : null;
const budget = (value, old, target) => {
  if (!Number.isFinite(value)) return 'unavailable';
  if (value > target + .01) return 'over budget';
  if (old != null && old > target + .01 && value > old * .75 + .01) return 'improvement <25%';
  if (old != null && old <= target + .01 && value > old * 1.1 + .01) return 'regression >10%';
  return 'pass';
};
for (const [key, group] of Object.entries(after)) {
  const old = before?.[key];
  group.checks = { repetitions: group.runs >= 5 ? 'pass' : 'need >=5',
    cold: budget(group.coldMedian, old?.coldMedian, 2500), warm: budget(group.warmMedian, old?.warmMedian, 500) };
  for (const [name, values] of Object.entries(group.gestures)) {
    values.checks = Object.fromEntries(Object.entries({ frameP95: 33.4, presentationP95: 100, longestTask: 200 })
      .map(([metric, target]) => [metric, metric === 'presentationP95' && (values.presentationRuns < group.runs || (old && old.gestures[name]?.presentationRuns < old.runs)) ? 'unavailable' : budget(values[metric], old?.gestures[name]?.[metric], target)]));
  }
}
await writeFile(afterPath.replace(/\.json$/, '.summary.json'), JSON.stringify(after, null, 2));
console.log(JSON.stringify(after, null, 2));
if (process.argv.includes('--check')) {
  const failures = [];
  for (const [label, raw] of [['candidate', afterRaw], ['baseline', beforeRaw]]) {
    if (raw?.metadata.protocol !== 2) failures.push(`${label}: requires protocol 2 (active gesture windows)`);
    for (const sample of raw?.samples ?? []) for (const level of ['overview', 'dense']) for (const name of ['drag', 'wheel', 'buttons', 'touch', 'pinch', 'pinch-out']) {
      if (sample.gestures.filter(g => g.level === level && g.name === name).length !== 1) failures.push(`${label}/${sample.fixture}/${sample.viewport.width}/${sample.run}: missing or duplicate ${level}/${name}`);
    }
  }
  for (const name of ['catalog', 'dense']) for (const viewport of ['1366x768', '1024x768', '1180x820']) {
    const key = `${name}/${viewport}`;
    if (!after[key]) failures.push(`missing candidate group: ${key}`);
    if (!before?.[key]) failures.push(`missing baseline group: ${key}`);
    else if (before[key].runs < 5) failures.push(`baseline ${key}: need >=5`);
  }
  for (const field of ['protocol', 'browser', 'platform', 'cpu', 'cpuCount', 'profile', 'fixtureCounts', 'experiment']) {
    if (JSON.stringify(afterRaw.metadata[field]) !== JSON.stringify(beforeRaw?.metadata[field])) failures.push(`incompatible metadata: ${field}`);
  }
  for (const [key, group] of Object.entries(after)) {
    for (const [metric, status] of Object.entries(group.checks)) if (status !== 'pass') failures.push(`${key}/${metric}: ${status}`);
    for (const [name, gesture] of Object.entries(group.gestures)) {
      for (const [metric, status] of Object.entries(gesture.checks)) {
        // Chromium cannot always link JS-debounced wheel zoom to a presented
        // input frame. Keep that explicit; never substitute the rAF proxy.
        if (status === 'unavailable' && metric === 'presentationP95' && name.endsWith('/wheel') && process.argv.includes('--allow-missing-presentation')) continue;
        if (status !== 'pass') failures.push(`${key}/${name}/${metric}: ${status}`);
      }
    }
  }
  if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
}
