import test from 'node:test';
import assert from 'node:assert/strict';
import { GardenSessions, withoutAnimalPositions } from '../src/town-building/gardenSessions.js';
import { emptyTown } from '../src/town-building/game.js';
import { freshPatch } from '../src/town-building/garden.js';
import {tickMap} from '../src/town-building/mapTick.ts';
const summer={season:'summer' as const,timeOfDay:'noon',precipitation:'none' as const};
function town(){const state=emptyTown();state.entities.push({id:'patch',blueprintId:'vegetable-patch',x:8,y:14,paidCost:{},garden:freshPatch('summer')},{id:'farm',blueprintId:'farmhouse',x:6,y:19,paidCost:{}});return state;}
test('volatile growth overlays owned state without exposing or persisting positions',()=>{
 let now=1000;const sessions=new GardenSessions(()=>now);const stored=town();
 sessions.put('kid',tickMap(stored,'town',now,summer,true));now+=5000;
 const active=tickMap(sessions.read('kid',stored)!,'town',now,summer);sessions.put('kid',active);
 assert.equal(active.revision,stored.revision,'presence never advances the construction revision');
 assert.ok(active.gardening!.animals.length>0,'server keeps its own contact simulation');
 assert.ok(active.entities[0]!.garden!.slots[0]!.growth>0);
 assert.equal(stored.entities[0]!.garden!.slots[0]!.growth,0,'durable input is never changed by presence');
 const view=withoutAnimalPositions(sessions.read('kid',stored)!);
 assert.deepEqual(view.gardening!.animals,[]);assert.equal(view.gardening!.lastTick,now);
 const durable=withoutAnimalPositions(active,true);assert.equal(durable.gardening!.lastTick,0);assert.deepEqual(durable.gardening!.animals,[]);
 assert.ok(active.gardening!.animals.length>0,'stripping does not mutate the live lease');
 assert.equal(sessions.read('another-kid',stored),undefined,'leases are profile scoped');
});
test('durable revision changes, expiry and eviction cannot resurrect uncommitted growth or a spent harvest',()=>{
 let now=1000;const sessions=new GardenSessions(()=>now,2),stored=town();
 sessions.put('a',tickMap(stored,'town',now,summer,true));
 assert.equal(sessions.read('a',{...stored,revision:stored.revision+1}),undefined);
 sessions.put('a',stored);sessions.put('b',stored);sessions.put('c',stored);assert.equal(sessions.read('a',stored),undefined);
 now+=120001;assert.equal(sessions.read('b',stored),undefined);
});
