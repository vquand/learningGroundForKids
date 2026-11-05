import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyTown} from '../src/town-building/game.ts';
import {emptyLake,applyLakeCommand} from '../src/town-building/maps/lake/game.ts';
import {insectCycleRoll} from '../src/town-building/gardenEffects.ts';
import {plantRaftInsectCovered} from '../src/town-building/water/plantEffects.ts';
import {playMap} from './helpers/play.ts';
const id=Array.from({length:100},(_,i)=>`raft-${i}`).find(id=>insectCycleRoll(id,0)<.25)!;
function fixture(){const state=emptyTown();state.materials.stamina=100;state.maps={lake:emptyLake(1000)};state.maps.lake!.rafts=[
 {id,blueprintId:'floating-garden',x:12,y:7,paidCost:{},generation:0,fish:[],plant:'water-spinach',plantGrowth:0,feeder:false},
 {id:'water-insects',blueprintId:'floating-insect-raiser',x:11,y:10,paidCost:{},generation:0,fish:[],plant:null,plantGrowth:0,feeder:false},
 ];return state;}
test('only floating insect raisers cover plant rafts; shore and legacy attachments do not',()=>{
 const state=fixture(),lake=state.maps!.lake!,raft=lake.rafts[0]!;assert.equal(plantRaftInsectCovered(raft,lake.rafts,'lake'),true);
 lake.rafts[1]!.blueprintId='insect-raiser';assert.equal(plantRaftInsectCovered(raft,lake.rafts,'lake'),false);
 raft.feeder=true;assert.equal(plantRaftInsectCovered(raft,lake.rafts,'lake'),false);
 lake.rafts[1]!.blueprintId='floating-insect-raiser';lake.rafts[1]!.y=30;assert.equal(plantRaftInsectCovered(raft,lake.rafts,'lake'),false);
});
test('one stable withered plant per growth cycle persists through checkpoints and moving',()=>{
 let state=playMap(fixture(),'lake',1000,{season:'spring',timeOfDay:'morning',precipitation:'none'},true);state=playMap(state,'lake',301000,{season:'spring',timeOfDay:'morning',precipitation:'none'},false);
 const raft=state.maps!.lake!.rafts[0]!;assert.equal(raft.witheredPlants!.length>=1&&raft.witheredPlants!.length<=2,true);assert.equal(raft.plantGrowth,300);
 const before=structuredClone(raft);state=playMap(state,'lake',601000,{season:'spring',timeOfDay:'morning',precipitation:'none'},false);assert.deepEqual(state.maps!.lake!.rafts[0],before);
 state=applyLakeCommand(state,{type:'move-raft',raftId:id,x:13,y:7},601000,'move',{});
 assert.deepEqual(state.maps!.lake!.rafts[0]!.witheredPlants,before.witheredPlants);
 const replay=playMap(playMap(fixture(),'lake',1000,{season:'spring',timeOfDay:'morning',precipitation:'none'},true),'lake',301000,{season:'spring',timeOfDay:'morning',precipitation:'none'},false);assert.deepEqual(replay.maps!.lake!.rafts[0],before);
});
test('ripe plants are checked the first moment a floating raiser covers them; shore coverage leaves plants healthy',()=>{
 const mature=fixture();mature.maps!.lake!.rafts[0]!.plantGrowth=300;
 const next=playMap(playMap(mature,'lake',1000,{season:'spring',timeOfDay:'morning',precipitation:'none'},true),'lake',301000,{season:'spring',timeOfDay:'morning',precipitation:'none'},false);assert.equal(next.maps!.lake!.rafts[0]!.witheredPlants?.length,2,'a quarter of six plants, rounded up');
 const shore=fixture();shore.maps!.lake!.rafts[1]!.blueprintId='insect-raiser';const healthy=playMap(playMap(shore,'lake',1000,{season:'spring',timeOfDay:'morning',precipitation:'none'},true),'lake',301000,{season:'spring',timeOfDay:'morning',precipitation:'none'},false);assert.equal(healthy.maps!.lake!.rafts[0]!.witheredPlants,undefined);
});
test('each healthy plant gives full stamina, withered plants give nothing and harvest resets the cycle once',()=>{
 for(const lost of [0,1,2]){
  const state=fixture(),raft=state.maps!.lake!.rafts[0]!;raft.plantGrowth=300;raft.duckBoosted=true;raft.plantInsectChecked=true;raft.witheredPlants=Array.from({length:lost},(_,i)=>i);
  const command={type:'harvest-plant' as const,raftId:id,generation:0};
  const next=applyLakeCommand(state,command,1000,'harvest',{}),planted=next.maps!.lake!.rafts[0]!;
  assert.equal(next.materials.stamina,100+(6-lost)*4);assert.equal(next.maps!.lake!.plantsHarvested,6-lost);
  assert.equal(planted.plantGrowth,0);assert.equal(planted.witheredPlants,undefined);assert.equal(planted.duckBoosted,false);assert.equal(planted.plantCycle,1);
  assert.throws(()=>applyLakeCommand(next,command,1000,'retry',{}),/changed/);
 }
});
test('a covered raft always loses exactly two of six plants, with distinct valid slots, no reroll when generation changes, and a varying pick',()=>{
 const picks=new Set<string>();
 for(let i=0;i<100;i++){
  const state=fixture(),raft=state.maps!.lake!.rafts[0]!;raft.id=`distribution-${i}`;
  const moved=structuredClone(state);moved.maps!.lake!.rafts[0]!.generation=25;
  const next=playMap(playMap(state,'lake',1000,{season:'spring',timeOfDay:'morning',precipitation:'none'},true),'lake',301000,{season:'spring',timeOfDay:'morning',precipitation:'none'},false).maps!.lake!.rafts[0]!;
  const retry=playMap(playMap(moved,'lake',1000,{season:'spring',timeOfDay:'morning',precipitation:'none'},true),'lake',301000,{season:'spring',timeOfDay:'morning',precipitation:'none'},false).maps!.lake!.rafts[0]!;
  assert.deepEqual(next.witheredPlants,retry.witheredPlants);
  assert.equal(next.witheredPlants!.length,2);assert.equal(new Set(next.witheredPlants).size,2);assert.ok(next.witheredPlants!.every(i=>i>=0&&i<6));
  picks.add(next.witheredPlants!.join());
 }
 assert.ok(picks.size>3,'which plants wither is left to chance');
});
test('a duck bonus crossing maturity uses the same single insect decision',()=>{
 let state=fixture();state.maps!.lake!.rafts[0]!.plantGrowth=270;
 state.maps!.lake!.land.entities=[{id:'ducks',blueprintId:'coop',animal:'duck',x:12,y:5,mapId:'lake',paidCost:{}}];
 const env={season:'spring' as const,timeOfDay:'morning' as const,precipitation:'none' as const};
 state=playMap(state,'lake',1000,env,true);
 const raft=state.maps!.lake!.rafts[0]!;assert.equal(raft.duckBoosted,true);assert.equal(raft.plantGrowth,300);assert.equal(raft.witheredPlants?.length,2);
 assert.deepEqual(raft.witheredPlants,playMap(playMap(fixture(),'lake',1000,env,true),'lake',301000,env,false).maps!.lake!.rafts[0]!.witheredPlants);
});
