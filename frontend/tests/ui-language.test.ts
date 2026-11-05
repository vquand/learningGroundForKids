import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getUiLanguage, setUiLanguage, initializeUiLanguage, subscribeUiLanguage } from '../src/lib/uiLanguage.ts';
import { speechLanguage, matchingSpeechVoice } from '../src/lib/speechLanguage.ts';
import { drillHaptics } from '../src/lib/drillHaptics.ts';

test('UI language persists and publishes changes without modifying learning content', async () => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const memory = new Map<string, string>();
  Object.defineProperty(globalThis, 'document', {configurable: true, value: {documentElement: {lang: 'en'}}});
  Object.defineProperty(globalThis, 'localStorage', {configurable: true, value: {getItem: (key: string) => memory.get(key), setItem: (key: string, value: string) => memory.set(key, value)}});
  let changes = 0;
  const unsubscribe = subscribeUiLanguage(() => changes++);
  const puzzle = {language: 'en', clue: 'A place for people and cars.', letters: ['R','_','A','D']};
  try {
    setUiLanguage('vi'); assert.equal(getUiLanguage(), 'vi'); assert.equal(changes, 1);
    assert.equal(puzzle.language, 'en'); assert.equal(puzzle.clue, 'A place for people and cars.');
    setUiLanguage('en'); memory.set('plg-ui-language', 'vi'); initializeUiLanguage(); assert.equal(getUiLanguage(), 'vi');
    unsubscribe(); setUiLanguage('en'); assert.equal(changes, 3);
    Object.defineProperty(globalThis, 'localStorage', {configurable: true, get() {throw new Error('blocked');}});
    setUiLanguage('vi'); assert.equal(getUiLanguage(), 'vi'); initializeUiLanguage();
  } finally {
    unsubscribe(); if (originalDocument) Object.defineProperty(globalThis,'document',originalDocument); else Reflect.deleteProperty(globalThis,'document');
    if (originalStorage) Object.defineProperty(globalThis,'localStorage',originalStorage); else Reflect.deleteProperty(globalThis,'localStorage');
  }
});
test('speech uses content BCP-47 tag and never a voice in the wrong language', () => {
  assert.equal(speechLanguage('en'), 'en-US'); assert.equal(speechLanguage('vi'), 'vi-VN');
  const voices = [{lang:'en-GB',default:true},{lang:'vi-VN',default:false},{lang:'en-US',default:false}];
  assert.equal(matchingSpeechVoice(voices,'vi'),voices[1]); assert.equal(matchingSpeechVoice(voices,'en'),voices[2]);
  assert.equal(matchingSpeechVoice(voices.slice(0,1),'vi'),undefined);
});
test('drilling feedback is brief, optional, and safely unavailable on iPad', () => {
  const patterns: (number | number[])[] = [];
  assert.equal(drillHaptics({vibrate: value => {patterns.push(typeof value === 'number' ? value : Array.from(value));return true;}},false),true);
  assert.deepEqual(patterns, [[35,45,35]]);
  assert.equal(drillHaptics({vibrate: () => {throw new Error('unsupported');}},false),false);
  assert.equal(drillHaptics({} as Navigator,false),false);
  assert.equal(drillHaptics({vibrate: () => {throw new Error('should not run');}},true),false);
});
