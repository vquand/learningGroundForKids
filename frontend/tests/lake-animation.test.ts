import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceFishAnimation,type FishAnimationClock} from '../src/features/town-building/maps/lake/fishAnimation.ts';
import {lakeFishPosition} from '../src/features/town-building/maps/lake/fishMotion.ts';
import {visibleLakeFish} from '../src/features/town-building/maps/lake/fishDisplay.ts';
import {lakeDepthOutline} from '../src/features/town-building/maps/lake/depthBorder.ts';
import type {LakeRaft,LakeFish} from '../../server/src/town-building/maps/lake/types.ts';

test('lake animation time advances continuously across server heartbeats and pauses cleanly',()=>{
    const clock:FishAnimationClock={seconds:4,lastTime:1000};
    for(let frame=1;frame<=600;frame++)advanceFishAnimation(clock,1000+frame*1000/60,false);
    assert.ok(clock.seconds>13.9&&clock.seconds<14.1);
    const before=clock.seconds;advanceFishAnimation(clock,11000,true);assert.equal(clock.seconds,before);
    advanceFishAnimation(clock,12000,false);assert.ok(clock.seconds<before+.06);
    advanceFishAnimation(clock,12016,false);assert.ok(clock.seconds>before);
});

test('contained nursery fish stay inside the net throughout their looping swim',()=>{
    const raft:LakeRaft={id:'nursery',blueprintId:'nursery',x:8,y:12,paidCost:{},generation:0,fish:[],plant:null,plantGrowth:0,feeder:false};
    for(const species of ['P1','P3','P4','P5','R4'] as const){
      raft.fish=Array.from({length:['P1','P4'].includes(species)?6:4},(_,index)=>({id:`fish-${species}-${index}`,species,growth:0}));
      for(const fish of raft.fish){
        for(let second=0;second<360;second++){
            const p=lakeFishPosition(raft,fish,second,{timeOfDay:'morning',precipitation:'none'});
            assert.ok(p.x>=raft.x+.65&&p.x<=raft.x+1.15,`${species} row ${p.x}`);
            assert.ok(p.y>=raft.y+.75&&p.y<=raft.y+2.25,`${species} column ${p.y}`);
        }
      }
    }
});

test('a representative school shows at most six fish without changing real residents',()=>{
    const residents:LakeFish[]=Array.from({length:16},(_,index)=>({id:`fish-${index}`,species:'P1',growth:index}));
    const before=structuredClone(residents);
    assert.equal(visibleLakeFish(residents).length,6);
    assert.deepEqual(visibleLakeFish(residents),visibleLakeFish(residents),'animation frames keep the same representatives');
    assert.equal(visibleLakeFish(residents.slice(0,4)).length,4);
    assert.equal(visibleLakeFish([]).length,0);assert.deepEqual(residents,before);
});

test('deep-water border rounds its varied shelves into a continuous finite outline',()=>{
    const points=lakeDepthOutline();
    assert.ok(points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
    assert.deepEqual(points[0],points.at(-1));
    assert.ok(points.some(p=>p.x%1!==0&&p.y%1!==0),'rounded corners replace the tile staircase');
    assert.ok(points.every(p=>p.x>=9&&p.x<=31&&p.y>=0&&p.y<=20));
});
