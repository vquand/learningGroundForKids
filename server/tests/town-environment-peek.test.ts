import assert from 'node:assert/strict';
import test from 'node:test';
import {createEnvironmentService} from '../src/town-building/environment.js';
import {metWeatherFixture} from './met-weather-fixture.js';

test('cache-only environment reads never begin geocoding or forecast work',()=>{
 let fetches=0;
 const service=createEnvironmentService((async()=>{fetches++;throw new Error('No provider work allowed');}) as typeof fetch,()=>Date.parse('2026-10-31T18:00:00Z'));
 assert.equal(service.peek('kid','Hanoi','VN').timeOfDay,null);
 assert.equal(service.peek('kid',undefined,undefined).timeOfDay,null);
 assert.equal(fetches,0);
});

test('cache-only home clocks advance after weather expires and ignore appearance previews',async()=>{
 let now=Date.parse('2026-10-31T18:00:00Z'),fetches=0;
 const fetcher=(async(input:URL|string|Request)=>{
  fetches++;
  return String(input).includes('geocoding')
   ? Response.json({results:[{name:'Hanoi',country_code:'VN',latitude:21,longitude:105,timezone:'Asia/Bangkok'}]})
   : Response.json(metWeatherFixture(now));
 }) as typeof fetch;
 const service=createEnvironmentService(fetcher,()=>now,{logger:{info(){},warn(){}}});
 const live=await service.get('kid','Hanoi','VN','',false);assert.equal(fetches,2);
 const cached=service.peek('visitor','Hà Nội','vn');
 assert.equal(cached.weatherSource,live.weatherSource);assert.equal(cached.temperatureC,live.temperatureC);
 assert.equal(fetches,2,'visits can reuse valid weather without starting a provider request');
 service.preview('appearance',{season:'winter',precipitation:'snow',snowCover:true});
 now=Date.parse('2026-11-02T18:00:00Z');
 const home=service.peek('another-kid','Hà Nội','vn');
 assert.equal(home.localDate,'2026-11-03');assert.equal(home.localTime,'01:00');assert.equal(home.timeOfDay,'night');
 assert.equal(home.timeZone,'Asia/Bangkok');assert.equal(home.season,'autumn');assert.notEqual(home.weatherSource,'preview');
 assert.equal(fetches,2,'stale weather must not trigger a provider refresh on clock-only reads');
 assert.equal(service.peek('kid','New York','US').timeOfDay,null,'unresolved cities cannot borrow another city clock');
});
