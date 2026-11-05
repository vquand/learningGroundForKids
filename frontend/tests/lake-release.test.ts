import test from 'node:test';
import assert from 'node:assert/strict';
import {LakeReleaseClock,releasePose} from '../src/features/town-building/maps/lake/releaseAnimation.ts';
import {lakeTerrainAt} from '../../server/src/town-building/maps/lake/terrain.ts';
import type {LakeRaft} from '../../server/src/town-building/maps/lake/types.ts';
const raft:LakeRaft={id:'raft',blueprintId:'nursery',x:8,y:12,paidCost:{},generation:0,fish:[],plant:null,plantGrowth:0,feeder:false};
test('release animation is bounded, expires and never replays a repeated committed receipt',()=>{
 const clock=new LakeReleaseClock(),event={receipt:'profile:12',raft};assert.deepEqual(clock.step(undefined,.05),[]);
 assert.equal(clock.step(event,.05).length,1);for(let i=0;i<80;i++)clock.step(event,.05);assert.deepEqual(clock.step(event,.05),[]);
 assert.equal(clock.step({...event,receipt:'profile:13'},.05).length,1);
 for(let i=14;i<30;i++)clock.step({...event,receipt:`profile:${i}`},0);assert.equal(clock.step(undefined,0).length,4);
});
test('released content fades through water; reduced motion stays still',()=>{
 for(let index=0;index<6;index++)for(let age=0;age<2.8;age+=.1){const pose=releasePose(raft,index,6,age);assert.ok(['shallow','deep'].includes(lakeTerrainAt(Math.floor(pose.x),Math.floor(pose.y))));assert.ok(pose.alpha>=0&&pose.alpha<=1);}
 assert.deepEqual(releasePose(raft,0,6,0,true),{x:9,y:13.5,alpha:1});assert.equal(releasePose(raft,0,6,2,true).x,9);assert.equal(releasePose(raft,0,6,3).alpha,0);
});
