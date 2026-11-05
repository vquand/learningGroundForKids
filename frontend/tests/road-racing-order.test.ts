import assert from 'node:assert/strict';
import test from 'node:test';
import {racerPositions,finalStandings} from '../src/features/animal-racing/raceOrder.ts';
const racer=(distance:number,finishedAt:number|null=null)=>({distance,finishedAt});

test('faces occupy evenly spaced rank slots, even when all racers are near the start',()=>{
  assert.deepEqual(racerPositions([racer(1),racer(1.2),racer(.9),racer(2),racer(0),racer(.5)]),[2,1,3,0,5,4]);
  assert.deepEqual(racerPositions([racer(0),racer(0),racer(0),racer(0),racer(0),racer(0)]),[0,1,2,3,4,5]);
});
test('an overtake swaps the two face slots without moving unrelated friends',()=>{
  assert.deepEqual(racerPositions([racer(50),racer(51),racer(80),racer(20)]),[2,1,0,3]);
  assert.deepEqual(racerPositions([racer(52),racer(51),racer(80),racer(20)]),[1,2,0,3]);
});
test('crossing the finish keeps the same rank slot and preserves arrival order',()=>{
  const before=racerPositions([racer(1199),racer(1190),racer(1180)]);
  assert.deepEqual(racerPositions([racer(1200,90000),racer(1198),racer(1190)]),before);
  assert.deepEqual(racerPositions([racer(1200,90000),racer(1200,91000),racer(1200,92000)]),before);
  assert.deepEqual(racerPositions([racer(1200,93000),racer(1200,91000),racer(1200,92000)]),[2,0,1]);
  assert.deepEqual(racerPositions([racer(1200,0),racer(1200,null)]),[0,1]);
});


test('podium and crowd contain every friend once and preserve verified player place on a finish tie',()=>{
  const racers=[{...racer(1200,10),player:true,id:'kid'},{...racer(1200,10),player:false,id:'a'},{...racer(1199),player:false,id:'b'},{...racer(1100),player:false,id:'c'},{...racer(900),player:false,id:'d'},{...racer(500),player:false,id:'e'}];
  const original=structuredClone(racers);
  for(let place=1;place<=6;place++){
    const order=finalStandings(racers,place);
    assert.equal(order[place-1].id,'kid');
    assert.equal(new Set(order.map(r=>r.id)).size,6);
    assert.deepEqual(order.filter(r=>!r.player).map(r=>r.id),['a','b','c','d','e']);
    assert.equal(order.slice(0,3).length,3);assert.equal(order.slice(3).length,3);
  }
  assert.deepEqual(racers,original);
});
