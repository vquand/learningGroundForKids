import test from 'node:test';
import assert from 'node:assert/strict';
import {ghostFlightPose} from '../src/features/town-building/ghostAnimation.ts';
import {flightTiming,stepFlyingMotion,ghostRestSeconds} from '../../server/src/town-building/ghostMotion.ts';
import {HALLOWEEN_GHOST_POLICY} from '../../server/src/town-building/events/halloween2026Model.ts';
test('another event can reuse ghost motion with independent timing, speed and skin frames',()=>{
 const job={origin:{x:0,y:0},from:{x:0,y:4},to:{x:0,y:8},startedAt:0,approachSeconds:4,carrySeconds:8};
 const skin={flying:[30,31],pickup:[32,33],placing:[34,35],frameMs:200};
 const other=Object.freeze({...HALLOWEEN_GHOST_POLICY,speed:1,pickupSeconds:2,placeSeconds:2,restMin:8,restMax:10});
 const saved={...HALLOWEEN_GHOST_POLICY};
 assert.equal(flightTiming(job,HALLOWEEN_GHOST_POLICY).pickupAt,8);assert.equal(flightTiming(job,other).pickupAt,6);
 const pose=ghostFlightPose(job,job.origin,job.to,other,skin,7,200);assert.equal(pose.stage,'flying');assert.equal(pose.frame,31);assert.ok(pose.y>4);
 const original=ghostFlightPose(job,job.origin,job.to,HALLOWEEN_GHOST_POLICY,skin,7,200);assert.equal(original.stage,'pickup');assert.equal(original.y,4);
 assert.equal(stepFlyingMotion(job.origin,job.to,.05,other.speed).y,.05);assert.equal(stepFlyingMotion(job.origin,job.to,.05,HALLOWEEN_GHOST_POLICY.speed).y,.125);
 assert.ok(ghostRestSeconds('other',0,1,other)>=8);assert.ok(ghostRestSeconds('original',0,1,HALLOWEEN_GHOST_POLICY)<=7);
 assert.equal(ghostFlightPose(job,job.origin,job.to,other,skin,7,999,true).frame,30);
 assert.deepEqual(HALLOWEEN_GHOST_POLICY,saved);
});
