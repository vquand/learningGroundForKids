import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregateActivityGames, hasRecordedLearning, latestSavedActivity } from '../src/lib/activityReports.ts';
import type { ChildReport, GameReport } from '../src/api/parentReports.ts';
import { ACTIVITY_AGES } from '../src/pages/activityAgeGuidance.ts';
import { isPrivateQueryKey } from '../src/lib/familyQueries.ts';

const activity = (id: string, values: Array<[string, number | null]>, recorded = true): GameReport => ({
  id, name: id, scope: id === 'cooking' ? 'unavailable' : 'lifetime', recorded,
  metrics: values.map(([key, value]) => ({ key, label: key, value })), achievements: [], earning: 'none',
});
const child = (games: GameReport[], overrides: Partial<ChildReport> = {}): ChildReport => ({
  id: 'kid', name: 'Child', emoji: '⭐', color: '#345', avatar_type: 'emoji', avatar_url: null,
  avatar_frame: null, public_id: null, exploring_completed: 0, exploring_badges: 0,
  quiz_attempts: 0, quiz_passes: 0, earned_badges: 0, last_activity_at: null, latest_items: [], games, ...overrides,
});
test('family metrics combine matching keys, preserve unavailable counts and recorded siblings', () => {
  const games = aggregateActivityGames([
    child([activity('miniku', [['boards', 0], ['large', 0]], false), activity('cooking', [['completed', null]], false)]),
    child([activity('miniku', [['large', 2], ['boards', 6]]), activity('cooking', [['completed', null]], false)]),
  ]);
  assert.equal(games.find(game => game.id === 'miniku')?.recorded, true);
  assert.equal(games[0]?.metrics.find(metric => metric.key === 'boards')?.value, 6);
  assert.equal(games[0]?.metrics.find(metric => metric.key === 'large')?.value, 2);
  assert.equal(games[1]?.metrics[0]?.value, null);
  assert.deepEqual(aggregateActivityGames([]), []);
});
test('an automatically granted town home does not imply learning, while quizzes and minigames do', () => {
  assert.equal(hasRecordedLearning(child([activity('town-building', [['structures', 1]])])), false);
  assert.equal(hasRecordedLearning(child([])), false);
  assert.equal(hasRecordedLearning(child([], { quiz_attempts: 1 })), true);
  assert.equal(hasRecordedLearning(child([activity('miniku', [['boards', 1]])])), true);
  assert.equal(hasRecordedLearning(child([activity('fishing', [['caught', 1]])])), true);
  assert.equal(hasRecordedLearning(child([activity('fishing', [['caught', 0], ['questions', 1]])])), true);
  assert.equal(latestSavedActivity([child([]), child([], { last_activity_at: '2026-10-10T01:00:00Z' }), child([], { last_activity_at: '2026-10-14T01:00:00Z' })]), '2026-10-14T01:00:00Z');
  assert.equal(latestSavedActivity([]), null);
});

test('fishing family metrics preserve local point totals and its private caches clear on account change', () => {
  const games = aggregateActivityGames([
    child([activity('fishing', [['caught', 2], ['pondPoints', 5], ['riverPoints', 0]])]),
    child([activity('fishing', [['caught', 3], ['pondPoints', 60], ['riverPoints', 15]])]),
  ]);
  assert.deepEqual(games[0]?.metrics.map(metric => metric.value), [5, 65, 15]);
  assert.equal(isPrivateQueryKey(['fishing', 'family-a', 'kid']), true);
  assert.equal(isPrivateQueryKey(['profile-achievement-groups', 'family-a', 'kid']), true);
  assert.equal(ACTIVITY_AGES.fishing, 5);
});
