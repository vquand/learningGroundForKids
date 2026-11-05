import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequestLifecycle } from '../src/lib/requestLifecycle.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('late results cannot repopulate a cleared cache after the owner changes', async () => {
  for (const change of ['logout', 'same-family-new-session', 'profile-switch', 'unmount']) {
    let current = true;
    const lifecycle = createRequestLifecycle(() => current);
    const cache = new Map<string, number>();
    const response = deferred<number>();
    let finished = false;
    const pending = lifecycle.run(() => response.promise, {
      success: value => { cache.set('old-profile', value); },
      finish: () => { finished = true; },
    });
    cache.clear();
    if (change === 'unmount') lifecycle.invalidate();
    else current = false;
    response.resolve(7);
    await pending;
    assert.equal(cache.size, 0, change);
    assert.equal(finished, false, change);
  }
});

test('late errors are ignored and a new owner can start while an old request settles', async () => {
  const lifecycle = createRequestLifecycle(() => true);
  const old = deferred<number>();
  const errors: string[] = [];
  const values: number[] = [];
  const first = lifecycle.run(() => old.promise, { error: error => errors.push(String(error)) });
  lifecycle.invalidate();
  const next = deferred<number>();
  const second = lifecycle.run(() => next.promise, { success: value => values.push(value) });
  old.reject(new Error('old session failure'));
  await first;
  assert.equal(lifecycle.busy, true, 'old finalization must not unlock the new request');
  next.resolve(9);
  await second;
  assert.deepEqual(errors, []);
  assert.deepEqual(values, [9]);
  assert.equal(lifecycle.busy, false);
});

test('serializes requests and finishes current errors so retry is possible', async () => {
  const lifecycle = createRequestLifecycle(() => true);
  const response = deferred<number>();
  let calls = 0, finishes = 0;
  const errors: string[] = [];
  const first = lifecycle.run(() => { calls++; return response.promise; }, {
    error: error => errors.push((error as Error).message), finish: () => { finishes++; },
  });
  await lifecycle.run(async () => { calls++; return 2; });
  assert.equal(calls, 1);
  response.reject(new Error('try again'));
  await first;
  assert.deepEqual(errors, ['try again']);
  assert.equal(finishes, 1);
  await lifecycle.run(async () => { calls++; return 3; });
  assert.equal(calls, 2);
});
