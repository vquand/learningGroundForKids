import assert from 'node:assert/strict';
import test from 'node:test';
import {createApp} from '../src/app.ts';
import {loadConfig} from '../src/config.ts';
import {hashSessionToken} from '../src/auth.ts';
import {AppError} from '../src/errors.ts';
import type {AppDatabase} from '../src/contracts/db.ts';
import {emptyTown,type Entity,type TownState} from '../src/town-building/game.ts';
import {freshPatch,GROW_SECONDS} from '../src/town-building/garden.ts';
import {settleFarm} from '../src/town-building/barn.ts';
import {emptyLake,applyLakeCommand} from '../src/town-building/maps/lake/game.ts';
import {applyMapLandCommand} from '../src/town-building/maps/land.ts';
import {applyHarvestAll} from '../src/town-building/harvestAll.ts';
import {harvestAllForMap} from '../src/town-building/harvestSchema.ts';
import {mapHarvestReady} from '../src/town-building/harvestReadiness.ts';
import {townPayload,townStatePayload} from '../src/town-building/presentation.ts';
import {lakeActionSchema} from '../src/town-building/maps/lake/commands.ts';
import {townActionSchema,townCommandSchema} from '../src/town-building/routes.ts';
import type {HarvestCategory} from '../src/town-building/harvestTypes.ts';
import type {MapId} from '../src/town-building/maps/types.ts';
import {LAKE_GROW_SECONDS,type LakeFishId} from '../src/town-building/water/catalog.ts';
import type {LakeFish,LakeRaft} from '../src/town-building/water/types.ts';

const now=1000;
const clock={season:'spring' as const,timeOfDay:'morning' as const,localDate:'2026-11-02',localTime:'09:00'};
const catchesAll:Partial<Record<LakeFishId,number>>={P1:10,P4:10};

function ripePatch(id:string,x:number,y:number,growth=GROW_SECONDS):Entity {
    const garden=freshPatch('spring');
    for(const slot of garden.slots)slot.growth=growth;
    return {id,blueprintId:'vegetable-patch',x,y,paidCost:{},garden};
}
function coop(id:string,x:number,y:number,eggs:number):Entity {
    return {id,blueprintId:'coop',animal:'chicken',x,y,paidCost:{},poultry:{eggs,progress:0,lastTick:now,rate:1,generation:0}};
}
function barn(id:string,x:number,y:number,animal:'dairy-cow'|'sheep'|'highland-cow',stock:number):Entity {
    return {id,blueprintId:'farmhouse',animal,x,y,paidCost:{},barn:{species:animal,stock,progress:0,lastTick:now,fedUntil:0,generation:0}};
}
function townWith(entities:Entity[]=[],rafts:LakeRaft[]=[]):TownState {
    const state=emptyTown();state.entities=entities;state.revision=3;
    if(rafts.length)state.rafts=rafts;
    return settleFarm(state,now);
}
function lakeWith(land:Entity[]=[],rafts:LakeRaft[]=[]):TownState {
    const state=emptyTown();state.revision=3;
    state.maps={lake:emptyLake(now)};state.maps.lake!.land.entities=land;state.maps.lake!.rafts=rafts;
    return settleFarm(state,now);
}
const fish=(id:string,species:LakeFishId,growth:number):LakeFish=>({id,species,growth});
const nursery=(fishes:LakeFish[],extra:Partial<LakeRaft>={}):LakeRaft=>({id:'nursery',blueprintId:'nursery',x:8,y:7,paidCost:{},generation:0,fish:fishes,plant:null,plantGrowth:0,feeder:false,...extra});
const floatingGarden=(plantGrowth:number,extra:Partial<LakeRaft>={}):LakeRaft=>({id:'garden',blueprintId:'floating-garden',x:11,y:7,paidCost:{},generation:0,fish:[],plant:'water-spinach',plantGrowth,feeder:false,...extra});
function run(state:TownState,mapId:MapId,category:HarvestCategory,revision=state.revision,catches?:Partial<Record<LakeFishId,number>>) {
    return applyHarvestAll(state,revision,{type:'harvest-all',mapId,category},now,clock,catches);
}
const raftOf=(state:TownState,id:string)=>state.maps!.lake!.rafts.find(r=>r.id===id)!;
const landOf=(state:TownState,id:string)=>state.maps!.lake!.land.entities.find(e=>e.id===id)!;
const entitiesOn=(state:TownState,mapId:MapId):Entity[]=>mapId==='town'?state.entities:state.maps!.lake!.land.entities;
const byId=(entities:Entity[],id:string)=>entities.find(e=>e.id===id)!;
/** Nurseries on one map. The Lake's reserve and catches are shared, so both maps read them from the Lake book. */
function fishWorld(mapId:MapId,rafts:LakeRaft[]):TownState {
    if(mapId==='lake')return lakeWith([],rafts);
    const state=townWith([],rafts);
    state.maps={lake:emptyLake(now)};
    return state;
}
const storeHouse=():Entity=>({id:'store',blueprintId:'town-storage',x:30,y:30,paidCost:{}});
/** Books a harvest may change; revisions are compared separately. */
const books=(state:TownState)=>({materials:state.materials,storage:state.storage,poultry:state.poultry,gardening:state.gardening,earned:state.earned,
    entities:state.entities,lake:state.maps?.lake?{...state.maps.lake,catches:undefined}:undefined});

test('town readiness: plants, animals and fish follow saved ripe, withered, collectable and grown state only',()=>{
    assert.deepEqual(mapHarvestReady(townWith([ripePatch('p',4,4)]),'town'),{plants:true,animals:false,fish:false});
    assert.equal(mapHarvestReady(townWith([ripePatch('p',4,4,GROW_SECONDS-1)]),'town').plants,false);
    const withered=townWith([ripePatch('p',4,4,0)]);withered.entities[0]!.garden!.slots[0]!.withered=true;
    assert.equal(mapHarvestReady(withered,'town').plants,true);
    assert.deepEqual(mapHarvestReady(townWith([coop('c',8,4,1)]),'town'),{plants:false,animals:true,fish:false});
    assert.deepEqual(mapHarvestReady(townWith([coop('c',8,4,0)]),'town'),{plants:false,animals:false,fish:false});
    assert.equal(mapHarvestReady(townWith([barn('b',12,4,'sheep',1)]),'town').animals,true);
    assert.equal(mapHarvestReady(townWith([barn('b',12,4,'sheep',0)]),'town').animals,false);
    assert.equal(mapHarvestReady(townWith([],[nursery([fish('a','P1',LAKE_GROW_SECONDS),fish('b','P1',10)])]),'town').fish,true);
    assert.equal(mapHarvestReady(townWith([],[nursery([fish('a','P1',LAKE_GROW_SECONDS-1)])]),'town').fish,false);
    // Companion fish in the fish home raft are never harvested.
    const home=nursery([fish('a','P1',LAKE_GROW_SECONDS)],{id:'home',blueprintId:'friendly'});
    assert.equal(mapHarvestReady(townWith([],[home]),'town').fish,false);
});

test('lake readiness covers floating gardens, land products and nursery fish; an unopened map reports nothing',()=>{
    const lake=lakeWith([ripePatch('lp',4,4),coop('lc',8,4,2)],[floatingGarden(LAKE_GROW_SECONDS),nursery([fish('a','P1',LAKE_GROW_SECONDS)])]);
    assert.deepEqual(mapHarvestReady(lake,'lake'),{plants:true,animals:true,fish:true});
    assert.deepEqual(mapHarvestReady(lakeWith([],[floatingGarden(LAKE_GROW_SECONDS-1)]),'lake'),{plants:false,animals:false,fish:false});
    assert.deepEqual(mapHarvestReady(emptyTown(),'lake'),{plants:false,animals:false,fish:false});
});

for(const mapId of ['town','lake'] as const) {
    const base=(extra:Entity[]=[])=>mapId==='town'?townWith([...extra]):lakeWith(extra);

    test(`${mapId}: animal batch equals manual egg and barn collections, with the same products and rewards`,()=>{
        const before=base([coop('c',8,4,3),barn('dairy',12,4,'dairy-cow',4),barn('wool',14,4,'sheep',4),barn('yarn',16,4,'highland-cow',4)]),saved=structuredClone(before);
        const entitiesOf=mapId==='town'?before.entities:before.maps!.lake!.land.entities;
        let expected=before;
        // Manual: the same four collections, one command each, through the land rule path.
        for(const e of entitiesOf.filter(e=>e.poultry||e.barn)){
            expected=applyMapLandCommand(expected,{type:'land-action',mapId,command:e.poultry?{type:'harvest-eggs',entityId:e.id,generation:0}:{type:'collect-barn',entityId:e.id,generation:0}},now,'m',clock);
        }
        const outcome=run(before,mapId,'animals');
        assert.deepEqual(before,saved);
        assert.equal(outcome.state.revision,before.revision+1);
        assert.deepEqual(books(outcome.state),books(expected));
        assert.equal(outcome.state.poultry?.harvested,3);
        assert.deepEqual(outcome.receipt.products,[{item:'egg',amount:3},{item:'milk',amount:4},{item:'wool',amount:4},{item:'yarn',amount:4}]);
        assert.deepEqual(outcome.receipt.reward,{stamina:6,milk:4,wool:4,yarn:4});
        assert.equal(outcome.receipt.replanted,0);assert.deepEqual(outcome.receipt.notReplanted,[]);
        assert.equal(outcome.receipt.id,`harvest-all:${mapId}:animals:${outcome.state.revision}`);
        assert.equal(outcome.receipt.duplicate,false);
    });

    test(`${mapId}: a barn with no storage room is skipped and reported while the eggs are still kept`,()=>{
        const state=base([coop('c',8,4,3),barn('dairy',12,4,'dairy-cow',4)]);
        state.storage={built:false,crops:{},milk:[{count:10,at:now}],fish:{}};
        const saved=structuredClone(state);
        const outcome=run(state,mapId,'animals');
        assert.deepEqual(state,saved);
        assert.equal(outcome.state.revision,state.revision+1);
        assert.equal(outcome.state.poultry?.harvested,3);
        assert.deepEqual(outcome.receipt.products,[{item:'egg',amount:3}]);
        assert.deepEqual(outcome.receipt.reward,{stamina:6});
        assert.deepEqual(outcome.receipt.notCollected,[{item:'milk',amount:4}]);
        // The skipped barn is untouched: same stock, same generation, storage unchanged.
        const dairy=byId(entitiesOn(outcome.state,mapId),'dairy');
        assert.deepEqual([dairy.barn?.stock,dairy.barn?.generation],[4,0]);
        assert.deepEqual(outcome.state.storage?.milk,[{count:10,at:now}]);
    });

    test(`${mapId}: partly full storage keeps every target that fits, reports what stayed, and leaves refused barns untouched`,()=>{
        const state=base([coop('c',8,4,3),barn('dairy',12,4,'dairy-cow',6),barn('wool',14,4,'sheep',4),barn('yarn',16,4,'highland-cow',4)]);
        state.storage={built:false,crops:{},milk:[{count:7,at:now}],fish:{}};
        state.storage!.wool=10;
        const saved=structuredClone(state);
        const outcome=run(state,mapId,'animals');
        assert.deepEqual(state,saved);
        // Milk fits three of six: the barn keeps the manual partial collect and the other three stay in it.
        assert.deepEqual(outcome.receipt.products,[{item:'egg',amount:3},{item:'milk',amount:3},{item:'yarn',amount:4}]);
        assert.deepEqual(outcome.receipt.reward,{stamina:6,milk:3,yarn:4});
        assert.deepEqual(outcome.receipt.notCollected,[{item:'milk',amount:3},{item:'wool',amount:4}]);
        assert.deepEqual(outcome.receipt.notReplanted,[]);
        const ents=entitiesOn(outcome.state,mapId);
        assert.deepEqual([byId(ents,'dairy').barn?.stock,byId(ents,'dairy').barn?.generation],[3,1]);
        // The refused wool barn is byte-for-byte untouched and its material never moved.
        assert.deepEqual(byId(ents,'wool'),byId(entitiesOn(saved,mapId),'wool'));
        assert.equal(outcome.state.storage!.wool,10);
        assert.equal(byId(ents,'yarn').barn?.stock,0);
        // A retry of the committed batch returns the same skips without awarding anything again.
        const retry=applyHarvestAll(outcome.state,state.revision,{type:'harvest-all',mapId,category:'animals'},now,clock);
        assert.equal(retry.receipt.duplicate,true);
        assert.deepEqual(retry.receipt.notCollected,outcome.receipt.notCollected);
        assert.equal(retry.state,outcome.state);
    });

    test(`${mapId}: when every ready animal target is blocked by storage the batch rejects with HARVEST_STORAGE_FULL and no write`,()=>{
        const state=base([barn('wool',14,4,'sheep',4)]);
        state.storage!.wool=10;
        const saved=structuredClone(state);
        assert.throws(()=>run(state,mapId,'animals'),(e:unknown)=>e instanceof AppError&&e.code==='HARVEST_STORAGE_FULL'&&e.status===409);
        assert.deepEqual(state,saved);
        assert.equal(state.revision,saved.revision);
    });

    test(`${mapId}: a full crop store skips the whole patch, keeps its ripe crops and rejects when nothing else can be kept`,()=>{
        const state=base([ripePatch('p',4,4)]);
        state.storage!.crops.carrot=10;
        const saved=structuredClone(state);
        assert.throws(()=>run(state,mapId,'plants'),(e:unknown)=>e instanceof AppError&&e.code==='HARVEST_STORAGE_FULL');
        assert.deepEqual(state,saved);
        assert.equal(state.revision,saved.revision);
    });

    test(`${mapId}: a patch that only partly fits is skipped whole, so no crop is discarded, while the patch that fits is kept`,()=>{
        const state=base([ripePatch('first',4,4),ripePatch('second',8,4)]);
        state.storage!.crops.carrot=6;
        const outcome=run(state,mapId,'plants');
        assert.deepEqual(outcome.receipt.products,[{item:'carrot',amount:4}]);
        assert.deepEqual(outcome.receipt.notCollected,[{item:'carrot',amount:4}]);
        assert.equal(outcome.receipt.replanted,4);
        assert.equal(outcome.state.storage!.crops.carrot,10);
        assert.equal(outcome.state.materials.stamina,state.materials.stamina+8);
        const [first,second]=[byId(entitiesOn(outcome.state,mapId),'first'),byId(entitiesOn(outcome.state,mapId),'second')];
        assert.ok(first.garden!.slots.every(s=>s.growth===0&&s.generation===1));
        assert.ok(second.garden!.slots.every(s=>s.growth===GROW_SECONDS&&s.generation===0));
        // Only the four crops of the kept patch count as harvests, on the map where they were grown.
        const harvestsOf=(s:TownState)=>mapId==='town'?s.gardening?.harvests:s.maps?.lake?.land.gardening?.harvests;
        assert.equal(harvestsOf(outcome.state),4);
        assert.equal(harvestsOf(state)??0,0);
    });

    test(`${mapId}: a refused target without a storage reason is skipped, and a batch with nothing kept rejects as HARVEST_EMPTY`,()=>{
        // The queued species needs 10 catches before the raft can be restocked; the manual harvest refuses.
        const state=fishWorld(mapId,[nursery([fish('f1','P1',LAKE_GROW_SECONDS),fish('f2','P1',LAKE_GROW_SECONDS)],{nextFish:'P4'})]);
        const saved=structuredClone(state);
        assert.throws(()=>run(state,mapId,'fish',state.revision,{P1:10,P4:9}),(e:unknown)=>e instanceof AppError&&e.code==='HARVEST_EMPTY');
        assert.deepEqual(state,saved);
        assert.equal(state.revision,saved.revision);
    });

    test(`${mapId}: stale revisions and empty categories reject with no write or revision bump`,()=>{
        const ready=base([ripePatch('p',4,4)]),saved=structuredClone(ready);
        assert.throws(()=>run(ready,mapId,'plants',ready.revision+1),(e:unknown)=>e instanceof AppError&&e.code==='TOWN_STALE');
        assert.deepEqual(ready,saved);
        const empty=base([ripePatch('p',4,4,GROW_SECONDS-1)]),emptySaved=structuredClone(empty);
        assert.throws(()=>run(empty,mapId,'plants'),(e:unknown)=>e instanceof AppError&&e.code==='HARVEST_EMPTY');
        assert.deepEqual(empty,emptySaved);
        assert.throws(()=>run(base(),mapId,'animals'),(e:unknown)=>e instanceof AppError&&e.code==='HARVEST_EMPTY');
    });

    test(`${mapId}: a retried request returns the committed receipt once and awards nothing again`,()=>{
        const before=base([ripePatch('p',4,4)]);
        const first=run(before,mapId,'plants');
        const retry=applyHarvestAll(first.state,before.revision,{type:'harvest-all',mapId,category:'plants'},now,clock);
        assert.equal(retry.receipt.duplicate,true);
        assert.equal(retry.receipt.id,first.receipt.id);
        assert.deepEqual(retry.receipt.products,first.receipt.products);
        assert.equal(retry.state,first.state);
        assert.equal(retry.state.materials.stamina,first.state.materials.stamina);
        // The same revision for another category is a different request, so it is stale.
        assert.throws(()=>applyHarvestAll(first.state,before.revision,{type:'harvest-all',mapId,category:'animals'},now,clock),(e:unknown)=>e instanceof AppError&&e.code==='TOWN_STALE');
    });
}

test('town plants: five full patches pay exactly as five manual harvests when a Town Storage holds all twenty crops',()=>{
    const patches=[0,1,2,3,4].map(i=>ripePatch(`p${i}`,4+i*3,4));
    const before=townWith([...patches,storeHouse()]);
    assert.equal(before.storage?.built,true);
    let expected=before;
    for(const p of patches)expected=applyMapLandCommand(expected,{type:'land-action',mapId:'town',command:{type:'harvest',entityId:p.id,generation:0}},now,'m',clock);
    const outcome=run(before,'town','plants');
    assert.deepEqual(books(outcome.state),books(expected));
    assert.equal(outcome.state.materials.stamina,before.materials.stamina+40);
    assert.equal(outcome.state.gardening?.harvests,20);
    assert.ok(outcome.state.earned['town-first-harvest']&&outcome.state.earned['town-garden-basket']);
    assert.deepEqual(outcome.receipt.products,[{item:'carrot',amount:20}]);
    assert.equal(outcome.receipt.replanted,20);assert.deepEqual(outcome.receipt.notReplanted,[]);
    assert.deepEqual(outcome.receipt.notCollected,[]);
    assert.deepEqual(outcome.receipt.reward,{stamina:40});
    for(const p of outcome.state.entities.filter(e=>e.garden))for(const slot of p.garden!.slots){assert.equal(slot.growth,0);assert.equal(slot.generation,1);}
});

test('a nursery whose fish would overflow the reserve is skipped whole, and the other nursery is still harvested',()=>{
    for(const mapId of ['town','lake'] as const) {
        // Restocking checks water placement, so each map's nurseries sit on its own river or lake tiles.
        const [fx,fy,ox,oy]=mapId==='town'?[16,4,16,12]:[8,7,11,7];
        const full=nursery([fish('f1','P1',LAKE_GROW_SECONDS),fish('f2','P1',LAKE_GROW_SECONDS)],{id:'full',x:fx,y:fy});
        const open=nursery([fish('f3','P4',LAKE_GROW_SECONDS)],{id:'open',x:ox,y:oy});
        const state=fishWorld(mapId,[full,open]);
        state.maps!.lake!.reserve={P1:9};
        const saved=structuredClone(state);
        const outcome=run(state,mapId,'fish',state.revision,{P1:10,P4:10});
        assert.deepEqual(state,saved);
        assert.deepEqual(outcome.receipt.products,[{item:'P4',amount:1}]);
        assert.deepEqual(outcome.receipt.notCollected,[{item:'P1',amount:2}]);
        assert.equal(outcome.state.maps!.lake!.reserve.P1,9);
        assert.equal(outcome.state.maps!.lake!.reserve.P4,1);
        // The full nursery keeps its ready fish and its growth; nothing about it changed.
        const raftsOf=(s:TownState)=>mapId==='town'?s.rafts!:s.maps!.lake!.rafts;
        assert.deepEqual(raftsOf(outcome.state).find(r=>r.id==='full'),raftsOf(saved).find(r=>r.id==='full'));
        assert.deepEqual(raftsOf(outcome.state).find(r=>r.id==='full')!.fish.map(f=>[f.id,f.growth]),[['f1',LAKE_GROW_SECONDS],['f2',LAKE_GROW_SECONDS]]);
        assert.equal(outcome.state.maps!.lake!.harvested,1);
    }
});

test('withered patch slots are harvested for no reward, replanted free and never counted as harvests',()=>{
    const patch=ripePatch('p',4,4,100);
    patch.garden!.slots[0]!.withered=true;patch.garden!.slots[0]!.growth=0;
    patch.garden!.slots[1]!.withered=true;patch.garden!.slots[1]!.growth=0;
    const before=townWith([patch]),materials=structuredClone(before.materials);
    const outcome=run(before,'town','plants');
    assert.deepEqual(outcome.receipt.products,[]);
    assert.equal(outcome.receipt.replanted,2);
    assert.deepEqual(outcome.receipt.reward,{});
    assert.deepEqual(outcome.state.materials,materials);
    assert.equal(outcome.state.gardening?.harvests??0,0);
    assert.equal(outcome.state.earned['town-first-harvest'],undefined);
    const [s0,s1,s2,s3]=outcome.state.entities[0]!.garden!.slots;
    assert.deepEqual([s0!.withered,s0!.growth,s0!.generation],[undefined,0,1]);
    assert.deepEqual([s1!.withered,s1!.growth,s1!.generation],[undefined,0,1]);
    assert.deepEqual([s2!.growth,s2!.generation],[100,0]);assert.deepEqual([s3!.growth,s3!.generation],[100,0]);
});

test('lake plants: ready and withered floating-garden pockets pay the manual amounts and replant free',()=>{
    // Patch (4 ripe slots, 2 stamina each) plus a floating garden (4 healthy pockets of 4 stamina; 2 withered).
    const before=lakeWith([ripePatch('lp',4,4)],[floatingGarden(LAKE_GROW_SECONDS,{witheredPlants:[0,1]})]);
    const manual=applyLakeCommand(before,{type:'harvest-plant',mapId:'lake',raftId:'garden',generation:0},now,'m',before.maps!.lake!.catches);
    const outcome=run(before,'lake','plants');
    assert.equal(outcome.state.materials.stamina,before.materials.stamina+8+16);
    assert.deepEqual(outcome.receipt.products,[{item:'carrot',amount:4},{item:'water-spinach',amount:4}]);
    assert.equal(outcome.receipt.replanted,4+6);
    assert.deepEqual(outcome.receipt.reward,{stamina:24});
    const garden=raftOf(outcome.state,'garden');
    assert.equal(garden.plantGrowth,0);assert.equal(garden.witheredPlants,undefined);
    // The water-plant part matches the manual harvest exactly.
    assert.equal(outcome.state.maps!.lake!.plantsHarvested,manual.maps!.lake!.plantsHarvested);
    assert.deepEqual(raftOf(outcome.state,'garden'),raftOf(manual,'garden'));
});

test('lake nursery: harvested fish reach the reserve, regrow the harvested count free and keep the rest',()=>{
    const before=lakeWith([],[nursery([fish('f1','P1',LAKE_GROW_SECONDS),fish('f2','P1',LAKE_GROW_SECONDS),fish('f3','P1',0)])]);
    const outcome=run(before,'lake','fish',before.revision,{P1:10});
    const raft=raftOf(outcome.state,'nursery');
    assert.equal(outcome.state.materials.stamina,before.materials.stamina+2);
    assert.equal(outcome.state.maps!.lake!.harvested,2);
    assert.equal(outcome.state.maps!.lake!.reserve.P1,2);
    assert.equal(outcome.state.maps!.lake!.collections,1);
    assert.deepEqual(outcome.receipt.products,[{item:'P1',amount:2}]);
    assert.equal(outcome.receipt.replanted,2);assert.deepEqual(outcome.receipt.notReplanted,[]);
    assert.equal(raft.fish.length,3);
    assert.ok(raft.fish.every(f=>f.species==='P1'&&f.growth===0));
    assert.deepEqual(outcome.receipt.reward,{stamina:2});
});

test('lake nursery: a species not caught 10 times is never restocked free and is reported, while harvests still pay',()=>{
    const before=lakeWith([],[nursery([fish('f1','P1',LAKE_GROW_SECONDS),fish('f2','P1',LAKE_GROW_SECONDS)])]);
    const outcome=run(before,'lake','fish',before.revision,{P1:9});
    assert.equal(raftOf(outcome.state,'nursery').fish.length,0);
    assert.equal(outcome.receipt.replanted,0);
    assert.deepEqual(outcome.receipt.notReplanted,[{item:'P1',amount:2}]);
    assert.deepEqual(outcome.receipt.products,[{item:'P1',amount:2}]);
});

test('lake nursery: a queued species restocks in full only when the raft empties',()=>{
    const before=lakeWith([],[nursery([fish('f1','P1',LAKE_GROW_SECONDS),fish('f2','P1',LAKE_GROW_SECONDS)],{nextFish:'P4'})]);
    const outcome=run(before,'lake','fish',before.revision,catchesAll);
    const raft=raftOf(outcome.state,'nursery');
    assert.equal(raft.nextFish,undefined);
    assert.ok(raft.fish.length>0&&raft.fish.every(f=>f.species==='P4'&&f.growth===0));
    assert.equal(outcome.receipt.replanted,raft.fish.length);
    assert.deepEqual(outcome.receipt.notReplanted,[]);
    assert.deepEqual(outcome.receipt.products,[{item:'P1',amount:2}]);
});

test('lake nursery: a partial harvest keeps a queued switch waiting, with no restock of the old species',()=>{
    const before=lakeWith([],[nursery([fish('f1','P1',LAKE_GROW_SECONDS),fish('f2','P1',LAKE_GROW_SECONDS),fish('f3','P1',0)],{nextFish:'P4'})]);
    const outcome=run(before,'lake','fish',before.revision,catchesAll);
    const raft=raftOf(outcome.state,'nursery');
    assert.equal(raft.nextFish,'P4');
    assert.deepEqual(raft.fish.map(f=>f.id),['f3']);
    assert.equal(outcome.receipt.replanted,0);
    assert.deepEqual(outcome.receipt.notReplanted,[{item:'P1',amount:2}]);
});

test('town nursery harvests use the verified Fishing Friends counts, not a stale lake copy',()=>{
    const state=townWith([],[nursery([fish('f1','P1',LAKE_GROW_SECONDS)])]);
    state.maps={lake:emptyLake(now)};state.maps.lake!.catches={P1:10};
    const stale=run(state,'town','fish',state.revision,{});
    assert.deepEqual(stale.receipt.notReplanted,[{item:'P1',amount:1}]);
    assert.equal(stale.state.maps!.lake!.reserve.P1,1);
});

test('receipts list each actual product once per item, and the retry ledger stays bounded and private',()=>{
    let state=lakeWith([ripePatch('lp',4,4)],[floatingGarden(LAKE_GROW_SECONDS)]);
    const firstRevision=state.revision;
    for(let i=0;i<33;i++){
        raftOf(state,'garden').plantGrowth=LAKE_GROW_SECONDS;
        state=run(state,'lake','plants',state.revision).state;
    }
    assert.equal(state.harvestReceipts?.length,32);
    assert.throws(()=>run(state,'lake','plants',firstRevision),(e:unknown)=>e instanceof AppError&&e.code==='TOWN_STALE');
    const payload=townPayload(state,'lake');
    assert.equal('harvestReceipts' in payload,false);
    assert.deepEqual(payload.harvestReady,{plants:false,animals:false,fish:false});
});

test('read projections expose readiness for the viewed map only and never persist or send the ledger',()=>{
    const state=townWith([ripePatch('p',4,4)]);
    state.harvestReceipts=[{id:'x',revision:9,mapId:'town',category:'plants',products:[],replanted:0,notReplanted:[],notCollected:[],reward:{},expectedRevision:8}];
    const saved=structuredClone(state);
    const payload=townPayload(state,'town');
    assert.deepEqual(payload.harvestReady,{plants:true,animals:false,fish:false});
    assert.equal('harvestReceipts' in payload,false);
    assert.deepEqual(state,saved);
    assert.deepEqual(townPayload(lakeWith([],[floatingGarden(LAKE_GROW_SECONDS)]),'lake').harvestReady,{plants:true,animals:false,fish:false});
    // Visits and other readers get saved fields only: another child's readiness is never sent.
    assert.equal('harvestReady' in townStatePayload(state),false);
    assert.equal('harvestReceipts' in townStatePayload(state),false);
});

test('harvest-all schemas are strict, endpoint-scoped and take no client ids, quantities, products or rewards',()=>{
    const town=harvestAllForMap('town');
    for(const category of ['plants','animals','fish'])assert.equal(town.safeParse({type:'harvest-all',category,mapId:'town'}).success,true);
    for(const bad of [
        {type:'harvest-all',category:'plants',mapId:'lake'},
        {type:'harvest-all',category:'all',mapId:'town'},
        {type:'harvest-all',mapId:'town'},
        {type:'harvest-all',category:'plants',mapId:'town',entityId:'p'},
        {type:'harvest-all',category:'plants',mapId:'town',raftId:'r'},
        {type:'harvest-all',category:'plants',mapId:'town',generation:0},
        {type:'harvest-all',category:'plants',mapId:'town',quantity:99},
        {type:'harvest-all',category:'plants',mapId:'town',products:[{item:'carrot',amount:9}]},
        {type:'harvest-all',category:'plants',mapId:'town',reward:{stamina:99}},
        {type:'harvest-all',category:'plants',mapId:'town',revision:3},
    ])assert.equal(town.safeParse(bad).success,false,JSON.stringify(bad));
    assert.equal(harvestAllForMap('lake').safeParse({type:'harvest-all',category:'fish',mapId:'town'}).success,false);
    // The Town action admits it for the Town only; nested land actions never do.
    assert.equal(townActionSchema.safeParse({type:'harvest-all',category:'plants',mapId:'town'}).success,true);
    assert.equal(townCommandSchema.safeParse({type:'harvest-all',category:'plants',mapId:'town'}).success,false);
    assert.equal(lakeActionSchema(townCommandSchema).safeParse({type:'land-action',mapId:'lake',command:{type:'harvest-all',category:'plants',mapId:'lake'}}).success,false);
    assert.equal(lakeActionSchema(townCommandSchema).safeParse({type:'harvest-all',category:'fish',mapId:'lake'}).success,true);
});

// Route wiring: ownership, endpoint scoping and that forged fields never reach the repository.
const familyHash=hashSessionToken('harvest-session');
function appWith(calls:{kind:string;args:unknown[]}[]) {
    const receipt={id:'harvest-all:town:plants:4',revision:4,mapId:'town',category:'plants',products:[{item:'carrot',amount:4}],replanted:4,notReplanted:[],notCollected:[],reward:{stamina:8},duplicate:false};
    const db={
        auth:{async findFamilyBySessionHash(hash:string){return hash===familyHash?{id:'family',role:'admin'}:null;}},
        profiles:{async get(family:string,id:string){return family==='family'&&id==='kid'?{id,name:'Kid',native_city:undefined,native_country_code:undefined}:null;}},
        town:{
            get:async()=>emptyTown(),getName:async()=>({adjective:'Sunny',noun:'Meadow'}),mutate:async()=>emptyTown(),
            harvestAll:async(profileId:string,revision:number,command:unknown)=>{calls.push({kind:'town.harvestAll',args:[profileId,revision,command]});
                return {state:{...emptyTown(),harvestReceipts:[{...receipt,expectedRevision:3}]} as TownState,receipt};},
            getLake:async()=>emptyTown(),mutateLake:async()=>emptyTown(),tickLake:async()=>emptyTown(),pauseLake:async()=>emptyTown(),
        },
    } as unknown as AppDatabase;
    const config=loadConfig({NODE_ENV:'test',DATABASE_URL:'postgresql://test:test@localhost/test',ALLOWED_ORIGINS:'https://app.example.test',ALLOWED_FORWARDED_HOSTS:'app.example.test'});
    return createApp({db,config,logger:{info(){},warn(){},error(){}}});
}
const post=(app:ReturnType<typeof appWith>,path:string,body:unknown)=>app.request(`https://app.example.test/api/v1/profiles/${path}`,{method:'POST',headers:{cookie:'plg_session=harvest-session',origin:'https://app.example.test','content-type':'application/json'},body:JSON.stringify(body)});

test('Town action runs harvest-all for the owner, returns the receipt and hides the ledger',async()=>{
    const calls:{kind:string;args:unknown[]}[]=[];
    const app=appWith(calls);
    const response=await post(app,'kid/town/action',{revision:3,command:{type:'harvest-all',category:'plants',mapId:'town'}});
    assert.equal(response.status,200);
    const body=await response.json() as Record<string,unknown>;
    assert.deepEqual(calls,[{kind:'town.harvestAll',args:['kid',3,{type:'harvest-all',category:'plants',mapId:'town'}]}]);
    assert.equal((body.harvestReceipt as {id:string}).id,'harvest-all:town:plants:4');
    assert.ok(body.harvestReady&&typeof body.harvestReady==='object');
    assert.equal('harvestReceipts' in body,false);
});

test('forged, extra or cross-map harvest-all payloads are rejected before the repository runs',async()=>{
    const calls:{kind:string;args:unknown[]}[]=[];
    const app=appWith(calls);
    for(const command of [
        {type:'harvest-all',category:'plants',mapId:'lake'},
        {type:'harvest-all',category:'plants',mapId:'town',entityId:'p1'},
        {type:'harvest-all',category:'plants',mapId:'town',products:[{item:'carrot',amount:99}]},
        {type:'harvest-all',category:'plants',mapId:'town',amount:99},
        {type:'harvest-all',category:'plants',mapId:'town',stamina:99},
        {type:'harvest-all',category:'nope',mapId:'town'},
        {type:'harvest-eggs',entityId:'coop',generation:0,mapId:'town'},
    ])assert.equal((await post(app,'kid/town/action',{revision:3,command})).status,422,JSON.stringify(command));
    assert.equal((await post(app,'kid/town/maps/lake/action',{revision:3,command:{type:'harvest-all',category:'fish',mapId:'town'}})).status,422);
    assert.equal((await post(app,'kid/town/maps/lake/action',{revision:3,command:{type:'land-action',mapId:'lake',command:{type:'harvest-all',category:'plants',mapId:'lake'}}})).status,422);
    assert.equal((await post(app,'kid/town/action',{revision:3,command:{type:'harvest-all',category:'plants',mapId:'town'},extra:true})).status,422);
    assert.deepEqual(calls,[]);
});

test('harvest-all is owner-only: another family\'s or unknown profile gets the same 404 and no write',async()=>{
    const calls:{kind:string;args:unknown[]}[]=[];
    const app=appWith(calls);
    const response=await post(app,'stranger/town/action',{revision:3,command:{type:'harvest-all',category:'plants',mapId:'town'}});
    assert.equal(response.status,404);
    assert.deepEqual(calls,[]);
});

test('Lake action runs harvest-all on the lake only and returns the same receipt shape',async()=>{
    const calls:{kind:string;args:unknown[]}[]=[];
    const app=appWith(calls);
    const response=await post(app,'kid/town/maps/lake/action',{revision:3,command:{type:'harvest-all',category:'fish',mapId:'lake'}});
    assert.equal(response.status,200);
    const body=await response.json() as Record<string,unknown>;
    assert.deepEqual(calls,[{kind:'town.harvestAll',args:['kid',3,{type:'harvest-all',category:'fish',mapId:'lake'}]}]);
    assert.ok(body.harvestReceipt&&typeof body.harvestReceipt==='object');
    assert.equal('harvestReceipts' in body,false);
});
