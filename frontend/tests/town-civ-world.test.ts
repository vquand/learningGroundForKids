import assert from 'node:assert/strict';
import test from 'node:test';
import { createCivWorld, stepCivWorld, civDirection, alongCivPath } from '../src/features/town-building/civWorld.ts';
import { freshCivHome } from '../../server/src/town-building/civCatalog.ts';
import { CIV_GATE, civWalkPath, civEntrance } from '../../server/src/town-building/civ.ts';
import type { Entity } from '../../server/src/town-building/game.ts';
import {mapDefinition} from '../../server/src/town-building/maps/registry.ts';
const town=mapDefinition('town');
const host:Entity={id:'grocery',blueprintId:'grocery',x:5,y:12,paidCost:{},civ:{...freshCivHome(),phase:'ready'}};
test('NPC navigation uses explicit map context even with no buildings',()=>{
 const world=createCivWorld([],mapDefinition('lake'));
 assert.equal(world.walkable.has('8:12'),false,'lake water cannot become a Town footpath');
 assert.ok(world.walkable.has('7:3'));
});
test('people have proper four directions and interpolate cardinal steps without side-sliding',()=>{
 assert.equal(civDirection(0,1),'right');assert.equal(civDirection(0,-1),'left');assert.equal(civDirection(1,0),'down');assert.equal(civDirection(-1,0),'up');
 assert.deepEqual(alongCivPath([{x:5,y:4},{x:6,y:4}],.5),{x:5.5,y:4,direction:'down'});
});
test('ordinary residents can walk farther than two off-road steps and never cross footprints',()=>{
 const path=civWalkPath([host],{x:7,y:13},{x:7,y:20},town);assert.equal(path.length,8);
 const world=createCivWorld([host],town);const actor=world.people[0]!;let moved=false;
 for(let i=0;i<200;i++){stepCivWorld(world,[host],110000,{localTime:'09:00'},.05);moved ||= actor.x!==7||actor.y!==13;assert.ok(world.walkable.has(`${Math.round(actor.x)}:${Math.round(actor.y)}`));}
 assert.ok(moved);const previous={x:actor.x,y:actor.y};stepCivWorld(world,[host],110000,{localTime:'09:00'},1,true);assert.equal(actor.x,previous.x);assert.equal(actor.y,previous.y);
});
test('world rebuilds preserve existing people and add only bounded decorative guests',()=>{
 const first=createCivWorld([host],town);first.people[0]!.clock=42;
 const second=createCivWorld([host],town,first,99);assert.equal(second.people[0],first.people[0]);assert.equal(second.people[0]!.clock,42);assert.equal(second.people.filter(p=>p.guest).length,3);
 assert.equal(createCivWorld([],town,second,3).people.length,0);
});

test('walking consumes the full movement budget across tile boundaries',()=>{
 const world=createCivWorld([host],town),actor=world.people[0]!;
 actor.x=7;actor.y=13.99;actor.path=[{x:7,y:14},{x:7,y:15}];
 stepCivWorld(world,[host],110000,{localTime:'09:00'},.05);
 assert.ok(Math.abs(actor.y-14.06)<.00001, `lost movement at tile boundary: ${actor.y}`);
});

test('decorative outside guests start at the fixed entrance',()=>{
 const world=createCivWorld([host],town,undefined,3);
 for(const person of world.people.filter(p=>p.guest))assert.deepEqual({x:person.x,y:person.y},CIV_GATE);
});

test('a town edit invalidates NPC routes through newly occupied tiles and recovers a blocked starting tile',()=>{
 const first=createCivWorld([host],town),actor=first.people[0]!;actor.x=7;actor.y=16;actor.path=[{x:7,y:17},{x:7,y:18}];actor.mode='walk';
 const obstacle:Entity={id:'new-house',blueprintId:'house',x:7,y:16,paidCost:{}};
 const world=createCivWorld([host,obstacle],town,first);const moved=world.people[0]!;
 assert.ok(world.walkable.has(`${Math.round(moved.x)}:${Math.round(moved.y)}`),'NPC cannot stay stranded inside a newly occupied footprint');
 assert.ok(moved.path.every(p=>world.walkable.has(`${p.x}:${p.y}`)),'stale route cannot cross the new building');
});

test('existing houses over the west gate cannot strand decorative visitors',()=>{
 const house:Entity={id:'old-house',blueprintId:'large-house',x:5,y:0,paidCost:{}};
 const world=createCivWorld([host,house],town,undefined,3),guests=world.people.filter(p=>p.guest),starts=guests.map(p=>({x:p.x,y:p.y}));
 assert.ok(guests.every(p=>world.walkable.has(`${p.x}:${p.y}`)));
 for(let i=0;i<600;i++)stepCivWorld(world,[host,house],110000,{localTime:'09:00'},.05);
 assert.ok(guests.every((p,i)=>Math.hypot(p.x-starts[i]!.x,p.y-starts[i]!.y)>.1),'visitors must be able to leave their recovered spawn');
});

test('a visitor at its only nearby destination does not idle there forever',()=>{
 const school:Entity={id:'school',blueprintId:'school',x:5,y:20,paidCost:{},civ:{...freshCivHome(),phase:'ready'}};
 const entities=[host,school],world=createCivWorld(entities,town,undefined,1),visitor=world.people.find(p=>p.guest)!;
 const door=civEntrance(school);visitor.x=door.x;visitor.y=door.y;visitor.path=[];visitor.pause=0;let moved=false;
 for(let i=0;i<600;i++){stepCivWorld(world,entities,0,{localTime:'10:00',timeOfDay:'morning'},.05);moved ||= Math.hypot(visitor.x-door.x,visitor.y-door.y)>.5;}
 assert.ok(moved,'a zero-length repeat visit must fall back to another reachable walk');
});
test('evening visitors leave through the gate and do not continue shopping all night',()=>{
 const world=createCivWorld([host],town,undefined,1),visitor=world.people.find(p=>p.guest)!;
 visitor.x=7;visitor.y=13;visitor.pause=5;visitor.path=[{x:7,y:14},{x:7,y:15}];
 for(let i=0;i<1000;i++)stepCivWorld(world,[host],0,{localTime:'22:00',timeOfDay:'night'},.05);
 assert.equal(visitor.visible,false);assert.deepEqual({x:visitor.x,y:visitor.y},CIV_GATE);
 stepCivWorld(world,[host],0,{localTime:'09:00',timeOfDay:'morning'},.05);assert.equal(visitor.visible,true);
});
test('reduced motion still puts a closed-shop worker indoors and removes nighttime visitors',()=>{
 const world=createCivWorld([host],town,undefined,1);world.people.forEach(p=>{p.x=7;p.y=18;p.visible=true;});
 stepCivWorld(world,[host],0,{localTime:'22:00',timeOfDay:'night'},.05,true);
 assert.ok(world.people.every(p=>!p.visible),'reduced motion must freeze animation, not prevent going inside');
});

test('closing time replans a returning worker immediately instead of completing an old errand',()=>{
 const world=createCivWorld([host],town),worker=world.people[0]!;worker.x=7;worker.y=18;worker.routePurpose='errand';worker.path=[{x:7,y:19},{x:7,y:20}];
 stepCivWorld(world,[host],110000,{localTime:'22:00',timeOfDay:'night'},.05);
 assert.equal(worker.routePurpose,'home');assert.ok(worker.y<18);assert.deepEqual(worker.path.at(-1),civEntrance(host));
 for(let i=0;i<200;i++)stepCivWorld(world,[host],110000,{localTime:'22:00',timeOfDay:'night'},.05);
 assert.equal(worker.visible,false);assert.equal(worker.mode,'rest');
});
test('turning a shop in place sends its waiting workers to the new door',()=>{
 const arriving:Entity={...host,civ:{...freshCivHome(),phase:'travelling'}};
 const before=createCivWorld([arriving],town),turned={...arriving,direction:'left' as const};
 const after=createCivWorld([turned],town,before),entrance=civEntrance(turned);
 assert.notDeepEqual(civEntrance(arriving),entrance);
 assert.deepEqual({x:after.people[0]!.x,y:after.people[0]!.y},{x:entrance.x,y:entrance.y});
 assert.deepEqual(createCivWorld([turned],town,after).people[0],after.people[0],'an unchanged rebuild keeps the same person');
});
