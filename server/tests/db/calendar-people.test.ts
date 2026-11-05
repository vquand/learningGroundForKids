import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { assertSafeTestDatabaseUrl } from '../../src/db/test-database.js';
import { createCalendarPeopleRepository } from '../../src/calendar/participants.js';
import { createCalendarEventsRepository } from '../../src/calendar/events.js';
import { createCalendarRepository } from '../../src/calendar/repository.js';
import { createCalendarNotificationsRepository } from '../../src/calendar/notifications.js';
import { AppError } from '../../src/errors.js';
const skip = !process.env.TEST_DATABASE_URL;
const now = new Date('2026-11-01T03:00:00Z');
const fail = (status: number) => (e: unknown) => e instanceof AppError && e.status === status;

test('participants enforce both friendship scopes, parent choices, revocation and history without sharing events', { skip }, async () => {
  const pool = new Pool({ connectionString: assertSafeTestDatabaseUrl(process.env.TEST_DATABASE_URL!, []) });
  await migrate(drizzle(pool), { migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)) });
  const families = [randomUUID(), randomUUID(), randomUUID()]; const kids = Array.from({ length: 6 }, () => randomUUID());
  try {
    for (const family of families) await pool.query('INSERT INTO families(id,email,display_name,password_hash) VALUES($1,$2,\'Test\',\'unused\')', [family, `${family}@calendar-people.test`]);
    for (const [i, kid] of kids.entries()) await pool.query('INSERT INTO profiles(id,family_id,name,public_id,emoji,color) VALUES($1,$2,$3,$1,\'⭐\',\'#456\')', [kid, families[Math.floor(i / 2)], `Kid ${i}`]);
    const viewer = kids[0]!, sibling = kids[1]!, friend = kids[2]!, friendSibling = kids[3]!;
    const friendship = randomUUID();
    await pool.query(`INSERT INTO friend_requests(id,requesting_family_id,requesting_scope,requesting_profile_id,target_family_id,target_scope,target_profile_id,status,requesting_label,target_label,target_code,requester_message) VALUES($1,$2,'profile',$3,$4,'profile',$5,'accepted','Viewer','Friend','TEST','Hello')`, [friendship, families[0], viewer, families[1], friend]);
    const people = createCalendarPeopleRepository(pool), events = createCalendarEventsRepository(pool), calendar = createCalendarRepository(pool);
    assert.deepEqual((await people.candidates(viewer, '')).profiles.map(p => p.profile_id).sort(), [sibling, friend].sort());
    assert.deepEqual((await people.candidates(sibling, '')).profiles.map(p => p.profile_id), [viewer]);
    assert.deepEqual((await people.candidates(viewer, 'Kid 2')).profiles.map(p => p.profile_id), [friend]);
    assert.deepEqual(await people.settings(families[0]!), { disabled_roles: [], revision: 0 });
    await people.saveSettings(families[0]!, { disabled_roles: ['dad', 'maternal_grandma'], expected_revision: 0 });
    assert.equal((await people.candidates(viewer, '')).roles.includes('dad'), false);
    await assert.rejects(() => people.saveSettings(families[0]!, { disabled_roles: [], expected_revision: 0 }), fail(409));
    const base = { title: 'Park', icon_key: 'birthday', start_date: '2026-11-01', repeat: 'weekly' };
    await assert.rejects(() => events.create(viewer, { ...base, participants: [{ kind: 'role', key: 'dad' }] }, now), fail(422));
    for (const profile_id of [viewer, friendSibling, kids[4]!, randomUUID()]) await assert.rejects(() => events.create(viewer, { ...base, participants: [{ kind: 'profile', profile_id }] }, now), fail(422));
    const created = await events.create(viewer, { ...base, participants: [{ kind: 'role', key: 'mom' }, { kind: 'profile', profile_id: friend }, { kind: 'profile', profile_id: sibling }] }, now);
    assert.equal(created.participants?.length, 3); assert.equal(created.participants?.[1]?.kind, 'profile');
    await people.saveSettings(families[0]!, { disabled_roles: ['dad', 'mom'], expected_revision: 1 });
    const updated = await events.update(viewer, created.id, { ...base, title: 'Picnic', participants: [{ kind: 'role', key: 'mom' }, { kind: 'profile', profile_id: friend }], expected_revision: 1, from_date: '2026-11-08' }, now);
    assert.equal(updated.title, 'Picnic'); assert.equal(updated.participants?.length, 2, 'an existing now-hidden role can be retained');
    let read = await calendar.read(viewer, now);
    assert.deepEqual(read.events.map(e => [e.date, e.title, e.participants?.length]), [['2026-11-01', 'Park', 3], ['2026-11-08', 'Picnic', 2]]);
    assert.equal((await calendar.read(friend, now)).events.length, 0, 'participation does not copy or invite');
    assert.equal((await calendar.read(sibling, now)).events.length, 0);
    await pool.query("UPDATE friend_requests SET status='rejected' WHERE id=$1", [friendship]);
    read = await calendar.read(viewer, now);
    assert.ok(read.events.every(e => e.participants?.some(p => p.kind === 'role' && p.key === 'friend')));
    assert.ok(!JSON.stringify(read.events).includes(friend), 'revocation hides the former friend id and current name');
    await assert.rejects(() => events.update(viewer, created.id, { ...base, participants: [{ kind: 'profile', profile_id: friend }], expected_revision: 2, from_date: '2026-11-08' }, now), fail(422));
    // A family-wide friendship covers every child at both ends.
    await pool.query("UPDATE friend_requests SET requesting_scope='family',requesting_profile_id=NULL,target_scope='family',target_profile_id=NULL,status='accepted' WHERE id=$1", [friendship]);
    assert.ok((await people.candidates(sibling, '')).profiles.some(p => p.profile_id === friendSibling));
    const future = await events.create(viewer,{...base,start_date:'2026-11-05',participants:[{kind:'role',key:'friend'}]},now);
    const renamed = await events.update(viewer,future.id,{...base,title:'Future picnic',start_date:'2026-11-05',expected_revision:1},now);
    assert.equal(renamed.title,'Future picnic','legacy callers can still edit an event with participant history');
    assert.deepEqual(renamed.participants,[{kind:'role',key:'friend'}],'omitted participants preserve the selection');
    const stopped = await events.stopRepeat(viewer,future.id,{expected_revision:2},now);
    assert.equal(stopped.title,'Future picnic','stopping a future event returns its effective title and people');
    assert.deepEqual(stopped.participants,renamed.participants);

  } finally { for (const family of families) await pool.query('DELETE FROM families WHERE id=$1', [family]); await pool.end(); }
});

test('rescheduling future events rebases effective details to the new start', { skip }, async t => {
  const pool = new Pool({ connectionString: assertSafeTestDatabaseUrl(process.env.TEST_DATABASE_URL!, []) });
  await migrate(drizzle(pool), { migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)) });
  const today = new Date('2026-11-02T03:00:00Z');
  const mom = [{ kind: 'role' as const, key: 'mom' as const }];
  const dad = [{ kind: 'role' as const, key: 'dad' as const }];
  const scenarios: {
    name: string; repeat: 'none' | 'weekly'; next: string; from?: string;
    participants?: typeof mom | typeof dad; laterVersion?: boolean; hideMom?: boolean;
  }[] = [
    { name: 'one-off moves earlier with edited title, icon and people', repeat: 'none', next: '2026-11-03', from: '2026-11-05', participants: dad },
    { name: 'weekly series moves earlier with its new recurrence anchor', repeat: 'weekly', next: '2026-11-03', from: '2026-11-05', participants: dad },
    { name: 'weekly series moves later', repeat: 'weekly', next: '2026-11-07', from: '2026-11-05', participants: dad },
    { name: 'omitted people retain the old selection', repeat: 'weekly', next: '2026-11-03', from: '2026-11-05' },
    { name: 'legacy caller omits both occurrence date and people', repeat: 'weekly', next: '2026-11-03' },
    { name: 'existing hidden relative can be retained', repeat: 'weekly', next: '2026-11-03', from: '2026-11-05', participants: mom, hideMom: true },
    { name: 'people come from the selected old occurrence', repeat: 'weekly', next: '2026-11-03', from: '2026-11-12', laterVersion: true },
  ];
  try {
    for (const scenario of scenarios) await t.test(scenario.name, async () => {
      const family = randomUUID(), profile = randomUUID();
      try {
        await pool.query("INSERT INTO families(id,email,display_name,password_hash) VALUES($1,$2,'Test','unused')", [family, `${family}@calendar-reschedule.test`]);
        await pool.query("INSERT INTO profiles(id,family_id,name,public_id,emoji,color) VALUES($1,$2,'Kid',$1,'⭐','#456')", [profile, family]);
        const events = createCalendarEventsRepository(pool);
        const original = { title: 'Original event', icon_key: 'birthday', start_date: '2026-11-05', repeat: scenario.repeat };
        let current = await events.create(profile, { ...original, participants: mom }, today);
        if (scenario.laterVersion) current = await events.update(profile, current.id, {
          ...original, title: 'Later name', icon_key: 'star', from_date: '2026-11-12', participants: dad, expected_revision: current.revision,
        }, today);
        if (scenario.hideMom) await createCalendarPeopleRepository(pool).saveSettings(family, { disabled_roles: ['mom'], expected_revision: 0 });
        const input = {
          ...original, title: 'Edited outing', icon_key: 'music_lesson', start_date: scenario.next, expected_revision: current.revision,
          ...(scenario.from ? { from_date: scenario.from } : {}),
          ...(scenario.participants ? { participants: scenario.participants } : {}),
        };
        if (scenario.repeat === 'none') {
          // The source must still be a displayed occurrence of the old schedule.
          await assert.rejects(() => events.update(profile, current.id, { ...input, from_date: scenario.next }, today), fail(422));
          await assert.rejects(() => events.update(profile, current.id, { ...input, from_date: '2026-11-19' }, today), fail(422));
        }
        const expectedPeople = scenario.participants ?? (scenario.laterVersion ? dad : mom);
        const saved = await events.update(profile, current.id, input, today);
        const details = (event: { title: string; icon_key: string; participants?: unknown }) => ({ title: event.title, icon_key: event.icon_key, participants: event.participants });
        const expected = { title: input.title, icon_key: input.icon_key, participants: expectedPeople };
        assert.deepEqual(details(saved), expected, 'the save response uses the rebased version');
        assert.equal(saved.start_date, scenario.next);
        const calendar = await createCalendarRepository(pool).read(profile, today);
        const occurrences = calendar.events.filter(event => event.event_id === current.id);
        assert.deepEqual(occurrences.map(event => event.date), scenario.repeat === 'none' ? [scenario.next]
          : scenario.next === '2026-11-03' ? ['2026-11-03', '2026-11-10'] : ['2026-11-07', '2026-11-14']);
        for (const occurrence of occurrences) assert.deepEqual(details(occurrence), expected, 'reloading never restores old details');
        if (scenario.next === '2026-11-03') {
          const notifications = await createCalendarNotificationsRepository(pool).list(family, today);
          const reminder = notifications.items.find(item => item.occurrence_id.includes(current.id));
          assert.equal(reminder?.date, scenario.next);
          assert.equal(reminder?.title, input.title);
          assert.equal(reminder?.icon_key, input.icon_key);
        }
      } finally { await pool.query('DELETE FROM families WHERE id=$1', [family]); }
    });
  } finally { await pool.end(); }
});

test('people search strips Vietnamese accents and stroke, searches past the cap and keeps scopes', { skip }, async () => {
  const pool = new Pool({ connectionString: assertSafeTestDatabaseUrl(process.env.TEST_DATABASE_URL!, []) });
  await migrate(drizzle(pool), { migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)) });
  const family = randomUUID(), foreignFamily = randomUUID(), viewer = randomUUID(), friend = randomUUID();
  try {
    for (const id of [family, foreignFamily]) await pool.query("INSERT INTO families(id,email,display_name,password_hash) VALUES($1,$2,'Test','unused')", [id, `${id}@calendar-search.test`]);
    const rows = [{ id: viewer, family, name: 'Đỗ viewer' }, { id: friend, family: foreignFamily, name: 'Đỗ Hà friend' },
      { id: randomUUID(), family: foreignFamily, name: 'Đỗ Hà private sibling' },
      ...Array.from({ length: 105 }, (_, i) => ({ id: randomUUID(), family, name: `AAA ${String(i).padStart(3, '0')}` })),
      { id: randomUUID(), family, name: 'Đỗ Hà' }, { id: randomUUID(), family, name: 'Ha\u0300 decomposed' }];
    for (const row of rows) await pool.query("INSERT INTO profiles(id,family_id,name,public_id,emoji,color) VALUES($1,$2,$3,$1,'⭐','#456')", [row.id, row.family, row.name]);
    await pool.query(`INSERT INTO friend_requests(id,requesting_family_id,requesting_scope,requesting_profile_id,target_family_id,target_scope,target_profile_id,status,requesting_label,target_label,target_code,requester_message) VALUES($1,$2,'profile',$3,$4,'profile',$5,'accepted','Viewer','Friend','TEST','Hello')`, [randomUUID(), family, viewer, foreignFamily, friend]);
    let candidateLoads = 0;
    const observedPool = { async query(sql: string, params: unknown[]) {
      if (sql.startsWith('SELECT p.id AS profile_id')) candidateLoads++;
      return pool.query(sql, params);
    } } as unknown as Pool;
    const people = createCalendarPeopleRepository(observedPool);
    assert.equal((await people.candidates(viewer, '')).profiles.length, 100);
    assert.equal((await people.candidates(viewer, '')).has_more, true);
    assert.equal((await people.candidates(viewer, 'aaa')).has_more, true);
    for (const query of ['do', 'ĐỖ', 'dO']) {
      candidateLoads = 0;
      const found = await people.candidates(viewer, query);
      assert.deepEqual(found.profiles.map(row => row.name), ['Đỗ Hà', 'Đỗ Hà friend']);
      assert.deepEqual(found.profiles.map(row => row.source), ['family', 'friend']);
      assert.equal(found.has_more, false, 'filtered results determine has_more');
      assert.equal(candidateLoads, 1, 'a rare match after 100 rows still needs only one authorized candidate query');
    }
    assert.deepEqual((await people.candidates(viewer, 'HA')).profiles.map(row => row.name).sort(), ['Đỗ Hà', 'Đỗ Hà friend', 'Ha\u0300 decomposed'].sort());
    await pool.query("UPDATE friend_requests SET status='pending' WHERE requesting_profile_id=$1", [viewer]);
    assert.deepEqual((await people.candidates(viewer, 'do')).profiles.map(row => row.name), ['Đỗ Hà']);
  } finally {
    for (const id of [family, foreignFamily]) await pool.query('DELETE FROM families WHERE id=$1', [id]);
    await pool.end();
  }
});
