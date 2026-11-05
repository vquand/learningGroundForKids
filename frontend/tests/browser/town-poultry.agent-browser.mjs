import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {pickLakeObject} from './lake-map-pick.mjs';
const session=`lake-poultry-${process.pid}`,base=process.env.LAKE_BROWSER_URL??'http://127.0.0.1:5186/tests/browser/town-lake-harness.html',out='/tmp/town-poultry';mkdirSync(out,{recursive:true});
const ab=(...args)=>execFileSync('agent-browser',['--session',session,...args],{encoding:'utf8',timeout:55000,maxBuffer:8*1024*1024,env:{...process.env,AGENT_BROWSER_DEFAULT_TIMEOUT:'45000'}});
const read=code=>{const result=JSON.parse(ab('eval',`JSON.stringify(${code})`));return typeof result==='string'?JSON.parse(result):result;};
function ref(role,name){const snapshot=ab('snapshot','-i'),line=snapshot.split('\n').find(l=>l.includes(`- ${role} "${name}"`));assert.ok(line,snapshot);return '@'+/ref=(e\d+)/.exec(line)[1];}
function click(name){ab('wait','--fn',`[...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')??b.textContent).trim()===${JSON.stringify(name)}&&!b.disabled)`);ab('click',ref('button',name));ab('snapshot','-i');}
function select(id){pickLakeObject({ab,read,click},id);}
function fits(){assert.equal(read(`document.documentElement.scrollHeight<=innerHeight+1&&document.documentElement.scrollWidth<=innerWidth+1`),true);assert.deepEqual(read(`(()=>{const root=document.querySelector('dialog[open]')??document;return [...root.querySelectorAll('button,select')].filter(e=>e.checkVisibility()).filter(e=>{const r=e.getBoundingClientRect();return r.left<0||r.top<0||r.right>innerWidth+1||r.bottom>innerHeight+1}).map(e=>e.getAttribute('aria-label')??e.textContent)})()`),[]);}
const stamina=()=>read(`Number(document.querySelector('.town-storage strong').textContent)`);
try{
 for(const [width,height]of [[1366,768],[1024,768],[1180,820]]){
  ab('open',base+'?poultry=1');ab('set','viewport',String(width),String(height));ab('snapshot','-i');ab('wait','--fn',`document.querySelector('.town-map-screen')?.getAttribute('aria-busy')==='false'&&document.querySelector('[data-lake-scene] canvas')?.width>100`);click('Center map');
  select('chickens');fits();ab('screenshot',`${out}/chicken-range-${width}.png`);assert.match(ab('get','text','.town-view-panel'),/Eggs · 2\/24/);assert.match(ab('get','text','.town-view-panel'),/8 eggs per day/);fits();
  const before=stamina();click('Harvest eggs');ab('wait','--fn',`Number(document.querySelector('.town-storage strong').textContent)===${before+4}`);assert.equal(stamina(),before+4);assert.equal(read(`document.querySelector('button[aria-label="Harvest eggs"]').disabled`),true);
  click('Build');click('Visit friends');fits();click('Visit Robin’s town');ab('wait','--fn',`document.querySelector('.town-visit-owner')?.textContent==='Robin'`);fits();click('Visit Robin’s lake');ab('wait','--fn',`document.querySelector('.town-name-heading h1')?.textContent==="Robin's Sunny lake"`);ab('snapshot','-i');
  assert.equal(read(`document.querySelectorAll('.town-visit-button,.town-map-friends').length`),1);assert.equal(read(`document.querySelector('.town-map-screen').dataset.editing`),'false');assert.equal(read(`document.querySelector('.town-edit-toggle').disabled`),true);assert.equal(read(`!!document.querySelector('button[aria-label="Change lake name"]')`),false);
  click('Follow the river back to Town');ab('wait','--fn',`document.querySelector('.town-visit-owner')?.textContent==='Robin'`);click('Visit friends');click('Back to my town');ab('wait','--fn',`!!document.querySelector('.town-map-screen .town-canvas')`);click('Visit your lake');ab('wait','--fn',`document.querySelector('.town-name-heading h1')?.textContent==="Mika's Sunny lake"`);assert.equal(read(`document.querySelector('.town-map-screen').dataset.editing`),'true','own Build mode survives the visit');click('Done editing');
  select('chickens');click('Change interface language');click('Tiếng Việt');assert.match(ab('get','text','.town-view-panel'),/Trứng/);fits();ab('screenshot',`${out}/coop-vietnamese-${width}.png`);click('Đổi ngôn ngữ giao diện');click('English');
  assert.equal(ab('errors').trim(),'');assert.doesNotMatch(ab('console'),/\[error\]/);console.log(`${width}×${height}: coop eggs/reward, private friend lake, persistent Build state and Vietnamese pass`);
 }
}catch(error){console.error(ab('snapshot','-i'));console.error(ab('console'));console.error(read(`({commands:window.__lakeCommands,visits:window.__lakeFixtureState().maps.lake.duckVisits,active:window.__lakeFixtureState().maps.lake.activeSeconds,focused:document.hasFocus()})`));throw error;}finally{ab('close');}
