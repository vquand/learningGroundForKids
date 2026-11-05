import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTownCommand, BLUEPRINTS, emptyTown, placementError, type Entity } from '../src/town-building/game.js';
import { applyGardenCommand, freshPatch, applyGardenContacts, restoreAnimals, ensureTownGardens, GROW_SECONDS } from '../src/town-building/garden.js';
import { createAnimalResidents, animalWalkable, stepAnimalResidents } from '../src/town-building/animalWorld.js';
import { planPatchFence } from '../src/town-building/fence.js';
import { townCommandSchema } from '../src/town-building/routes.js';
import {tickMap} from '../src/town-building/mapTick.ts';
const patch=():Entity=>({id:'patch',blueprintId:'vegetable-patch',x:8,y:14,paidCost:{wood:4},garden:freshPatch('summer')});
const town=()=>({...emptyTown(),entities:[patch()]});
const summer={season:'summer' as const,precipitation:'none' as const,timeOfDay:'noon'};
test('300 seconds active growth, no offline credit, no extra progress for overlapping heartbeats',()=>{
    let state=tickMap(town(),'town',1000,summer,true);
    for(let time=6000;time<=301000;time+=5000)state=tickMap(state,'town',time,summer);
    assert.equal(state.entities[0]!.garden!.slots[0]!.growth,GROW_SECONDS);
    assert.equal(state.materials.stamina,0,'ripe plants never harvest automatically');
    const ready=state.entities[0]!.garden!.slots[0]!.growth;
    state=tickMap(state,'town',301000,summer);assert.equal(state.entities[0]!.garden!.slots[0]!.growth,ready);
    state=applyGardenCommand(state,'town',{type:'harvest',entityId:'patch',generation:0},'unused',301000,'summer');
    assert.equal(state.materials.stamina,8);
    state=tickMap(state,'town',901000,summer);assert.equal(state.entities[0]!.garden!.slots[0]!.growth,0);
    state=tickMap(state,'town',906000,summer);assert.ok(Math.abs(state.entities[0]!.garden!.slots[0]!.growth-5)<.0001);
    state=tickMap(state,'town',907000,summer,true);assert.ok(Math.abs(state.entities[0]!.garden!.slots[0]!.growth-5)<.0001);
});
test('one crop per turf; harvest all and only ripe plants atomically, replay safe across seasons',()=>{
    let state=town();const garden=state.entities[0]!.garden!;
    assert.equal(new Set(garden.slots.map(slot=>slot.crop)).size,1);
    assert.throws(()=>applyGardenCommand(state,'town',{type:'harvest',entityId:'patch',generation:0},'',1000,'summer'),/still growing/);
    garden.slots[0]!.growth=300;garden.slots[2]!.growth=300;garden.slots[1]!.growth=120;
    const command={type:'harvest' as const,entityId:'patch',generation:0};
    state=applyGardenCommand(state,'town',command,'',1000,'winter');
    assert.equal(state.materials.stamina,4);assert.equal(state.gardening!.harvests,2);
    assert.deepEqual(state.entities[0]!.garden!.slots.map(slot=>slot.growth),[0,120,0,0]);
    assert.ok(state.entities[0]!.garden!.slots.every(slot=>slot.crop==='tomato'));
    assert.throws(()=>applyGardenCommand(state,'town',command,'',1001,'summer'),/changed/);
    assert.ok(state.earned['town-first-harvest']);
    assert.throws(()=>applyGardenCommand(state,'town',{type:'plant',entityId:'patch',generation:1,crop:'cabbage'},'',1000,'summer'),/home season/);
    state=applyGardenCommand(state,'town',{type:'plant',entityId:'patch',generation:1,crop:'corn'},'',1000,'summer');
    assert.ok(state.entities[0]!.garden!.slots.every(slot=>slot.crop==='corn'&&slot.growth===0));
    state=tickMap(state,'town',2000,{...summer,season:'winter'},true);state=tickMap(state,'town',7000,{...summer,season:'winter'});
    assert.equal(state.entities[0]!.garden!.slots[0]!.growth,0);
});
test('duck contacts retain their non-stacking land buff; bites replant only the visited slot and cool down',()=>{
    const garden=patch();garden.garden!.slots.forEach(s=>s.growth=100);
    const coop:Entity={id:'coop',blueprintId:'coop',x:10,y:17,paidCost:{},animal:'duck'};
    const chicken=createAnimalResidents([coop],[],{mapId:'town'})[0]!;chicken.x=8.5;chicken.y=14.5;
    applyGardenContacts(garden,[chicken]);assert.equal(garden.garden!.boost,30);
    applyGardenContacts(garden,[chicken]);assert.equal(garden.garden!.boost,30);
    chicken.x=12;applyGardenContacts(garden,[chicken]);assert.equal(garden.garden!.slots[0]!.growth,100);
    const farm:Entity={id:'farm',blueprintId:'farmhouse',x:6,y:19,paidCost:{}};
    const cow=createAnimalResidents([farm],[],{mapId:'town'})[0]!;cow.x=8.5;cow.y=14.5;
    applyGardenContacts(garden,[cow]);assert.equal(garden.garden!.slots[0]!.growth,0);assert.equal(garden.garden!.slots[0]!.generation,1);
    cow.y=15.5;applyGardenContacts(garden,[cow]);assert.equal(garden.garden!.slots[1]!.growth,100);
    const dog=createAnimalResidents([{id:'home',blueprintId:'house',x:10,y:20,paidCost:{},pets:['australian-cattle-dog']}],[],{mapId:'town'})[0]!;
    dog.x=8;dog.y=15;cow.herderId=dog.id;garden.garden!.biteCooldown=0;
    applyGardenContacts(garden,[cow,dog]);assert.equal(garden.garden!.slots[1]!.growth,100);
    dog.species='border-collie';applyGardenContacts(garden,[cow,dog]);assert.equal(garden.garden!.slots[1]!.growth,0);
});
test('fence wrap is 12 wood-only tiles, reuses fences, blocks roads, and rejects atomically',()=>{
    const state=town();state.materials.wood=12;
    const next=applyTownCommand(state,'town',{type:'wrap-fence',entityId:'patch'},'ring',1000);
    assert.equal(next.entities.filter(e=>e.blueprintId==='wooden-fence').length,12);assert.equal(next.materials.wood,0);
    assert.equal(next.materials.stamina,0);assert.equal(planPatchFence(next,next.entities[0]!,'town').wood,0);
    const fence=next.entities[1]!;
    assert.equal(applyTownCommand(next,'town',{type:'build',blueprintId:'wooden-fence',x:fence.x,y:fence.y},'retry',1000),next,'an existing fence is a no-op without spending');
    assert.ok(placementError(next.entities,'town',BLUEPRINTS.find(b=>b.id==='dirt-road')!,fence.x,fence.y));
    const blocked=town();blocked.materials.wood=100;blocked.entities.push({...fence,blueprintId:'dirt-road'});
    assert.throws(()=>applyTownCommand(blocked,'town',{type:'wrap-fence',entityId:'patch'},'ring',1000),/occupied/);
    assert.equal(blocked.materials.wood,100);assert.equal(blocked.entities.length,2);
    assert.throws(()=>applyTownCommand(town(),'town',{type:'wrap-fence',entityId:'patch'},'ring',1000),/wood/);
    const farm:Entity={id:'farm',blueprintId:'farmhouse',x:6,y:16,paidCost:{}};
    assert.ok(!animalWalkable([...next.entities,farm],farm,'dairy-cow',{mapId:'town'}).has(`${fence.x}:${fence.y}`));
    assert.ok(animalWalkable([...next.entities,farm],farm,'chicken',{mapId:'town'}).has(`${fence.x}:${fence.y}`));
});
test('cattle dog recruits actual cows, collie sheep; command schemas reject forged progress',()=>{
    const home:Entity={id:'home',blueprintId:'house',x:8,y:14,paidCost:{},pets:['australian-cattle-dog']};
    const farm:Entity={id:'farm',blueprintId:'farmhouse',x:6,y:19,paidCost:{}};
    const animals=createAnimalResidents([home,farm],[],{mapId:'town'});let protectedCow=false;
    for(let i=0;i<2400;i++){stepAnimalResidents(animals,.05,summer);protectedCow ||= animals.some(a=>a.species==='dairy-cow'&&a.herderId!==null);}
    assert.ok(protectedCow);
    assert.equal(townCommandSchema.safeParse({type:'harvest',entityId:'patch',generation:0,stamina:999}).success,false);
    assert.equal(townCommandSchema.safeParse({type:'plant',entityId:'patch',slot:4,generation:0,crop:'tomato'}).success,false);
});

test('compact saved animal snapshots preserve prediction and reject growth without a home clock',()=>{
    let state=town();state.entities.push({id:'farm',blueprintId:'farmhouse',x:6,y:19,paidCost:{}});
    state.entities.push({id:'home',blueprintId:'house',x:10,y:22,paidCost:{},pets:['australian-cattle-dog']});
    state=tickMap(state,'town',1000,summer,true);
    const expected=restoreAnimals(state.entities,state.gardening!.animals,{mapId:'town'});
    for(let i=0;i<200;i++)stepAnimalResidents(expected,.05,summer);
    state=tickMap(state,'town',6000,summer);state=tickMap(JSON.parse(JSON.stringify(state)),'town',11000,summer);
    const actual=restoreAnimals(state.entities,state.gardening!.animals,{mapId:'town'});
    for(const animal of actual){const match=expected.find(a=>a.id===animal.id)!;assert.equal(animal.seed,match.seed);assert.ok(Math.hypot(animal.x-match.x,animal.y-match.y)<.0001);}
    for(const animal of state.gardening!.animals){assert.ok(!('allowed' in animal));assert.ok(!('trees' in animal));}
    const before=structuredClone(state);
    state=tickMap(state,'town',16000,{...summer,timeOfDay:null});
    assert.deepEqual(state.entities,before.entities);assert.equal(state.gardening!.activeSeconds,before.gardening!.activeSeconds);
});

test('legacy mixed turfs keep maturity and resources while adopting one crop, exactly once',()=>{
    const legacy:any=town();delete legacy.entities[0].garden.crop;delete legacy.entities[0].garden.generation;
    legacy.entities[0].garden.slots[1].crop='corn';legacy.entities[0].garden.slots[0].growth=300;legacy.entities[0].garden.slots[1].growth=150;
    const next=ensureTownGardens(legacy);assert.ok(next.entities[0]!.garden!.slots.every(slot=>slot.crop==='tomato'));
    assert.deepEqual(next.entities[0]!.garden!.slots.map(slot=>slot.growth),[300,150,0,0]);assert.deepEqual(next.materials,legacy.materials);assert.deepEqual(next.earned,legacy.earned);
    assert.equal(ensureTownGardens(next),next);
});
