import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('the alert banner on the profile picker is called "News" and covers friend requests and events', async () => {
  const page = await readFile(new URL('../src/pages/ProfilePickerPage.tsx', import.meta.url), 'utf8');
  assert.match(page, /uiText\("News"\)/);
  assert.match(page, /friend requests and upcoming events pop up right away/);
  assert.equal(page.includes('Enable friend request alerts'), false);
  const vi = JSON.parse(await readFile(new URL('../src/i18n/vi.json', import.meta.url), 'utf8')) as Record<string, string>;
  assert.equal(vi['News'], 'Tin mới');
  assert.ok(vi['Turn on browser notifications so friend requests and upcoming events pop up right away.']);
});
