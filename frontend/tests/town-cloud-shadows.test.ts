import test from 'node:test';
import assert from 'node:assert/strict';
import { cloudShadows } from '../src/features/town-building/cloudShadows.ts';
import { ANIMAL_FRONT,ANIMAL_BACK,CLOUD_SHADES } from '../src/features/town-building/directionalAtlas.ts';
test('cloud shades are subtle, coverage-driven, moving shapes with a static reduced-motion view',()=>{
 assert.deepEqual(cloudShadows(null,100,false),[]);assert.deepEqual(cloudShadows(0,100,false),[]);assert.deepEqual(cloudShadows(NaN,100,false),[]);
 const clouds=cloudShadows(100,0,false);assert.equal(clouds.length,4);
 assert.ok(clouds.every(c=>c.opacity>0&&c.opacity<=.18&&c.width>=6&&c.width<=8));
 assert.notDeepEqual(clouds,cloudShadows(100,10000,false));
 assert.deepEqual(cloudShadows(100,0,true),cloudShadows(100,10000,true));
});
test('directional sprites and shade crops stay within their measured atlas bounds',()=>{
 for(const atlas of [ANIMAL_FRONT,ANIMAL_BACK,CLOUD_SHADES]){
  assert.equal(atlas.rects.length,atlas===CLOUD_SHADES?2:16);
  for(const [x,y,w,h] of atlas.rects){assert.ok(x!>=0&&y!>=0&&w!>0&&h!>0);assert.ok(x!+w!<=atlas.width&&y!+h!<=atlas.height);}
 }
});
