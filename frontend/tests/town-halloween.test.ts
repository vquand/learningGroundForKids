import test from 'node:test';
import assert from 'node:assert/strict';
import { isHalloweenVisit,HALLOWEEN_GUESTS,ghostPosition } from '../src/features/town-building/halloween.ts';
import { ghostJobPose, previewHalloween, ghostFacing, stepGhostMotion, HalloweenPreviewWorld } from '../src/features/town-building/halloweenWorld.ts';
import { initialTown } from '../../server/src/town-building/game.ts';
test('Halloween guests appear only October 30 and October 31 in home-local dates',()=>{
 for(const year of ['2026','2027','2028']) {
  for(const day of ['10-30','10-31']) assert.equal(isHalloweenVisit(`${year}-${day}`),true);
  for(const day of ['10-29','11-01','11-02','01-01','03-30']) assert.equal(isHalloweenVisit(`${year}-${day}`),false);
 }
 for(const malformed of ['', '2026-10-31T00:00:00Z', '10-31', '2026-11-1']) assert.equal(isHalloweenVisit(malformed),false);
});

test('ghost animation has approach, pickup, carry and hang poses; carries only server-harvested lanterns',()=>{
 const job={id:8,worker:0,entityId:'patch',slot:0,generation:0,from:{x:8.5,y:14.5},to:{x:10,y:18},startedAt:0,harvested:false};
 assert.equal(ghostJobPose(job,2,200,false).stage,'flying');
 assert.equal(ghostJobPose(job,6,600,false).stage,'pickup');
 assert.equal(ghostJobPose(job,12,1200,false).carrying,false,'interpolation cannot invent a harvest');
 assert.equal(ghostJobPose({...job,harvested:true},12,1200,false).carrying,true);
 assert.equal(ghostJobPose({...job,harvested:true},18,1800,false).stage,'hanging');
 assert.deepEqual(ghostJobPose(job,6,0,true),ghostJobPose(job,6,5000,true));
 for(let age=0;age<22;age+=.1){const p=ghostJobPose(job,age,age*1000);assert.ok(p.frame>=0&&p.frame<18);assert.ok(p.x>=0&&p.x<20&&p.y>=0&&p.y<40);}
 const state=initialTown(),copy=structuredClone(state);
 assert.equal(previewHalloween(state.entities,30).holiday.lanterns.length,0,'no phantom pumpkins in an empty town');
 assert.equal(ghostFacing({x:1,y:9},{x:2,y:4}),-1);assert.equal(ghostFacing({x:1,y:4},{x:2,y:9}),1);
 assert.deepEqual(state,copy,'preview never edits real crops or rewards');
});
test('Halloween visitors stay inside the map and freeze when reduced motion is enabled',()=>{
 assert.equal(HALLOWEEN_GUESTS.length,6);
 for(const guest of HALLOWEEN_GUESTS) {
  for(let time=0;time<120000;time+=1000){const p=ghostPosition(guest,time,false);assert.ok(p.x>0&&p.x<20&&p.y>0&&p.y<40);}
  assert.deepEqual(ghostPosition(guest,0,true),ghostPosition(guest,100000,true));
 }
});

test('ghost source regions preserve shape and cannot include another atlas cell',async()=>{
 const {GHOST_ATLAS}=await import('../src/features/town-building/ghostAtlas.ts');
 assert.equal(GHOST_ATLAS.rects.length,6);
 for(const [index,crop] of GHOST_ATLAS.rects.entries()){
  const [x,y,w,h]=crop;assert.ok(w!>0&&h!>0&&x!>=0&&y!>=0);
  assert.ok(x!+w!<=GHOST_ATLAS.width&&y!+h!<=GHOST_ATLAS.height);
  assert.ok(x!>=index%3*GHOST_ATLAS.width/3&&x!+w!<=(index%3+1)*GHOST_ATLAS.width/3);
 }
});

test('ghosts visit only during dry darkness, including when Halloween is previewed',async()=>{
 const {ghostsMayVisit}=await import('../src/features/town-building/halloween.ts');
 const night={localDate:'2026-10-31',precipitation:'none' as const,isDay:false,timeOfDay:'night',weatherSource:'live'};
 assert.equal(ghostsMayVisit(night),true);
 assert.equal(ghostsMayVisit({...night,isDay:true}),false);
 assert.equal(ghostsMayVisit({...night,precipitation:'rain'}),false);
 assert.equal(ghostsMayVisit({...night,precipitation:'snow'}),false);
 assert.equal(ghostsMayVisit({...night,localDate:'2026-10-12'}),false);
 assert.equal(ghostsMayVisit({...night,localDate:'2026-10-12'},true),true);
 assert.equal(ghostsMayVisit({...night,isDay:true},true),false);
 assert.equal(ghostsMayVisit({...night,isDay:null,timeOfDay:null}),false);
});

test('preview consumes each actual ripe pumpkin once and stops; never changes the saved snapshot',async()=>{
 const {freshPatch}=await import('../../server/src/town-building/garden.ts');
 const state=initialTown(),garden=freshPatch('autumn');garden.crop='pumpkin';garden.slots.forEach(s=>{s.crop='pumpkin';s.growth=300;});state.entities.push({id:'patch',blueprintId:'vegetable-patch',x:8,y:14,paidCost:{},garden});const saved=structuredClone(state);
 const pickup=previewHalloween(state.entities,10);assert.equal(pickup.entities.at(-1)!.garden!.slots.filter(s=>s.growth===0).length,pickup.holiday.jobs.filter(j=>j.harvested).length);assert.ok(pickup.holiday.jobs.filter(j=>!j.harvested).length<=1);
 const done=previewHalloween(state.entities,120);assert.equal(done.holiday.lanterns.length,4);assert.equal(done.holiday.jobs.length,0);assert.ok(done.entities.at(-1)!.garden!.slots.every(s=>s.growth===0));
 assert.equal(previewHalloween(state.entities,6000).holiday.lanterns.length,4);assert.deepEqual(state,saved);
});

test('ghost reassignment keeps its actual origin and cannot jump toward a distant pumpkin',()=>{
 const origin={x:4,y:35},job={id:3,worker:0,entityId:'patch',slot:0,generation:0,from:{x:10,y:5},to:{x:11,y:12},origin,approachSeconds:20,carrySeconds:8,startedAt:30,harvested:false};
 const start=ghostJobPose(job,30,0);assert.equal(start.x,origin.x);assert.equal(start.y,origin.y);
 let point=origin;for(let i=1;i<=60;i++){const next=stepGhostMotion(point,job.from,1/60);assert.ok(Math.hypot(next.x-point.x,next.y-point.y)<=2.5/60+1e-8);point=next;}assert.ok(Math.hypot(point.x-origin.x,point.y-origin.y)<=2.5+1e-8);
 assert.deepEqual(stepGhostMotion(origin,job.from,0),origin);assert.deepEqual(stepGhostMotion(origin,job.from,.016,true),job.from);
});

test('incremental Halloween preview shares exclusive patch reservations and visible post-delivery rests',async()=>{
 const {freshPatch}=await import('../../server/src/town-building/garden.ts'),state=initialTown(),garden=freshPatch('autumn');garden.slots.forEach(s=>{s.crop='pumpkin';s.growth=300;});state.entities.push({id:'preview-patch',blueprintId:'vegetable-patch',x:8,y:14,paidCost:{},garden});
 const preview=new HalloweenPreviewWorld(state.entities,'town');let restFrames=0;
 for(let seconds=0;seconds<=160;seconds+=.2){const {holiday}=preview.advance(seconds);assert.ok(holiday.jobs.filter(j=>!j.harvested).length<=1);restFrames+=holiday.workers!.filter(w=>w.readyAt>holiday.activeSeconds&&!holiday.jobs.some(j=>j.worker===w.worker)).length;}
 assert.ok(restFrames>0);assert.equal(preview.advance(160).holiday.lanterns.length,4);assert.ok(state.entities.at(-1)!.garden!.slots.every(s=>s.growth===300));
});
