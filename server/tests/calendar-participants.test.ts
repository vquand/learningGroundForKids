import test from 'node:test';
import assert from 'node:assert/strict';
import { eventSchemas } from '../src/calendar/events.js';
import { eventParticipantsAt, eventNameAt } from '../src/calendar/names.js';
import { participantKey, participantSchema, settingsSchema } from '../src/calendar/participants.js';

test('participant inputs accept only reviewed roles or profile ids, never browser names or duplicates', () => {
  const input = { title: 'Park', icon_key: 'birthday', start_date: '2026-11-01', repeat: 'none' };
  const schema = eventSchemas('2026-11-01').create;
  assert.ok(schema.safeParse({ ...input, participants: [{ kind: 'role', key: 'dad' }, { kind: 'profile', profile_id: 'kid-2' }] }).success);
  for (const participants of [[{ kind: 'role', key: 'unknown' }], [{ kind: 'profile', profile_id: 'kid-2', name: 'Forged' }], [{ kind: 'role', key: 'dad' }, { kind: 'role', key: 'dad' }], Array.from({ length: 25 }, (_, i) => ({ kind: 'profile', profile_id: `kid-${i}` }))]) assert.equal(schema.safeParse({ ...input, participants }).success, false);
  assert.equal(participantSchema.safeParse({ kind: 'profile', profile_id: 'bad id!' }).success, false);
  assert.equal(participantKey({ kind: 'role', key: 'friend' }), 'role:friend');
});

test('family settings hide only fixed relatives and require a captured revision', () => {
  assert.ok(settingsSchema.safeParse({ disabled_roles: ['dad', 'maternal_grandma'], expected_revision: 0 }).success);
  for (const body of [{ disabled_roles: ['friend'], expected_revision: 0 }, { disabled_roles: ['dad', 'dad'], expected_revision: 1 }, { disabled_roles: [] }, { disabled_roles: [], expected_revision: 0, family_id: 'other' }]) assert.equal(settingsSchema.safeParse(body).success, false);
});

test('participant versions preserve earlier occurrences and stay out of notification name projections', () => {
  const event = {
title: 'Park', icon_key: 'birthday', name_history: [
      { from: '2026-11-01', title: 'Park', icon_key: 'birthday', participants: [{ kind: 'role' as const, key: 'dad' as const }] },
      { from: '2026-11-08', title: 'Walk', icon_key: 'birthday' },
      { from: '2026-11-15', title: 'Walk', icon_key: 'birthday', participants: [] },
    ]
};
  assert.deepEqual(eventParticipantsAt(event, '2026-10-31'), []);
  assert.deepEqual(eventParticipantsAt(event, '2026-11-08'), [{ kind: 'role', key: 'dad' }]);
  assert.deepEqual(eventParticipantsAt(event, '2026-11-15'), []);
  assert.deepEqual(eventNameAt(event, '2026-11-08'), { title: 'Walk', icon_key: 'birthday' });
});

test('invalid stored participant selections are omitted rather than displayed as trusted roles', () => {
  assert.deepEqual(eventParticipantsAt({ name_history: [{ from: '2026-11-01', title: 'Park', icon_key: 'birthday', participants: [{ kind: 'role', key: 'forged' }] as never }] }, '2026-11-01'), []);
});
