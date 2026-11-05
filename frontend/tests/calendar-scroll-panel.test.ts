import assert from 'node:assert/strict';
import test from 'node:test';
import { observeCalendarScrollPanel } from '../src/lib/calendarScrollPanel.ts';

test('repeated reveals reuse observers, wait for layout/data, and clean up pending work', t => {
  const callbacks = new Map<number, FrameRequestCallback>();
  let nextFrame = 0, resized = () => {}, mutated = () => {}, disconnected = 0, observerCount = 0;
  const previous = Object.getOwnPropertyDescriptors(globalThis);
  Object.assign(globalThis, {
    requestAnimationFrame: (callback: FrameRequestCallback) => { callbacks.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame: (id: number) => callbacks.delete(id),
    ResizeObserver: class { constructor(callback: () => void) { resized = callback; observerCount++; } observe() {} disconnect() { disconnected++; } },
    MutationObserver: class { constructor(callback: () => void) { mutated = callback; observerCount++; } observe() {} disconnect() { disconnected++; } },
  });
  t.after(() => { for (const key of ['requestAnimationFrame', 'cancelAnimationFrame', 'ResizeObserver', 'MutationObserver']) {
    const descriptor = previous[key];
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
  } });
  const flush = () => { const pending = [...callbacks.values()]; callbacks.clear(); pending.forEach(callback => callback(0)); };
  let rowReady = false;
  const panel = { scrollTop: 0, getBoundingClientRect: () => ({ top: 0, bottom: 100 }) } as HTMLElement;
  const row = { dataset: { scrollKey: 'favorite' }, getBoundingClientRect: () => ({ top: 200 - panel.scrollTop, bottom: 248 - panel.scrollTop }) };
  const content = { querySelectorAll: () => rowReady ? [row] : [] } as unknown as HTMLElement;
  const observer = observeCalendarScrollPanel(panel, content, () => 'favorite');
  flush(); assert.equal(panel.scrollTop, 0, 'a not-yet-rendered row does not throw');
  rowReady = true; mutated();
  assert.equal(panel.scrollTop, 0, 'reveal waits for the layout frame');
  flush(); assert.equal(panel.scrollTop, 152, 'late data reveals the saved row');
  panel.scrollTop = 20;
  mutated(); resized(); flush();
  assert.equal(panel.scrollTop, 20, 'search/edit mutations and layout changes do not override a later user scroll');
  rowReady = false; mutated(); flush();
  rowReady = true; mutated(); flush();
  assert.equal(panel.scrollTop, 20, 'a consumed save token does not reveal again when filtering brings its row back');
  panel.scrollTop = 0; observer.schedule(); observer.schedule(); resized();
  assert.equal(callbacks.size, 1, 'requests coalesce');
  flush(); assert.equal(panel.scrollTop, 152, 'saving the same id again reveals it again');
  assert.equal(observerCount, 2, 'reveal and resize reuse the mounted observers');
  observer.schedule(); observer.cleanup();
  assert.equal(callbacks.size, 0); assert.equal(disconnected, 2);
});
