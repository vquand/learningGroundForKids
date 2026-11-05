import assert from 'node:assert/strict';
import { applyTownCommand, BLUEPRINTS, initialTown, placementError, type TownState } from '../../src/town-building/game.js';
import { applyGardenCommand } from '../../src/town-building/garden.js';

/** Fill a legal town through the same placement and animal validators as the API. */
export function crowdedTown(): TownState {
  let state = initialTown();
  for (const material of Object.keys(state.materials) as (keyof TownState['materials'])[]) state.materials[material] = 100_000;

  function add(blueprintId: string, count: number): void {
    const blueprint = BLUEPRINTS.find(b => b.id === blueprintId)!;
    for (let index = 0; index < count; index++) {
      let placed = false;
      for (let x = 0; x < 20 && !placed; x++) for (let y = 0; y < 40 && !placed; y++) {
        if (placementError(state.entities,'town', blueprint, x, y)) continue;
        const id = `${blueprintId}-${index}`;
        const command = { type: 'build' as const, blueprintId, x, y };
        state = blueprintId === 'vegetable-patch'
          ? applyGardenCommand(state,'town', command, id, 1_000, 'autumn')
          : applyTownCommand(state,'town', command, id, 1_000);
        if (blueprintId === 'house') state = applyTownCommand(state,'town', { type: 'set-pets', entityId: id, pets: ['border-collie'] }, '', 1_000);
        if (blueprintId === 'farmhouse') state = applyTownCommand(state,'town', { type: 'set-animal', entityId: id, animal: 'sheep' }, '', 1_000);
        placed = true;
      }
      assert.ok(placed, `the dense fixture must legally fit ${count} ${blueprintId} entities`);
    }
  }

  add('farmhouse', 30);
  add('house', 39); // A starter house already exists.
  state = applyTownCommand(state,'town', { type: 'set-pets', entityId: 'starter-home', pets: ['border-collie'] }, '', 1_000);
  add('vegetable-patch', 1);
  assert.equal(state.entities.filter(e => e.blueprintId === 'house').length, 40);
  assert.equal(state.entities.filter(e => e.blueprintId === 'farmhouse').length, 30);
  return state;
}
