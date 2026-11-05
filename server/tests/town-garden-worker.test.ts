import test from 'node:test';
import {ensurePoultry,settlePoultry} from '../src/town-building/poultry.ts';
import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import { GardenWorkerPool } from '../src/town-building/gardenSimulation.js';
import { createTownRepository } from '../src/town-building/repository.js';
import { AppError } from '../src/errors.js';
import { emptyTown, type TownState } from '../src/town-building/game.js';
import { applyGardenCommand } from '../src/town-building/garden.js';
import {tickMap} from '../src/town-building/mapTick.ts';
const summer = {season:'summer' as const,timeOfDay:'noon',isDay:true,precipitation:'none' as const};
function gardenTown(): TownState {
    let state=emptyTown();state.starterHomeGranted=true;
    for(const key of Object.keys(state.materials) as (keyof TownState['materials'])[])state.materials[key]=1000;
    for(const [id,blueprintId,x,y] of [['patch','vegetable-patch',8,14],['farm','farmhouse',6,19],['home','house',10,22],['coop','coop',10,16]] as const)
        state=applyGardenCommand(state,'town',{type:'build',blueprintId,x,y},id,1000,'summer');
    state=applyGardenCommand(state,'town',{type:'set-pets',entityId:'home',pets:['australian-cattle-dog']},'',1000,'summer');
    // The repository transaction initializes coops; mirror it for stored fixtures.
    return settlePoultry(ensurePoultry(state,1000),1000);
}
const unavailable=(error:unknown)=>error instanceof AppError&&error.status===503&&error.code==='GARDEN_UNAVAILABLE';

test('worker preserves exact contacts, fixed-step timing, season gating and offline/resume rules',async()=>{
    const workers=new GardenWorkerPool();
    try {
        const state=tickMap(gardenTown(),'town',1000,summer,true);
        const patch=state.entities.find(e=>e.id==='patch')!;patch.garden!.slots.forEach(slot=>slot.growth=100);
        const chicken=state.gardening!.animals.find(a=>a.species==='chicken')!;
        chicken.x=8.5;chicken.y=14.5;chicken.pause=10;chicken.path=[];
        const cow=state.gardening!.animals.find(a=>a.species==='dairy-cow')!;
        cow.x=8.5;cow.y=15.5;cow.pause=10;cow.path=[];
        const input=structuredClone(state),expected=tickMap(state,'town',6000,summer);
        const actual=await workers.run(state,'town',6000,summer,false);
        assert.deepEqual(actual,expected);assert.deepEqual(state,input,'worker never mutates the lease input');
        assert.equal(actual.entities.find(e=>e.id==='patch')!.garden!.slots[0]!.coopBoosted,true);
        assert.equal(actual.entities.find(e=>e.id==='patch')!.garden!.lastBiteSlot,1);
        assert.deepEqual(actual.materials,state.materials,'tick cannot harvest or award resources');
        for(const [now,environment,resume] of [[6000,summer,false],[21000,summer,false],[22000,summer,true],[27000,{...summer,season:'winter' as const},false],[28000,{...summer,timeOfDay:null},false]] as const)
            assert.deepEqual(await workers.run(actual,'town',now,environment,resume),tickMap(actual,'town',now,environment,resume));
    } finally {await workers.close();}
});

test('worker admission is bounded and queued work completes without bypassing simulation',async()=>{
    const workers=new GardenWorkerPool({maxJobs:2});
    try {
        const first=workers.run(gardenTown(),'town',1000,summer,true),second=workers.run(gardenTown(),'town',1000,summer,true);
        await assert.rejects(workers.run(gardenTown(),'town',1000,summer,true),e=>e instanceof AppError&&e.code==='GARDEN_BUSY');
        const results=await Promise.all([first,second]);assert.deepEqual(results[0],results[1]);
        await workers.run(gardenTown(),'town',6000,summer,true);
    } finally {await workers.close();}
});

test('worker deadline aborts unfinished jobs and permits a fresh worker to recover',async()=>{
    const options={maxJobs:2,timeoutMs:1};const workers=new GardenWorkerPool(options);
    try {
        const results=await Promise.allSettled([workers.run(gardenTown(),'town',1000,summer,true),workers.run(gardenTown(),'town',1000,summer,true)]);
        assert.ok(results.every(r=>r.status==='rejected'&&unavailable(r.reason)));
        options.timeoutMs=10000;
        const result=await workers.run(gardenTown(),'town',1000,summer,true);assert.equal(result.gardening!.lastTick,1000);
    } finally {await workers.close();}
});

test('simulation error rejects safely, the next job succeeds, and close rejects pending work',async()=>{
    const workers=new GardenWorkerPool();
    await assert.rejects(workers.run({...gardenTown(),entities:null as unknown as []},'town',1000,summer,true),unavailable);
    const result=await workers.run(gardenTown(),'town',1000,summer,true);assert.equal(result.gardening!.lastTick,1000);
    const pending=Promise.allSettled([workers.run(gardenTown(),'town',6000,summer,false),workers.run(gardenTown(),'town',6000,summer,false)]);
    await workers.close();assert.ok((await pending).every(r=>r.status==='rejected'&&unavailable(r.reason)));
    await assert.rejects(workers.run(gardenTown(),'town',1000,summer,true),unavailable);
});

test('an unexpected worker exit rejects safely and does not leave admission stuck',async()=>{
    const workerUrl=new URL('data:text/javascript,'+encodeURIComponent("import {parentPort} from 'node:worker_threads';parentPort.on('message',()=>process.exit(1));"));
    const workers=new GardenWorkerPool({maxJobs:1,workerUrl});
    try {
        await assert.rejects(workers.run(gardenTown(),'town',1000,summer,true),unavailable);
        // A replacement worker also exits, but the second request is admitted
        // and fails safely rather than leaving the slot permanently busy.
        await assert.rejects(workers.run(gardenTown(),'town',1000,summer,true),unavailable);
    } finally {await workers.close();}
});

// A held simulation makes cross-request races deterministic without sleeping.
function gate(){let release!:()=>void;const wait=new Promise<void>(resolve=>release=resolve);return {wait,release};}
function readPool(state:()=>TownState):Pool{return {async query(){const stored=state();stored.woolMigrated=true;return {rows:[{state:stored,learned_ids:stored.learnedIds,revision:stored.revision}]};}} as unknown as Pool;}
test('duplicate profile heartbeats share one simulation and never credit double elapsed time',async()=>{
    const stored=gardenTown(),held=gate();let calls=0;
    const repository=createTownRepository(readPool(()=>stored),()=>1000,async(state,mapId,now,environment,resume)=>{calls++;await held.wait;return tickMap(state,mapId,now,environment,resume);});
    const first=repository.tick!('kid','town',summer,true),second=repository.tick!('kid','town',summer,false);
    await new Promise<void>(resolve=>setImmediate(resolve));assert.equal(calls,1);
    held.release();assert.deepEqual(await first,await second);assert.equal(calls,1);
});
test('a durable revision changed during simulation discards stale output and its lease',async()=>{
    let stored=gardenTown();const held=gate();let calls=0;
    const repository=createTownRepository(readPool(()=>stored),()=>1000,async(state,mapId,now,environment,resume)=>{calls++;if(calls===1)await held.wait;return tickMap(state,mapId,now,environment,resume);});
    const tick=repository.tick!('kid','town',summer,true);
    await new Promise<void>(resolve=>setImmediate(resolve));stored={...stored,revision:stored.revision+1,materials:{...stored.materials,wood:stored.materials.wood+7}};
    held.release();await assert.rejects(tick,e=>e instanceof AppError&&e.code==='TOWN_STALE');
    const result=await repository.tick!('kid','town',summer,false);
    assert.equal(result.materials.wood,stored.materials.wood);assert.equal(result.gardening!.activeSeconds,0,'discarded worker cannot establish a lease');
});
