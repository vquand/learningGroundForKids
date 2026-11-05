import assert from 'node:assert/strict';
import test from 'node:test';
import {access,readFile} from 'node:fs/promises';
import {townImageFiles,townImageUrl} from '../src/features/town-building/townImageFiles.ts';
import {CIV_BUSINESSES} from '../../server/src/town-building/civCatalog.ts';
import type {Entity} from '../../server/src/town-building/game.ts';

test('all Town preload URLs exist and all raster artwork uses the private Blob catalog',async()=>{
 const catalog=JSON.parse(await readFile(new URL('../server/artwork/catalog.json',import.meta.url),'utf8'));
 const entities:Entity[]=CIV_BUSINESSES.map(b=>({id:b.id,blueprintId:b.id,x:3,y:3,paidCost:{}}));
 const files=townImageFiles(entities,3);assert.equal(new Set(files).size,files.length);
 for(const file of files){const url=townImageUrl(file);assert.ok(url.startsWith('/minigames/town-building/'));await access(new URL(`../public${url}`,import.meta.url));if(url.endsWith('.png'))assert.ok(catalog.entries[url.slice(1)],`${url} must support release omission`);}
 for(const file of ['civ-people/baker-idle-v1','civ-people/baker-work-v1','civ-people/doctor-v1','animalSign','terrain','materials','prosperity-growth-v1'])assert.ok(files.includes(file));
 assert.ok(files.includes('civ-interior-specialized-v3'));assert.ok(files.includes('civ-interior-tiles-v2'));
 const empty=townImageFiles([]);assert.ok(!empty.includes('civ-interior-specialized-v3'),'interior artwork loads only for placed shops');assert.ok(!empty.some(file=>file.startsWith('civ-people/')),'unplaced neighbors load only when needed');assert.ok(empty.includes('civ-buildings/school-v1'),'the blueprint palette is ready on first paint');
 assert.deepEqual(townImageFiles([...entities].reverse(),3),files,'entity order and heartbeat changes do not restart image loading');
});

test('only sheep homes preload the dedicated dream jump sheet',()=>{
 const farm:Entity={id:'farm',blueprintId:'farmhouse',x:7,y:12,paidCost:{},animal:'sheep'};
 assert.ok(townImageFiles([farm]).includes('sheep-dream-jump-v1'));
 assert.ok(!townImageFiles([{...farm,animal:'dairy-cow'}]).includes('sheep-dream-jump-v1'));
});
