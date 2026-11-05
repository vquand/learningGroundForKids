import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyTown,type Entity} from '../src/town-building/game.ts';
import {freshPatch,advanceCropGrowth,applyGardenCommand} from '../src/town-building/garden.ts';
import {gardenAreaEffects,gardenInsectSources} from '../src/town-building/gardenEffects.ts';
import {emptyLake} from '../src/town-building/maps/lake/game.ts';
import {playMap} from './helpers/play.ts';
const env={season:'spring' as const,timeOfDay:'morning' as const,precipitation:'none' as const,localDate:'2026-10-25'};
const patch=(id:string):Entity=>({id,blueprintId:'vegetable-patch',mapId:'lake',x:6,y:3,paidCost:{},garden:freshPatch('spring')});
const losingId=()=>'plot-a';
test('chicken and shore/floating insect coverage coexist, do not stack, and use plot centers',()=>{
 const p=patch('plot'),coop:Entity={id:'chicken',blueprintId:'coop',animal:'chicken',x:3,y:3,paidCost:{}};
 const lake=emptyLake(1000);lake.rafts=[{id:'insects',blueprintId:'insect-raiser',x:8,y:6,paidCost:{},generation:0,fish:[],plant:null,plantGrowth:0,feeder:false}];
 const sources=gardenInsectSources(lake.rafts,'lake');assert.deepEqual(gardenAreaEffects(p,[p,coop],sources,'lake'),{chicken:true,insects:true});
 assert.deepEqual(gardenAreaEffects(p,[p,coop,coop],[...sources,...sources],'lake'),{chicken:true,insects:true});
 lake.rafts[0]!.blueprintId='floating-insect-raiser';assert.equal(gardenAreaEffects(p,[p],gardenInsectSources(lake.rafts,'lake'),'lake').insects,true);
 assert.equal(gardenAreaEffects({...p,y:20},[p,coop],sources,'lake').insects,false);
 assert.deepEqual(gardenInsectSources([],'town'),[]);
});
test('a covered plot always loses a quarter of its crops, rounded up, once per cycle; buff and debuff coexist and withered crops stop growing',()=>{
 const p=patch('plot-a');advanceCropGrowth(p,240,'spring',env.localDate,true,true);
 assert.equal(p.garden!.slots.filter(s=>s.withered).length,1,'a quarter of four crops, guaranteed');assert.equal(p.garden!.slots.filter(s=>!s.withered&&s.growth===300).length,3);
 const before=structuredClone(p);advanceCropGrowth(p,600,'spring',env.localDate,true,true);
 assert.deepEqual(p,before,'repeated growth and overlapping coverage cannot wither more crops');
 const retry=patch(p.id);advanceCropGrowth(retry,240,'spring',env.localDate,true,true);assert.deepEqual(retry.garden,p.garden,'replay keeps the same outcome');
 const open=patch('open-plot');advanceCropGrowth(open,300,'spring',env.localDate,false,false);assert.equal(open.garden!.slots.filter(s=>s.withered).length,0,'no insect area, no loss');
 // Every plot loses exactly one crop; only the position is left to chance.
 const positions=new Set<number>();
 for(let i=0;i<40;i++){const q=patch(`plot-${i}`);advanceCropGrowth(q,300,'spring',env.localDate,false,true);const lost=q.garden!.slots.flatMap((s,index)=>s.withered?[index]:[]);assert.equal(lost.length,1);positions.add(lost[0]!);}
 assert.ok(positions.size>1,'the withered position varies between plots');
});
test('a plot that was already ripe is checked the first moment an insect area covers it',()=>{
 const p=patch('late-raiser');p.garden!.slots.forEach(s=>{s.growth=300;});
 advanceCropGrowth(p,1,'spring',env.localDate,false,false);assert.equal(p.garden!.slots.filter(s=>s.withered).length,0);
 advanceCropGrowth(p,1,'spring',env.localDate,false,true);assert.equal(p.garden!.slots.filter(s=>s.withered).length,1);
});
test('harvest pays for healthy ripe crops only and replants the withered crop once',()=>{
 let state=emptyTown();state.entities=[patch(losingId())];advanceCropGrowth(state.entities[0]!,300,'spring',env.localDate,false,true);
 const command={type:'harvest' as const,entityId:state.entities[0]!.id,generation:0};
 state=applyGardenCommand(state,'town',command,'unused',1000,'spring');
 assert.equal(state.materials.stamina,6);assert.equal(state.gardening!.harvests,3);
 assert.ok(state.entities[0]!.garden!.slots.every(s=>!s.withered&&s.growth===0&&s.generation===1));
 assert.equal(state.entities[0]!.garden!.insectChecked,false);assert.throws(()=>applyGardenCommand(state,'town',command,'unused',1001,'spring'),/changed/);
});
test('clearing only a withered crop replants without rewards, badges or resetting healthy unripe plants',()=>{
 const state=emptyTown(),p=patch('cleanup');state.entities=[p];p.garden!.slots.forEach(s=>s.growth=50);p.garden!.slots[0]!.withered=true;
 const next=applyGardenCommand(state,'town',{type:'harvest',entityId:p.id,generation:0},'unused',1000,'spring');
 assert.equal(next.materials.stamina,0);assert.equal(next.gardening!.harvests,0);assert.deepEqual(next.earned,{});
 assert.deepEqual(next.entities[0]!.garden!.slots.map(s=>s.growth),[0,50,50,50]);assert.equal(next.entities[0]!.garden!.slots[0]!.withered,undefined);
});
test('no insect loss off-season, without elapsed growth or outside coverage; lake checkpoints use the same rule',()=>{
 const p=patch(losingId());for(const [seconds,season,insects]of [[300,'winter',true],[0,'spring',true],[300,'spring',false]] as const){const copy=structuredClone(p);advanceCropGrowth(copy,seconds,season,env.localDate,false,insects);assert.ok(copy.garden!.slots.every(s=>!s.withered));}
 let state=emptyTown();state.maps={lake:emptyLake(1000)};state.maps.lake!.land.entities=[p];state.maps.lake!.rafts=[{id:'insects',blueprintId:'insect-raiser',x:8,y:6,paidCost:{},generation:0,fish:[],plant:null,plantGrowth:0,feeder:false}];
 state=playMap(state,'lake',1000,env,true);state=playMap(state,'lake',301000,env,false);
 assert.equal(state.maps!.lake!.land.entities[0]!.garden!.slots.filter(s=>s.withered).length,1);
});
