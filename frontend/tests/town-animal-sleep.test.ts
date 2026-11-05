import assert from 'node:assert/strict';
import {artSource,assertRuntimeCataloged,ART_SOURCES_MISSING} from './town-art-helpers.ts';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {SHEEP_DREAM_ATLAS} from '../src/features/town-building/sheepDreamAtlas.ts';
import {drawAnimalSleep} from '../src/features/town-building/animalSleepRender.ts';
import {sleepingAnimalGroups,sleepLetters,sheepDreamPose,sheepDreamOpacity} from '../src/features/town-building/animalSleep.ts';
const sheep=(id:string,hostId='farm',sleeping=true)=>({id,hostId,species:'sheep' as const,sleeping,x:8,y:12});
test('sleeping herd members share one indicator; awake animals and other homes stay separate',()=>{
 const groups=sleepingAnimalGroups([sheep('a'),{...sheep('b'),y:12.5},sheep('awake','farm',false),sheep('c','other')]);
 assert.equal(groups.length,2);assert.equal(groups[0]!.count,2);assert.equal(groups[0]!.y,12.25);assert.equal(groups[0]!.sheep,true);
 assert.deepEqual(sleepingAnimalGroups([sheep('awake','farm',false)]),[]);
 assert.deepEqual(sleepingAnimalGroups([sheep('b'),sheep('a')]),sleepingAnimalGroups([sheep('a'),sheep('b')]));
});
test('zzZ drifts, grows and fades; reduced motion preserves static readable letters',()=>{
 const first=sleepLetters(1000,0),later=sleepLetters(1600,0);assert.notDeepEqual(first,later);
 assert.deepEqual(first.map(p=>p.letter),['z','z','Z']);
 for(const letter of [...first,...later])assert.ok(letter.alpha>=0&&letter.alpha<=1&&letter.size>0);
 assert.deepEqual(sleepLetters(1000,3,true),sleepLetters(99999,3,true));
});
test('dream sheep clears the fence at the middle of the jump and rests between jumps',()=>{
 const middle=sheepDreamPose(1800,0),start=sheepDreamPose(0,0),end=sheepDreamPose(3600,0);
 assert.ok(start.x<.5&&end.x>.5);assert.ok(middle.lift>.3);assert.equal(start.lift,0);assert.equal(end.lift,0);
 assert.deepEqual(sheepDreamPose(0,2,true),sheepDreamPose(9000,2,true));
});

test('zoom replaces sheep sleep letters with the dream while other herds retain zzZ',()=>{
 assert.equal(sheepDreamOpacity(1),0);assert.ok(sheepDreamOpacity(1.4)>0&&sheepDreamOpacity(1.4)<1);assert.equal(sheepDreamOpacity(2),1);
 assert.equal(1-sheepDreamOpacity(1),1);assert.equal(1-sheepDreamOpacity(2),0);
 assert.equal(sleepLetters(500,0).length,3,'other sleeping species retain their letters');
 const frames=new Set(Array.from({length:36},(_,i)=>sheepDreamPose(i*100,0).frame));assert.deepEqual([...frames],[0,1,2,3,4,5]);
 assert.equal(sheepDreamPose(150,0).x,0,'crouch stays planted before takeoff');
 assert.equal(sheepDreamPose(3500,0).x,1,'landing stays planted');
});

test('the dream uses six measured, cataloged jump poses and a scalloped cloud outline',{skip:ART_SOURCES_MISSING&&'local /art sources not present'},async()=>{
 const atlas=SHEEP_DREAM_ATLAS,png=await readFile(artSource(`${atlas.file}.png`));
 assert.equal(png.readUInt32BE(16),atlas.width);assert.equal(png.readUInt32BE(20),atlas.height);assert.equal(atlas.frames.length,6);
 for(const frame of atlas.frames){const [x,y,w,h]=frame.crop;assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=atlas.width&&y+h<=atlas.height);assert.ok(frame.anchor[0]>0&&frame.anchor[0]<w&&frame.anchor[1]>0&&frame.anchor[1]<h);}
 const catalog=JSON.parse(await readFile(new URL('../server/artwork/catalog.json',import.meta.url),'utf8'));assertRuntimeCataloged(assert,catalog,atlas.file);
 const calls:string[]=[],ctx=new Proxy({}, {get:(_target,key)=>()=>calls.push(String(key)),set:()=>true}) as CanvasRenderingContext2D;
 const group=sleepingAnimalGroups([sheep('a')]);drawAnimalSleep(ctx,new Map(),group,1500,24,-100,-100,800,450,2,false);
 assert.ok(calls.filter(name=>name==='bezierCurveTo').length>=6);assert.ok(!calls.includes('roundRect'));assert.ok(!calls.includes('fillText'),'the cloud replaces sheep zzZ at close zoom');
});
