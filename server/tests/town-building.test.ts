import assert from 'node:assert/strict';
import test from 'node:test';
import { BLUEPRINTS, emptyTown, applyTownCommand, movementCost, terrainAt, placementError } from '../src/town-building/game.js';
import { seasonAt, storybookSnow } from '../src/town-building/environment.js';
test('800 tiles include exactly 640 buildable tiles and a continuous river', () => {
  const count = { grass: 0, river: 0, mountain: 0 };
  for (let y=0;y<40;y++) for(let x=0;x<20;x++) count[terrainAt(x,y)]++;
  assert.deepEqual(count,{grass:640,river:120,mountain:40});
  for(let y=0;y<40;y++) assert.equal(Array.from({length:20},(_,x)=>terrainAt(x,y)).filter(t=>t==='river').length,3);
});
test('movement rounds each original material independently and preserves zero', () => {
  assert.deepEqual(movementCost({wood:9,stamina:7,rock:0}),{wood:5,stamina:4,rock:0});
});
test('paid construction validates footprint and eligibility without mutating input', () => {
  const state=emptyTown(); state.materials={...state.materials,stamina:30,wood:30,rock:30};
  const next=applyTownCommand(state,'town',{type:'build',blueprintId:'house',x:5,y:8},'one',100);
  assert.equal(state.entities.length,0); assert.equal(next.materials.wood,21);
  assert.ok(next.earned['town-first-home']);
  assert.throws(()=>applyTownCommand(next,'town',{type:'build',blueprintId:'house',x:5,y:8},'two',200),/occupied/);
  assert.throws(()=>applyTownCommand(state,'town',{type:'build',blueprintId:'town-hall',x:5,y:8},'two',200),/Learn/);
  assert.throws(()=>applyTownCommand(emptyTown(),'town',{type:'build',blueprintId:'house',x:5,y:8},'two',200),/materials/);
  assert.ok(placementError(state.entities,'town',BLUEPRINTS[0]!,15,0));
  assert.ok(placementError(state.entities,'town',BLUEPRINTS[0]!,19,39));
  assert.ok(placementError(state.entities,'town',BLUEPRINTS[0]!,5.5,8));
});
test('moves charge rounded saved cost, keep identity; no-op and removal spend nothing', () => {
  const state=emptyTown(); state.materials={...state.materials,wood:30,stamina:30,rock:30};
  const built=applyTownCommand(state,'town',{type:'build',blueprintId:'house',x:5,y:8},'one',100);
  const moved=applyTownCommand(built,'town',{type:'move',entityId:'one',x:8,y:8},'ignored',200);
  assert.equal(moved.materials.wood,16); assert.equal(moved.entities[0]!.id,'one');
  assert.deepEqual(moved.entities[0]!.paidCost,built.entities[0]!.paidCost);
  assert.deepEqual(applyTownCommand(moved,'town',{type:'move',entityId:'one',x:8,y:8},'ignored',300),moved);
  const removed=applyTownCommand(moved,'town',{type:'remove',entityId:'one'},'ignored',400);
  assert.equal(removed.entities.length,0); assert.deepEqual(removed.materials,moved.materials);
  assert.deepEqual(removed.earned,moved.earned);
});
test('roads cost nothing or one rock; repeated rocky road placement is harmless',()=>{
  const state=emptyTown(); state.materials.rock=1;
  const dirt=applyTownCommand(state,'town',{type:'build',blueprintId:'dirt-road',x:5,y:8},'one',100);
  assert.equal(dirt.materials.rock,1);
  const rock=applyTownCommand(dirt,'town',{type:'build',blueprintId:'rocky-road',x:5,y:8},'two',200);
  assert.equal(rock.materials.rock,0); assert.equal(rock.entities.length,1);
  assert.deepEqual(applyTownCommand(rock,'town',{type:'build',blueprintId:'rocky-road',x:5,y:8},'three',300),rock);
});
test('all seasons follow home timezone and hemisphere at month boundaries',()=>{
  assert.equal(seasonAt(new Date('2026-02-28T18:00:00Z'),'Asia/Ho_Chi_Minh',10).season,'spring');
  assert.equal(seasonAt(new Date('2026-02-28T18:00:00Z'),'UTC',10).season,'winter');
  const expected=['winter','winter','spring','spring','spring','summer','summer','summer','autumn','autumn','autumn','winter'];
  for(let month=1;month<=12;month++) {
    const date=new Date(`2026-${String(month).padStart(2,'0')}-15T12:00:00Z`);
    assert.equal(seasonAt(date,'UTC',10).season,expected[month-1]);
    assert.notEqual(seasonAt(date,'UTC',-10).season,expected[month-1]);
  }
  assert.equal(storybookSnow('kid','2026-12-12'),storybookSnow('kid','2026-12-12'));
});

test('town names have ten choices per list, persist, and cost nothing', async () => {
  const { TOWN_ADJECTIVES,TOWN_NOUNS,townDisplayName }=await import('../src/town-building/game.js');
  assert.equal(TOWN_ADJECTIVES.length,10);assert.equal(new Set(TOWN_ADJECTIVES).size,10);
  assert.equal(TOWN_NOUNS.length,10);assert.equal(new Set(TOWN_NOUNS).size,10);
  const town=emptyTown();const renamed=applyTownCommand(town,'town',{type:'rename',adjective:'Cozy',noun:'Haven'},'unused',100);
  assert.equal(townDisplayName(JSON.parse(JSON.stringify(renamed))),'Cozy Haven');
  assert.deepEqual(renamed.materials,town.materials);assert.deepEqual(renamed.earned,town.earned);
  assert.equal(renamed.revision,town.revision+1);assert.equal(townDisplayName(undefined),'Sunny Meadow');
  assert.equal(applyTownCommand(renamed,'town',{type:'rename',adjective:'Cozy',noun:'Haven'},'unused',200),renamed);
  assert.throws(()=>applyTownCommand(town,'town',{type:'rename',adjective:'Invalid' as 'Sunny',noun:'Meadow'},'unused',100),/lists/);
});

test('animal homes supply the right free residents and preserve choices when moved', async () => {
  const { animalSpecies,animalCount }=await import('../src/town-building/game.js');
  for(const [blueprintId,defaults,chosen,count] of [['farmhouse','dairy-cow','sheep',2],['coop','chicken','duck',4],['animal-habitat','capybara','rabbit',4]] as const) {
    const town=emptyTown();for(const material of Object.keys(town.materials))town.materials[material as keyof typeof town.materials]=1000;
    const built=applyTownCommand(town,'town',{type:'build',blueprintId,x:7,y:12},'home',100);
    assert.equal(animalSpecies(built.entities[0]!),defaults);
    const switched=applyTownCommand(built,'town',{type:'set-animal',entityId:'home',animal:chosen},'ignored',200);
    assert.equal(animalSpecies(switched.entities[0]!),chosen);assert.equal(animalCount(chosen),count);
    assert.deepEqual(switched.materials,built.materials);assert.deepEqual(switched.earned,built.earned);
    assert.equal(switched.entities.length,1);
    const moved=applyTownCommand(switched,'town',{type:'move',entityId:'home',x:10,y:12},'ignored',300);
    assert.equal(animalSpecies(moved.entities[0]!),chosen);
    const removed=applyTownCommand(moved,'town',{type:'remove',entityId:'home'},'ignored',400);
    assert.equal(removed.entities.length,0);
    assert.throws(()=>applyTownCommand(switched,'town',{type:'set-animal',entityId:'home',animal:blueprintId==='farmhouse'?'duck':'dairy-cow'},'ignored',400),/cannot live/);
  }
  assert.equal(animalSpecies({blueprintId:'farmhouse'}),'dairy-cow');
  assert.equal(animalSpecies({blueprintId:'coop'}),'chicken');
  assert.equal(animalSpecies({blueprintId:'house'}),undefined);
});
