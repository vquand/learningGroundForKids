import test from 'node:test';
import assert from 'node:assert/strict';
import {animalWalkable,createAnimalResidents,stepAnimalResidents} from '../src/town-building/animalWorld.ts';
import {mapDefinition} from '../src/town-building/maps/registry.ts';
import type {Entity} from '../src/town-building/game.ts';

test('animal navigation follows the map it is given, never a field on the entity',()=>{
    const coop:Entity={id:'coop',blueprintId:'coop',animal:'chicken',mapId:'town',x:6,y:5,paidCost:{}};
    const lake=animalWalkable([coop],coop,'chicken',{mapId:'lake'});
    for(const cell of lake){const [x,y]=cell.split(':').map(Number);assert.equal(mapDefinition('lake').terrainAt(x!,y!),'grass','chickens stay on Lake land');}
    assert.notDeepEqual(lake,animalWalkable([coop],coop,'chicken',{mapId:'town'}),'the legacy entity mapId is ignored');
});
test('herding dogs never recruit animals living on another map',()=>{
    const dog:Entity={id:'dog',blueprintId:'house',pets:['border-collie'],x:6,y:3,paidCost:{}},sheep:Entity={id:'sheep',blueprintId:'farmhouse',animal:'sheep',x:9,y:3,paidCost:{}};
    const residents=[...createAnimalResidents([dog],[],{mapId:'town'}),...createAnimalResidents([sheep],[],{mapId:'lake'})];
    for(let i=0;i<100;i++)stepAnimalResidents(residents,.05,{precipitation:'none',timeOfDay:'morning'});
    assert.equal(residents.find(a=>a.species==='border-collie')!.herding,null);
    assert.ok(residents.filter(a=>a.species==='sheep').every(a=>a.herderId===null));
});
test('transferred animal hosts rebuild habitat without retaining the previous map',()=>{
    const coop:Entity={id:'coop',blueprintId:'coop',animal:'goose',x:6,y:3,paidCost:{}};
    const lake=createAnimalResidents([coop],[],{mapId:'lake'});
    const town=createAnimalResidents([coop],lake,{mapId:'town'});
    assert.ok(town.every(a=>a.mapId==='town'));
    assert.ok(town.every(a=>a.allowed.has(`${Math.floor(a.x)}:${Math.floor(a.y)}`)));
    assert.deepEqual(town,createAnimalResidents([coop],[],{mapId:'town'}));
});
