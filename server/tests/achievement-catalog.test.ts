import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { ACHIEVEMENT_GROUPS, INFINIDRILL_ACHIEVEMENT_GROUP } from '../src/achievement-catalog.js';
import { ROAD_ACHIEVEMENTS, ROAD_BADGE_COLUMNS, ROAD_BADGE_ROWS } from '../src/road-racing/achievements.js';

test('Earth expedition has ten named achievements with shared badge style and obtainable difficulties', async () => {
  const group = INFINIDRILL_ACHIEVEMENT_GROUP;
  assert.equal(group.id, 'infinidrill-earth');
  assert.equal(group.achievements.length, 10);
  assert.equal(new Set(group.achievements.map(a => a.id)).size, 10);
  assert.ok(group.achievements.every(a => a.badge === '/minigames/infinidrill/achievement-badges.png' && a.badgeColumns === 5 && a.badgeRows === 2));
  for (const achievement of group.achievements) {
    assert.ok(achievement.name && achievement.description);
    assert.ok(['easy', 'medium', 'hard', 'legendary'].includes(achievement.difficulty));
    assert.ok(achievement.target > 0);
  }
  const badgeComponent = await readFile(new URL('../../frontend/src/features/achievements/AchievementBadgeArt.tsx', import.meta.url), 'utf8');
  assert.match(badgeComponent, /backgroundPosition/);
  const artPrompt = await readFile(new URL('../../frontend/public/minigames/achievements/UNIVERSAL_BADGE_ART_PROMPT.md', import.meta.url), 'utf8');
  assert.match(artPrompt, /storybook keepsakes/);
  assert.equal(group.achievements.find(a => a.metric === 'coreReached')?.target, 1);
});

test('catalog status detects stale definitions as well as missing ones', async () => {
  const { achievementGroupStatus } = await import('../src/achievement-catalog.js');
  const group = INFINIDRILL_ACHIEVEMENT_GROUP;
  const stored = group.achievements.map(a => ({ ...a, groupId: group.id }));
  assert.equal(achievementGroupStatus(group, stored).needsMigration, false);
  stored[0]!.description = 'Outdated condition';
  assert.equal(achievementGroupStatus(group, stored).installed, 9);
  assert.equal(achievementGroupStatus(group, stored).needsMigration, true);
  assert.equal(achievementGroupStatus(group, []).installed, 0);
});

test('admin catalogs cover every server-backed game with stable, unique group-scoped definitions', () => {
  assert.deepEqual(ACHIEVEMENT_GROUPS.map(group => group.id), ['infinidrill-earth', 'shoo-shoo-ufo', 'waddle-wall', 'cooking', 'burger', 'food-and-drink', 'town-building', 'miniku', 'halloween', 'cabbage-rolls', 'fishing', 'womens-day-2026', 'road-racing', 'daily-quiz', 'town-lake', 'xmas-2026']);
  for (const group of ACHIEVEMENT_GROUPS) {
    const ids = group.achievements.map(a => a.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(group.achievements.every(a => a.badge && a.description && a.metric && a.target > 0));
  }
  assert.equal(ACHIEVEMENT_GROUPS[1]?.achievements.length, 15);
  assert.equal(ACHIEVEMENT_GROUPS[2]?.achievements.length, 7);
  assert.ok(ACHIEVEMENT_GROUPS.slice(3, 6).every(group => group.earning === 'catalog-only'));
  assert.equal(ACHIEVEMENT_GROUPS.find(group => group.id === 'cabbage-rolls')?.achievements.length, 4);
});

test('Fishing Friends installs the complete seven-badge server-verified catalog', async () => {
  const group = ACHIEVEMENT_GROUPS.find(group => group.id === 'fishing');
  assert.ok(group);
  assert.equal(group.name, 'Fishing Friends');
  assert.equal(group.earning, 'server-verified');
  assert.equal(group.achievements.length, 7);
  assert.deepEqual(group.achievements.map(badge => badge.metric), ['fishingCaught', 'fishingPondPoints', 'fishingRiverPoints', 'fishingPondSpecies', 'fishingRiverSpecies', 'fishingBaits', 'fishingFriends']);
  assert.deepEqual(group.achievements.map(badge => badge.target), [1, 60, 180, 6, 7, 7, 3]);
  assert.ok(group.achievements.every(badge => badge.badge === '/minigames/fishing/achievement-badges.png' && badge.badgeColumns === 4 && badge.badgeRows === 2));
  const { achievementGroupStatus } = await import('../src/achievement-catalog.js');
  const installed = group.achievements.map(badge => ({ ...badge, groupId: group.id }));
  assert.equal(achievementGroupStatus(group, installed).needsMigration, false);
  assert.equal(achievementGroupStatus(group, installed).installed, 7);
});

test('Road Racing appends two snail badges in a 4×5 sheet while preserving the first sixteen cells', () => {
  assert.equal(ROAD_ACHIEVEMENTS.length, 18);
  assert.deepEqual(ROAD_ACHIEVEMENTS.slice(0, 16).map(achievement => [achievement.badgeColumns, achievement.badgeRows, achievement.badgeIndex]),
    Array.from({ length: 16 }, (_, index) => [4, 5, index]));
  assert.deepEqual(ROAD_ACHIEVEMENTS.slice(16).map(achievement => [achievement.name, achievement.badgeIndex]),
    [['Slow and Steady', 16], ['Snail Survivor', 17]]);
  assert.ok(ROAD_ACHIEVEMENTS.every(achievement => achievement.badgeColumns === ROAD_BADGE_COLUMNS
    && achievement.badgeRows === ROAD_BADGE_ROWS
    && achievement.badge === '/minigames/road-racing/badges.png'
    && achievement.badgeIndex! >= 0
    && achievement.badgeIndex! < achievement.badgeColumns! * achievement.badgeRows!));
});

test('cabbage rolls define completion and three outcome collectibles without enabling client awards', () => {
  const group = ACHIEVEMENT_GROUPS.find(group => group.id === 'cabbage-rolls');
  assert.ok(group);
  assert.equal(group.earning, 'server-verified');
  assert.deepEqual(group.achievements.map(a => [a.id, a.metric, a.target, a.difficulty]), [
    ['cabbage-rolls-completed', 'cabbageRollsCompleted', 1, 'easy'],
    ['cabbage-rolls-undercooked', 'cabbageRollsUndercooked', 1, 'easy'],
    ['cabbage-rolls-burnt', 'cabbageRollsBurnt', 1, 'medium'],
    ['cabbage-rolls-perfect', 'cabbageRollsPerfect', 1, 'medium'],
  ]);
  assert.deepEqual(group.achievements.map(a => a.badgeIndex), [0, 1, 2, 3]);
  assert.ok(group.achievements.every(a => a.badge === '/minigames/cooking/cabbage-rolls/achievement-badges.png' && a.badgeColumns === 2 && a.badgeRows === 2));
  assert.match(group.achievements[0]!.description, /any final result/);
});
