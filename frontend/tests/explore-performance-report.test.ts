import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

function measurements() {
  return {
    metadata: { protocol: 2, browser: 'reference', platform: 'reference', cpu: 'reference', cpuCount: 20,
      profile: { cpuSlowdown: 4 }, fixtureCounts: { catalog: 2982, dense: 4000 }, experiment: 'none' },
    samples: ['catalog', 'dense'].flatMap(fixture => [1366, 1024, 1180].flatMap(width =>
      Array.from({ length: 5 }, (_, run) => ({ fixture, viewport: { width, height: width === 1180 ? 820 : 768 }, run,
        coldMs: 1000, warmMs: 300, loading: { resources: [{ bytes: 100 }] },
        gestures: ['overview', 'dense'].flatMap(level => ['drag', 'wheel', 'buttons', 'touch', 'pinch', 'pinch-out'].map(name => ({
          level, name, frames: [16.7], frameP95: 16.7, presentationLatencies: [{ ms: 50, type: name === 'wheel' ? 'MOUSE_WHEEL' : name === 'buttons' ? 'MOUSE_RELEASED' : name === 'drag' ? 'MOUSE_DRAGGED' : 'TOUCH_MOVED' }], presentationP95: 50,
          inputPaintProxy: [20], longestTask: 0,
        }))),
      })))),
  };
}

type Measurements = ReturnType<typeof measurements>;
function report(after: Measurements, before: Measurements, flags: string[] = []) {
  const directory = mkdtempSync(join(tmpdir(), 'explore-report-test-'));
  try {
    const paths = ['after', 'before'].map(name => join(directory, `${name}.json`));
    writeFileSync(paths[0]!, JSON.stringify(after)); writeFileSync(paths[1]!, JSON.stringify(before));
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./browser/explore-performance-report.mjs', import.meta.url)),
      ...paths, '--check', ...flags], { encoding: 'utf8' });
    if (result.error) throw result.error;
    return result;
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

test('performance gate requires five complete, compatible baseline and candidate runs', () => {
  const reference = measurements();
  assert.equal(report(reference, reference).status, 0);
  const short = measurements(); short.samples = short.samples.filter(s => s.run === 0);
  assert.match(report(reference, short).stderr, /baseline catalog\/1366x768: need >=5/);
  const incomplete = measurements(); incomplete.samples[0]!.gestures.pop();
  assert.match(report(incomplete, reference).stderr, /missing or duplicate dense\/pinch-out/);
  const incompatible = measurements(); incompatible.metadata.profile.cpuSlowdown = 8;
  assert.match(report(incompatible, reference).stderr, /incompatible metadata: profile/);
});

test('presentation exception applies only to wheel; real regressions still fail', () => {
  const reference = measurements(), candidate = measurements();
  for (const sample of candidate.samples) for (const g of sample.gestures) {
    if (g.name === 'wheel') g.presentationLatencies = [];
  }
  assert.notEqual(report(candidate, reference).status, 0);
  assert.equal(report(candidate, reference, ['--allow-missing-presentation']).status, 0);
  candidate.samples[0]!.gestures.find(g => g.name === 'pinch')!.presentationLatencies = [];
  assert.match(report(candidate, reference, ['--allow-missing-presentation']).stderr, /overview\/pinch\/presentationP95: unavailable/);
  const slower = measurements(); slower.samples[0]!.coldMs = 3000;
  slower.samples[1]!.coldMs = 3000; slower.samples[2]!.coldMs = 3000;
  assert.match(report(slower, reference).stderr, /cold: over budget/);
});

test('frame timestamp rounding does not turn a passing baseline into a failing one', () => {
  const reference = measurements(), candidate = measurements();
  for (const sample of reference.samples) for (const g of sample.gestures) g.frames = [33.400000000001];
  for (const sample of candidate.samples) for (const g of sample.gestures) g.frames = [33.4];
  assert.equal(report(candidate, reference).status, 0);
});
