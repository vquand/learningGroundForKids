import test from 'node:test';
import assert from 'node:assert/strict';
import { sceneLighting } from '../src/features/town-building/sceneLighting.ts';
test('local time and cloud cover create restrained scene-wide color filters',()=>{
 const clear={precipitation:'none' as const,cloudCover:0,isDay:true};
 assert.deepEqual(sceneLighting({...clear,timeOfDay:'noon'}),[]);
 for(const timeOfDay of ['morning','afternoon','evening','night'] as const) assert.equal(sceneLighting({...clear,timeOfDay}).length,1);
 assert.equal(sceneLighting({...clear,timeOfDay:'noon',cloudCover:100}).length,1);
 assert.equal(sceneLighting({...clear,timeOfDay:'evening',cloudCover:100,precipitation:'rain'}).length,3);
 assert.deepEqual(sceneLighting({...clear,cloudCover:null,timeOfDay:null}),[]);
 assert.equal(sceneLighting({...clear,timeOfDay:'morning',isDay:false}).length,2);
});
