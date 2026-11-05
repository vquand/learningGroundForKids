import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { hashSessionToken } from '../src/auth.js';
import { loadConfig } from '../src/config.js';
import type { AppDatabase } from '../src/contracts/db.js';
import { applyCommand, emptyProgress, publicState } from '../src/fishing/game.js';
import { AppError } from '../src/errors.js';

test('fishing routes enforce current session ownership, no-store and strict server-owned inputs', async () => {
  let authenticated = true, reads = 0, writes = 0;
  let progress = emptyProgress();
  const family = { id: 'family-1', email: 'test@test.local', displayName: 'Parent', passwordHash: 'unused', role: 'family' };
  const db = {
    auth: { async findFamilyBySessionHash(hash: string) { return authenticated && hash === hashSessionToken('token') ? family : null; } },
    profiles: { async get(familyId: string, profileId: string) { return familyId === family.id && profileId === 'child-1' ? { id: profileId } : null; } },
    fishing: {
      async get() { reads++; return publicState(progress, 0); },
      async mutate(_id: string, revision: number, command: Parameters<typeof applyCommand>[1]) {
        if (revision !== progress.revision) throw new AppError(409, 'FISHING_STALE_SESSION', 'Stale revision.');
        writes++; progress = applyCommand(progress, command, 0, () => 0, () => 'issued-question'); progress.revision++;
        return publicState(progress, 0);
      },
    },
  } as unknown as AppDatabase;
  const app = createApp({ db, config: loadConfig({ NODE_ENV: 'test', DATABASE_URL: 'postgresql://test:test@localhost/test', ALLOWED_ORIGINS: 'https://app.example.com', ALLOWED_FORWARDED_HOSTS: 'app.example.com' }), logger: { info() {}, error() {}, warn() {} } });
  const request = (suffix = '', init: RequestInit = {}, child = 'child-1') => app.request(`https://app.example.com/api/v1/profiles/${child}/fishing${suffix}`, { ...init, headers: { cookie: 'plg_session=token', origin: 'https://app.example.com', 'content-type': 'application/json', ...init.headers } });
  const action = (command: unknown, revision = progress.revision) => request('/action', { method: 'POST', body: JSON.stringify({ revision, command }) });
  assert.equal((await app.request('https://app.example.com/api/v1/profiles/child-1/fishing')).status, 401);
  for (const suffix of ['', '/action']) assert.equal((await request(suffix, suffix ? { method: 'POST', body: '{}' } : {}, 'stranger')).status, 404);
  assert.equal(reads, 0); assert.equal(writes, 0);
  const read = await request(); assert.equal(read.status, 200); assert.equal(read.headers.get('cache-control'), 'no-store');
  assert.equal((await request('', { method: 'POST', body: '{}' })).status, 405);
  for (const command of [
    { type: 'cast', fishId: 'P5' }, { type: 'tick', elapsedMs: 8000 }, { type: 'answer', questionId: 'x', answer: 2, correctAnswer: 2 },
    { type: 'question', baitId: 'mythic' }, { type: 'select-location', location: 'lava' }, { type: 'select-companion', companion: 'root' },
  ]) assert.equal((await action(command)).status, 422);
  assert.equal((await request('/action', { method: 'POST', body: JSON.stringify({ revision: 0, profileId: 'stranger', command: { type: 'cast' } }) })).status, 422);
  assert.equal((await action({ type: 'question', baitId: 'master' })).status, 409);
  const questionResponse = await action({ type: 'question', baitId: 'baby' });
  const question = await questionResponse.json(); assert.equal(questionResponse.status, 200);
  assert.equal(question.question.id, 'issued-question');
  assert.equal(question.question.baitId, 'baby');
  assert.equal(question.question.attempts, 0);
  assert.deepEqual(question.question.publicQuestion.card, { kind: 'equation', level: 'addsub-2d1d', values: [10, 0], operators: ['+'], result: null });
  assert.equal('answer' in question.question, false);
  assert.equal('key' in question.question, false);
  const answer = progress.question?.question.answer;
  assert.equal((await action({ type: 'answer', questionId: 'issued-question', answer: Number(answer) + 1 }, 0)).status, 409);
  assert.equal((await action({ type: 'answer', questionId: 'issued-question', answer: Number(answer) })).status, 200);
  assert.equal(progress.bait.baby, 1);
  assert.equal((await action({ type: 'answer', questionId: 'issued-question', answer: Number(answer) })).status, 409);
  authenticated = false;
  assert.equal((await request()).status, 401); assert.equal((await action({ type: 'cast' })).status, 401);
});
