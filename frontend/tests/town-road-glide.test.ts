import assert from 'node:assert/strict';
import test from 'node:test';
import { BLUEPRINTS, emptyTown, applyTownCommand } from '../../server/src/town-building/game.ts';
import { roadSprite } from '../src/features/town-building/roadArt.ts';
import { roadLine, planRoadStroke } from '../src/features/town-building/roadGlide.ts';
const dirt = BLUEPRINTS.find(b => b.id === 'dirt-road')!, rock = BLUEPRINTS.find(b => b.id === 'rocky-road')!;
test('gliding fills fast diagonal pointer motion with connected tiles', () => {
    const start = { x: 5, y: 10 }, end = { x: 8, y: 15 };
    const path = [start, ...roadLine(start, end)];
    assert.deepEqual(path.at(-1), end);
    for (let i = 1; i < path.length; i++) assert.equal(Math.abs(path[i]!.x - path[i - 1]!.x) + Math.abs(path[i]!.y - path[i - 1]!.y), 1);
    assert.deepEqual(roadLine(start, start), []);
});
test('paid strokes stop at available materials, while dirt roads are free', () => {
    const state = emptyTown(); state.materials.rock = 2;
    const tiles = Array.from({ length: 6 }, (_, i) => ({ x: 6, y: 10 + i }));
    assert.equal(planRoadStroke(state, 'town', rock, tiles).length, 2);
    assert.equal(planRoadStroke(state, 'town', dirt, tiles).length, 6);
    assert.equal(state.materials.rock, 2);
});
test('revisiting existing roads is free; converting dirt consumes rock once', () => {
    let state = emptyTown(); state.materials.rock = 2;
    state = applyTownCommand(state,'town', { type: 'build', blueprintId: rock.id, x: 6, y: 10 }, 'road1', 1);
    state = applyTownCommand(state,'town', { type: 'build', blueprintId: dirt.id, x: 6, y: 11 }, 'road2', 2);
    const tiles = [{ x: 6, y: 10 }, { x: 6, y: 10 }, { x: 6, y: 11 }, { x: 6, y: 12 }];
    assert.deepEqual(planRoadStroke(state, 'town', rock, tiles), [{ x: 6, y: 10 }, { x: 6, y: 11 }]);
});
test('strokes stop at buildings, mountains and water rather than jumping past them', () => {
    const state = emptyTown(); state.entities.push({ id: 'home', blueprintId: 'house', x: 6, y: 12, paidCost: {} });
    assert.deepEqual(planRoadStroke(state, 'town', dirt, [{ x: 6, y: 11 }, { x: 6, y: 12 }, { x: 6, y: 15 }]), [{ x: 6, y: 11 }]);
    assert.deepEqual(planRoadStroke(state, 'town', dirt, [{ x: 0, y: 0 }]), []);
    assert.deepEqual(planRoadStroke(state, 'town', dirt, [{ x: 14, y: 0 }, { x: 15, y: 0 }, { x: 18, y: 0 }]), [{ x: 14, y: 0 }]);
});

test('road sprites connect to the correct neighbors for all sixteen layouts', () => {
    const canonical = [0, 1, 5, 3, 11, 15]; // single, up end, vertical, up/right corner, up/right/left tee, cross
    for (let mask = 0; mask < 16; mask++) {
        const sprite = roadSprite(mask);
        let connection = canonical[sprite.column]!;
        for (let turn = 0; turn < sprite.rotation; turn++) connection = (connection << 1 & 15) | (connection >> 3);
        assert.equal(connection, mask, `connections for mask ${mask}`);
    }
});
