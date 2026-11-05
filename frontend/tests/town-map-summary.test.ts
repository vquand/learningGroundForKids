import assert from 'node:assert/strict';
import test from 'node:test';
import {emptyTown,type Entity} from '../../server/src/town-building/game.ts';
import {emptyLake} from '../../server/src/town-building/maps/lake/game.ts';
import {capSummaryKinds,calculateSummaryIconOverlap,mapSummary,SUMMARY_ICON_GAP,SUMMARY_ICON_SIZE} from '../src/features/town-building/mapSummary.ts';

const entity=(blueprintId:string,id=blueprintId):Entity=>({id,blueprintId,x:0,y:0,paidCost:{}});
test('the map overview combines kinds, keeps roads and bridges separate, and excludes unrelated scenery',()=>{
 const state=emptyTown();
 state.entities=['house','coop','library','vegetable-patch','dirt-road','dirt-road','rocky-road','wood-bridge','stone-bridge','wooden-fence','farm-gate','apple','halloween-lantern','unknown-future-object'].map((id,i)=>entity(id,String(i)));
 assert.deepEqual(mapSummary(state,'town'),{
  buildings:3,buildingKinds:[{id:'house',count:1},{id:'coop',count:1},{id:'library',count:1}],plantPlots:1,plantKinds:[{id:'vegetable-patch',count:1}],
  roadTiles:3,roadKinds:[{id:'dirt-road',count:2},{id:'rocky-road',count:1}],bridgeTiles:2,bridgeKinds:[{id:'wood-bridge',count:1},{id:'stone-bridge',count:1}],
  animalHouses:1,animalHouseKinds:[{id:'coop',count:1}],fishHouses:0,fishHouseKinds:[],
 });
});
test('the overview follows the current map and counts plots independently of planting or growth',()=>{
 const state=emptyTown(),lake=emptyLake(0);state.maps={lake};
 state.entities=[entity('house'),entity('vegetable-patch')];
 state.rafts=[{id:'town-garden',blueprintId:'floating-garden',x:0,y:0,paidCost:{},generation:0,fish:[],plant:null,plantGrowth:0,feeder:false}];
 lake.land.entities=[entity('farmhouse'),entity('coop'),entity('vegetable-patch'),entity('rocky-road'),entity('stone-bridge')];
 lake.rafts=[{id:'lake-garden',blueprintId:'floating-garden',x:0,y:0,paidCost:{},generation:0,fish:[],plant:'water-lily',plantGrowth:0,feeder:false}];
 lake.rafts.push({id:'lake-nursery',blueprintId:'nursery',x:4,y:0,paidCost:{},generation:0,fish:[{id:'fish-1',species:'P1',growth:0}],plant:null,plantGrowth:0,feeder:false});
 assert.deepEqual(mapSummary(state,'town'),{
  buildings:1,buildingKinds:[{id:'house',count:1}],plantPlots:2,plantKinds:[{id:'vegetable-patch',count:1},{id:'floating-garden',count:1}],
  roadTiles:0,roadKinds:[],bridgeTiles:0,bridgeKinds:[],animalHouses:0,animalHouseKinds:[],fishHouses:0,fishHouseKinds:[],
 });
 assert.deepEqual(mapSummary(state,'lake'),{
  buildings:2,buildingKinds:[{id:'farmhouse',count:1},{id:'coop',count:1}],plantPlots:2,plantKinds:[{id:'vegetable-patch',count:1},{id:'floating-garden',count:1}],
  roadTiles:1,roadKinds:[{id:'rocky-road',count:1}],bridgeTiles:1,bridgeKinds:[{id:'stone-bridge',count:1}],animalHouses:2,animalHouseKinds:[{id:'farmhouse',count:1},{id:'coop',count:1}],fishHouses:1,fishHouseKinds:[{id:'nursery',count:1}],
 });
 lake.land.entities.push(entity('library'));
 assert.equal(mapSummary(state,'lake').buildings,3);
 assert.equal(mapSummary(state,'town').buildings,1);
});
test('an empty map shows real zero counts',()=>{
 assert.deepEqual(mapSummary(emptyTown(),'town'),{
  buildings:0,buildingKinds:[],plantPlots:0,plantKinds:[],roadTiles:0,roadKinds:[],bridgeTiles:0,bridgeKinds:[],
  animalHouses:0,animalHouseKinds:[],fishHouses:0,fishHouseKinds:[],
 });
});
test('groups roads and bridges by blueprint id to list kinds present',()=>{
 const state=emptyTown();
 state.entities=[entity('dirt-road','1'),entity('dirt-road','2'),entity('stone-bridge','3')];
 const summary=mapSummary(state,'town');
 assert.deepEqual(summary.roadKinds,[{id:'dirt-road',count:2}]);
 assert.deepEqual(summary.bridgeKinds,[{id:'stone-bridge',count:1}]);
 assert.equal(summary.roadTiles,2);
 assert.equal(summary.bridgeTiles,1);
});
test('animal houses include dedicated hosts but exclude residences and civic buildings',()=>{
 const state=emptyTown();
 state.entities=['house','large-house','town-hall','grocery','farmhouse','coop','animal-habitat'].map((id,i)=>entity(id,String(i)));
 const summary=mapSummary(state,'town');
 assert.equal(summary.buildings,7);
 assert.equal(summary.animalHouses,3);
 assert.deepEqual(summary.animalHouseKinds,[{id:'farmhouse',count:1},{id:'coop',count:1},{id:'animal-habitat',count:1}]);
});
test('summary kinds sort by quantity first and preserve blueprint order for ties',()=>{
 const state=emptyTown();
 state.entities=['library','house','coop','house','library','house','coop'].map((id,i)=>entity(id,String(i)));
 assert.deepEqual(mapSummary(state,'town').buildingKinds,[
  {id:'house',count:3},{id:'coop',count:2},{id:'library',count:2},
 ]);
});
test('summary kind capping keeps twelve visible and exposes only a safety overflow chip',()=>{
 const kinds=Array.from({length:13},(_,index)=>({id:`kind-${index}`,count:13-index}));
 const capped=capSummaryKinds(kinds);
 assert.equal(capped.visible.length,12);
 assert.equal(capped.hidden.length,1,'the compact chip is +1 only beyond the safety limit');
 assert.deepEqual(capped.visible[0],{id:'kind-0',count:13});
});
test('summary icon overlap keeps a small gap while the stack fits and grows monotonically when constrained',()=>{
 assert.equal(calculateSummaryIconOverlap(1,32),0);
 assert.equal(calculateSummaryIconOverlap(3,3*SUMMARY_ICON_SIZE+2*SUMMARY_ICON_GAP),0);
 const overlaps=[4,5,6].map(count=>calculateSummaryIconOverlap(count,160));
 assert.ok(overlaps[0]>=overlaps[1]&&overlaps[1]>=overlaps[2],`expected increasingly negative overlap: ${overlaps.join(', ')}`);
 for(const count of [4,5,6,12]){
  const overlap=calculateSummaryIconOverlap(count,160);
  const stackWidth=count*SUMMARY_ICON_SIZE+(count-1)*(SUMMARY_ICON_GAP+overlap);
  assert.ok(stackWidth<=160+0.001,`${count} icons must fit before the row number: ${stackWidth}`);
 }
});
