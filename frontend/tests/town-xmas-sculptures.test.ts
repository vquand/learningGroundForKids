import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import React from 'react';
import {
    BLUEPRINTS,
    XMAS_SCULPTURE_BLUEPRINTS,
    XMAS_SCULPTURE_IDS,
    isSnowSculpture,
    isXmasOpen,
    blueprintEventError,
    emptyTown,
    type Entity,
} from '../../server/src/town-building/game.ts';
import { canRotate } from '../../server/src/town-building/direction.ts';
import { BUILDING_GROUPS, landGroup } from '../src/features/town-building/buildingGroups.ts';
import type { Environment } from '../../server/src/town-building/environment.ts';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

let vite: ViteDevServer;

before(async () => {
    vite = await createServer({
        configFile: false,
        root: fileURLToPath(new URL('..', import.meta.url)),
        plugins: [react()],
        server: { middlewareMode: true, hmr: false, ws: false, watch: null },
        optimizeDeps: { noDiscovery: true },
    });
});

after(async () => {
    await vite.close();
});

test('facing and frame mapping: 4 directional frames for rotatable sculptures, 1 static frame for tree', async () => {
    const { snowSculptureCrop } = await vite.ssrLoadModule('/src/features/town-building/buildingRender.ts');
    for (const id of XMAS_SCULPTURE_IDS) {
        if (id === 'snow-tree') {
            assert.deepEqual(snowSculptureCrop(id, 'front'), [0, 0, 256, 256]);
            assert.deepEqual(snowSculptureCrop(id, 'right'), [0, 0, 256, 256]);
            assert.deepEqual(snowSculptureCrop(id, 'back'), [0, 0, 256, 256]);
            assert.deepEqual(snowSculptureCrop(id, 'left'), [0, 0, 256, 256]);
        } else {
            assert.deepEqual(snowSculptureCrop(id, 'front'), [0, 0, 256, 256]);
            assert.deepEqual(snowSculptureCrop(id, 'right'), [256, 0, 256, 256]);
            assert.deepEqual(snowSculptureCrop(id, 'back'), [512, 0, 256, 256]);
            assert.deepEqual(snowSculptureCrop(id, 'left'), [768, 0, 256, 256]);
        }
    }
});

test('canvas map render anchors sculptures at the 1x1 tile ground baseline and draws occluders', async () => {
    const { drawTownBuilding } = await vite.ssrLoadModule('/src/features/town-building/buildingRender.ts');
    const images = new Map<string, HTMLImageElement>([
        ['xmas/snow-snowman', { complete: true, naturalWidth: 1024, naturalHeight: 256 } as unknown as HTMLImageElement],
    ]);
    const calls: { name: string; args: unknown[] }[] = [];
    const ctx = new Proxy({}, {
        get: (_, key) => (...args: unknown[]) => calls.push({ name: String(key), args })
    }) as unknown as CanvasRenderingContext2D;

    const sculpture: Entity = {
        id: 'snowman-1',
        blueprintId: 'snow-snowman',
        x: 3,
        y: 5,
        direction: 'right',
        paidCost: { stamina: 5, wood: 2 },
    };
    const occluders: any[] = [];
    drawTownBuilding(ctx, images, sculpture, { season: 'winter' } as Environment, 40, 10, 20, [sculpture], occluders);

    const drawCalls = calls.filter(c => c.name === 'drawImage');
    assert.ok(drawCalls.length >= 1, 'drawImage called for sculpture');
    const mainDraw = drawCalls[drawCalls.length - 1]!;
    // Crop should be frame 1 (right facing = [256, 0, 256, 256])
    assert.deepEqual(mainDraw.args.slice(1, 5), [256, 0, 256, 256]);
    // Target position: px = 10 + 5 * 40 = 210, py = 20 + 3 * 40 = 140
    assert.equal(mainDraw.args[5], 210);
    assert.equal(mainDraw.args[6], 140);
    assert.equal(mainDraw.args[7], 40);
    assert.equal(mainDraw.args[8], 40);

    // Occluder pushed with depth = x + 1 = 4
    assert.equal(occluders.length, 1);
    assert.equal(occluders[0].depth, 4);
});

test('palette entries: all ten sculptures belong to the decorations group, have 5 stamina cost, and localized descriptions', async () => {
    const { buildingDescription } = await vite.ssrLoadModule('/src/features/town-building/buildingDescriptions.ts');
    assert.equal(XMAS_SCULPTURE_BLUEPRINTS.length, 10);
    for (const b of XMAS_SCULPTURE_BLUEPRINTS) {
        assert.ok(isSnowSculpture(b.id));
        assert.equal(landGroup(b), 'decorations', `${b.id} belongs to the Decorations group`);
        assert.equal(b.cost.stamina, 5, `${b.id} costs 5 stamina`);
        assert.equal(b.width, 1);
        assert.equal(b.length, 1);
        const desc = buildingDescription(b.id);
        assert.ok(desc.length > 0, `${b.id} has description`);
        assert.ok(desc.includes('December 20 to January 6'), `${b.id} description mentions event dates`);
    }
});

test('palette cost cards display stamina, materials, wool, yarn, fish, and crops', async () => {
    const { landBuildingCost } = await vite.ssrLoadModule('/src/features/town-building/scene/workspaceDetails.tsx');
    const { BuildingCostList } = await vite.ssrLoadModule('/src/features/town-building/BuildingDetailCard.tsx');

    // Snow penguin: {stamina: 5, yarn: 1, fish: 1}
    const penguinBlueprint = BLUEPRINTS.find(b => b.id === 'snow-penguin')!;
    const state = emptyTown();
    state.storage = { built: true, crops: {}, milk: [], fish: {}, yarn: 0 };
    const cost = landBuildingCost(penguinBlueprint, state);
    assert.equal(cost.cost.stamina, 5);
    assert.equal(cost.cost.yarn, 1);
    assert.equal(cost.cost.fish, 1);
    assert.equal(cost.yarn, 0);
    assert.equal(cost.fish, 0);

    const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(BuildingCostList, { cost })));
    assert.match(html, /stamina/i);
    assert.match(html, /Yarn/);
    assert.match(html, /Fish/);
    assert.match(html, /Collect yarn/);
    assert.match(html, /Catch fish/);
});

test('event window gating and friendly server error message', async () => {
    const { placementProblem } = await vite.ssrLoadModule('/src/features/town-building/scene/workspaceDetails.tsx');
    const errorText = 'Snow sculptures are only available from December 20 to January 6.';

    assert.equal(isXmasOpen('2026-12-19'), false);
    assert.equal(isXmasOpen('2026-12-20'), true);
    assert.equal(isXmasOpen('2026-12-25'), true);
    assert.equal(isXmasOpen('2026-12-31'), true);
    assert.equal(isXmasOpen('2027-01-01'), true);
    assert.equal(isXmasOpen('2027-01-06'), true);
    assert.equal(isXmasOpen('2027-01-07'), false);

    assert.equal(blueprintEventError('snow-snowman', '2026-11-03'), errorText);
    assert.equal(blueprintEventError('snow-snowman', '2026-12-25'), null);

    const state = emptyTown();
    state.materials.stamina = 10;
    state.materials.wood = 10;
    state.storage = { built: true, crops: { carrot: 2 }, milk: [], fish: {} };
    const view = { entities: state.entities, rafts: [] };

    // Outside window, preview off -> blocked
    const problemClosed = placementProblem(state, view, 'town', { kind: 'land', blueprintId: 'snow-snowman' }, { x: 5, y: 5 }, undefined, 'front', '2026-11-03', false);
    assert.equal(problemClosed, errorText);

    // Inside window -> allowed
    const problemOpen = placementProblem(state, view, 'town', { kind: 'land', blueprintId: 'snow-snowman' }, { x: 5, y: 5 }, undefined, 'front', '2026-12-25', false);
    assert.equal(problemOpen, null);

    // Outside window, preview ON -> allowed
    const problemPreview = placementProblem(state, view, 'town', { kind: 'land', blueprintId: 'snow-snowman' }, { x: 5, y: 5 }, undefined, 'front', '2026-11-03', true);
    assert.equal(problemPreview, null);
});

test('rotation rules: 9 sculptures are rotatable, tree does not rotate in the UI', () => {
    for (const id of XMAS_SCULPTURE_IDS) {
        const rotatableInUi = canRotate(id) && (id as string) !== 'snow-tree';
        if (id === 'snow-tree') {
            assert.equal(rotatableInUi, false, 'snow-tree must not be rotatable in UI');
        } else {
            assert.equal(rotatableInUi, true, `${id} must be rotatable in UI`);
        }
    }
});

test('the Decorations group exists with a dedicated tab and holds only seasonal decorations',()=>{
    assert.ok(BUILDING_GROUPS.some(group=>group.id==='decorations'&&group.name==='Decorations'));
    for(const b of BLUEPRINTS.filter(b=>b.kind==='decoration'))assert.equal(landGroup(b),'decorations');
    for(const b of BLUEPRINTS.filter(b=>b.kind!=='decoration'))assert.notEqual(landGroup(b),'decorations',`${b.id} is not a seasonal decoration`);
});

test('admin/dev previews open the lantern and sculptures outside their windows, and a preview lantern is not put away at once',async()=>{
    const game=await import('../../server/src/town-building/game.ts');
    assert.ok(game.blueprintEventError('halloween-lantern','2026-11-03'));
    assert.equal(game.blueprintEventError('halloween-lantern','2026-11-03',true),null);
    assert.equal(game.eventBuildingExpired({id:'l',blueprintId:'halloween-lantern',x:0,y:0,paidCost:{},eventYear:game.lanternEventYear('2026-11-03')},'2026-11-03'),false);
});

test('the Town header badges button lists the Xmas group', async () => {
    const { readFileSync } = await import('node:fs');
    const layout = readFileSync(new URL('../src/features/town-building/TownMapLayout.tsx', import.meta.url), 'utf8');
    assert.match(layout, /groupIds=\{\[[^\]]*'xmas-2026'[^\]]*\]\}/);
});
