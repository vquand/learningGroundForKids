import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyTown } from '../src/town-building/game.js';
import { defineTimedEvent, runTimedEvents } from '../src/town-building/events/runtime.js';
import { tickTownEvents } from '../src/town-building/events/index.js';
import { freshPatch } from '../src/town-building/garden.js';
import {mapDefinition} from '../src/town-building/maps/registry.ts';
const night={localDate:'2026-10-30',timeOfDay:'night',isDay:false,precipitation:'none',weatherSource:'live'};
function festival(id:string,amount:number,latest='v1') {
  return defineTimedEvent({id,occurrence:(weather)=>weather.localDate?.endsWith('-10-30')?weather.localDate.slice(0,4):undefined,
    editionFor:()=>latest,editions:[{version:'v1',create:()=>({visits:0}),tick(data,context){data.visits+=amount;context.changed();}},
    {version:'v2',create:()=>({visits:0}),tick(data,context){data.visits+=100;context.changed();}}]});
}
test('events isolate state; ending one preserves other events and unknown records',()=>{
  const town=emptyTown(),a=festival('a',1),b=festival('b',7);
  runTimedEvents(town,mapDefinition('town'),night,5,300,[a,b]);
  assert.deepEqual(town.events!.a!.data,{visits:1});assert.deepEqual(town.events!.b!.data,{visits:7});
  town.events!.uninstalled={edition:'future',occurrence:'2026',data:{keep:true}};
  const before=structuredClone(town.events!.b);
  runTimedEvents(town,mapDefinition('town'),night,5,300,[festival('a',20)]);
  assert.deepEqual(town.events!.a!.data,{visits:21});assert.deepEqual(town.events!.b,before);
  runTimedEvents(town,mapDefinition('town'),{...night,localDate:'2026-11-01'},5,300,[a]);
  assert.equal(town.events!.a,undefined);assert.deepEqual(town.events!.b,before);assert.deepEqual(town.events!.uninstalled.data,{keep:true});
});
test('occurrences pin editions across reload; later years select the new edition; unknown versions freeze',()=>{
  const town=emptyTown();runTimedEvents(town,mapDefinition('town'),night,5,300,[festival('a',1)]);
  const restored=JSON.parse(JSON.stringify(town));
  runTimedEvents(restored,mapDefinition('town'),night,5,300,[festival('a',1,'v2')]);
  assert.equal(restored.events.a.edition,'v1');assert.equal(restored.events.a.data.visits,2);
  runTimedEvents(restored,mapDefinition('town'),{...night,localDate:'2027-10-30'},5,300,[festival('a',1,'v2')]);
  assert.equal(restored.events.a.edition,'v2');assert.equal(restored.events.a.occurrence,'2027');assert.equal(restored.events.a.data.visits,100);
  restored.events.a.edition='unavailable';const saved=structuredClone(restored.events.a);
  runTimedEvents(restored,mapDefinition('town'),{...night,localDate:'2027-10-30'},5,300,[festival('a',1,'v2')]);assert.deepEqual(restored.events.a,saved);
});
test('plugins cannot mutate world snapshots or leave partial harvest effects after failure',()=>{
  const town=emptyTown();town.entities.push({id:'patch',blueprintId:'vegetable-patch',x:10,y:14,paidCost:{},garden:freshPatch('autumn')});
  town.entities[0]!.garden!.slots[0]={crop:'pumpkin',growth:300,generation:0};
  const before=structuredClone(town);
  const broken=defineTimedEvent({id:'broken',occurrence:()=> '2026',editionFor:()=> 'v1',editions:[{
    version:'v1',harvest:{crop:'pumpkin',stamina:2},create:()=>({}),tick(_data,context){
      assert.equal(context.harvest({entityId:'patch',slot:0,generation:0}),true);
      context.entities[0]!.garden!.slots[0]!.growth=300;
    }}]});
  assert.deepEqual(runTimedEvents(town,mapDefinition('town'),night,5,300,[broken]),[{eventId:'broken',edition:'selection'}]);assert.deepEqual(town,before);
  runTimedEvents(town,mapDefinition('town'),night,5,300,[broken,festival('healthy',1)]);
  assert.deepEqual(town.events!.healthy!.data,{visits:1});assert.deepEqual(town.entities,before.entities);assert.equal(town.materials.stamina,0);
});
test('harvest capability validates generations and is unavailable unless declared',()=>{
  const town=emptyTown();const garden=freshPatch('autumn');garden.slots[0]={crop:'pumpkin',growth:300,generation:0};
  town.entities.push({id:'patch',blueprintId:'vegetable-patch',x:10,y:14,paidCost:{},garden});
  const make=(id:string,allowed:boolean)=>defineTimedEvent({id,occurrence:()=> '2026',editionFor:()=> 'v1',editions:[{
    version:'v1',...(allowed?{harvest:{crop:'pumpkin',stamina:2}}:{}),create:()=>({picked:false}),tick(data,context){
      data.picked=context.harvest({entityId:'patch',slot:0,generation:0});context.changed();
    }}]});
  runTimedEvents(town,mapDefinition('town'),night,5,300,[make('decorative',false),make('first',true),make('second',true)]);
  assert.deepEqual(town.events!.decorative!.data,{picked:false});assert.deepEqual(town.events!.first!.data,{picked:true});assert.deepEqual(town.events!.second!.data,{picked:false});
  assert.equal(town.materials.stamina,2);assert.equal(town.entities[0]!.garden!.slots[0]!.generation,1);
});
test('legacy Halloween is adopted once; November cleanup preserves unrelated event data',()=>{
  const town=emptyTown();town.halloween={year:'2026',activeSeconds:10,nextId:2,lanterns:[{id:1,x:5,y:10,variant:1,post:1}],jobs:[]};
  tickTownEvents(town,mapDefinition('town'),night,0,300);assert.equal(town.events!['halloween-pumpkins']!.edition,'2026-v1');assert.equal(town.halloween!.lanterns.length,1);
  town.events!.other={edition:'v1',occurrence:'2026',data:{visits:5}};
  tickTownEvents(town,mapDefinition('town'),{...night,localDate:'2026-11-01'},0,300);
  assert.equal(town.halloween,undefined);assert.equal(town.events!['halloween-pumpkins'],undefined);assert.deepEqual(town.events!.other.data,{visits:5});
});

test('completion receipts are deduplicated per occurrence and retained after cleanup; only declared awards unlock',()=>{
  const town=emptyTown();let receipt=0;
  const event=defineTimedEvent({id:'festival',occurrence:weather=>weather.localDate?.endsWith('-10-30')?weather.localDate.slice(0,4):undefined,editionFor:()=> 'v1',editions:[{
    version:'v1',counters:[{id:'lanterns',achievements:[{id:'ghostly-sky',target:21}]}],create:()=>({}),tick(_data,context){context.recordCompletion('lanterns',String(receipt));context.recordCompletion('lanterns',String(receipt));context.recordCompletion('unregistered',String(receipt));},
  }]});
  for(receipt=0;receipt<20;receipt++)runTimedEvents(town,mapDefinition('town'),night,1,300,[event],1000);
  assert.equal(town.eventHistory!.festival!['2026']!.counters.lanterns!.count,20);assert.equal(town.earned['ghostly-sky'],undefined);
  runTimedEvents(town,mapDefinition('town'),night,1,300,[event],2000);assert.equal(town.eventHistory!.festival!['2026']!.counters.lanterns!.count,21);assert.equal(town.earned['ghostly-sky'],'1970-01-01T00:00:02.000Z');
  runTimedEvents(town,mapDefinition('town'),{...night,localDate:'2026-11-01'},1,300,[event],3000);
  assert.equal(town.events!.festival,undefined);assert.equal(town.eventHistory!.festival!['2026']!.counters.lanterns!.count,21);
  runTimedEvents(town,mapDefinition('town'),{...night,localDate:'2027-10-30'},1,300,[event],4000);assert.equal(town.eventHistory!.festival!['2027']!.counters.lanterns!.count,1);assert.equal(town.earned['ghostly-sky'],'1970-01-01T00:00:02.000Z');
});
