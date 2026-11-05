import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { assertSafeTestDatabaseUrl } from '../../src/db/test-database.js';
import { NOTIFICATION_ITEM_CAP, createCalendarNotificationsRepository } from '../../src/calendar/notifications.js';
import { systemEventDate } from '../../src/calendar/system-events.js';

const configured = process.env.TEST_DATABASE_URL;
const skip = configured ? false : 'TEST_DATABASE_URL is not configured';
const TODAY_INSTANT = new Date('2026-10-29T03:00:00Z'); // Asia/Ho_Chi_Minh 2026-10-29 10:00
const TODAY = '2026-10-29';

async function openPool(): Promise<Pool> {
  const pool = new Pool({ connectionString: assertSafeTestDatabaseUrl(configured!, [process.env.DATABASE_URL, process.env.DATABASE_URL_UNPOOLED].filter((value): value is string => !!value)) });
  await migrate(drizzle(pool), { migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)) });
  return pool;
}

async function seedFamily(pool: Pool, profiles: { id: string; name: string }[]): Promise<string> {
  const family = randomUUID();
  await pool.query('INSERT INTO families(id,email,display_name,password_hash) VALUES($1,$2,$3,$4)', [family, `${family}@calendar-notifications.test`, 'Test', 'unused']);
  for (const profile of profiles) {
    await pool.query('INSERT INTO profiles(id,family_id,name,public_id,emoji,color) VALUES($1,$2,$3,$1,$4,$5)', [profile.id, family, profile.name, '⭐', '#456']);
  }
  return family;
}

async function insertEvent(pool: Pool, profile: string, row: { id?: string; title?: string; start: string; repeat?: string; ended?: string | null }): Promise<string> {
  const id = row.id ?? randomUUID();
  await pool.query(`INSERT INTO calendar_events(id,profile_id,title,icon_key,start_date,"repeat",repeat_ended_on,revision)
    VALUES($1,$2,$3,'hiking',$4::date,$5,$6::date,1)`, [id, profile, row.title ?? 'Event', row.start, row.repeat ?? 'none', row.ended ?? null]);
  return id;
}

test('notifications are scoped to the session family and never show another family\'s profiles', { skip }, async () => {
  const pool = await openPool();
  const ownKid = randomUUID(), foreignKid = randomUUID();
  const family = await seedFamily(pool, [{ id: ownKid, name: 'Mun' }]);
  const foreign = await seedFamily(pool, [{ id: foreignKid, name: 'Bo' }]);
  const repo = createCalendarNotificationsRepository(pool);
  try {
    const ownEvent = await insertEvent(pool, ownKid, { title: 'Own', start: TODAY });
    const foreignEvent = await insertEvent(pool, foreignKid, { title: 'Foreign', start: TODAY });
    const foreignWeekly = await insertEvent(pool, foreignKid, { title: 'Foreign weekly', start: '2026-10-01', repeat: 'weekly' });

    const own = (await repo.list(family, TODAY_INSTANT)).items.filter(item => item.kind === 'kid');
    assert.deepEqual(own.map(item => item.occurrence_id), [`kid:${ownKid}:${ownEvent}:${TODAY}`]);
    assert.equal(own[0]!.profile_name, 'Mun');
    assert.equal(own[0]!.title, 'Own');

    const other = (await repo.list(foreign, TODAY_INSTANT)).items.filter(item => item.kind === 'kid');
    assert.deepEqual(other.map(item => item.occurrence_id), [
      `kid:${foreignKid}:${foreignEvent}:${TODAY}`,
      `kid:${foreignKid}:${foreignWeekly}:${TODAY}`,
    ].sort());
    assert.ok(!other.some(item => item.profile_id === ownKid), 'the other family never sees this family');
  } finally {
    await pool.query('DELETE FROM families WHERE id = ANY($1::text[])', [[family, foreign]]);
    await pool.end();
  }
});

test('weekly, monthly and yearly occurrences inside the window are listed and stopped series are not', { skip }, async () => {
  const pool = await openPool();
  const kid = randomUUID();
  const family = await seedFamily(pool, [{ id: kid, name: 'Mun' }]);
  const repo = createCalendarNotificationsRepository(pool);
  try {
    const weekly = await insertEvent(pool, kid, { title: 'Weekly', start: '2026-10-01', repeat: 'weekly' }); // Thu 10-29 inside
    const monthly = await insertEvent(pool, kid, { title: 'Monthly', start: '2026-03-31', repeat: 'monthly' }); // 10-31 inside
    const yearly = await insertEvent(pool, kid, { title: 'Yearly', start: '2024-10-30', repeat: 'yearly' }); // 10-30 inside
    const stopped = await insertEvent(pool, kid, { title: 'Stopped', start: '2026-10-01', repeat: 'weekly', ended: '2026-10-28' });
    const stoppedToday = await insertEvent(pool, kid, { title: 'Stopped today', start: '2026-10-01', repeat: 'weekly', ended: TODAY });

    const items = (await repo.list(family, TODAY_INSTANT)).items.filter(item => item.kind === 'kid');
    const sameDay = [`kid:${kid}:${weekly}:${TODAY}`, `kid:${kid}:${stoppedToday}:${TODAY}`].sort();
    assert.deepEqual(items.map(item => item.occurrence_id), [
      ...sameDay,
      `kid:${kid}:${yearly}:2026-10-30`,
      `kid:${kid}:${monthly}:2026-10-31`,
    ]);
    assert.ok(!items.some(item => item.occurrence_id.includes(stopped)), 'a series stopped before today is not listed');
    assert.equal(items.find(item => item.occurrence_id.includes(monthly))!.days_until, 2);
  } finally {
    await pool.query('DELETE FROM families WHERE id=$1', [family]);
    await pool.end();
  }
});

test('the window includes today and today plus three, and excludes yesterday and today plus four', { skip }, async () => {
  const pool = await openPool();
  const kid = randomUUID();
  const family = await seedFamily(pool, [{ id: kid, name: 'Mun' }]);
  const repo = createCalendarNotificationsRepository(pool);
  try {
    await insertEvent(pool, kid, { title: 'Yesterday', start: '2026-10-28' });
    const today = await insertEvent(pool, kid, { title: 'Today', start: TODAY });
    const plusThree = await insertEvent(pool, kid, { title: 'Plus three', start: '2026-11-01' });
    await insertEvent(pool, kid, { title: 'Plus four', start: '2026-11-02' });
    await insertEvent(pool, kid, { title: 'Weekly from yesterday', start: '2026-10-28', repeat: 'weekly' }); // next is 11-04, outside

    const items = (await repo.list(family, TODAY_INSTANT)).items.filter(item => item.kind === 'kid');
    assert.deepEqual(items.map(item => [item.title, item.days_until]), [['Today', 0], ['Plus three', 3]]);
    assert.deepEqual(items.map(item => item.occurrence_id), [`kid:${kid}:${today}:${TODAY}`, `kid:${kid}:${plusThree}:2026-11-01`]);
  } finally {
    await pool.query('DELETE FROM families WHERE id=$1', [family]);
    await pool.end();
  }
});

test('system events appear once for the family on Halloween and on Tet', { skip }, async () => {
  const pool = await openPool();
  const kid = randomUUID();
  const family = await seedFamily(pool, [{ id: kid, name: 'Mun' }]);
  const repo = createCalendarNotificationsRepository(pool);
  try {
    assert.equal(systemEventDate('halloween', 2026), '2026-10-31');
    const halloween = await repo.list(family, TODAY_INSTANT);
    assert.deepEqual(halloween.items.filter(item => item.kind === 'system'), [{
      occurrence_id: 'system:halloween:2026-10-31',
      kind: 'system',
      profile_id: null,
      profile_name: null,
      title_key: 'halloween',
      title: null,
      icon_key: 'halloween',
      date: '2026-10-31',
      days_until: 2,
    }]);

    const tetNow = new Date('2027-02-03T03:00:00Z'); // Vietnam 2027-02-03; Tet is 2027-02-06
    assert.equal(systemEventDate('tet', 2027), '2027-02-06');
    const tet = await repo.list(family, tetNow);
    assert.deepEqual(tet.items.filter(item => item.kind === 'system').map(item => [item.occurrence_id, item.days_until]), [['system:tet:2027-02-06', 3]]);
  } finally {
    await pool.query('DELETE FROM families WHERE id=$1', [family]);
    await pool.end();
  }
});

test('the database reads at most fifty rows per profile and the response caps at one hundred sorted items', { skip }, async () => {
  const pool = await openPool();
  const profiles = Array.from({ length: 5 }, (_, index) => ({ id: randomUUID(), name: `Kid ${index}` }));
  const family = await seedFamily(pool, profiles);
  const repo = createCalendarNotificationsRepository(pool);
  try {
    // 50 one-offs per profile, half on today and half tomorrow-plus-one: 250 kid occurrences before the cap.
    for (const profile of profiles) {
      for (let index = 0; index < 50; index++) {
        await insertEvent(pool, profile.id, { title: `E${index}`, start: index % 2 === 0 ? TODAY : '2026-10-30' });
      }
    }
    const capped = await repo.list(family, TODAY_INSTANT);
    assert.equal(capped.items.length, NOTIFICATION_ITEM_CAP);
    // Soonest items survive the cap: all 125 same-day occurrences sort before the 10-30 ones.
    assert.ok(capped.items.every(item => item.date === TODAY));

    // A profile with more rows than the bound: only 50 rows are read and expanded.
    const busy = randomUUID();
    const busyFamily = await seedFamily(pool, [{ id: busy, name: 'Busy' }]);
    try {
      for (let index = 0; index < 55; index++) await insertEvent(pool, busy, { title: `B${index}`, start: TODAY });
      const bounded = (await repo.list(busyFamily, TODAY_INSTANT)).items.filter(item => item.kind === 'kid');
      assert.equal(bounded.length, 50);
    } finally {
      await pool.query('DELETE FROM families WHERE id=$1', [busyFamily]);
    }
  } finally {
    await pool.query('DELETE FROM families WHERE id=$1', [family]);
    await pool.end();
  }
});
