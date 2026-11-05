import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {pickLakeObject} from './lake-map-pick.mjs';
const session=`garden-effects-${process.pid}`,base=process.env.LAKE_BROWSER_URL??'http://127.0.0.1:5196/tests/browser/town-lake-harness.html',out='/tmp/town-garden-effects';mkdirSync(out,{recursive:true});
const ab=(...args)=>execFileSync('agent-browser',['--session',session,...args],{encoding:'utf8',timeout:45000,maxBuffer:8*1024*1024});
const read=code=>{const raw=JSON.parse(ab('eval',`JSON.stringify(${code})`));return typeof raw==='string'?JSON.parse(raw):raw;};
function ref(name){const s=ab('snapshot','-i'),line=s.split('\n').find(l=>l.includes(`- button "${name}"`));assert.ok(line,s);return'@'+/ref=(e\d+)/.exec(line)[1];}
function click(name){ab('wait','--fn',`[...document.querySelectorAll('button')].some(b=>!b.disabled&&(b.getAttribute('aria-label')??b.textContent).trim()===${JSON.stringify(name)})`);ab('click',ref(name));ab('snapshot','-i');}
function fits(){assert.equal(read(`document.documentElement.scrollHeight<=innerHeight+1&&document.documentElement.scrollWidth<=innerWidth+1`),true);assert.deepEqual(read(`(()=>{const d=document.querySelector('dialog[open]')??document;return [...d.querySelectorAll('button,select')].filter(e=>e.checkVisibility()).filter(e=>{const r=e.getBoundingClientRect();return r.left<0||r.top<0||r.right>innerWidth+1||r.bottom>innerHeight+1}).map(e=>e.getAttribute('aria-label')??e.textContent)})()`),[]);}
try{
 for(const [w,h]of [[1366,768],[1024,768],[1180,820]]){
  ab('open',base+'?effects=1');ab('set','viewport',String(w),String(h));ab('snapshot','-i');ab('wait','--fn',`document.querySelector('.town-map-screen')?.getAttribute('aria-busy')==='false'&&document.querySelector('[data-garden-effect="chicken"]')?.checkVisibility()`);
  assert.equal(read(`document.querySelector('.town-object-picker')===null`),true);
  assert.equal(read(`document.querySelectorAll('[data-garden-effect="chicken"]').length`),1);assert.equal(read(`document.querySelectorAll('[data-garden-effect="insects"]').length`),1);
  assert.equal(read(`getComputedStyle(document.querySelector('[data-garden-effect="chicken"]')).borderRadius`),'0px');
  assert.equal(read(`document.querySelectorAll('[data-garden-effect] feMorphology').length`),4,'each silhouette has a thick sticker border');
  const id=read(`window.__gardenFixtureId`);pickLakeObject({ab,read,click},id);fits();
  assert.equal(read(`window.__lakeFixtureState().maps.lake.land.entities.find(e=>e.id===window.__gardenFixtureId).garden.slots.filter(s=>s.withered).length`),1);
  ab('screenshot',`${out}/both-effects-withered-${w}.png`);click('Choose a crop');ab('wait','--text','Withered crops replant when you harvest.');fits();ab('screenshot',`${out}/withered-help-${w}.png`);click('Close garden');
  const before=read(`Number(document.querySelector('.town-storage strong').textContent)`);click('Harvest crops');ab('wait','--fn',`Number(document.querySelector('.town-storage strong').textContent)===${before+6}`);
  assert.equal(read(`window.__lakeFixtureState().maps.lake.land.entities.find(e=>e.id===window.__gardenFixtureId).garden.slots.every(s=>!s.withered&&s.growth===0)`),true);ab('screenshot',`${out}/harvest-replant-${w}.png`);
  click('Zoom in');fits();click('Center map');click('Change interface language');click('Tiếng Việt');assert.match(read(`document.querySelector('[data-garden-effect="insects"]').getAttribute('aria-label')`),/một phần tư/);fits();ab('screenshot',`${out}/vietnamese-${w}.png`);click('Đổi ngôn ngữ giao diện');click('English');
  assert.equal(ab('errors').trim(),'');assert.doesNotMatch(ab('console'),/\[error\]/);console.log(`${w}x${h}: no object dropdown, both faces, one withered crop, +6 healthy harvest and replant, EN/VI and zoom bounds pass`);
  ab('open',base+'?raft-effects=1');ab('snapshot','-i');ab('wait','--fn',`document.querySelector('.town-map-screen')?.getAttribute('aria-busy')==='false'&&document.querySelector('[data-garden-effect="duck"]')?.checkVisibility()`);
  assert.equal(read(`document.querySelectorAll('[data-garden-effect="insects"]').length`),1);assert.match(read(`document.querySelector('[data-garden-effect="insects"]').getAttribute('aria-label')`),/2 of 6 plants wither/);
  const raftId=read(`window.__raftGardenFixtureId`);pickLakeObject({ab,read,click},raftId);fits();
  const lost=read(`window.__lakeFixtureState().maps.lake.rafts.find(r=>r.id===window.__raftGardenFixtureId).witheredPlants.length`);assert.equal(lost,2,'a quarter of six plants, rounded up, always withers');
  ab('screenshot',`${out}/raft-stickers-withered-${w}.png`);
  click('Change interface language');click('Tiếng Việt');assert.match(read(`document.querySelector('[data-garden-effect="insects"]').getAttribute('aria-label')`),/2 trong 6 cây/);assert.match(read(`document.querySelector('[data-garden-effect="duck"]').getAttribute('aria-label')`),/30/);fits();ab('screenshot',`${out}/raft-stickers-vietnamese-${w}.png`);click('Đổi ngôn ngữ giao diện');click('English');
  const raftBefore=read(`Number(document.querySelector('.town-storage strong').textContent)`);click('Collect grown plants');ab('wait','--fn',`Number(document.querySelector('.town-storage strong').textContent)===${raftBefore+(6-lost)*4}`);
  assert.equal(read(`window.__lakeFixtureState().maps.lake.rafts.find(r=>r.id===window.__raftGardenFixtureId).witheredPlants===undefined`),true);assert.equal(read(`document.querySelector('[data-garden-effect="duck"]')===null`),true);
  assert.equal(ab('errors').trim(),'');assert.doesNotMatch(ab('console'),/\[error\]/);fits();console.log(`${w}x${h}: duck + floating insect stickers, ${lost} withered plants, full healthy-plant reward, replant and EN/VI pass`);
 }
 const pixels=JSON.parse(JSON.parse(ab('eval',`(async()=>JSON.stringify(await window.__verifyAnimalDepth()))()`)));
 assert.deepEqual(pixels,[[[255,0,0,255],[0,0,255,255]],[[255,0,0,255],[255,0,0,255]]],'closer building alpha hides animals; transparent gutters and foreground animals remain visible');
 ab('set','media','light','reduced-motion');ab('wait','--fn',`matchMedia('(prefers-reduced-motion: reduce)').matches`);ab('eval','new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))');const top=read(`document.querySelector('[data-garden-status]').style.top`);ab('screenshot',`${out}/reduced-motion.png`);assert.equal(read(`document.querySelector('[data-garden-status]').style.top`),top);
 console.log('Animal/building alpha occlusion and reduced-motion status indicators pass');
}catch(error){console.error(ab('snapshot','-i'));console.error(ab('console'));throw error;}finally{ab('close');}
