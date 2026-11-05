import assert from 'node:assert/strict';
import test from 'node:test';
import {splitRaftStamina,riverDayStart} from '../src/town-building/raftCatalog.js';
test('sharing splits each item independently with both shares rounded up',()=>{
 assert.deepEqual(splitRaftStamina(2),{picker:1,provider:2});assert.deepEqual(splitRaftStamina(10),{picker:3,provider:7});
 assert.deepEqual(splitRaftStamina(1),{picker:1,provider:1});assert.equal(riverDayStart(Date.UTC(2026,9,23,23,59)),Date.UTC(2026,9,23));
});
