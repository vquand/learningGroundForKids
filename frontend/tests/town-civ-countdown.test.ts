import assert from 'node:assert/strict';
import test from 'node:test';
import {businessFor} from '../../server/src/town-building/civCatalog.ts';
import {returnCountdown,countdownHands,drawCountdownClock} from '../src/features/town-building/civCountdown.ts';

test('return clocks use remaining time and move both hands backward without text',()=>{
 const business=businessFor('grocery')!;
 const first=returnCountdown(business,[{kind:'away',returnInMs:30000}],{localTime:'09:00'},0)!;
 const later=returnCountdown(business,[{kind:'away',returnInMs:29000}],{localTime:'09:00'},0)!;
 const a=countdownHands(first),b=countdownHands(later);
 assert.ok(b.long<a.long&&b.short<a.short);
 const text:string[]=[];const ctx=new Proxy({fillText:(s:string)=>text.push(s)}, {get:(target,key)=>key in target?target[key as keyof typeof target]:()=>{}}) as unknown as CanvasRenderingContext2D;
 drawCountdownClock(ctx,50,50,15,first);assert.deepEqual(text,[]);
});
test('closed clocks advance smoothly between unchanged home-clock minute samples',()=>{
 const business=businessFor('bakery')!;
 const first=returnCountdown(business,[{kind:'closed'}],{localTime:'04:30'},0)!;
 const next=returnCountdown(business,[{kind:'closed'}],{localTime:'04:30'},5000)!;
 assert.equal(first.remainingMs-next.remainingMs,5000);
 assert.equal(returnCountdown(business,[{kind:'unknown'}],{},0),null);
 assert.equal(returnCountdown(business,[{kind:'working'}],{localTime:'09:00'},0),null);
});
