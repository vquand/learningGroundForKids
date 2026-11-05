import test from 'node:test';
import assert from 'node:assert/strict';
import {DuckFlocks} from '../src/features/town-building/scene/duckFlocks.ts';
import {createAnimalResidents} from '../src/features/town-building/animalWorld.ts';
import {emptyTown} from '../../server/src/town-building/game.ts';
import {emptyLake,applyLakeCommand} from '../../server/src/town-building/maps/lake/game.ts';
import {tickMap} from '../../server/src/town-building/mapTick.ts';
import {playMap} from '../../server/tests/helpers/play.ts';
import type {TownState} from '../../server/src/town-building/game.ts';
import {duckWaterRange,duckHelpCoverage,duckRaftInRange,DUCK_HELP_TILES} from '../../server/src/town-building/water/ducks.ts';
import type {Entity} from '../../server/src/town-building/game.ts';
import type {LakeRaft} from '../../server/src/town-building/water/types.ts';
import {lakeTerrainAt} from '../../server/src/town-building/maps/lake/terrain.ts';
const water=(state:TownState)=>({mapId:'lake' as const,entities:state.maps!.lake!.land.entities,rafts:state.maps!.lake!.rafts});
const env={season:'spring' as const,timeOfDay:'morning' as const,precipitation:'none' as const};
test('shore duck help coverage is the closest 18 reachable water tiles, a cone widest against the coop',()=>{
 const coop:Entity={id:'shore-ducks',blueprintId:'coop',animal:'duck',x:6,y:5,paidCost:{}},entities=[coop],rafts:LakeRaft[]=[];
 const world={mapId:'lake' as const,entities,rafts};
 const coverage=duckHelpCoverage(world,coop);
 assert.equal(coverage.size,DUCK_HELP_TILES);assert.ok(coverage.has('6:7'));
 for(const cell of coverage){const [x,y]=cell.split(':').map(Number);assert.ok(['shallow','deep'].includes(lakeTerrainAt(x!,y!)));}
 const widths=new Map<number,number>();for(const cell of coverage){const y=Number(cell.split(':')[1]);widths.set(y,(widths.get(y)??0)+1);}
 const columns=[...widths.keys()].sort((a,b)=>a-b);
 assert.equal(columns[0],7,'the cone starts at the shore beside the coop');
 for(let i=1;i<columns.length;i++){assert.equal(columns[i],columns[i-1]!+1,'one connected cone');assert.ok(widths.get(columns[i]!)!<=widths.get(columns[i-1]!)!,'narrows away from the coop');}
 assert.ok(widths.get(columns[0]!)!>widths.get(columns.at(-1)!)!);
 assert.equal(coverage.has('9:22'),false);assert.equal(coverage.has('16:1'),false);
 const near={id:'near',blueprintId:'floating-garden' as const,x:6,y:8,generation:0,fish:[],plantGrowth:0,paidCost:{},plant:null,feeder:false};
 const far={...near,id:'far',x:9,y:20};
 rafts.push(near,far);const withRafts=duckHelpCoverage(world,coop);
 assert.deepEqual([...withRafts].sort(),[...coverage].sort(),'rafts float inside the area rather than reshaping it');
 assert.equal(duckRaftInRange(withRafts,near),true);assert.equal(duckRaftInRange(withRafts,far),false);
});
test('inland coops, other species and enclosed ducks do not advertise water help',()=>{
 const coop:Entity={id:'ducks',blueprintId:'coop',animal:'duck',x:6,y:3,paidCost:{}},entities=[coop],world={mapId:'lake' as const,entities,rafts:[]};
 assert.equal(duckHelpCoverage(world,coop).size,0);
 coop.y=5;assert.ok(duckHelpCoverage(world,coop).size>0);
 assert.equal(duckHelpCoverage(world,{...coop,animal:'chicken'}).size,0);
 for(const [x,y]of [[8,5],[6,7],[5,6],[7,4]])entities.push({id:`wall-${x}-${y}`,blueprintId:'house',x:x!,y:y!,paidCost:{}});
 assert.equal(duckHelpCoverage(world,coop).size,0);
});
function fixture(){
 let state=emptyTown();state.materials={stamina:1000,wood:1000,rock:1000,sand:1000,metal:1000};state.storage={built:false,crops:{},milk:[],fish:{},wool:1000};state.woolMigrated=true;state.maps={lake:emptyLake(1000)};
 state.maps.lake!.land.entities=[{id:'ducks',blueprintId:'coop',animal:'duck',x:6,y:5,paidCost:{}}];
 state=applyLakeCommand(state,{type:'build-raft',blueprintId:'nursery',x:6,y:9},1000,'nursery',{});
 state=applyLakeCommand(state,{type:'stock',raftId:'nursery',species:'P3'},1000,'fish',{P3:10});
 state=tickMap(state,'lake',1000,env,true);
 const birds=createAnimalResidents(water(state).entities as Entity[],[],{mapId:'lake',rafts:water(state).rafts}),flocks=new DuckFlocks();flocks.sync(water(state),birds);return{state,birds,flocks};
}
test('lake ducks paddle in a compact synchronized school on legal routes, and the server tick gives their raft its one 30-second help',()=>{
 let {state,birds,flocks}=fixture();const coop=water(state).entities[0]!,allowed=duckWaterRange(water(state),coop);
 const visited=new Set<string>();
 for(let frame=1;frame<=4000;frame++){
  flocks.step(water(state),.05,env);
  visited.add(`${Math.floor(flocks.flocks[0]!.center.x)}:${Math.floor(flocks.flocks[0]!.center.y)}`);
  assert.ok(birds.every(b=>allowed.has(`${Math.floor(b.x)}:${Math.floor(b.y)}`)));
  assert.ok(birds.every(b=>b.clock===birds[0]!.clock),'all birds paddle on the same clock');
  assert.ok(birds.every(b=>Math.hypot(b.x-birds[0]!.x,b.y-birds[0]!.y)<1),'a close bunch rather than a long single-file line');
 }
 assert.ok(visited.size>=3,'the flock roams its water instead of waiting at a raft');
 // The help needs no visit: the first daytime tick applies it, once.
 state=playMap(state,'lake',1000+5000,env,true);
 assert.ok(state.maps!.lake!.rafts[0]!.fish.every(f=>f.duckBoosted&&f.growth>=30));
});
test('paused ducks freeze together; reduced motion freezes paddling',()=>{
 const {state,birds,flocks}=fixture();flocks.step(water(state),.05,env);const before=birds.map(b=>[b.x,b.y,b.clock]);
 for(let i=0;i<100;i++)flocks.step(water(state),0,env);
 assert.deepEqual(birds.map(b=>[b.x,b.y,b.clock]),before);
 for(let frame=1;frame<800;frame++)flocks.step(water(state),.05,env,true);
 assert.equal(birds[0]!.clock,before[0]![2]);
});
test('ducks only help rafts inside their water area',()=>{
 let state=emptyTown();state.materials={stamina:1000,wood:1000,rock:1000,sand:1000,metal:1000};state.storage={built:false,crops:{},milk:[],fish:{},wool:1000};state.woolMigrated=true;state.maps={lake:emptyLake(1000)};
 state.maps.lake!.land.entities=[{id:'ducks',blueprintId:'coop',animal:'duck',x:6,y:5,paidCost:{}}];
 state=applyLakeCommand(state,{type:'build-raft',blueprintId:'nursery',x:8,y:14},1000,'nursery',{});
 state=applyLakeCommand(state,{type:'stock',raftId:'nursery',species:'P3'},1000,'fish',{P3:10});
 state=tickMap(state,'lake',1000,env,true);
 assert.ok(state.maps!.lake!.rafts[0]!.fish.every(f=>!f.duckBoosted&&f.growth===0),'a raft outside the area gets no help');
 const birds=createAnimalResidents(water(state).entities as Entity[],[],{mapId:'lake',rafts:water(state).rafts}),flocks=new DuckFlocks();flocks.sync(water(state),birds);
 assert.equal(flocks.flocks.length,0,'with nothing in its area to help, the ducks have land duty and no water flock');
});
test('the flock keeps paddling slowly around its water, in rain too',()=>{
 let {state,birds,flocks}=fixture();const coop=water(state).entities[0]!,allowed=duckWaterRange(water(state),coop);
 const rain={...env,precipitation:'rain' as const};
 const visited=new Set<string>();let travelled=0,last={...flocks.flocks[0]!.center};
 for(let frame=0;frame<6000;frame++){
  flocks.step(water(state),.05,rain);
  const center=flocks.flocks[0]!.center;travelled+=Math.hypot(center.x-last.x,center.y-last.y);last={...center};
  visited.add(`${Math.floor(center.x)}:${Math.floor(center.y)}`);
  assert.ok(birds.every(b=>allowed.has(`${Math.floor(b.x)}:${Math.floor(b.y)}`)),'always on legal water');
  assert.ok(birds.every(b=>!b.sleeping&&!b.inactive));
 }
 assert.ok(visited.size>=4,`the flock explores its area (${visited.size} tiles)`);
 assert.ok(travelled/300<=.66,'at the slow paddling speed');assert.ok(travelled>10);
});
