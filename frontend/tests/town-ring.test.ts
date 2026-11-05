import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import test from 'node:test';
import {TOWN_RING_LAYERS} from '../src/features/town-building/townRing.generated.ts';
import {OPTIONAL_TOWN_FILES,townImageFiles,townImageUrl} from '../src/features/town-building/townImageFiles.ts';

const SEASONS=['spring','summer','autumn','winter'] as const;
test('every season has a baked back and front scenery ring that preloads and stays inside the visible frame',()=>{
    const files=townImageFiles([]);
    for(const season of SEASONS)for(const layer of ['back','front']){
        const key=`ring-${season}-${layer}`,place=TOWN_RING_LAYERS[`${season}-${layer}`]!;
        assert.ok(files.includes(key),`${key} is preloaded`);
        assert.ok(OPTIONAL_TOWN_FILES.has(key),`${key} never blocks the town if missing`);
        assert.ok(existsSync(new URL(`../public${townImageUrl(key)}`,import.meta.url)),`${key} file exists`);
        assert.ok(place.x>=-3&&place.y>=-3&&place.x+place.width<=43.001&&place.y+place.height<=23.2+.001,`${key} lies inside the visible map frame`);
    }
});
