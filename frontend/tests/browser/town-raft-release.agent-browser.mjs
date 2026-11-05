import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {pickLakeObject} from './lake-map-pick.mjs';
const session=`raft-release-${process.pid}`,base=process.env.LAKE_BROWSER_URL??'http://127.0.0.1:5196/tests/browser/town-lake-harness.html',out='/tmp/town-raft-release';mkdirSync(out,{recursive:true});
const ab=(...args)=>execFileSync('agent-browser',['--session',session,...args],{encoding:'utf8',timeout:45000,maxBuffer:8*1024*1024});
const read=code=>{const raw=JSON.parse(ab('eval',`JSON.stringify(${code})`));return typeof raw==='string'?JSON.parse(raw):raw;};
function ref(name){const s=ab('snapshot','-i'),line=s.split('\n').find(l=>l.includes(`- button "${name}"`));assert.ok(line,s);return'@'+/ref=(e\d+)/.exec(line)[1];}
function click(name){ab('wait','--fn',`[...document.querySelectorAll('button')].some(b=>!b.disabled&&(b.getAttribute('aria-label')??b.textContent).trim()===${JSON.stringify(name)})`);ab('click',ref(name));ab('snapshot','-i');}
const state=()=>read(`window.__lakeFixtureState()`);
try{
 for(const [w,h]of [[1366,768],[1024,768],[1180,820]]){
  ab('open',base+'?release=1');ab('set','viewport',String(w),String(h));ab('snapshot','-i');ab('wait','--fn',`document.querySelector('.town-map-screen')?.getAttribute('aria-busy')==='false'&&document.querySelector('[data-lake-scene] canvas')?.width>100`);if(read(`document.querySelector('.town-map-screen').dataset.editing`)!=='true')click('Build');
  for(const id of ['nursery','friendly','garden']){
   pickLakeObject({ab,read,click},id);const before=state().maps.lake.rafts.find(r=>r.id===id);click('Move');click('Footprint down');click('Move here');
   ab('wait','--fn',`window.__lakeFixtureState().maps.lake.rafts.find(r=>r.id===${JSON.stringify(id)}).x===${before.x+1}`);const moved=state().maps.lake.rafts.find(r=>r.id===id);
   assert.deepEqual(moved.fish,before.fish);assert.equal(moved.plant,before.plant);assert.equal(moved.plantGrowth,before.plantGrowth);
   pickLakeObject({ab,read,click},id);const pre=state();click('Remove');click('Confirm removal');ab('wait','--fn',`!window.__lakeFixtureState().maps.lake.rafts.some(r=>r.id===${JSON.stringify(id)})&&document.querySelector('[data-lake-scene]').dataset.releaseActive==='true'`);
   const after=state();assert.deepEqual(after.materials,pre.materials);assert.deepEqual(after.maps.lake.reserve,pre.maps.lake.reserve);assert.equal(after.maps.lake.harvested,pre.maps.lake.harvested);assert.equal(after.maps.lake.collections,pre.maps.lake.collections);assert.equal(read(`document.querySelectorAll('.town-resource-flight').length`),0,'release is not a harvest reward');
   ab('screenshot',`${out}/${id}-${w}.png`);ab('wait','--fn',`document.querySelector('[data-lake-scene]').dataset.releaseActive==='false'`);click('Center map');assert.equal(read(`document.querySelector('[data-lake-scene]').dataset.releaseActive`),'false');
  }
  assert.equal(read(`document.documentElement.scrollHeight<=innerHeight+1&&document.documentElement.scrollWidth<=innerWidth+1`),true);assert.equal(ab('errors').trim(),'');assert.doesNotMatch(ab('console'),/\[error\]/);console.log(`${w}x${h}: moves carry nursery/friendly fish and plants with growth; demolition releases once without rewards`);
 }
}catch(error){console.error(ab('snapshot','-i'));console.error(ab('console'));throw error;}finally{ab('close');}
