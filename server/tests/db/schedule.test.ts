import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { assertSafeTestDatabaseUrl } from '../../src/db/test-database.js';
import { createScheduleRepository } from '../../src/schedule/repository.js';

const configured = process.env.TEST_DATABASE_URL;
const skip = configured ? false : 'TEST_DATABASE_URL is not configured';

test('schedule repository: enable, revisions, replace/add, ownership and zone-change limit', { skip }, async () => {
  const pool = new Pool({ connectionString: assertSafeTestDatabaseUrl(configured!) });
  const family = randomUUID(), other = randomUUID(), a = randomUUID(), b = randomUUID(), foreign = randomUUID();
  const repo = createScheduleRepository(pool);
  const now = new Date('2026-11-02T08:00:00Z');
  try {
    await migrate(drizzle(pool), { migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)) });
    for (const id of [family, other]) await pool.query('INSERT INTO families(id,email,display_name,password_hash) VALUES($1,$2,$3,$4)', [id, `${id}@schedule.test`, 'T', 'x']);
    for (const [id, owner] of [[a, family], [b, family], [foreign, other]] as const) await pool.query('INSERT INTO profiles(id,family_id,name,public_id,emoji,color) VALUES($1,$2,$3,$1,$4,$5)', [id, owner, 'Kid', '⭐', '#456']);

    assert.deepEqual(await repo.resolve(family, a, null, now), { enabled: false, slots: [], timezone: 'Asia/Ho_Chi_Minh' });
    assert.equal(await repo.resolve(family, foreign, null, now), null, 'foreign profiles are unknown');

    await assert.rejects(repo.apply(family, 'replace', [], [{ profile_id: a, expected_revision: 0 }]), /turn the schedule on/i);
    await repo.setEnabled(family, a, true, 0);
    await assert.rejects(repo.setEnabled(family, a, false, 0), /changed/i, 'stale revision');
    await assert.rejects(repo.setEnabled(family, foreign, true, 0), /not found/i);

    const slot = { weekday: 1, start_minute: 960, end_minute: 1080 };
    await repo.apply(family, 'replace', [slot], [{ profile_id: a, expected_revision: 1 }]);
    await repo.apply(family, 'add', [{ weekday: 1, start_minute: 1080, end_minute: 1140 }, { weekday: 3, start_minute: 600, end_minute: 660 }], [{ profile_id: a, expected_revision: 2 }]);
    const kids = await repo.listForFamily(family);
    const kid = kids.find(item => item.profile_id === a)!;
    assert.deepEqual(kid.slots, [{ weekday: 1, start_minute: 960, end_minute: 1140 }, { weekday: 3, start_minute: 600, end_minute: 660 }]);
    assert.equal(kid.weekly_minutes, 240);
    assert.equal(kids.find(item => item.profile_id === b)!.enabled, false);

    // First zone report is free; later changes are limited to three per UTC day.
    assert.equal((await repo.resolve(family, a, 'Asia/Ho_Chi_Minh', now))!.timezone, 'Asia/Ho_Chi_Minh');
    for (const zone of ['Europe/Paris', 'Asia/Tokyo', 'America/New_York']) assert.equal((await repo.resolve(family, a, zone, now))!.timezone, zone);
    assert.equal((await repo.resolve(family, a, 'Europe/London', now))!.timezone, 'America/New_York', 'fourth change ignored');
    assert.equal((await repo.resolve(family, a, 'Not/AZone', now))!.timezone, 'America/New_York');
    assert.equal((await repo.listForFamily(family)).find(item => item.profile_id === a)!.timezone_events.length, 3);
  } finally {
    await pool.query('DELETE FROM families WHERE id = ANY($1)', [[family, other]]);
    await pool.end();
  }
});
