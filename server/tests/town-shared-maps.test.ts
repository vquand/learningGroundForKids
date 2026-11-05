import test from 'node:test';
import assert from 'node:assert/strict';
import {BLUEPRINTS,emptyTown,type Entity,type TownState} from '../src/town-building/game.ts';
import {emptyLake,applyLakeCommand} from '../src/town-building/maps/lake/game.ts';
import {applyMapLandCommand} from '../src/town-building/maps/land.ts';
import {ensurePoultry,settlePoultry} from '../src/town-building/poultry.ts';
import {gardenAreaEffects,gardenInsectSources} from '../src/town-building/gardenEffects.ts';
import {createAnimalResidents} from '../src/town-building/animalWorld.ts';
import {applyGardenContacts,freshPatch} from '../src/town-building/garden.ts';
import {duckDuty,duckHelpCoverage} from '../src/town-building/water/ducks.ts';
import {tickMap} from '../src/town-building/mapTick.ts';
import {mapDefinition} from '../src/town-building/maps/registry.ts';
import type {LakeRaft} from '../src/town-building/water/types.ts';

const morning={season:'autumn' as const,timeOfDay:'morning' as const,precipitation:'none' as const,localDate:'2026-10-20'};
function town():TownState{
    const state=emptyTown();state.maps={lake:emptyLake(1000)};
    state.materials={stamina:1000,wood:1000,rock:1000,sand:1000,metal:1000};state.storage={built:false,crops:{},milk:[],fish:{},wool:1000};
    state.learnedIds=Array.from({length:40},(_,i)=>`item-${i}`);
    return state;
}
const raft=(id:string,blueprintId:LakeRaft['blueprintId'],x:number,y:number):LakeRaft=>({id,blueprintId,x,y,paidCost:{},generation:0,fish:[],plant:null,plantGrowth:0,feeder:false});

test('water structures build on the Town river once the lake opens; depth and reserved tiles apply',()=>{
    let state=town();
    state=applyLakeCommand(state,{type:'build-raft',blueprintId:'floating-garden',x:15,y:16,mapId:'town'},1000,'garden',{});
    assert.equal(state.rafts!.length,1);assert.equal(state.maps!.lake!.rafts.length,0);
    assert.ok(state.maps!.lake!.built.includes('floating-garden'),'one shared water-care book');
    state=applyLakeCommand(state,{type:'build-raft',blueprintId:'nursery',x:15,y:0,mapId:'town'},1000,'nursery',{});
    assert.throws(()=>applyLakeCommand(state,{type:'stock',raftId:'nursery',species:'P3',mapId:'town'},1000,'fish',{P3:10}),/deep/,'a river is shallow water: deep-water fish stay at the Lake');
    state=applyLakeCommand(state,{type:'stock',raftId:'nursery',species:'P1',mapId:'town'},1000,'fish',{P1:10});
    assert.equal(state.rafts!.find(r=>r.id==='nursery')!.fish.length,16);
    assert.throws(()=>applyLakeCommand(state,{type:'build-raft',blueprintId:'floating-garden',x:15,y:6,mapId:'town'},1000,'reserved',{}),/river friends/);
    assert.throws(()=>applyLakeCommand(state,{type:'build-raft',blueprintId:'floating-garden',x:3,y:16,mapId:'town'},1000,'land',{}),/water/);
    assert.throws(()=>applyLakeCommand({...emptyTown()},{type:'build-raft',blueprintId:'floating-garden',x:15,y:16,mapId:'town'},1000,'locked',{}),/Flower prosperity/);
    state=applyLakeCommand(state,{type:'plant',raftId:'garden',plant:'water-spinach',mapId:'town'},1000,'plant',{});
    assert.equal(state.rafts![0]!.plant,'water-spinach');
    assert.throws(()=>applyMapLandCommand(state,{type:'land-action',mapId:'town',command:{type:'build',blueprintId:'house',x:14,y:16}},1000,'house',morning),/occupied|river/,'land buildings keep clear of water structures');
});

test('only Town Hall is restricted to Town, whether built or moved',()=>{
    let state=town();
    assert.throws(()=>applyMapLandCommand(state,{type:'land-action',mapId:'lake',command:{type:'build',blueprintId:'town-hall',x:2,y:1}},1000,'hall',morning),/only be built in Town/);
    state=applyMapLandCommand(state,{type:'land-action',mapId:'town',command:{type:'build',blueprintId:'town-hall',x:2,y:10}},1000,'hall',morning);
    assert.throws(()=>applyMapLandCommand(state,{type:'transfer-building',entityId:'hall',sourceMap:'town',destinationMap:'lake',x:2,y:1},1000,'move',morning),/only be built in Town/);
    for(const b of BLUEPRINTS.filter(b=>b.kind==='building'&&b.id!=='town-hall'))assert.equal(b.maps,undefined,`${b.id} may be built on any map`);
    state=applyMapLandCommand(state,{type:'land-action',mapId:'lake',command:{type:'build',blueprintId:'school',x:2,y:1}},1000,'school',morning);
    assert.ok(state.maps!.lake!.land.entities.some(e=>e.id==='school'));
});

test('a Town insect raiser affects Town gardens and chicken eggs exactly like one at the Lake',()=>{
    let state=town();
    state=applyLakeCommand(state,{type:'build-raft',blueprintId:'insect-raiser',x:14,y:20,mapId:'town'},1000,'insects',{});
    state.entities.push({id:'coop',blueprintId:'coop',animal:'chicken',x:12,y:19,paidCost:{}});
    const patch:Entity={id:'patch',blueprintId:'vegetable-patch',x:12,y:22,paidCost:{},garden:freshPatch('autumn')};
    state.entities.push(patch);
    state=settlePoultry(ensurePoultry(state,1000),1000);
    assert.equal(state.entities.find(e=>e.id==='coop')!.poultry!.rate,2,'insects nearby double laying on any map');
    assert.equal(gardenAreaEffects(patch,state.entities,gardenInsectSources(state.rafts!,'town'),'town').insects,true);
});

test('ducks roam the land unless their shore area holds something to help',()=>{
    const coop:Entity={id:'ducks',blueprintId:'coop',animal:'duck',x:13,y:17,paidCost:{}};
    const inland={...coop,x:6};
    assert.equal(duckDuty({mapId:'town',entities:[inland],rafts:[]},inland),'land');
    assert.equal(duckDuty({mapId:'town',entities:[coop],rafts:[]},coop),'land','no beneficiary: fall back to roaming');
    const garden=raft('garden','floating-garden',15,16),friendly=raft('friendly','friendly',15,16);
    assert.equal(duckDuty({mapId:'town',entities:[coop],rafts:[friendly]},coop),'land','special homes are never beneficiaries');
    const world={mapId:'town' as const,entities:[coop],rafts:[garden]};
    assert.equal(duckDuty(world,coop),'water');
    const area=duckHelpCoverage(world,coop),birds=createAnimalResidents([coop],[],{mapId:'town',rafts:[garden]});
    for(const bird of birds){
        assert.equal(bird.duty,'water');
        for(const cell of bird.allowed){const [x,y]=cell.split(':').map(Number);
            assert.ok(area.has(cell)||x!>=coop.x-1&&x!<=coop.x+2&&y!>=coop.y-1&&y!<=coop.y+2,`water-duty ducks stay on their water or doorstep (${cell})`);}
    }
    const roaming=createAnimalResidents([inland],[],{mapId:'town'});
    assert.ok(roaming.every(bird=>bird.duty==='land'&&bird.allowed.size>area.size),'land ducks roam widely');
    const patch:Entity={id:'patch',blueprintId:'vegetable-patch',x:5,y:5,paidCost:{},garden:freshPatch('autumn')};
    const visitor={...roaming[0]!,x:5.5,y:5.5,mode:'roaming' as const,sleeping:false,inactive:false};
    applyGardenContacts(patch,[{...visitor,duty:'water'}]);assert.equal(patch.garden!.boost,0,'water-duty ducks never help crops');
    applyGardenContacts(patch,[visitor]);assert.equal(patch.garden!.boost,30,'land ducks help the crops they visit');
});

test('Halloween runs on every map with its own lanterns; Women\'s Day stays in Town',()=>{
    let state=town();
    const halloween={...morning,localDate:'2026-10-30',timeOfDay:'night' as const,isDay:false};
    state=tickMap(state,'lake',1000,halloween,true);
    assert.ok(state.maps!.lake!.land.events?.['halloween-pumpkins'],'the Lake has its own Halloween occurrence');
    assert.equal(state.events?.['halloween-pumpkins'],undefined,'ticking the Lake never runs Town\'s occurrence');
    state=tickMap(state,'lake',2000,{...morning,localDate:'2026-10-20',timeOfDay:'noon' as const},true);
    assert.equal(state.maps!.lake!.land.events?.['womens-day'],undefined);
    assert.ok(mapDefinition('lake').rows>0);
});

test('moving a resting shop between maps keeps its remaining rest on the destination clock',()=>{
    const base=town();
    base.civ={activeMs:100000,lastTick:0,helpedTypes:[]};base.maps!.lake!.land.civ={activeMs:5000,lastTick:0,helpedTypes:[]};
    // Two minutes of rest remain on Town's shop clock.
    base.entities.push({id:'bakery',blueprintId:'bakery',x:2,y:10,paidCost:{},civ:{phase:'ready',elapsedMs:0,routeKey:'',helpStep:0,helpAfterMs:220000}});
    const toLake=applyMapLandCommand(base,{type:'transfer-building',entityId:'bakery',sourceMap:'town',destinationMap:'lake',x:2,y:1},1000,'move',morning);
    assert.equal(toLake.maps!.lake!.land.entities.find(e=>e.id==='bakery')!.civ!.helpAfterMs,5000+120000);
    const back=applyMapLandCommand(toLake,{type:'transfer-building',entityId:'bakery',sourceMap:'lake',destinationMap:'town',x:2,y:10},1000,'back',morning);
    assert.equal(back.entities.find(e=>e.id==='bakery')!.civ!.helpAfterMs,100000+120000,'moving back cannot skip the rest');
    const rested=structuredClone(base);rested.entities.find(e=>e.id==='bakery')!.civ!.helpAfterMs=50000;
    const fresh=applyMapLandCommand(rested,{type:'transfer-building',entityId:'bakery',sourceMap:'town',destinationMap:'lake',x:2,y:1},1000,'move',morning);
    assert.equal(fresh.maps!.lake!.land.entities.find(e=>e.id==='bakery')!.civ!.helpAfterMs,0,'a rested shop stays ready to help');
});

test('shared Town achievements count buildings and harvests on every map',()=>{
    let state=town();
    state=applyMapLandCommand(state,{type:'land-action',mapId:'town',command:{type:'build',blueprintId:'farmhouse',x:2,y:10}},1000,'farm',morning);
    assert.equal(state.earned['town-farm-friends'],undefined);
    state=applyMapLandCommand(state,{type:'land-action',mapId:'lake',command:{type:'build',blueprintId:'coop',x:2,y:1}},1000,'coop',morning);
    assert.ok(state.earned['town-farm-friends'],'a Town farmhouse and a Lake coop are Farm Friends');
    state.gardening={lastTick:0,activeSeconds:0,harvests:16,animals:[],season:'autumn'};
    state.maps!.lake!.land.gardening={lastTick:0,activeSeconds:0,harvests:4,animals:[],season:'autumn'};
    state=applyMapLandCommand(state,{type:'land-action',mapId:'lake',command:{type:'build',blueprintId:'dirt-road',x:6,y:1}},1000,'road',morning);
    assert.ok(state.earned['town-garden-basket'],'16 Town and 4 Lake harvests fill the Garden Basket');
});
