import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {CIV_BUSINESSES} from '../../server/src/town-building/civCatalog.ts';
import {artSource,assertRuntimeCataloged,ART_SOURCES_MISSING} from './town-art-helpers.ts';
const root=new URL('../public/minigames/town-building/',import.meta.url);
const read=async(path:string)=>JSON.parse(await readFile(new URL(path,root),'utf8'));
test('civil art metadata matches sources, isolates crops and catalogs every runtime PNG for Blob omission',{skip:ART_SOURCES_MISSING&&'local /art sources not present'},async()=>{
 const buildings=await read('civ-buildings/manifest.json'),people=await read('civ-people/manifest.json'),catalog=JSON.parse(await readFile(new URL('../server/artwork/catalog.json',import.meta.url),'utf8'));
 assert.deepEqual(JSON.parse(await readFile(new URL('../src/features/town-building/civBuildingAtlas.json',import.meta.url),'utf8')),buildings);
 assert.deepEqual(JSON.parse(await readFile(new URL('../src/features/town-building/civPeopleAtlas.json',import.meta.url),'utf8')),people);
 const checked=new Set<string>();
 async function source(file:string,width?:number,height?:number){assertRuntimeCataloged(assert,catalog,file);const png=await readFile(artSource(file));assert.equal(png.subarray(1,4).toString(),'PNG');if(width){assert.equal(png.readUInt32BE(16),width);assert.equal(png.readUInt32BE(20),height);}checked.add(file);return [png.readUInt32BE(16),png.readUInt32BE(20)];}
 function crop(rect:number[],width:number,height:number){assert.equal(rect.length,4);assert.ok(rect.every(Number.isInteger));assert.ok(rect[0]!>=0&&rect[1]!>=0&&rect[2]!>0&&rect[3]!>0&&rect[0]!+rect[2]!<=width&&rect[1]!+rect[3]!<=height);}
 for(const business of CIV_BUSINESSES){const atlas=buildings.buildings[business.id];assert.ok(atlas);assert.equal(atlas.rects.length,2);await source(`${atlas.file}.png`,atlas.width,atlas.height);for(const rect of atlas.rects)crop(rect,atlas.width,atlas.height);assert.deepEqual(atlas.rects[0].slice(1),atlas.rects[1].slice(1),'paired states must have stable vertical ground anchors and dimensions');
  for(const worker of business.workers){const person=people.people[worker.art];assert.equal(person.frames.length,32);await source(`civ-people/${person.file}`,person.width,person.height);for(const frame of person.frames){const [width,height]=frame.file?await source(`civ-people/${frame.file}`):[person.width,person.height];crop(frame.crop,width,height);assert.ok(frame.anchor.every(Number.isFinite));}}
 }
 for(const key of ['vehicles','icons','badges']){const atlas=buildings[key];await source(`${atlas.file}.png`,atlas.width,atlas.height);for(const rect of atlas.rects)crop(rect,atlas.width,atlas.height);}
 await source('prosperity-growth-v1.png');assert.ok(checked.size>=23);
});
