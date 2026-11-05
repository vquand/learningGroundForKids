import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BLUEPRINTS,
  emptyTown,
  expireEventBuildings,
  isPassable,
  allowedDirections,
  canRotate,
  nextDirection,
  placementError,
  bridgeSupportError,
  countInstalledSnowSculptures,
  movementCost,
  movementCropCost,
  type Entity,
  type TownCommand,
  type TownState,
} from '../src/town-building/game.ts';
import {
  isSnowSculpture,
  isXmasOpen,
  xmasOccurrence,
  xmasStartingYear,
  XMAS_EVENT_ID,
  XMAS_EDITION,
  XMAS_SCULPTURE_IDS,
  type SnowSculptureId,
} from '../src/town-building/events/xmas2026Model.ts';
import { XMAS_ACHIEVEMENTS, XMAS_GROUP_ID } from '../src/town-building/events/xmasAchievements.ts';
import { xmasProgress } from '../src/town-building/events/xmasProgress.ts';
import { applyMapLandCommand } from '../src/town-building/maps/land.ts';
import { emptyLake } from '../src/town-building/maps/lake/game.ts';
import { landView } from '../src/town-building/maps/view.ts';
import { mapDefinition } from '../src/town-building/maps/registry.ts';
import { civWalkable } from '../src/town-building/civ.ts';
import { animalWalkable } from '../src/town-building/animalWorld.ts';
import { tickMap } from '../src/town-building/mapTick.ts';
import { runTimedEvents } from '../src/town-building/events/runtime.ts';
import { xmasEvent } from '../src/town-building/events/xmas2026.ts';
import { ACHIEVEMENT_GROUPS, achievementGroupStatus } from '../src/achievement-catalog.ts';
import { summarizeChild, type ReportRow } from '../src/parent-reports/summary.ts';

import type { GardenEnvironment } from '../src/town-building/garden.ts';

const openWeather: GardenEnvironment = {
  season: 'winter' as const,
  localDate: '2026-12-25',
  timeOfDay: 'morning',
  isDay: true,
  precipitation: 'none' as const,
};

function seedTown(): TownState {
  const s = emptyTown();
  s.materials.stamina = 100;
  s.materials.wood = 50;
  s.materials.rock = 50;
  s.storage = {
    built: true,
    crops: { carrot: 10, tomato: 10, pumpkin: 10, corn: 10, peas: 10 },
    milk: [],
    fish: { P1: [{ count: 10, at: 1000 }] },
    wool: 20,
    yarn: 20,
  };
  const lake = emptyLake(1000);
  lake.reserve = { P1: 10, P3: 0, P4: 0, P5: 0, R4: 0 };
  s.maps = { lake };
  return s;
}

const execCommand = (
  s: TownState,
  c: TownCommand,
  mapId: 'town' | 'lake' = 'town',
  weather: GardenEnvironment = openWeather,
  id = 'sculpture-test',
) => applyMapLandCommand(s, { type: 'land-action', mapId, command: c }, 2000, id, weather);

test('window edges: Dec 19 closed, Dec 20 open, Jan 6 open, Jan 7 closed melt, Jan 3 2027 belongs to 2026', () => {
  // Closed before event
  assert.equal(isXmasOpen('2026-12-19'), false);
  assert.equal(xmasOccurrence({ localDate: '2026-12-19', timeOfDay: 'morning' }), undefined);

  // Dec 20: open
  assert.equal(isXmasOpen('2026-12-20'), true);
  assert.equal(xmasOccurrence({ localDate: '2026-12-20', timeOfDay: 'morning' }), '2026');
  assert.equal(xmasStartingYear('2026-12-20'), 2026);

  // Dec 31: open
  assert.equal(isXmasOpen('2026-12-31'), true);
  assert.equal(xmasOccurrence({ localDate: '2026-12-31', timeOfDay: 'morning' }), '2026');
  assert.equal(xmasStartingYear('2026-12-31'), 2026);

  // Jan 1: open, occurrence is starting year 2026
  assert.equal(isXmasOpen('2027-01-01'), true);
  assert.equal(xmasOccurrence({ localDate: '2027-01-01', timeOfDay: 'morning' }), '2026');
  assert.equal(xmasStartingYear('2027-01-01'), 2026);

  // Jan 3: open, belongs to 2026
  assert.equal(isXmasOpen('2027-01-03'), true);
  assert.equal(xmasOccurrence({ localDate: '2027-01-03', timeOfDay: 'morning' }), '2026');
  assert.equal(xmasStartingYear('2027-01-03'), 2026);

  // Jan 6: open
  assert.equal(isXmasOpen('2027-01-06'), true);
  assert.equal(xmasOccurrence({ localDate: '2027-01-06', timeOfDay: 'morning' }), '2026');
  assert.equal(xmasStartingYear('2027-01-06'), 2026);

  // Jan 7: closed (melt date)
  assert.equal(isXmasOpen('2027-01-07'), false);
  assert.equal(xmasOccurrence({ localDate: '2027-01-07', timeOfDay: 'morning' }), undefined);

  // Unknown clock or preview never starts occurrence
  assert.equal(xmasOccurrence({ localDate: '2026-12-25' }), undefined, 'missing timeOfDay');
  assert.equal(xmasOccurrence({ timeOfDay: 'morning' }), undefined, 'missing localDate');
  assert.equal(xmasOccurrence({ localDate: '2026-12-25', timeOfDay: 'morning', weatherSource: 'preview' }), undefined, 'preview rejected');

  // Building outside window is refused with clear error
  const s = seedTown();
  assert.throws(
    () => execCommand(s, { type: 'build', blueprintId: 'snow-snowman', x: 8, y: 4 }, 'town', { ...openWeather, localDate: '2026-12-19' }),
    /available from December 20 to January 6/i,
  );
  assert.throws(
    () => execCommand(s, { type: 'build', blueprintId: 'snow-snowman', x: 8, y: 4 }, 'town', { ...openWeather, localDate: '2027-01-07' }),
    /available from December 20 to January 6/i,
  );
  assert.throws(
    () => execCommand(s, { type: 'build', blueprintId: 'snow-snowman', x: 8, y: 4 }, 'town', { ...openWeather, localDate: '' }),
    /available from December 20 to January 6/i,
  );

  // Non-admin preview is rejected
  assert.throws(
    () => execCommand(s, { type: 'build', blueprintId: 'snow-snowman', x: 8, y: 4 }, 'town', { ...openWeather, localDate: '2026-11-01', weatherSource: 'preview' }),
    /available from December 20 to January 6/i,
  );
});

test('costs/debits for all 10 sculptures, 5 stamina each, eventYear saved', () => {
  assert.equal(XMAS_SCULPTURE_IDS.length, 10);

  type SculptureConfig = {
    id: SnowSculptureId;
    cost: Partial<Record<'wood' | 'rock' | 'wool' | 'yarn' | 'fish', number>>;
    crop: Partial<Record<'carrot' | 'tomato' | 'pumpkin' | 'corn' | 'peas', number>>;
    storage: Partial<Record<'wool' | 'yarn' | 'fish', number>>;
  };

  const sculpturesConfig: readonly SculptureConfig[] = [
    { id: 'snow-snowman', cost: { wood: 2 }, crop: { carrot: 1 }, storage: {} },
    { id: 'snow-rabbit', cost: { wool: 1 }, crop: { tomato: 1 }, storage: { wool: 1 } },
    { id: 'snow-owl', cost: { wool: 2 }, crop: {}, storage: { wool: 2 } },
    { id: 'snow-penguin', cost: { yarn: 1, fish: 1 }, crop: {}, storage: { yarn: 1, fish: 1 } },
    { id: 'snow-fox', cost: { yarn: 1 }, crop: { pumpkin: 1 }, storage: { yarn: 1 } },
    { id: 'snow-lamb', cost: { wool: 2 }, crop: { corn: 1 }, storage: { wool: 2 } },
    { id: 'snow-duckling', cost: { wood: 1 }, crop: { peas: 1 }, storage: {} },
    { id: 'snow-bear', cost: { rock: 3, yarn: 1 }, crop: {}, storage: { yarn: 1 } },
    { id: 'snow-tree', cost: { wood: 2, yarn: 1 }, crop: {}, storage: { yarn: 1 } },
    { id: 'snow-angel', cost: { wool: 1, yarn: 1 }, crop: {}, storage: { wool: 1, yarn: 1 } },
  ];

  for (const config of sculpturesConfig) {
    const b = BLUEPRINTS.find(item => item.id === config.id);
    assert.ok(b, `blueprint ${config.id} must exist`);
    assert.equal(b.width, 1);
    assert.equal(b.length, 1);
    assert.equal(b.learned, 0);
    assert.equal(b.cost.stamina, 5);

    const s = seedTown();
    const prevStamina = s.materials.stamina;
    const prevWood = s.materials.wood;
    const prevRock = s.materials.rock;
    const prevWool = s.storage!.wool ?? 0;
    const prevYarn = s.storage!.yarn ?? 0;
    const prevFish = s.maps!.lake!.reserve.P1 ?? 0;

    const res = execCommand(s, { type: 'build', blueprintId: config.id, x: 8, y: 4 }, 'town', openWeather, `entity-${config.id}`);
    const placed = res.entities.find(e => e.id === `entity-${config.id}`);
    assert.ok(placed);
    assert.equal(placed.eventYear, 2026);
    assert.equal(placed.paidCost.stamina, 5);
    assert.equal(res.materials.stamina, prevStamina - 5);

    if (config.cost.wood) assert.equal(res.materials.wood, prevWood - config.cost.wood);
    if (config.cost.rock) assert.equal(res.materials.rock, prevRock - config.cost.rock);
    if (config.storage.wool) assert.equal(res.storage!.wool, prevWool - config.storage.wool);
    if (config.storage.yarn) assert.equal(res.storage!.yarn, prevYarn - config.storage.yarn);
    if (config.storage.fish) {
      assert.equal(res.maps!.lake!.reserve.P1, prevFish - 1);
      assert.equal(res.storage!.fish.P1![0]!.count, 9);
    }
  }
});

test('stamina requirement: exactly 5 stamina needed, out of stamina refuses with clear error and no write', () => {
  const s = seedTown();
  s.materials.stamina = 4; // Not enough (needs 5)
  assert.throws(
    () => execCommand(s, { type: 'build', blueprintId: 'snow-snowman', x: 8, y: 4 }),
    /missing materials/i,
  );
  assert.equal(s.materials.stamina, 4, 'no state write when out of stamina');
  assert.equal(s.entities.length, 0);
});

test('unaffordable crops or storage products refuse with clear error and no write', () => {
  // Missing carrot for snowman
  const noCarrot = seedTown();
  delete noCarrot.storage!.crops.carrot;
  assert.throws(
    () => execCommand(noCarrot, { type: 'build', blueprintId: 'snow-snowman', x: 8, y: 4 }),
    /crops|carrot/i,
  );
  assert.equal(noCarrot.materials.stamina, 100);

  // Missing wool for owl
  const noWool = seedTown();
  noWool.storage!.wool = 0;
  assert.throws(
    () => execCommand(noWool, { type: 'build', blueprintId: 'snow-owl', x: 8, y: 4 }),
    /materials/i,
  );
  assert.equal(noWool.materials.stamina, 100);

  // Missing fish for penguin
  const noFish = seedTown();
  noFish.maps!.lake!.reserve.P1 = 0;
  noFish.storage!.fish = {};
  assert.throws(
    () => execCommand(noFish, { type: 'build', blueprintId: 'snow-penguin', x: 8, y: 4 }),
    /materials|fish/i,
  );
  assert.equal(noFish.materials.stamina, 100);
});

test('cap: 100 installed sculptures per child, all maps combined', () => {
  let s = seedTown();
  // Fill Town with 50 sculptures and Lake with 50 sculptures
  for (let i = 0; i < 50; i++) {
    s.entities.push({
      id: `town-sculpture-${i}`,
      blueprintId: 'snow-snowman',
      x: 0,
      y: i,
      paidCost: { stamina: 5, wood: 2 },
      eventYear: 2026,
    });
    s.maps!.lake!.land.entities.push({
      id: `lake-sculpture-${i}`,
      blueprintId: 'snow-rabbit',
      x: 0,
      y: i,
      paidCost: { stamina: 5, wool: 1 },
      eventYear: 2026,
    });
  }

  assert.equal(countInstalledSnowSculptures(s), 100);

  // Attempting to build 101st on Town fails
  assert.throws(
    () => execCommand(s, { type: 'build', blueprintId: 'snow-snowman', x: 8, y: 4 }, 'town'),
    /100/i,
  );

  // Attempting to build 101st on Lake fails
  assert.throws(
    () => execCommand(s, { type: 'build', blueprintId: 'snow-rabbit', x: 8, y: 4 }, 'lake'),
    /100/i,
  );

  // Moving an existing sculpture at the cap is allowed
  s.materials.stamina = 50;
  s.materials.wood = 50;
  const moved = execCommand(s, { type: 'move', entityId: 'town-sculpture-0', x: 8, y: 4 }, 'town');
  assert.ok(moved.entities.find(e => e.id === 'town-sculpture-0' && e.x === 8 && e.y === 4));
});

test('rotation: four facings via the existing rotation mechanism', () => {
  for (const id of XMAS_SCULPTURE_IDS) {
    assert.equal(canRotate(id), true);
    assert.deepEqual(allowedDirections(id), ['front', 'left', 'back', 'right']);
    assert.equal(nextDirection(id, 'front'), 'left');
    assert.equal(nextDirection(id, 'left'), 'back');
    assert.equal(nextDirection(id, 'back'), 'right');
    assert.equal(nextDirection(id, 'right'), 'front');
  }

  // Building with direction
  const s = seedTown();
  const built = execCommand(s, { type: 'build', blueprintId: 'snow-owl', x: 8, y: 4, direction: 'back' });
  assert.equal(built.entities[0]!.direction, 'back');
});

test('walking blocking and bridge support rules as lantern', () => {
  const s = seedTown();
  const built = execCommand(s, { type: 'build', blueprintId: 'snow-bear', x: 8, y: 4 });
  const bear = built.entities[0]!;
  assert.equal(isPassable(bear), false);
  assert.equal(civWalkable(built.entities, mapDefinition('town')).has('8:4'), false);

  // Stands on bridge deck and blocks it
  let bridgeTown = seedTown();
  bridgeTown.entities = [{ id: 'bridge-1', blueprintId: 'wood-bridge', x: 16, y: 12, paidCost: { wood: 2 } }];
  bridgeTown = execCommand(bridgeTown, { type: 'build', blueprintId: 'snow-tree', x: 16, y: 12 });
  assert.equal(bridgeTown.entities.length, 2);
  assert.equal(civWalkable(bridgeTown.entities, mapDefinition('town')).has('16:12'), false);

  // Protecting bridge from removal or movement
  for (const c of [
    { type: 'remove' as const, entityId: 'bridge-1' },
    { type: 'remove-line' as const, entityId: 'bridge-1' },
    { type: 'move' as const, entityId: 'bridge-1', x: 16, y: 13 },
  ]) {
    assert.throws(() => execCommand(bridgeTown, c), /snow sculpture/i);
  }
});

test('move and transfer preserve paidCost and occurrence year', () => {
  const s = seedTown();
  const built = execCommand(s, { type: 'build', blueprintId: 'snow-penguin', x: 8, y: 4 }, 'town', { ...openWeather, localDate: '2027-01-03' });
  const penguin = built.entities[0]!;
  assert.equal(penguin.eventYear, 2026);
  assert.deepEqual(penguin.paidCost, { stamina: 5, yarn: 1, fish: 1 });

  // Move within Town
  const moved = execCommand(built, { type: 'move', entityId: penguin.id, x: 8, y: 5 }, 'town');
  const movedPenguin = moved.entities[0]!;
  assert.equal(movedPenguin.eventYear, 2026);
  assert.deepEqual(movedPenguin.paidCost, { stamina: 5, yarn: 1, fish: 1 });

  // Transfer Town -> Lake
  const transferred = applyMapLandCommand(
    moved,
    { type: 'transfer-building', entityId: penguin.id, sourceMap: 'town', destinationMap: 'lake', x: 8, y: 4 },
    3000,
    'transfer-test',
    openWeather,
  );
  assert.equal(transferred.entities.length, 0);
  const lakePenguin = transferred.maps!.lake!.land.entities[0]!;
  assert.equal(lakePenguin.eventYear, 2026);
  assert.deepEqual(lakePenguin.paidCost, { stamina: 5, yarn: 1, fish: 1 });
});

test('melt: Jan 7 on/after removes all sculptures on every saved map with durable revision, no refund, no receipts', () => {
  let s = seedTown();
  s.entities.push(
    { id: 'snowman-1', blueprintId: 'snow-snowman', x: 8, y: 4, paidCost: { stamina: 5, wood: 2 }, eventYear: 2026 },
    { id: 'normal-house', blueprintId: 'house', x: 2, y: 2, paidCost: { wood: 9 } },
  );
  s.maps!.lake!.land.entities.push(
    { id: 'rabbit-1', blueprintId: 'snow-rabbit', x: 8, y: 4, paidCost: { stamina: 5, wool: 1 }, eventYear: 2026 },
  );

  const prevWood = s.materials.wood;
  const prevStamina = s.materials.stamina;
  const prevRev = s.revision;

  // Earlier date: Dec 25, 2026 does not melt
  expireEventBuildings(s, '2026-12-25');
  assert.equal(s.entities.some(e => e.blueprintId === 'snow-snowman'), true);
  assert.equal(s.revision, prevRev);

  // Jan 6, 2027 does not melt
  expireEventBuildings(s, '2027-01-06');
  assert.equal(s.entities.some(e => e.blueprintId === 'snow-snowman'), true);
  assert.equal(s.revision, prevRev);

  // Malformed date does not melt
  expireEventBuildings(s, '2027-02-30');
  expireEventBuildings(s, 'invalid-date');
  assert.equal(s.entities.some(e => e.blueprintId === 'snow-snowman'), true);

  // Jan 7, 2027: MELT!
  const melted = applyMapLandCommand(
    s,
    { type: 'land-action', mapId: 'town', command: { type: 'rename', adjective: 'Cozy', noun: 'Valley' } },
    4000,
    'melt-test',
    { ...openWeather, localDate: '2027-01-07' },
  );

  assert.equal(melted.entities.some(e => isSnowSculpture(e.blueprintId)), false);
  assert.equal(melted.maps!.lake!.land.entities.some(e => isSnowSculpture(e.blueprintId)), false);
  // House preserved
  assert.ok(melted.entities.some(e => e.blueprintId === 'house'));
  // No refund
  assert.equal(melted.materials.wood, prevWood);
  assert.equal(melted.materials.stamina, prevStamina);
  assert.ok(melted.revision > prevRev);
});

test('deduplication of completion receipts and achievement thresholds', () => {
  let s = seedTown();
  // Build 1st sculpture: Snowy Friends (easy)
  s = execCommand(s, { type: 'build', blueprintId: 'snow-snowman', x: 8, y: 4 }, 'town', openWeather, 'sculpture-1');
  assert.ok(s.earned['xmas-2026-snowy-friends'], 'Snowy Friends awarded on 1st sculpture');
  const h1 = s.eventHistory?.xmas?.['2026'];
  assert.ok(h1);
  assert.equal(h1.total, 1);
  assert.equal(h1.receipts?.length, 1);

  // Duplicate receipt does not double count
  s = execCommand(s, { type: 'build', blueprintId: 'snow-snowman', x: 8, y: 5 }, 'town', openWeather, 'sculpture-1');
  const h2 = s.eventHistory?.xmas?.['2026'];
  assert.ok(h2);
  assert.equal(h2.total, 1);
  assert.equal(h2.receipts?.length, 1);

  // Build remaining 9 distinct types -> Snow Parade (medium)
  const remaining = [
    'snow-rabbit', 'snow-owl', 'snow-penguin', 'snow-fox', 'snow-lamb',
    'snow-duckling', 'snow-bear', 'snow-tree', 'snow-angel',
  ] as const;

  for (let i = 0; i < remaining.length; i++) {
    s.materials.stamina = 100;
    s.storage!.wool = 20;
    s.storage!.yarn = 20;
    s.maps!.lake!.reserve.P1 = 10;
    s.storage!.fish.P1 = [{ count: 10, at: 1000 }];
    const x = 2 + Math.floor(i / 3);
    const y = 10 + (i % 3);
    s = execCommand(s, { type: 'build', blueprintId: remaining[i]!, x, y }, 'town', openWeather, `type-${i + 2}`);
  }
  const h3 = s.eventHistory?.xmas?.['2026'];
  assert.ok(h3);
  assert.equal(h3.builtTypes?.length, 10);
  assert.ok(s.earned['xmas-2026-snow-parade'], 'Snow Parade awarded after all 10 types built');

  // Winter Wonderland (20 installed at once)
  for (let i = 11; i <= 20; i++) {
    s.materials.stamina = 100;
    s.materials.wood = 50;
    s.storage!.crops.carrot = 20;
    const x = 2 + Math.floor((i - 11) / 5);
    const y = 15 + ((i - 11) % 5);
    s = execCommand(s, { type: 'build', blueprintId: 'snow-snowman', x, y }, 'town', openWeather, `wonderland-${i}`);
  }
  assert.ok(s.earned['xmas-2026-winter-wonderland'], 'Winter Wonderland awarded with 20 installed sculptures');

  // Snowman Army (20 snowmen)
  for (let i = 21; i <= 30; i++) {
    s.materials.stamina = 100;
    s.materials.wood = 50;
    s.storage!.crops.carrot = 20;
    const x = 5 + Math.floor((i - 21) / 5);
    const y = 15 + ((i - 21) % 5);
    s = execCommand(s, { type: 'build', blueprintId: 'snow-snowman', x, y }, 'town', openWeather, `army-${i}`);
  }
  assert.ok(s.earned['xmas-2026-snowman-army'], 'Snowman Army awarded with 20 snowmen');
});

test('child-report projection includes xmas-2026 group in both parent and admin reports', () => {
  const s = seedTown();
  s.eventHistory = {
    xmas: {
      '2026': {
        edition: XMAS_EDITION,
        total: 15,
        byType: { 'snow-snowman': 10, 'snow-rabbit': 5 },
        builtTypes: ['snow-snowman', 'snow-rabbit'],
        maxSimultaneous: 12,
        receipts: ['r1', 'r2'],
        counters: {},
      },
    },
  };
  s.earned['xmas-2026-snowy-friends'] = '2026-12-25T10:00:00Z';

  const row: ReportRow = {
    id: 'kid-1',
    name: 'Alice',
    emoji: '⭐',
    color: 'blue',
    town: s,
  };

  const report = summarizeChild(row);
  const xmasGame = report.games.find(g => g.id === XMAS_GROUP_ID);
  assert.ok(xmasGame, 'xmas-2026 must be present in games report');
  assert.equal(xmasGame.recorded, true);
  assert.equal(xmasGame.earning, 'server-verified');

  // Verify metric values
  const metricMap = Object.fromEntries(xmasGame.metrics.map(m => [m.key, m.value]));
  assert.equal(metricMap.sculptures, 15);
  assert.equal(metricMap.distinctTypes, 2);
  assert.equal(metricMap.maxSimultaneous, 12);
  assert.equal(metricMap.snowmen, 10);
  assert.equal(metricMap.rabbits, 5);

  // Verify badge progress
  const firstBadge = xmasGame.achievements.find(a => a.id === 'xmas-2026-snowy-friends');
  assert.ok(firstBadge);
  assert.equal(firstBadge.earned, true);
  assert.equal(firstBadge.earned_at, '2026-12-25T10:00:00.000Z');
  assert.equal(firstBadge.current, 15);
});

test('admin achievement catalog migration: group-level compare, idempotent sync', () => {
  const group = ACHIEVEMENT_GROUPS.find(g => g.id === XMAS_GROUP_ID);
  assert.ok(group, 'xmas-2026 must be in ACHIEVEMENT_GROUPS');
  assert.equal(group.achievements.length, 7);

  // Clean uninstalled
  const uninstalledStatus = achievementGroupStatus(group, []);
  assert.equal(uninstalledStatus.installed, 0);
  assert.equal(uninstalledStatus.needsMigration, true);

  // Fully installed
  const installedRows = group.achievements.map(a => ({ ...a, groupId: group.id }));
  const installedStatus = achievementGroupStatus(group, installedRows);
  assert.equal(installedStatus.installed, 7);
  assert.equal(installedStatus.needsMigration, false);
});

test('timed event lifecycle: events[xmas] cleanup on Jan 7 retains eventHistory', () => {
  const s = seedTown();
  s.events = {
    xmas: {
      occurrence: '2026',
      edition: XMAS_EDITION,
      data: { year: '2026' },
    },
  };
  s.eventHistory = {
    xmas: {
      '2026': {
        edition: XMAS_EDITION,
        total: 5,
        byType: { 'snow-snowman': 5 },
        builtTypes: ['snow-snowman'],
        maxSimultaneous: 5,
        receipts: ['r1', 'r2', 'r3', 'r4', 'r5'],
        counters: {},
      },
    },
  };

  // Run timed events on Jan 7
  const map = mapDefinition('town');
  runTimedEvents(
    s,
    map,
    { localDate: '2027-01-07', timeOfDay: 'morning', isDay: true, precipitation: 'none' },
    10,
    300,
    [xmasEvent],
  );

  // events[xmas] cleaned up
  assert.equal(s.events.xmas, undefined);
  // eventHistory survives!
  const h = s.eventHistory.xmas?.['2026'];
  assert.ok(h);
  assert.equal(h.total, 5);
  assert.equal(h.builtTypes?.length, 1);
});

test('admin preview support: previewAllowed enables building in preview, non-admin preview rejected', () => {
  const s = seedTown();

  // Non-admin preview (allowPreview: false) -> rejected
  assert.throws(
    () => applyMapLandCommand(
      s,
      { type: 'land-action', mapId: 'town', command: { type: 'build', blueprintId: 'snow-snowman', x: 8, y: 4 } },
      1000,
      'preview-reject',
      { ...openWeather, localDate: '2026-11-01', weatherSource: 'preview', allowPreview: false },
    ),
    /available from December 20 to January 6/i,
  );

  // Admin preview (allowPreview: true) -> allowed
  const built = applyMapLandCommand(
    s,
    { type: 'land-action', mapId: 'town', command: { type: 'build', blueprintId: 'snow-snowman', x: 8, y: 4 } },
    1000,
    'preview-allow',
    { ...openWeather, localDate: '2026-11-01', weatherSource: 'preview', allowPreview: true },
  );
  assert.ok(built.entities.find(e => e.id === 'preview-allow'));
});

test('Lake sculptures are counted once and together with Town sculptures (cap and Winter Wonderland)', () => {
  // Ten owls built only on the Lake are ten installed, not twenty, so Winter Wonderland (20 at once) is not awarded.
  let s = seedTown();
  s.storage!.wool = 40;
  for (let i = 0; i < 10; i++) {
    s = execCommand(s, { type: 'build', blueprintId: 'snow-owl', x: 8 + (i % 5), y: 4 + Math.floor(i / 5) * 2 }, 'lake', openWeather, `lake-owl-${i}`);
  }
  assert.equal(countInstalledSnowSculptures(s), 10);
  assert.equal(s.eventHistory!.xmas!['2026']!.maxSimultaneous, 10);
  assert.equal(s.earned['xmas-2026-winter-wonderland'], undefined);

  // 19 in Town + the 20th on the Lake unlocks it; 99 in Town + 1 on the Lake fits the cap, the next is refused.
  let t = seedTown();
  t.entities = Array.from({ length: 19 }, (_, i) => ({ id: `t-${i}`, blueprintId: 'snow-owl', x: i % 20, y: 10 + Math.floor(i / 20), paidCost: {}, eventYear: 2026 }));
  t.storage!.wool = 40;
  t = execCommand(t, { type: 'build', blueprintId: 'snow-owl', x: 8, y: 4 }, 'lake', openWeather, 'lake-20th');
  assert.equal(countInstalledSnowSculptures(t), 20);
  assert.ok(t.earned['xmas-2026-winter-wonderland']);

  let c = seedTown();
  c.entities = Array.from({ length: 99 }, (_, i) => ({ id: `c-${i}`, blueprintId: 'snow-owl', x: i % 20, y: 10 + Math.floor(i / 20), paidCost: {}, eventYear: 2026 }));
  c.storage!.wool = 40;
  c = execCommand(c, { type: 'build', blueprintId: 'snow-owl', x: 8, y: 4 }, 'lake', openWeather, 'lake-100th');
  assert.equal(countInstalledSnowSculptures(c), 100);
  assert.throws(() => execCommand(c, { type: 'build', blueprintId: 'snow-owl', x: 9, y: 4 }, 'lake', openWeather, 'lake-101st'), /100/);

  // 50 on the Lake and none in Town still allows the 51st on the Lake.
  let l = seedTown();
  l.maps!.lake!.land.entities = Array.from({ length: 50 }, (_, i) => ({ id: `l-${i}`, blueprintId: 'snow-owl', x: i % 20, y: 10 + Math.floor(i / 20), paidCost: {}, eventYear: 2026 }));
  l.storage!.wool = 40;
  l = execCommand(l, { type: 'build', blueprintId: 'snow-owl', x: 8, y: 4 }, 'lake', openWeather, 'lake-51st');
  assert.equal(countInstalledSnowSculptures(l), 51);
});

test('every Xmas achievement badge file exists and its atlas cell is inside the grid', async () => {
  const { existsSync } = await import('node:fs');
  for (const badge of XMAS_ACHIEVEMENTS) {
    assert.ok(existsSync(new URL(`../../frontend/public${badge.badge}`, import.meta.url)), `${badge.id} artwork exists`);
    assert.ok(badge.badgeIndex < badge.badgeColumns * badge.badgeRows, `${badge.id} cell is in the atlas`);
  }
});

test('fish payment uses the Lake reserve only: unsettled storage fish refuse cleanly, reserve fish pay, no partial write', () => {
  // Fish listed only in storage batches while the reserve is empty cannot pay.
  const unsettled = seedTown();
  unsettled.maps!.lake!.reserve = { P1: 0, P3: 0, P4: 0, P5: 0, R4: 0 };
  assert.throws(
    () => execCommand(unsettled, { type: 'build', blueprintId: 'snow-penguin', x: 8, y: 4 }),
    /missing materials/i,
  );
  assert.equal(unsettled.storage!.yarn, 20, 'no partial debit');

  // Reserve fish without any storage batch pay and leave the reserve one lower.
  const reserveOnly = seedTown();
  reserveOnly.storage!.fish = {};
  reserveOnly.maps!.lake!.reserve = { P1: 2, P3: 0, P4: 0, P5: 0, R4: 0 };
  const built = execCommand(reserveOnly, { type: 'build', blueprintId: 'snow-penguin', x: 8, y: 4 });
  assert.equal(built.maps!.lake!.reserve.P1, 1);

  // Reserve with a matching batch pays from both consistently.
  const settled = seedTown();
  const paid = execCommand(settled, { type: 'build', blueprintId: 'snow-penguin', x: 8, y: 4 });
  assert.equal(paid.maps!.lake!.reserve.P1, 9);
  assert.equal(paid.storage!.fish.P1![0]!.count, 9);
});
